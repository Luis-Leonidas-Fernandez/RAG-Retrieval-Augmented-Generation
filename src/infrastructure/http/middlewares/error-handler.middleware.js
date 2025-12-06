import { createResponse } from "../utils/response.js";

/**
 * Middleware para manejo seguro de errores
 * No expone información sensible en producción
 */
export const errorHandler = (err, req, res, next) => {
  // Log del error completo (solo en desarrollo)
  if (process.env.NODE_ENV === "development") {
    console.error("Error completo:", err);
  } else {
    // En producción, log estructurado sin información sensible
    console.error("Error:", {
      message: err.message,
      stack: err.stack?.split("\n")[0], // Solo primera línea del stack
      path: req.path,
      method: req.method,
    });
  }

  // Determinar código de estado
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Error interno del servidor";

  // Errores de validación
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Error de validación";
  }

  // Errores de MongoDB
  if (err.name === "MongoError" || err.name === "MongoServerError") {
    statusCode = 500;
    message = "Error en la base de datos";
    // No exponer detalles de MongoDB en producción
  }

  // Errores de autenticación
  if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "No autorizado";
  }

  // Respuesta de error genérica
  const errorResponse = createResponse(false, message);

  // Solo en desarrollo, agregar más detalles
  if (process.env.NODE_ENV === "development") {
    errorResponse.error = {
      details: err.message,
      stack: err.stack,
    };
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware para rutas no encontradas
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json(
    createResponse(false, `Ruta ${req.method} ${req.path} no encontrada`)
  );
};

