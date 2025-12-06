import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando un tenant no se encuentra
 */
export class TenantNotFoundException extends DomainException {
  constructor(message = "Tenant no encontrado") {
    super(message);
  }
}

