/**
 * Interface para servicio de email
 * Define el contrato que deben cumplir las implementaciones
 */
export class IEmailService {
  /**
   * Envía un email de verificación
   * @param {string} email - Email del destinatario
   * @param {string} name - Nombre del destinatario
   * @param {string} token - Token de verificación
   * @returns {Promise<void>}
   */
  async sendVerificationEmail(email, name, token) {
    throw new Error("Method not implemented");
  }

  /**
   * Envía un email de reset de contraseña
   * @param {string} email - Email del destinatario
   * @param {string} name - Nombre del destinatario
   * @param {string} token - Token de reset de contraseña
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(email, name, token) {
    throw new Error("Method not implemented");
  }
}

