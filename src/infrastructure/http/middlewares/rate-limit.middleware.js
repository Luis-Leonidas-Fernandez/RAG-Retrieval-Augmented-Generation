import rateLimit from "express-rate-limit";

// Rate limit general: 200 req/min por IP (primera línea de defensa, más suave)
export const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10), // 1 minuto
  max: 200, // 200 requests por ventana (aumentado para ser menos restrictivo)
  message: {
    ok: false,
    message: "Demasiadas solicitudes desde esta IP, por favor intenta más tarde.",
  },
  standardHeaders: true, // Retorna info de rate limit en headers
  legacyHeaders: false,
});

// Rate limit estricto para rutas de autenticación: 5 req/min por IP
export const authRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  max: 5, // 5 requests por minuto (muy estricto para prevenir ataques)
  message: {
    ok: false,
    message: "Demasiados intentos de autenticación. Por favor espera antes de intentar nuevamente.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

