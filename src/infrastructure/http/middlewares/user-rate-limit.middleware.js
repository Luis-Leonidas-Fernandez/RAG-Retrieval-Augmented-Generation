import rateLimit from "express-rate-limit";

/**
 * Función helper para logging mejorado de rate limits excedidos
 * Incluye tenantId, userId, ruta para analytics
 */
const logRateLimitExceeded = (req, limitType, limitValue) => {
  const tenantId = req.user?.tenantId || 'unknown';
  const userId = req.user?.id || 'unknown';
  const route = req.path || req.route?.path || 'unknown';
  const method = req.method || 'unknown';
  
  const logData = {
    tenantId,
    userId: limitType === 'user' ? userId : undefined, // Solo en límites por user
    route: `${method} ${route}`,
    limitType, // 'user' o 'tenant'
    limit: limitValue,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  };
  
  // Usar console.warn con estructura clara para analytics
  console.warn(`[RateLimit] ${limitType} excedido`, logData);
};

/**
 * Middleware wrapper para logging de rate limits (v7 compatible)
 * Detecta cuando se envía respuesta 429 y hace logging
 */
const createRateLimitWithLogging = (rateLimiter, limitType, getLimitValue) => {
  return async (req, res, next) => {
    let rateLimitExceeded = false;
    
    // Guardar referencias originales para interceptar
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalStatus = res.status.bind(res);
    
    // Interceptar status para detectar 429
    res.status = function(code) {
      if (code === 429) {
        rateLimitExceeded = true;
      }
      return originalStatus(code);
    };
    
    // Interceptar json para logging cuando se envía respuesta 429
    res.json = function(body) {
      if (rateLimitExceeded || res.statusCode === 429) {
        const limitValue = getLimitValue ? getLimitValue(req) : (typeof rateLimiter.max === 'function' ? rateLimiter.max(req) : rateLimiter.max);
        logRateLimitExceeded(req, limitType, limitValue);
        rateLimitExceeded = false; // Reset para evitar logging duplicado
      }
      return originalJson(body);
    };
    
    // Interceptar send para logging cuando se envía respuesta 429
    res.send = function(body) {
      if (rateLimitExceeded || res.statusCode === 429) {
        const limitValue = getLimitValue ? getLimitValue(req) : (typeof rateLimiter.max === 'function' ? rateLimiter.max(req) : rateLimiter.max);
        logRateLimitExceeded(req, limitType, limitValue);
        rateLimitExceeded = false; // Reset para evitar logging duplicado
      }
      return originalSend(body);
    };
    
    // Ejecutar rate limiter
    rateLimiter(req, res, next);
  };
};

/**
 * Rate limiting por usuario autenticado
 * Configurable por env vars con tenantId en keyGenerator
 */
const createUserRateLimit = (envVar, defaultMax, message, windowMs) => {
  const maxFromEnv = parseInt(process.env[envVar] || defaultMax.toString(), 10);
  
  const limiter = rateLimit({
    windowMs: windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: maxFromEnv,
    message: {
      ok: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Key generator: incluir tenantId para namespacing consistente
    keyGenerator: (req) => {
      if (req.user && req.user.id && req.user.tenantId) {
        return `tenant:${req.user.tenantId}:user:${req.user.id}`;
      }
      return `tenant:unknown:user:unknown`;
    },
    // Skip si el usuario es admin (opcional)
    skip: (req) => {
      return req.user && req.user.role === "admin";
    },
    // Removido onLimitReached (deprecado en v7)
  });
  
  // Envolver con logging middleware
  return createRateLimitWithLogging(limiter, 'user', () => maxFromEnv);
};

/**
 * Rate limiting por tenant
 * Configurable por env vars y tenantSettings (planes Enterprise vs Pyme)
 */
const createTenantRateLimit = (envVar, defaultMax, message, windowMs, getMaxFromSettings = null) => {
  const maxFromEnv = parseInt(process.env[envVar] || defaultMax.toString(), 10);
  
  const limiter = rateLimit({
    windowMs: windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: (req) => {
      // Si hay función para obtener max desde settings, usarla
      if (getMaxFromSettings && req.user?.tenantSettings) {
        const customMax = getMaxFromSettings(req.user.tenantSettings);
        return customMax || maxFromEnv;
      }
      return maxFromEnv;
    },
    message: {
      ok: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      if (req.user && req.user.tenantId) {
        return `tenant:${req.user.tenantId}`;
      }
      return `tenant:unknown`;
    },
    skip: (req) => {
      return req.user && req.user.role === "admin";
    },
    // Removido onLimitReached (deprecado en v7)
  });
  
  // Envolver con logging middleware
  return createRateLimitWithLogging(limiter, 'tenant', (req) => {
    if (getMaxFromSettings && req.user?.tenantSettings) {
      const customMax = getMaxFromSettings(req.user.tenantSettings);
      return customMax || maxFromEnv;
    }
    return maxFromEnv;
  });
};

/**
 * Rate limits por usuario (configurables por env)
 * Mensajes en segunda persona: "Has alcanzado el límite de X por minuto"
 */
export const ragUserRateLimit = createUserRateLimit(
  'RATE_LIMIT_RAG_USER_DEFAULT',
  100,
  "Has alcanzado el límite de consultas RAG por minuto. Por favor espera antes de hacer más consultas.",
);

export const uploadUserRateLimit = createUserRateLimit(
  'RATE_LIMIT_UPLOAD_USER_DEFAULT',
  20,
  "Has alcanzado el límite de uploads por minuto. Por favor espera antes de subir más archivos.",
);

export const processUserRateLimit = createUserRateLimit(
  'RATE_LIMIT_PROCESS_USER_DEFAULT',
  40,
  "Has alcanzado el límite de solicitudes de procesamiento por minuto. Por favor espera.",
);

export const generalUserRateLimit = createUserRateLimit(
  'RATE_LIMIT_GENERAL_USER_DEFAULT',
  200,
  "Has alcanzado el límite de solicitudes por minuto. Por favor intenta más tarde.",
);

/**
 * Rate limits por tenant (configurables por env y tenantSettings)
 * Mensajes en tercera persona organizacional: "Tu organización alcanzó el límite de X por minuto"
 */
export const ragTenantRateLimit = createTenantRateLimit(
  'RATE_LIMIT_RAG_TENANT_DEFAULT',
  500,
  "Tu organización alcanzó el límite de consultas RAG por minuto. Por favor contacta al administrador.",
  null,
  (tenantSettings) => tenantSettings?.rateLimits?.ragPerMinute || null
);

export const uploadTenantRateLimit = createTenantRateLimit(
  'RATE_LIMIT_UPLOAD_TENANT_DEFAULT',
  100,
  "Tu organización alcanzó el límite de uploads por minuto. Por favor contacta al administrador.",
  null,
  (tenantSettings) => tenantSettings?.rateLimits?.uploadPerMinute || null
);

export const processTenantRateLimit = createTenantRateLimit(
  'RATE_LIMIT_PROCESS_TENANT_DEFAULT',
  200,
  "Tu organización alcanzó el límite de solicitudes de procesamiento por minuto. Por favor contacta al administrador.",
  null,
  (tenantSettings) => tenantSettings?.rateLimits?.processPerMinute || null
);

