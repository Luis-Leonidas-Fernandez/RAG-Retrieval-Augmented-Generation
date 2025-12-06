import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Servicio de dominio para generación de tokens de reset de contraseña
 */
export class PasswordResetTokenService {
  /**
   * Genera un token de reset de contraseña y su fecha de expiración
   * @returns {{ token: string, expiresAt: Date }} Token y fecha de expiración
   */
  generateToken() {
    const token = crypto.randomBytes(32).toString("hex"); // 64 caracteres

    // Parsear PASSWORD_RESET_EXPIRY (formato: "1h", "30m", "900s")
    const expiryStr = process.env.PASSWORD_RESET_EXPIRY || "1h";
    let expiryMs = 3600000; // Default: 1 hora en milisegundos

    if (expiryStr.endsWith("h")) {
      const hours = parseInt(expiryStr.replace("h", ""), 10);
      expiryMs = hours * 60 * 60 * 1000;
    } else if (expiryStr.endsWith("m")) {
      const minutes = parseInt(expiryStr.replace("m", ""), 10);
      expiryMs = minutes * 60 * 1000;
    } else if (expiryStr.endsWith("s")) {
      const seconds = parseInt(expiryStr.replace("s", ""), 10);
      expiryMs = seconds * 1000;
    }

    const expiresAt = new Date(Date.now() + expiryMs);

    return { token, expiresAt };
  }
}

