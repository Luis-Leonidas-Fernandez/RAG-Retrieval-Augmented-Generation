import jwt from "jsonwebtoken";
import { UserModel } from "../models/user.model.js";
import { TenantModel } from "../models/tenant.model.js";
import { createResponse } from "../utils/response.js";
import { isSessionActive, updateSessionActivity, hashToken } from "../services/session.service.js";
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

    // 3. Validar que JWT tenga tenantId
    if (!decoded.tenantId) {
      return res.status(401).json(
        createResponse(false, "Token inválido: falta tenantId")
      );
    }

    // 4. Buscar usuario en la base de datos (validando tenantId)
    const user = await UserModel.findOne({
      _id: decoded.id,
      tenantId: decoded.tenantId, // CRÍTICO: validar tenant
    })
      .select("_id email name role tenantId")
      .lean();
    
    if (!user) {
      return res.status(401).json(
        createResponse(false, "Usuario no encontrado o no pertenece al tenant")
      );
    }

    // 5. Cargar tenant y settings
    const tenant = await TenantModel.findById(decoded.tenantId).lean();
    if (!tenant) {
      return res.status(401).json(
        createResponse(false, "Tenant inválido")
      );
    }

    // 6. Verificar sesión activa en Redis (si está disponible)
    const tokenId = hashToken(token);
    const sessionActive = await isSessionActive(user.tenantId.toString(), tokenId);

    if (sessionActive === false) {
      // Sesión no está activa (pero Redis está disponible)
      return res.status(401).json(
        createResponse(false, "Sesión expirada o cerrada. Por favor inicia sesión nuevamente")
      );
    }

    // 7. Actualizar actividad de sesión (no bloqueante)
    if (sessionActive !== null) {
      // Redis está disponible y sesión existe
      updateSessionActivity(user.tenantId.toString(), tokenId).catch((err) => {
        console.warn("[AUTH] Error al actualizar actividad de sesión:", err);
      });
    }

    // 8. Agregar usuario y tenant a la request
    req.user = {
      id: user._id.toString(),
      tenantId: user.tenantId.toString(), // CRÍTICO: incluir tenantId
      email: user.email,
      name: user.name,
      role: user.role,
      tenantSettings: tenant.settings, // Settings del tenant
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

