import jwt from "jsonwebtoken";
import { UserModel } from "../models/user.model.js";
import { createResponse } from "../utils/response.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Middleware para autenticar usuarios mediante JWT
 * Verifica el token en el header Authorization: Bearer <token>
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // 1. Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json(
        createResponse(false, "Token de autenticación requerido")
      );
    }

    // 2. Verificar y decodificar token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[AUTH] JWT_SECRET no está configurado");
      return res.status(500).json(
        createResponse(false, "Error de configuración del servidor")
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json(
          createResponse(false, "Token expirado. Por favor inicia sesión nuevamente")
        );
      } else if (error.name === "JsonWebTokenError") {
        return res.status(401).json(
          createResponse(false, "Token inválido")
        );
      }
      throw error;
    }

    // 3. Buscar usuario en la base de datos (solo campos necesarios)
    // Usar .lean() para retornar objeto JavaScript plano (menos memoria)
    const user = await UserModel.findById(decoded.id)
      .select("_id email name role")
      .lean();
    
    if (!user) {
      return res.status(401).json(
        createResponse(false, "Usuario no encontrado")
      );
    }

    // 4. Agregar usuario a la request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("[AUTH] Error en autenticación:", error);
    return res.status(500).json(
      createResponse(false, "Error interno del servidor durante la autenticación")
    );
  }
};

/**
 * Middleware opcional para verificar rol de administrador
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      createResponse(false, "Autenticación requerida")
    );
  }

  if (req.user.role !== "admin") {
    return res.status(403).json(
      createResponse(false, "Acceso denegado. Se requieren permisos de administrador")
    );
  }

  next();
};

