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
    console.log('[REGISTER_USE_CASE] 🚀 Iniciando registro de usuario');
    console.log('[REGISTER_USE_CASE] Email:', registerRequest.email);
    console.log('[REGISTER_USE_CASE] Name:', registerRequest.name);
    console.log('[REGISTER_USE_CASE] TenantSlug recibido:', registerRequest.tenantSlug || '(vacío)');
    console.log('[REGISTER_USE_CASE] BusinessName recibido:', registerRequest.businessName || '(vacío)');

    // Helper local para generar slugs a partir de nombres
    const slugify = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    // 1. Normalizar email y determinar slug de tenant
    const normalizedEmail = registerRequest.email.toLowerCase().trim();

    let rawTenantSlug = registerRequest.tenantSlug;
    if (!rawTenantSlug && registerRequest.businessName) {
      rawTenantSlug = slugify(registerRequest.businessName);
    }

    const normalizedTenantSlug = (rawTenantSlug || "default")
      .toLowerCase()
      .trim();

    console.log('[REGISTER_USE_CASE] Email normalizado:', normalizedEmail);
    console.log('[REGISTER_USE_CASE] TenantSlug normalizado:', normalizedTenantSlug);

    // 2. Buscar tenant por slug
    console.log('[REGISTER_USE_CASE] 🔍 Buscando tenant con slug:', normalizedTenantSlug);
    let tenant = await this.tenantRepository.findBySlug(normalizedTenantSlug);

    // 3. Crear tenant si no existe
    if (!tenant) {
      if (normalizedTenantSlug === "default" && !registerRequest.businessName) {
        console.log('[REGISTER_USE_CASE] 📝 Tenant "default" no existe, creándolo...');
        tenant = await this.tenantRepository.createOrGetDefault();
        console.log('[REGISTER_USE_CASE] ✅ Tenant creado/obtenido, ID:', tenant?.id);
      } else if (registerRequest.businessName) {
        const tenantName = registerRequest.businessName.trim();
        const tenantSlug = normalizedTenantSlug || slugify(tenantName);

        console.log('[REGISTER_USE_CASE] 📝 Creando nuevo tenant para negocio:', {
          tenantName,
          tenantSlug,
        });

        tenant = await this.tenantRepository.createTenant({
          name: tenantName,
          slug: tenantSlug,
          brandName: tenantName,
        });

        console.log('[REGISTER_USE_CASE] ✅ Nuevo tenant creado:', {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        });
      }
    }

    // 4. Si no existe tenant y no se pudo crear, lanzar excepción
    if (!tenant) {
      console.error('[REGISTER_USE_CASE] ❌ Tenant no encontrado');
      throw new TenantNotFoundException("Tenant no encontrado");
    }

    console.log('[REGISTER_USE_CASE] ✅ Tenant encontrado/creado:');
    console.log('[REGISTER_USE_CASE] - Tenant ID:', tenant.id);
    console.log('[REGISTER_USE_CASE] - Tenant Name:', tenant.name);
    console.log('[REGISTER_USE_CASE] - Tenant Slug:', tenant.slug);

    // 5. Verificar si email ya existe en este tenant
    console.log('[REGISTER_USE_CASE] 🔍 Verificando si email ya existe en tenant:', tenant.id);
    const existingUser = await this.userRepository.findByEmailAndTenant(
      normalizedEmail,
      tenant.id
    );
    if (existingUser) {
      console.error('[REGISTER_USE_CASE] ❌ Email ya existe en este tenant');
      throw new EmailAlreadyExistsException(
        "El email ya está registrado en este tenant"
      );
    }
    console.log('[REGISTER_USE_CASE] ✅ Email disponible');

    // 6. Generar token de verificación
    console.log('[REGISTER_USE_CASE] 🎫 Generando token de verificación...');
    const tokenResult = this.verificationTokenService.generateToken();
    console.log('[REGISTER_USE_CASE] ✅ Token generado, expira:', tokenResult.expiresAt);

    // 7. Crear usuario con password en texto plano
    // Mongoose lo hasheará automáticamente en el pre-save hook
    console.log('[REGISTER_USE_CASE] 📝 Creando usuario en MongoDB...');
    console.log('[REGISTER_USE_CASE] Datos del usuario:', {
      tenantId: tenant.id,
      email: normalizedEmail,
      name: registerRequest.name,
      emailVerified: false,
      password: '***',
      hasVerificationToken: !!tokenResult.token,
      hasVerificationTokenExpires: !!tokenResult.expiresAt
    });

    let createdUser;
    try {
      createdUser = await this.userRepository.create({
        tenantId: tenant.id,
        email: normalizedEmail,
        password: registerRequest.password, // texto plano, Mongoose lo hashea
        name: registerRequest.name,
        emailVerified: false,
        verificationToken: tokenResult.token,
        verificationTokenExpires: tokenResult.expiresAt,
      });

      console.log('[REGISTER_USE_CASE] ✅ Usuario creado exitosamente:');
      console.log('[REGISTER_USE_CASE] - User ID:', createdUser.id);
      console.log('[REGISTER_USE_CASE] - User Email:', createdUser.email);
      console.log('[REGISTER_USE_CASE] - User TenantId:', createdUser.tenantId);
      console.log('[REGISTER_USE_CASE] - Email Verified:', createdUser.emailVerified);

      // Verificar que realmente se guardó en MongoDB con retry (para manejar consistencia eventual)
      console.log('[REGISTER_USE_CASE] 🔍 Verificando que el usuario se guardó en MongoDB...');
      let verifyUser = null;
      const maxRetries = 3;
      const retryDelays = [50, 100, 200]; // ms
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          verifyUser = await this.userRepository.findById(createdUser.id);
          if (verifyUser) {
            console.log(`[REGISTER_USE_CASE] ✅ Verificación exitosa (intento ${attempt + 1}/${maxRetries})`);
            console.log('[REGISTER_USE_CASE] - Verified User ID:', verifyUser.id);
            console.log('[REGISTER_USE_CASE] - Verified User Email:', verifyUser.email);
            break;
          }
        } catch (verifyError) {
          console.warn(`[REGISTER_USE_CASE] ⚠️ Error en verificación (intento ${attempt + 1}/${maxRetries}):`, verifyError.message);
        }
        
        // Si no se encontró y no es el último intento, esperar antes de reintentar
        if (!verifyUser && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }
      }
      
      if (!verifyUser) {
        console.warn('[REGISTER_USE_CASE] ⚠️ Usuario no encontrado en verificación inmediata (puede ser delay de consistencia)');
        console.warn('[REGISTER_USE_CASE] El usuario fue creado exitosamente, pero la verificación no lo encontró después de varios intentos');
        console.warn('[REGISTER_USE_CASE] Esto puede ser normal en MongoDB con réplicas. El usuario debería estar disponible en breve.');
        // No lanzar error, el usuario fue creado exitosamente
      }
    } catch (createError) {
      console.error('[REGISTER_USE_CASE] ❌ Error al crear usuario:', createError);
      console.error('[REGISTER_USE_CASE] Error name:', createError.name);
      console.error('[REGISTER_USE_CASE] Error code:', createError.code);
      console.error('[REGISTER_USE_CASE] Error message:', createError.message);
      if (createError.errors) {
        console.error('[REGISTER_USE_CASE] Validation errors:', createError.errors);
      }
      if (createError.stack) {
        console.error('[REGISTER_USE_CASE] Error stack:', createError.stack);
      }
      throw createError;
    }

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

