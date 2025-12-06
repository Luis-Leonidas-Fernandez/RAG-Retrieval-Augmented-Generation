/**
 * DTO para response de solicitud de reset de contraseña
 * Mensaje genérico por seguridad (no revela si el email existe)
 */
export class RequestPasswordResetResponse {
  constructor({ message }) {
    this.message = message;
  }
}

