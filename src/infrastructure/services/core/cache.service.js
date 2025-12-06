import crypto from "crypto";
import { getRedisClient, isRedisAvailable } from "../../config/redis.js";
import dotenv from "dotenv";

dotenv.config();

// TTLs por defecto
const DEFAULT_TTL_EMBEDDING = parseInt(
  process.env.CACHE_TTL_EMBEDDING || "604800",
  10
); // 7 días en segundos

const DEFAULT_TTL_RAG_RESPONSE = parseInt(
  process.env.CACHE_TTL_RAG_RESPONSE || "86400",
  10
); // 24 horas en segundos

/**
 * Generar hash SHA256 de un string
 */
export const generateHash = (text) => {
  return crypto.createHash("sha256").update(text).digest("hex");
};

/**
 * Generar key de caché consistente
 */
export const generateCacheKey = (prefix, ...parts) => {
  const keyParts = [prefix, ...parts];
  return keyParts.join(":");
};

/**
 * Obtener valor del caché
 */
export const getCache = async (key) => {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redisClient = getRedisClient();
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    return null;
  } catch (error) {
    console.warn(`[Cache] Error al obtener key "${key}":`, error.message);
    return null; // Fallar silenciosamente
  }
};

/**
 * Guardar valor en caché
 */
export const setCache = async (key, value, ttl = null) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redisClient = getRedisClient();
    const serializedValue = JSON.stringify(value);

    if (ttl) {
      await redisClient.setex(key, ttl, serializedValue);
    } else {
      await redisClient.set(key, serializedValue);
    }

    return true;
  } catch (error) {
    console.warn(`[Cache] Error al guardar key "${key}":`, error.message);
    return false; // Fallar silenciosamente
  }
};

/**
 * Eliminar valor del caché
 */
export const deleteCache = async (key) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redisClient = getRedisClient();
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.warn(`[Cache] Error al eliminar key "${key}":`, error.message);
    return false;
  }
};

/**
 * Eliminar múltiples keys que coincidan con un patrón usando SCAN (no bloqueante)
 * Más eficiente que KEYS para evitar bloqueos y reducir uso de memoria
 */
export const deleteCachePattern = async (pattern) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redisClient = getRedisClient();
    const keysToDelete = [];
    let cursor = '0';
    const SCAN_COUNT = 100; // Keys a escanear por iteración

    // Iterar con SCAN para encontrar todas las keys que coinciden con el patrón
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', SCAN_COUNT
      );
      
      cursor = nextCursor;
      
      // Filtrar keys que realmente coinciden con el patrón
      // (SCAN puede devolver keys parciales, mejor verificar con regex)
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      const matchingKeys = keys.filter(key => regex.test(key));
      
      keysToDelete.push(...matchingKeys);
      
      // Eliminar en lotes para evitar acumulación excesiva en memoria
      // ioredis permite hasta ~1000 keys en DEL, procesamos en lotes de 500
      if (keysToDelete.length >= 500) {
        const batchToDelete = keysToDelete.splice(0, 500);
        await redisClient.del(...batchToDelete);
        console.log(`[Cache] Eliminadas ${batchToDelete.length} keys (lote parcial) con patrón "${pattern}"`);
      }
    } while (cursor !== '0'); // '0' significa que terminamos

    // Eliminar keys restantes
    if (keysToDelete.length > 0) {
      await redisClient.del(...keysToDelete);
      console.log(`[Cache] Eliminadas ${keysToDelete.length} keys (lote final) con patrón "${pattern}"`);
    }

    const totalDeleted = keysToDelete.length;
    if (totalDeleted === 0) {
      console.log(`[Cache] No se encontraron keys con patrón "${pattern}"`);
    }

    return true;
  } catch (error) {
    console.warn(`[Cache] Error al eliminar patrón "${pattern}":`, error.message);
    return false;
  }
};

/**
 * Obtener embedding del caché (multi-tenant)
 */
export const getCachedEmbedding = async (tenantId, question) => {
  const questionHash = generateHash(question);
  const key = generateCacheKey("embedding", tenantId, questionHash);
  return await getCache(key);
};

/**
 * Guardar embedding en caché (multi-tenant)
 */
export const setCachedEmbedding = async (tenantId, question, embedding) => {
  const questionHash = generateHash(question);
  const key = generateCacheKey("embedding", tenantId, questionHash);
  return await setCache(key, embedding, DEFAULT_TTL_EMBEDDING);
};

/**
 * Obtener respuesta RAG completa del caché (multi-tenant)
 */
export const getCachedRagResponse = async (tenantId, pdfId, question) => {
  const questionHash = generateHash(question);
  const key = generateCacheKey("rag", tenantId, pdfId, questionHash);
  return await getCache(key);
};

/**
 * Guardar respuesta RAG completa en caché (multi-tenant)
 */
export const setCachedRagResponse = async (tenantId, pdfId, question, response) => {
  const questionHash = generateHash(question);
  const key = generateCacheKey("rag", tenantId, pdfId, questionHash);
  return await setCache(key, response, DEFAULT_TTL_RAG_RESPONSE);
};

/**
 * Invalidar todas las respuestas RAG de un PDF (multi-tenant)
 */
export const invalidateRagCacheForPdf = async (tenantId, pdfId) => {
  const pattern = generateCacheKey("rag", tenantId, pdfId, "*");
  return await deleteCachePattern(pattern);
};

