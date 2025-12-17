import { LoginRequest } from "../../dtos/LoginRequest.js";
import { LoginResponse } from "../../dtos/LoginResponse.js";
import { TenantNotFoundException } from "../../../domain/exceptions/TenantNotFoundException.js";
import { InvalidCredentialsException } from "../../../domain/exceptions/InvalidCredentialsException.js";
import { EmailNotVerifiedException } from "../../../domain/exceptions/EmailNotVerifiedException.js";

/**
 * Caso de uso para login de usuario
 * Orquesta la lógica de negocio del proceso de autenticación
 */
export class LoginUserUseCase {
  constructor(userRepository, tenantRepository, sessionRepository, passwordService, tokenService) {
    this.userRepository = userRepository;
    this.tenantRepository = tenantRepository;
    this.sessionRepository = sessionRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
  }

  /**
   * Ejecuta el caso de uso de login
   * @param {LoginRequest} loginRequest - DTO con email, password y tenantSlug
   * @param {Object} req - Request object de Express (para extraer IP y User-Agent en sesión)
   * @returns {Promise<LoginResponse>} DTO con token, user y sessionId
   * @throws {TenantNotFoundException} Si el tenant no existe
   * @throws {InvalidCredentialsException} Si el usuario no existe o la contraseña es incorrecta
   * @throws {EmailNotVerifiedException} Si el email no está verificado
   */
  async execute(loginRequest, req = null) {
    console.log('[LOGIN_USE_CASE] 🔐 Ejecutando caso de uso de login');
    console.log('[LOGIN_USE_CASE] Email recibido:', loginRequest.email);
    console.log('[LOGIN_USE_CASE] TenantSlug recibido:', loginRequest.tenantSlug || '(vacío)');

    // 1. Normalizar tenantSlug (usa "default" si vacío)
    const normalizedTenantSlug = loginRequest.tenantSlug
      ? loginRequest.tenantSlug.toLowerCase().trim()
      : "default";
    console.log('[LOGIN_USE_CASE] TenantSlug normalizado:', normalizedTenantSlug);

    // 2. Buscar tenant por slug
    console.log('[LOGIN_USE_CASE] 🔍 Buscando tenant con slug:', normalizedTenantSlug);
    const tenant = await this.tenantRepository.findBySlug(normalizedTenantSlug);
    
    if (!tenant) {
      console.error('[LOGIN_USE_CASE] ❌ Tenant NO encontrado con slug:', normalizedTenantSlug);
      console.error('[LOGIN_USE_CASE] Verificar que existe en la base de datos conectada');
      throw new TenantNotFoundException("Tenant no encontrado");
    }
    
    console.log('[LOGIN_USE_CASE] ✅ Tenant encontrado:');
    console.log('[LOGIN_USE_CASE] - Tenant ID:', tenant.id);
    console.log('[LOGIN_USE_CASE] - Tenant Name:', tenant.name);
    console.log('[LOGIN_USE_CASE] - Tenant Slug:', tenant.slug);

    // 3. Buscar usuario por email + tenantId
    console.log('[LOGIN_USE_CASE] 🔍 Buscando usuario con email:', loginRequest.email, 'y tenantId:', tenant.id);
    const user = await this.userRepository.findByEmailAndTenant(
      loginRequest.email,
      tenant.id
    );
    
    if (!user) {
      console.error('[LOGIN_USE_CASE] ❌ Usuario NO encontrado con email:', loginRequest.email, 'en tenant:', tenant.id);
      // Por seguridad, no revelar si el usuario existe o no
      throw new InvalidCredentialsException("Credenciales inválidas");
    }
    
    console.log('[LOGIN_USE_CASE] ✅ Usuario encontrado:');
    console.log('[LOGIN_USE_CASE] - User ID:', user.id);
    console.log('[LOGIN_USE_CASE] - User Email:', user.email);
    console.log('[LOGIN_USE_CASE] - User TenantId:', user.tenantId);
    console.log('[LOGIN_USE_CASE] - Email Verified:', user.emailVerified);

    // 4. Verificar contraseña con PasswordService.compare()
    console.log('[LOGIN_USE_CASE] 🔐 Verificando contraseña...');
    const isPasswordValid = await this.passwordService.compare(
      loginRequest.password,
      user.passwordHash
    );
    
    if (!isPasswordValid) {
      console.error('[LOGIN_USE_CASE] ❌ Contraseña inválida');
      // Por seguridad, mismo mensaje que cuando el usuario no existe
      throw new InvalidCredentialsException("Credenciales inválidas");
    }
    
    console.log('[LOGIN_USE_CASE] ✅ Contraseña válida');

    // 5. Verificar emailVerified === true
    if (!user.emailVerified) {
      console.error('[LOGIN_USE_CASE] ❌ Email no verificado');
      throw new EmailNotVerifiedException(
        "Por favor verifica tu email antes de iniciar sesión"
      );
    }
    
    console.log('[LOGIN_USE_CASE] ✅ Email verificado');

    // 6. Generar JWT con TokenService
    console.log('[LOGIN_USE_CASE] 🎫 Generando token JWT...');
    const token = this.tokenService.generateAuthToken({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
    console.log('[LOGIN_USE_CASE] ✅ Token generado');

    // 7. Crear sesión con ISessionRepository.createSession()
    console.log('[LOGIN_USE_CASE] 📝 Creando sesión...');
    const sessionResult = await this.sessionRepository.createSession(
      user.tenantId,
      user.id,
      token,
      req
    );
    console.log('[LOGIN_USE_CASE] ✅ Sesión creada, sessionId:', sessionResult?.sessionId);

    // 8. Retornar LoginResponse
    console.log('[LOGIN_USE_CASE] ✅ Login completado exitosamente');
    return new LoginResponse({
      token,
      user: user.toJSON(),
      sessionId: sessionResult?.sessionId || null,
    });
  }
}

