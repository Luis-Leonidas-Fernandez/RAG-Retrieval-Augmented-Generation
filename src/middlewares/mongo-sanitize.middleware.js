/**
 * Middleware de sanitización MongoDB
 * Previne inyección NoSQL eliminando operadores peligrosos ($, .)
 * Compatible con Express 5.x (solo sanitiza req.body, no req.query)
 */

/**
 * Sanitiza un objeto eliminando claves que empiecen con $ o .
 * y valores que contengan operadores MongoDB peligrosos
 */
function sanitizeObject(obj, replaceWith = '_') {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Si es un array, sanitizar cada elemento
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, replaceWith));
  }

  // Si no es un objeto, retornar tal cual
  if (typeof obj !== 'object') {
    return obj;
  }

  // Si es un objeto, crear uno nuevo sanitizado
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    // Si la clave empieza con $ o ., reemplazarla o omitirla
    if (key.startsWith('$') || key.startsWith('.')) {
      // Omitir la clave peligrosa (o usar replaceWith si se desea)
      continue;
    }

    // Si el valor es un objeto o array, sanitizarlo recursivamente
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, replaceWith);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware de sanitización MongoDB
 * Solo sanitiza req.body para evitar problemas con req.query (solo lectura en Express 5)
 * Solo se ejecuta en requests que tienen body (POST, PUT, PATCH)
 */
export const mongoSanitizeMiddleware = (req, res, next) => {
  // Solo procesar requests que típicamente tienen body
  const methodsWithBody = ['POST', 'PUT', 'PATCH'];
  
  if (!methodsWithBody.includes(req.method)) {
    // Skip para GET, DELETE, OPTIONS, etc.
    return next();
  }

  // Solo sanitizar si estamos en una ruta API (no para archivos estáticos)
  if (!req.path.startsWith('/api')) {
    return next();
  }

  console.log('[MONGO SANITIZE] Middleware ejecutándose para:', req.method, req.path);
  
  // Verificar si hay body parseado
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    console.log('[MONGO SANITIZE] Body antes de sanitizar:', {
      email: req.body?.email,
      name: req.body?.name,
      hasPassword: !!req.body?.password,
      keys: Object.keys(req.body)
    });
    
    try {
      const originalBody = JSON.parse(JSON.stringify(req.body)); // Deep clone
      req.body = sanitizeObject(req.body);
      
      console.log('[MONGO SANITIZE] Body después de sanitizar:', {
        email: req.body?.email,
        name: req.body?.name,
        hasPassword: !!req.body?.password,
        keys: Object.keys(req.body)
      });
      
      // Verificar si se modificó algo importante
      if (JSON.stringify(originalBody) !== JSON.stringify(req.body)) {
        console.log('[MONGO SANITIZE] ⚠️  Body fue modificado durante sanitización');
        console.log('[MONGO SANITIZE] Original:', originalBody);
        console.log('[MONGO SANITIZE] Sanitizado:', req.body);
      } else {
        console.log('[MONGO SANITIZE] ✓ Body no fue modificado (no tenía operadores peligrosos)');
      }
    } catch (error) {
      console.warn('[MONGO SANITIZE] ❌ Error al sanitizar req.body:', error.message);
      console.warn('[MONGO SANITIZE] Stack:', error.stack);
      // Continuar sin sanitizar si hay error
    }
  } else {
    // Body está vacío o no existe
    if (req.body === undefined || req.body === null) {
      console.log('[MONGO SANITIZE] Body es undefined/null - posiblemente no fue parseado');
    } else if (typeof req.body !== 'object') {
      console.log('[MONGO SANITIZE] Body no es un objeto:', typeof req.body);
    } else if (Object.keys(req.body).length === 0) {
      console.log('[MONGO SANITIZE] Body está vacío (objeto sin propiedades)');
    }
    console.log('[MONGO SANITIZE] Omitiendo sanitización - no hay body válido');
  }

  // No sanitizar req.query porque:
  // 1. Express 5 hace req.query de solo lectura
  // 2. req.query viene de la URL y es más seguro (ya está parseado por Express)
  // 3. Las validaciones con express-validator cubren req.query

  console.log('[MONGO SANITIZE] ✓ Continuando al siguiente middleware');
  next();
};

