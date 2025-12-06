import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

/**
 * Servicio de dominio para manejo de contraseñas
 * Envuelve bcrypt para operaciones de hash y comparación
 */
export class PasswordService {
  /**
   * Genera hash de una contraseña
   * @param {string} password - Contraseña en texto plano
   * @returns {Promise<string>} Hash de la contraseña
   */
  async hash(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compara una contraseña en texto plano con un hash
   * @param {string} password - Contraseña en texto plano
   * @param {string} hash - Hash de la contraseña
   * @returns {Promise<boolean>} true si coinciden, false en caso contrario
   */
  async compare(password, hash) {
    return await bcrypt.compare(password, hash);
  }
}

