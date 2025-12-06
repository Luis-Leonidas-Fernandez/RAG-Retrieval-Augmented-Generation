import { RegisterResponse } from "../../dtos/RegisterResponse.js";
import { TenantNotFoundException } from "../../../domain/exceptions/TenantNotFoundException.js";
import { EmailAlreadyExistsException } from "../../../domain/exceptions/EmailAlreadyExistsException.js";

/**
 * Caso de uso para registro de usuario
 * Orquesta la lógica de negocio del proceso de registro
 */
export class RegisterUserUseCase {
  constructor(userRepository, tenantRepository, verificationTokenService, emailService) {
    this.userRepository = userRepository;
    this.tenantRepository = tenantRepository;
    this.verificationTokenService = verificationTokenService;
    this.emailService = emailService;
  }

  /**
   * Ejecuta el caso de uso de registro
   * @param {RegisterRequest} registerRequest - DTO con email, password, name y tenantSlug
   * @returns {Promise<RegisterResponse>} DTO con user y requiresVerification
   * @throws {TenantNotFoundException} Si el tenant no existe y no es "default"
   * @throws {EmailAlreadyExistsException} Si el email ya está registrado en el tenant
   */
  async execute(registerRequest) {
    // 1. Normalizar email y tenantSlug
    const normalizedEmail = registerRequest.email.toLowerCase().trim();
    const normalizedTenantSlug = (registerRequest.tenantSlug || "default")
      .toLowerCase()
      .trim();

    // 2. Buscar tenant por slug
    let tenant = await this.tenantRepository.findBySlug(normalizedTenantSlug);

    // 3. Si no existe y es "default", crear tenant default
    if (!tenant && normalizedTenantSlug === "default") {
      tenant = await this.tenantRepository.createOrGetDefault();
    }

    // 4. Si no existe y no es "default", lanzar excepción
    if (!tenant) {
      throw new TenantNotFoundException("Tenant no encontrado");
    }

    // 5. Verificar si email ya existe en este tenant
    const existingUser = await this.userRepository.findByEmailAndTenant(
      normalizedEmail,
      tenant.id
    );
    if (existingUser) {
      throw new EmailAlreadyExistsException(
        "El email ya está registrado en este tenant"
      );
    }

    // 6. Generar token de verificación
    const tokenResult = this.verificationTokenService.generateToken();

    // 7. Crear usuario con password en texto plano
    // Mongoose lo hasheará automáticamente en el pre-save hook
    const createdUser = await this.userRepository.create({
      tenantId: tenant.id,
      email: normalizedEmail,
      password: registerRequest.password, // texto plano, Mongoose lo hashea
      name: registerRequest.name,
      emailVerified: false,
      verificationToken: tokenResult.token,
      verificationTokenExpires: tokenResult.expiresAt,
    });

    // 8. Enviar email de verificación (no bloqueante)
    this.emailService
      .sendVerificationEmail(
        createdUser.email,
        createdUser.name,
        tokenResult.token
      )
      .then((result) => {
        console.log("[REGISTER] ✅ Email enviado exitosamente:", result);
      })
      .catch((err) => {
        console.error("[REGISTER] ❌ Error al enviar email de verificación:");
        console.error("[REGISTER] Error completo:", err);
        console.error("[REGISTER] Mensaje:", err.message);
        if (err.stack) {
          console.error("[REGISTER] Stack:", err.stack);
        }
        // Verificar variables de entorno
        console.error(
          "[REGISTER] RESEND_API_KEY existe:",
          !!process.env.RESEND_API_KEY
        );
        console.error(
          "[REGISTER] RESEND_FROM:",
          process.env.RESEND_FROM || "NO CONFIGURADA"
        );
        console.error(
          "[REGISTER] RESEND_FROM_EMAIL:",
          process.env.RESEND_FROM_EMAIL || "NO CONFIGURADA"
        );
      });

    // 9. Retornar RegisterResponse con manejo seguro de toJSON
    return new RegisterResponse({
      user: createdUser.toJSON ? createdUser.toJSON() : createdUser,
      requiresVerification: true,
    });
  }
}

