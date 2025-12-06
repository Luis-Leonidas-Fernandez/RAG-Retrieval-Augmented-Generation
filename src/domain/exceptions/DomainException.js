/**
 * Clase base para excepciones de dominio
 */
export class DomainException extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

