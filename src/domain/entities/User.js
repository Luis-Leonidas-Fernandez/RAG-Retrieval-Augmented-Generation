/**
 * Entidad de dominio User
 */
export class User {
  constructor({ id, tenantId, email, name, role, emailVerified, passwordHash }) {
    this.id = id;
    this.tenantId = tenantId;
    this.email = email;
    this.name = name;
    this.role = role || "user";
    this.emailVerified = emailVerified || false;
    this.passwordHash = passwordHash;
  }

  /**
   * Serializa la entidad a JSON, excluyendo información sensible
   */
  toJSON() {
    const obj = {
      id: this.id,
      tenantId: this.tenantId,
      email: this.email,
      name: this.name,
      role: this.role,
      emailVerified: this.emailVerified,
    };
    return obj;
  }
}

