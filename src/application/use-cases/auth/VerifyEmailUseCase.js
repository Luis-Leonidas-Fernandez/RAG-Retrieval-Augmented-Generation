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
    console.log('[VERIFY_EMAIL_USE_CASE] 🔐 Iniciando verificación de email');
    console.log('[VERIFY_EMAIL_USE_CASE] Token recibido:', verifyEmailRequest.token?.substring(0, 10) + '...');

    // 1. Buscar usuario por token de verificación (válido y no expirado)
    console.log('[VERIFY_EMAIL_USE_CASE] 🔍 Buscando usuario con token de verificación...');
    const user = await this.userRepository.findByVerificationToken(
      verifyEmailRequest.token
    );

    if (!user) {
      console.error('[VERIFY_EMAIL_USE_CASE] ❌ Usuario NO encontrado con token de verificación');
      throw new EmailVerificationTokenInvalidException(
        "Token de verificación inválido o expirado"
      );
    }

    console.log('[VERIFY_EMAIL_USE_CASE] ✅ Usuario encontrado:');
    console.log('[VERIFY_EMAIL_USE_CASE] - User ID:', user.id);
    console.log('[VERIFY_EMAIL_USE_CASE] - User Email:', user.email);
    console.log('[VERIFY_EMAIL_USE_CASE] - User TenantId:', user.tenantId);
    console.log('[VERIFY_EMAIL_USE_CASE] - Email Verified (antes):', user.emailVerified);

    // 2. Marcar email como verificado y limpiar tokens
    console.log('[VERIFY_EMAIL_USE_CASE] 📝 Actualizando usuario: marcando email como verificado...');
    const updatedUser = await this.userRepository.update(user.id, {
      emailVerified: true,
      verificationToken: undefined,
      verificationTokenExpires: undefined,
    });

    if (!updatedUser) {
      console.error('[VERIFY_EMAIL_USE_CASE] ❌ ERROR: Usuario NO encontrado después de actualizar');
      throw new Error('Usuario no encontrado después de actualizar');
    }

    console.log('[VERIFY_EMAIL_USE_CASE] ✅ Usuario actualizado:');
    console.log('[VERIFY_EMAIL_USE_CASE] - Updated User ID:', updatedUser.id);
    console.log('[VERIFY_EMAIL_USE_CASE] - Updated User Email:', updatedUser.email);
    console.log('[VERIFY_EMAIL_USE_CASE] - Email Verified (después):', updatedUser.emailVerified);

    // Verificar que realmente se guardó en MongoDB con retry (para manejar consistencia eventual)
    console.log('[VERIFY_EMAIL_USE_CASE] 🔍 Verificando que el usuario se actualizó en MongoDB...');
    let verifyUser = null;
    const maxRetries = 3;
    const retryDelays = [50, 100, 200]; // ms
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        verifyUser = await this.userRepository.findById(updatedUser.id);
        if (verifyUser) {
          console.log(`[VERIFY_EMAIL_USE_CASE] ✅ Verificación exitosa (intento ${attempt + 1}/${maxRetries})`);
          console.log('[VERIFY_EMAIL_USE_CASE] - Verified Email Verified:', verifyUser.emailVerified);
          break;
        }
      } catch (verifyError) {
        console.warn(`[VERIFY_EMAIL_USE_CASE] ⚠️ Error en verificación (intento ${attempt + 1}/${maxRetries}):`, verifyError.message);
      }
      
      // Si no se encontró y no es el último intento, esperar antes de reintentar
      if (!verifyUser && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
    
    if (!verifyUser) {
      console.warn('[VERIFY_EMAIL_USE_CASE] ⚠️ Usuario no encontrado en verificación inmediata (puede ser delay de consistencia)');
      console.warn('[VERIFY_EMAIL_USE_CASE] El usuario fue actualizado exitosamente, pero la verificación no lo encontró después de varios intentos');
      console.warn('[VERIFY_EMAIL_USE_CASE] Esto puede ser normal en MongoDB con réplicas. El usuario debería estar disponible en breve.');
      // No lanzar error, el usuario fue actualizado exitosamente
    }

    // 3. Generar JWT con TokenService
    console.log('[VERIFY_EMAIL_USE_CASE] 🎫 Generando token JWT...');
    const token = this.tokenService.generateAuthToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      tenantId: updatedUser.tenantId,
    });
    console.log('[VERIFY_EMAIL_USE_CASE] ✅ Token JWT generado');

    // 4. Crear sesión activa (no bloqueante)
    console.log('[VERIFY_EMAIL_USE_CASE] 📝 Creando sesión activa...');
    this.sessionRepository
      .createSession(updatedUser.tenantId, updatedUser.id, token, req)
      .then(() => {
        console.log('[VERIFY_EMAIL_USE_CASE] ✅ Sesión creada exitosamente');
      })
      .catch((err) => {
        console.error("[VERIFY_EMAIL_USE_CASE] ❌ Error al crear sesión activa:", err);
      });

    // 5. Retornar VerifyEmailResponse
    console.log('[VERIFY_EMAIL_USE_CASE] ✅ Verificación de email completada exitosamente');
    return new VerifyEmailResponse({
      token,
      user: updatedUser.toJSON(),
    });
  }
}

