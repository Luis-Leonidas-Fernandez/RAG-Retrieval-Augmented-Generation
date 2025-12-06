import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let redisClient = null;
let isRedisEnabled = false;

/**
 * Inicializar conexión a Redis
 */
export const initRedis = async () => {
  const cacheEnabled = process.env.CACHE_ENABLED !== "false";
  
  if (!cacheEnabled) {
    console.log("[Redis] Caché deshabilitado en configuración");
    return null;
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true, // Conectar solo cuando sea necesario
    });

    // Manejar eventos de conexión
    redisClient.on("connect", () => {
      console.log("[Redis] Conectando...");
    });

    redisClient.on("ready", () => {
      console.log("[Redis] Conexión establecida correctamente");
      isRedisEnabled = true;
    });

    redisClient.on("error", (err) => {
      // Ignorar errores si aún no está conectado (se manejan en lazyConnect)
      if (redisClient.status === "ready" || redisClient.status === "connecting") {
        console.warn("[Redis] Error de conexión:", err.message);
        console.warn("[Redis] Continuando en modo degradado (sin caché)");
        isRedisEnabled = false;
      }
    });

    redisClient.on("close", () => {
      console.log("[Redis] Conexión cerrada");
      isRedisEnabled = false;
    });

    redisClient.on("reconnecting", () => {
      console.log("[Redis] Reconectando...");
    });

    // Intentar conectar (con lazyConnect, esto es opcional pero útil para verificar)
    try {
      await redisClient.connect();
    } catch (err) {
      console.warn("[Redis] No se pudo conectar. Modo degradado activado:", err.message);
      isRedisEnabled = false;
      // Continuar sin Redis - la aplicación funcionará en modo degradado
    }

    return redisClient;
  } catch (error) {
    console.warn("[Redis] Error al inicializar Redis. Modo degradado activado:", error.message);
    isRedisEnabled = false;
    return null;
  }
};

/**
 * Obtener cliente Redis (puede ser null si no está disponible)
 */
export const getRedisClient = () => {
  return redisClient;
};

/**
 * Verificar si Redis está habilitado y conectado
 */
export const isRedisAvailable = () => {
  return (
    isRedisEnabled &&
    redisClient &&
    (redisClient.status === "ready" || redisClient.status === "connect")
  );
};

/**
 * Cerrar conexión Redis
 */
export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isRedisEnabled = false;
    console.log("[Redis] Conexión cerrada");
  }
};

