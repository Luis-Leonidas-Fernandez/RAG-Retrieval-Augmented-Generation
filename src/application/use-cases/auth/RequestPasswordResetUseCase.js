import { RequestPasswordResetResponse } from "../../dtos/RequestPasswordResetResponse.js";

/**
 * Caso de uso para solicitar reset de contraseña
 * Orquesta la lógica de negocio del proceso de solicitud de reset
 */
export class RequestPasswordResetUseCase {
  constructor(
    userRepository,
    tenantRepository,
    passwordResetTokenService,
    emailService
  ) {
    this.userRepository = userRepository;
    this.tenantRepository = tenantRepository;
    this.passwordResetTokenService = passwordResetTokenService;
    this.emailService = emailService;
  }

  /**
   * Ejecuta el caso de uso de solicitud de reset de contraseña
   * @param {RequestPasswordResetRequest} requestPasswordResetRequest - DTO con email y tenantSlug
   * @returns {Promise<RequestPasswordResetResponse>} DTO con mensaje genérico (por seguridad)
   */
  async execute(requestPasswordResetRequest) {
    // Mensaje genérico por seguridad (no revelar si el email existe)
    const genericMessage =
      "Si el email existe, recibirás un enlace para restablecer tu contraseña";

    try {
      // 1. Normalizar email y tenantSlug
      const normalizedEmail = requestPasswordResetRequest.email
        ? requestPasswordResetRequest.email.toLowerCase().trim()
        : null;
      const normalizedTenantSlug = (
        requestPasswordResetRequest.tenantSlug || "default"
      )
        .toLowerCase()
        .trim();

      // 2. Si no hay email, retornar respuesta genérica (por seguridad)
      if (!normalizedEmail) {
        return new RequestPasswordResetResponse({ message: genericMessage });
      }

      // 3. Buscar tenant por slug
      const tenant = await this.tenantRepository.findBySlug(
        normalizedTenantSlug
      );

      // 4. Si no existe tenant, retornar respuesta genérica (por seguridad)
      if (!tenant) {
        return new RequestPasswordResetResponse({ message: genericMessage });
      }

      // 5. Buscar usuario por email + tenantId con emailVerified
      const user = await this.userRepository.findByEmailAndTenant(
        normalizedEmail,
        tenant.id
      );

      // 6. Si usuario existe Y está verificado, generar token y enviar email
      if (user && user.emailVerified) {
        // Generar token de reset
        const tokenResult = this.passwordResetTokenService.generateToken();

        // Actualizar usuario con token de reset
        await this.userRepository.update(user.id, {
          resetPasswordToken: tokenResult.token,
          resetPasswordExpires: tokenResult.expiresAt,
        });

        // Enviar email de reset (no bloqueante)
        this.emailService
          .sendPasswordResetEmail(user.email, user.name, tokenResult.token)
          .then((result) => {
            console.log("[RESET] ✅ Email de reset enviado exitosamente:");
          })
          .catch((err) => {
            console.error("[RESET] ❌ Error al enviar email de reset:");
            console.error("[RESET] Error completo:", err);
            console.error("[RESET] Mensaje:", err.message);
            // Nota: El token se guarda igual aunque falle el email (para evitar spam de requests)
          });
      }

      // 7. Siempre retornar respuesta genérica (por seguridad, no revelar si el email existe)
      return new RequestPasswordResetResponse({ message: genericMessage });
    } catch (error) {
      // 8. Manejar errores retornando respuesta genérica también
      console.error("[RESET] Error al solicitar reset de contraseña:", error);
      return new RequestPasswordResetResponse({ message: genericMessage });
    }
  }
}

