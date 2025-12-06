import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando el email ya está registrado en el tenant
 */
export class EmailAlreadyExistsException extends DomainException {
  constructor(message = "El email ya está registrado en este tenant") {
    super(message);
  }
}

