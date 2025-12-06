/**
 * DTO para request de reset de contraseña
 */
export class ResetPasswordRequest {
  constructor({ token, newPassword }) {
    this.token = token;
    this.newPassword = newPassword;
  }
}

