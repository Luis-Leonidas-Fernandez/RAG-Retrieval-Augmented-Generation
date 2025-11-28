import rateLimit from "express-rate-limit";

/**
 * Rate limiting que combina IP y usuario
 * Si el usuario está autenticado, usa su ID como key
 * Si no, usa la IP
 */
const createUserRateLimit = (max, message, windowMs) => {
  return rateLimit({
    windowMs: windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max,
    message: {
      ok: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Key generator: siempre usa user.id porque estas rutas requieren authenticateToken
    keyGenerator: (req) => {
      // Todas las rutas que usan estos rate limits requieren autenticación
      // por lo que req.user siempre existirá
      if (req.user && req.user.id) {
        return `user:${req.user.id}`;
      }
      // Fallback de seguridad (no debería ejecutarse nunca)
      return `user:unknown`;
    },
    // Skip si el usuario es admin (opcional)
    skip: (req) => {
      return req.user && req.user.role === "admin";
    },
  });
};

/**
 * Rate limit para usuarios autenticados - RAG queries
 * Límites más generosos para usuarios autenticados
 */
export const ragUserRateLimit = createUserRateLimit(
  100, // 100 requests por minuto para usuarios autenticados (vs 60 por IP)
  "Demasiadas consultas RAG. Por favor espera antes de hacer más consultas.",
);

/**
 * Rate limit para usuarios autenticados - Uploads
 */
export const uploadUserRateLimit = createUserRateLimit(
  20, // 20 uploads por minuto para usuarios autenticados (vs 10 por IP)
  "Demasiados archivos subidos. Por favor espera antes de subir más archivos.",
);

/**
 * Rate limit para usuarios autenticados - Procesamiento
 */
export const processUserRateLimit = createUserRateLimit(
  40, // 40 requests por minuto para usuarios autenticados (vs 20 por IP)
  "Demasiadas solicitudes de procesamiento. Por favor espera.",
);

/**
 * Rate limit general para usuarios autenticados
 */
export const generalUserRateLimit = createUserRateLimit(
  200, // 200 requests por minuto para usuarios autenticados (vs 100 por IP)
  "Demasiadas solicitudes. Por favor intenta más tarde.",
);

/**
 * NOTA: combinedRateLimit ya no se usa.
 * Las rutas protegidas siempre requieren autenticación (authenticateToken),
 * por lo que siempre usaremos rate limits por usuario directamente.
 * Esto simplifica el código y elimina la doble aplicación de rate limits.
 */

