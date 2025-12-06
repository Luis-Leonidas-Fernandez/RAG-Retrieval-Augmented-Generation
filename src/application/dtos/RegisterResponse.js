/**
 * DTO para response de registro de usuario
 */
export class RegisterResponse {
  constructor({ user, requiresVerification }) {
    this.user = user;
    this.requiresVerification = requiresVerification;
  }
}

