import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando el token de reset de contraseña es inválido o expirado
 */
export class PasswordResetTokenInvalidException extends DomainException {
  constructor(message = "Token inválido o expirado") {
    super(message);
  }
}

