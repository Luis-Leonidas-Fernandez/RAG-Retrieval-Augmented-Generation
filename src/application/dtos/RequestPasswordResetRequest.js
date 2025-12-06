/**
 * DTO para request de solicitud de reset de contraseña
 */
export class RequestPasswordResetRequest {
  constructor({ email, tenantSlug }) {
    this.email = email;
    this.tenantSlug = tenantSlug;
  }
}

