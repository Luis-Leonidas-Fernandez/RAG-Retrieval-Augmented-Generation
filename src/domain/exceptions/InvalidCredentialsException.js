import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando las credenciales de login son inválidas
 */
export class InvalidCredentialsException extends DomainException {
  constructor(message = "Credenciales inválidas") {
    super(message);
  }
}

