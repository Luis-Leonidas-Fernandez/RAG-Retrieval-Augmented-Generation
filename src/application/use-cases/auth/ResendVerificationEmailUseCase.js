import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Caso de uso para reenviar email de verificación
 * Orquesta la lógica de negocio del proceso de reenvío de email de verificación
 */
export class ResendVerificationEmailUseCase {
  constructor(userRepository, verificationTokenService, emailService) {
    this.userRepository = userRepository;
    this.verificationTokenService = verificationTokenService;
    this.emailService = emailService;
  }

  /**
   * Ejecuta el caso de uso de reenviar email de verificación
   * @param {Object} request - Objeto con userId y tenantId
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @returns {Promise<Object>} Objeto con mensaje de éxito
   * @throws {UserNotFoundException} Si el usuario no existe o no pertenece al tenant
   */
  async execute({ userId, tenantId }) {
    // Buscar usuario por ID y tenantId
    // Necesitamos emailVerified para verificar si ya está verificado
    const user = await this.userRepository.findByIdAndTenant(userId, tenantId, {
      select: "emailVerified email name +verificationToken +verificationTokenExpires",
    });

    if (!user) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    // Si el email ya está verificado, retornar mensaje pero no enviar email
    if (user.emailVerified) {
      return {
        message: "El email ya está verificado",
        emailSent: false,
      };
    }

    // Generar nuevo token de verificación
    const tokenResult = this.verificationTokenService.generateToken();

    // Actualizar usuario con nuevo token
    const updatedUser = await this.userRepository.update(userId, {
      verificationToken: tokenResult.token,
      verificationTokenExpires: tokenResult.expiresAt,
    });

    if (!updatedUser) {
      throw new UserNotFoundException("Error al actualizar usuario");
    }

    // Enviar email de verificación (no bloqueante)
    this.emailService
      .sendVerificationEmail(updatedUser.email, updatedUser.name, tokenResult.token)
      .then((result) => {
        console.log("[RESEND VERIFICATION] ✅ Email enviado exitosamente:", result);
      })
      .catch((err) => {
        console.error("[RESEND VERIFICATION] ❌ Error al enviar email de verificación:");
        console.error("[RESEND VERIFICATION] Error completo:", err);
        console.error("[RESEND VERIFICATION] Mensaje:", err.message);
        if (err.stack) {
          console.error("[RESEND VERIFICATION] Stack:", err.stack);
        }
      });

    return {
      message: "Email de verificación reenviado correctamente",
      emailSent: true,
    };
  }
}

