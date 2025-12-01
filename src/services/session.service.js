import crypto from "crypto";
import { getRedisClient, isRedisAvailable } from "../config/redis.js";
import { LoginHistoryModel } from "../models/login-history.model.js";

const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || "24", 10);
const SESSION_CLEANUP_INTERVAL_MINUTES = parseInt(
  process.env.SESSION_CLEANUP_INTERVAL_MINUTES || "15",
  10
);

/**
 * Generar hash SHA256 del token JWT para usar como ID único
 */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Obtener key de sesión en Redis (con tenantId)
 */
function getSessionKey(tenantId, tokenId) {
  return `session:${tenantId}:${tokenId}`;
}

/**
 * Obtener key de set de sesiones por usuario (con tenantId)
 */
function getUserSessionsKey(tenantId, userId) {
  return `user_sessions:${tenantId}:${userId}`;
}

/**
 * Crear sesión activa en Redis
 */
export async function createActiveSession(tenantId, userId, token, req) {
  if (!isRedisAvailable()) {
    console.warn("[Session] Redis no disponible, no se puede crear sesión activa");
    return null;
  }

  const tokenId = hashToken(token);
  const key = getSessionKey(tenantId, tokenId);
  const userSetKey = getUserSessionsKey(tenantId, userId);

  const now = new Date().toISOString();
  const ttlSeconds = SESSION_EXPIRY_HOURS * 3600;

  const sessionData = {
    tenantId,
    userId,
    tokenId,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    userAgent: req.headers["user-agent"] || "",
    deviceInfo: extractDeviceInfo(req.headers["user-agent"] || ""),
    createdAt: now,
    lastActivityAt: now,
  };

  const redis = getRedisClient();

  // SET + SADD en pipeline
  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(sessionData), "EX", ttlSeconds);
  pipeline.sadd(userSetKey, tokenId);
  await pipeline.exec();

  // Guardar historial de login (async, no bloqueante)
  LoginHistoryModel.create({
    tenantId,
    userId,
    tokenId,
    ipAddress: sessionData.ipAddress,
    userAgent: sessionData.userAgent,
    deviceInfo: sessionData.deviceInfo,
    loggedInAt: new Date(),
    wasActive: true,
  }).catch((err) => console.error("[Session] Error al guardar historial de login:", err));

  return { tokenId, session: sessionData };
}

/**
 * Verificar si sesión está activa
 */
export async function isSessionActive(tenantId, tokenId) {
  if (!isRedisAvailable()) {
    return null; // Modo degradado: no verificar
  }

  const key = getSessionKey(tenantId, tokenId);
  const redis = getRedisClient();
  const data = await redis.get(key);
  return !!data;
}

/**
 * Obtener sesión activa
 */
export async function getActiveSession(tenantId, tokenId) {
  if (!isRedisAvailable()) {
    return null;
  }

  const key = getSessionKey(tenantId, tokenId);
  const redis = getRedisClient();
  const data = await redis.get(key);

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch (err) {
    console.error("[Session] Error al parsear sesión:", err);
    return null;
  }
}

/**
 * Actualizar última actividad de sesión (no bloqueante)
 */
export async function updateSessionActivity(tenantId, tokenId) {
  if (!isRedisAvailable()) {
    return false;
  }

  const key = getSessionKey(tenantId, tokenId);
  const redis = getRedisClient();

  try {
    const data = await redis.get(key);
    if (!data) return false;

    const session = JSON.parse(data);
    session.lastActivityAt = new Date().toISOString();

    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.set(key, JSON.stringify(session), "EX", ttl);
    }

    return true;
  } catch (err) {
    console.error("[Session] Error al actualizar actividad:", err);
    return false;
  }
}

/**
 * Desactivar sesión
 */
export async function deactivateSession(tenantId, userId, tokenId) {
  if (!isRedisAvailable()) {
    return false;
  }

  const key = getSessionKey(tenantId, tokenId);
  const userSetKey = getUserSessionsKey(tenantId, userId);
  const redis = getRedisClient();

  const pipeline = redis.pipeline();
  pipeline.del(key);
  pipeline.srem(userSetKey, tokenId);
  await pipeline.exec();

  // Actualizar historial (loggedOutAt, sessionDuration)
  const now = new Date();
  try {
    const history = await LoginHistoryModel.findOne({ tenantId, tokenId }).sort({
      loggedInAt: -1,
    });

    if (history && !history.loggedOutAt) {
      const minutes = Math.round((now - history.loggedInAt) / 60000);
      history.loggedOutAt = now;
      history.sessionDuration = minutes;
      await history.save();
    }
  } catch (err) {
    console.error("[Session] Error al actualizar historial de logout:", err);
  }

  return true;
}

/**
 * Obtener todas las sesiones activas de un usuario (optimizado con Sets)
 */
export async function getActiveSessionsByUser(tenantId, userId) {
  if (!isRedisAvailable()) {
    return [];
  }

  const userSetKey = getUserSessionsKey(tenantId, userId);
  const redis = getRedisClient();

  try {
    const tokenIds = await redis.smembers(userSetKey);
    if (!tokenIds || tokenIds.length === 0) return [];

    // Pipeline para obtener todas las sesiones
    const pipeline = redis.pipeline();
    tokenIds.forEach((tokenId) => {
      const key = getSessionKey(tenantId, tokenId);
      pipeline.get(key);
    });

    const results = await pipeline.exec();
    const sessions = [];

    // Limpiar tokenIds huérfanos del Set
    const orphanedTokenIds = [];

    results.forEach(([err, val], index) => {
      if (err || !val) {
        orphanedTokenIds.push(tokenIds[index]);
        return;
      }

      try {
        const session = JSON.parse(val);
        sessions.push(session);
      } catch (parseErr) {
        orphanedTokenIds.push(tokenIds[index]);
      }
    });

    // Remover huérfanos del Set
    if (orphanedTokenIds.length > 0) {
      await redis.srem(userSetKey, ...orphanedTokenIds);
    }

    return sessions;
  } catch (err) {
    console.error("[Session] Error al obtener sesiones del usuario:", err);
    return [];
  }
}

/**
 * Desactivar todas las sesiones de un usuario
 */
export async function deactivateAllUserSessions(tenantId, userId) {
  if (!isRedisAvailable()) {
    return false;
  }

  const userSetKey = getUserSessionsKey(tenantId, userId);
  const redis = getRedisClient();

  try {
    const tokenIds = await redis.smembers(userSetKey);
    if (!tokenIds || tokenIds.length === 0) return true;

    const pipeline = redis.pipeline();
    tokenIds.forEach((tokenId) => {
      const key = getSessionKey(tenantId, tokenId);
      pipeline.del(key);
    });
    pipeline.del(userSetKey);

    await pipeline.exec();

    // Actualizar historial para todas las sesiones
    const now = new Date();
    await LoginHistoryModel.updateMany(
      { tenantId, userId, loggedOutAt: null },
      {
        $set: {
          loggedOutAt: now,
          sessionDuration: { $divide: [{ $subtract: [now, "$loggedInAt"] }, 60000] },
        },
      }
    ).catch((err) => console.error("[Session] Error al actualizar historial:", err));

    return true;
  } catch (err) {
    console.error("[Session] Error al desactivar todas las sesiones:", err);
    return false;
  }
}

/**
 * Limpiar Sets huérfanos de sesiones expiradas
 */
export async function cleanupExpiredUserSessions(tenantId) {
  if (!isRedisAvailable()) {
    return { cleaned: 0, errors: [] };
  }

  const redis = getRedisClient();
  let totalCleaned = 0;
  const errors = [];

  try {
    // Obtener todas las keys user_sessions:{tenantId}:*
    const sessionKeys = [];
    let cursor = "0";

    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        `user_sessions:${tenantId}:*`,
        "COUNT",
        100
      );
      cursor = result[0];
      sessionKeys.push(...result[1]);
    } while (cursor !== "0");

    // Para cada set, verificar y limpiar huérfanos
    for (const sessionKey of sessionKeys) {
      try {
        const tokenIds = await redis.smembers(sessionKey);

        // Pipeline para verificar existencia de cada sesión
        const pipeline = redis.pipeline();
        tokenIds.forEach((tokenId) => {
          pipeline.exists(getSessionKey(tenantId, tokenId));
        });
        const results = await pipeline.exec();

        // Verificar cuáles no existen y removerlos
        const pipelineRemove = redis.pipeline();
        let cleanedInSet = 0;

        results.forEach(([err, exists], index) => {
          if (!err && !exists) {
            pipelineRemove.srem(sessionKey, tokenIds[index]);
            cleanedInSet++;
          }
        });

        if (cleanedInSet > 0) {
          await pipelineRemove.exec();
          totalCleaned += cleanedInSet;
        }
      } catch (err) {
        errors.push({ key: sessionKey, error: err.message });
      }
    }

    if (totalCleaned > 0) {
      console.log(`[Session Cleanup] Limpiados ${totalCleaned} tokenIds huérfanos para tenant ${tenantId}`);
    }

    return { cleaned: totalCleaned, errors };
  } catch (err) {
    console.error("[Session Cleanup] Error general:", err.message);
    return { cleaned: totalCleaned, errors: [...errors, { error: err.message }] };
  }
}

/**
 * Guardar historial de login
 */
export async function saveLoginHistory(tenantId, userId, tokenId, req) {
  try {
    await LoginHistoryModel.create({
      tenantId,
      userId,
      tokenId,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"] || "",
      deviceInfo: extractDeviceInfo(req.headers["user-agent"] || ""),
      loggedInAt: new Date(),
      wasActive: true,
    });
  } catch (err) {
    console.error("[Session] Error al guardar historial de login:", err);
  }
}

/**
 * Guardar historial de logout
 */
export async function saveLogoutHistory(tenantId, tokenId, sessionDuration) {
  try {
    const history = await LoginHistoryModel.findOne({ tenantId, tokenId }).sort({
      loggedInAt: -1,
    });

    if (history && !history.loggedOutAt) {
      history.loggedOutAt = new Date();
      history.sessionDuration = sessionDuration;
      await history.save();
    }
  } catch (err) {
    console.error("[Session] Error al guardar historial de logout:", err);
  }
}

/**
 * Obtener historial de logins
 */
export async function getLoginHistory(tenantId, userId, limit = 50) {
  try {
    return await LoginHistoryModel.find({ tenantId, userId })
      .sort({ loggedInAt: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error("[Session] Error al obtener historial:", err);
    return [];
  }
}

/**
 * Extraer info del dispositivo desde userAgent
 */
function extractDeviceInfo(userAgent) {
  if (!userAgent) return "";

  // Extracción simple (puede mejorarse con librería como 'ua-parser-js')
  const browser = userAgent.includes("Chrome")
    ? "Chrome"
    : userAgent.includes("Firefox")
    ? "Firefox"
    : userAgent.includes("Safari")
    ? "Safari"
    : "Unknown";

  const os = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Mac")
    ? "macOS"
    : userAgent.includes("Linux")
    ? "Linux"
    : userAgent.includes("Android")
    ? "Android"
    : userAgent.includes("iOS")
    ? "iOS"
    : "Unknown";

  return `${browser} on ${os}`;
}

