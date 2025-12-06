/**
 * DTO para request de registro de usuario
 */
export class RegisterRequest {
  constructor({ email, password, name, tenantSlug }) {
    this.email = email;
    this.password = password;
    this.name = name;
    this.tenantSlug = tenantSlug;
  }
}

