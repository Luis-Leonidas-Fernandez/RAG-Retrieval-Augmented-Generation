import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

/**
 * Servicio de dominio para generación de tokens JWT
 */
export class TokenService {
  /**
   * Genera un token JWT de autenticación para un usuario
   * @param {Object} user - Objeto usuario con id, email, role, tenantId
   * @returns {string} Token JWT
   * @throws {Error} Si JWT_SECRET no está configurado
   */
  generateAuthToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId.toString(),
    };

    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || "24h";

    if (!secret) {
      throw new Error("JWT_SECRET no está configurado en las variables de entorno");
    }

    return jwt.sign(payload, secret, { expiresIn });
  }
}

