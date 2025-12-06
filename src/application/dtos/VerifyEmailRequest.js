/**
 * DTO para request de verificación de email
 */
export class VerifyEmailRequest {
  constructor({ token }) {
    this.token = token;
  }
}

