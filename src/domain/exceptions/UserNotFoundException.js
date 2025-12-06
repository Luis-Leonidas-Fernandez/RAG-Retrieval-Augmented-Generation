import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando un usuario no se encuentra
 */
export class UserNotFoundException extends DomainException {
  constructor(message = "Usuario no encontrado") {
    super(message);
  }
}

