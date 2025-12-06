/**
 * DTO para response de login
 */
export class LoginResponse {
  constructor({ token, user, sessionId }) {
    this.token = token;
    this.user = user;
    this.sessionId = sessionId;
  }
}

