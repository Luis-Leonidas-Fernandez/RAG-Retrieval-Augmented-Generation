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
    // 1. Normalizar tenantSlug (usa "default" si vacío)
    const normalizedTenantSlug = loginRequest.tenantSlug
      ? loginRequest.tenantSlug.toLowerCase().trim()
      : "default";

    // 2. Buscar tenant por slug
    const tenant = await this.tenantRepository.findBySlug(normalizedTenantSlug);
    if (!tenant) {
      throw new TenantNotFoundException("Tenant no encontrado");
    }

    // 3. Buscar usuario por email + tenantId
    const user = await this.userRepository.findByEmailAndTenant(
      loginRequest.email,
      tenant.id
    );
    if (!user) {
      // Por seguridad, no revelar si el usuario existe o no
      throw new InvalidCredentialsException("Credenciales inválidas");
    }

    // 4. Verificar contraseña con PasswordService.compare()
    const isPasswordValid = await this.passwordService.compare(
      loginRequest.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      // Por seguridad, mismo mensaje que cuando el usuario no existe
      throw new InvalidCredentialsException("Credenciales inválidas");
    }

    // 5. Verificar emailVerified === true
    if (!user.emailVerified) {
      throw new EmailNotVerifiedException(
        "Por favor verifica tu email antes de iniciar sesión"
      );
    }

    // 6. Generar JWT con TokenService
    const token = this.tokenService.generateAuthToken({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    // 7. Crear sesión con ISessionRepository.createSession()
    const sessionResult = await this.sessionRepository.createSession(
      user.tenantId,
      user.id,
      token,
      req
    );

    // 8. Retornar LoginResponse
    return new LoginResponse({
      token,
      user: user.toJSON(),
      sessionId: sessionResult?.sessionId || null,
    });
  }
}

