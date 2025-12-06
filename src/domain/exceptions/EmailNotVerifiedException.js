import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando el email del usuario no está verificado
 */
export class EmailNotVerifiedException extends DomainException {
  constructor(message = "Por favor verifica tu email antes de iniciar sesión") {
    super(message);
  }
}

