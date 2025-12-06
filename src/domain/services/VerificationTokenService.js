import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Servicio de dominio para generación de tokens de verificación
 */
export class VerificationTokenService {
  /**
   * Genera un token de verificación y su fecha de expiración
   * @returns {{ token: string, expiresAt: Date }} Token y fecha de expiración
   */
  generateToken() {
    const token = crypto.randomBytes(32).toString("hex");
    
    // Parsear EMAIL_VERIFICATION_EXPIRY (formato: "24h", "1h", etc.)
    const expiryStr = process.env.EMAIL_VERIFICATION_EXPIRY || "24h";
    const expiryHours = parseInt(expiryStr.replace("h", "") || "24", 10);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    
    return { token, expiresAt };
  }
}

