/**
 * Middleware para logging de seguridad
 * Registra intentos de rate limiting y requests sospechosos
 */

/**
 * Logging de intentos de rate limiting
 */
export const logRateLimitAttempt = (req, res, next) => {
  // Este middleware se ejecuta después de rate limiter
  // rate-limiter agrega headers si se excedió el límite
  if (res.getHeader("X-RateLimit-Remaining") === "0") {
    console.warn("[SECURITY] Rate limit excedido:", {
      ip: req.ip || req.connection.remoteAddress,
      path: req.path,
      method: req.method,
      userAgent: req.get("user-agent"),
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

/**
 * Logging de requests sospechosos
 */
export const logSuspiciousRequests = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script/i, // XSS attempts
    /eval\(/i, // Code injection
    /union.*select/i, // SQL injection patterns (aunque usamos NoSQL)
    /\$where/i, // MongoDB injection
    /\$ne/i, // MongoDB operators en queries
  ];

  const requestString = JSON.stringify({
    url: req.url,
    body: JSON.stringify(req.body),
    query: JSON.stringify(req.query),
  }).toLowerCase();

  const isSuspicious = suspiciousPatterns.some((pattern) =>
    pattern.test(requestString)
  );

  if (isSuspicious) {
    console.warn("[SECURITY] Request sospechoso detectado:", {
      ip: req.ip || req.connection.remoteAddress,
      path: req.path,
      method: req.method,
      userAgent: req.get("user-agent"),
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Middleware combinado para logging de seguridad
 */
export const securityLogger = [logSuspiciousRequests, logRateLimitAttempt];

