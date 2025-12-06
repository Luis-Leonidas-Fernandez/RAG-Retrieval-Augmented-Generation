import { IEmailService } from "../../domain/services/IEmailService.js";
import {
  sendVerificationEmail as sendVerificationEmailFunction,
  sendPasswordResetEmail as sendPasswordResetEmailFunction,
} from "../services/core/email.service.js";

/**
 * Implementación de IEmailService usando el servicio de email existente
 */
export class EmailService extends IEmailService {
  /**
   * Envía un email de verificación
   * @param {string} email - Email del destinatario
   * @param {string} name - Nombre del destinatario
   * @param {string} token - Token de verificación
   * @returns {Promise<void>}
   */
  async sendVerificationEmail(email, name, token) {
    await sendVerificationEmailFunction(email, name, token);
  }

  /**
   * Envía un email de reset de contraseña
   * @param {string} email - Email del destinatario
   * @param {string} name - Nombre del destinatario
   * @param {string} token - Token de reset de contraseña
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(email, name, token) {
    await sendPasswordResetEmailFunction(email, name, token);
  }
}

