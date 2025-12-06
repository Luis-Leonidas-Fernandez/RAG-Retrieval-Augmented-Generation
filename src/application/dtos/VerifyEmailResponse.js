/**
 * DTO para response de verificación de email
 */
export class VerifyEmailResponse {
  constructor({ token, user }) {
    this.token = token;
    this.user = user;
  }
}

