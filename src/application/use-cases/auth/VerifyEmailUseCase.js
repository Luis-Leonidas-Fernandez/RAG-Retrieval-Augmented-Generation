import { VerifyEmailResponse } from "../../dtos/VerifyEmailResponse.js";
import { EmailVerificationTokenInvalidException } from "../../../domain/exceptions/EmailVerificationTokenInvalidException.js";

/**
 * Caso de uso para verificación de email
 * Orquesta la lógica de negocio del proceso de verificación de email
 */
export class VerifyEmailUseCase {
  constructor(userRepository, sessionRepository, tokenService) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.tokenService = tokenService;
  }

  /**
   * Ejecuta el caso de uso de verificación de email
   * @param {VerifyEmailRequest} verifyEmailRequest - DTO con token de verificación
   * @param {Object} req - Request object de Express (para extraer IP y User-Agent en sesión)
   * @returns {Promise<VerifyEmailResponse>} DTO con token JWT y user
   * @throws {EmailVerificationTokenInvalidException} Si el token es inválido o expirado
   */
  async execute(verifyEmailRequest, req = null) {
    // 1. Buscar usuario por token de verificación (válido y no expirado)
    const user = await this.userRepository.findByVerificationToken(
      verifyEmailRequest.token
    );

    if (!user) {
      throw new EmailVerificationTokenInvalidException(
        "Token de verificación inválido o expirado"
      );
    }

    // 2. Marcar email como verificado y limpiar tokens
    const updatedUser = await this.userRepository.update(user.id, {
      emailVerified: true,
      verificationToken: undefined,
      verificationTokenExpires: undefined,
    });

    // 3. Generar JWT con TokenService
    const token = this.tokenService.generateAuthToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      tenantId: updatedUser.tenantId,
    });

    // 4. Crear sesión activa (no bloqueante)
    this.sessionRepository
      .createSession(updatedUser.tenantId, updatedUser.id, token, req)
      .catch((err) => {
        console.error("[VERIFY] Error al crear sesión activa:", err);
      });

    // 5. Retornar VerifyEmailResponse
    return new VerifyEmailResponse({
      token,
      user: updatedUser.toJSON(),
    });
  }
}

