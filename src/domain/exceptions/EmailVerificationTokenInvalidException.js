import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando el token de verificación de email es inválido o expirado
 */
export class EmailVerificationTokenInvalidException extends DomainException {
  constructor(message = "Token de verificación inválido o expirado") {
    super(message);
  }
}

