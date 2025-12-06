/**
 * DTO para request de login
 */
export class LoginRequest {
  constructor({ email, password, tenantSlug }) {
    this.email = email;
    this.password = password;
    this.tenantSlug = tenantSlug;
  }
}

