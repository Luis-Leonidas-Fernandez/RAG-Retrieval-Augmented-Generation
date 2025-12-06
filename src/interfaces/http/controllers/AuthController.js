import { LoginUserUseCase } from "../../../application/use-cases/auth/LoginUserUseCase.js";
import { LoginRequest } from "../../../application/dtos/LoginRequest.js";
import { VerifyEmailUseCase } from "../../../application/use-cases/auth/VerifyEmailUseCase.js";
import { VerifyEmailRequest } from "../../../application/dtos/VerifyEmailRequest.js";
import { RegisterUserUseCase } from "../../../application/use-cases/auth/RegisterUserUseCase.js";
import { RegisterRequest } from "../../../application/dtos/RegisterRequest.js";
import { RequestPasswordResetUseCase } from "../../../application/use-cases/auth/RequestPasswordResetUseCase.js";
import { RequestPasswordResetRequest } from "../../../application/dtos/RequestPasswordResetRequest.js";
import { ResetPasswordUseCase } from "../../../application/use-cases/auth/ResetPasswordUseCase.js";
import { ResetPasswordRequest } from "../../../application/dtos/ResetPasswordRequest.js";
import { GetProfileUseCase } from "../../../application/use-cases/auth/GetProfileUseCase.js";
import { UpdateProfileUseCase } from "../../../application/use-cases/auth/UpdateProfileUseCase.js";
import { ResendVerificationEmailUseCase } from "../../../application/use-cases/auth/ResendVerificationEmailUseCase.js";
import { UserRepositoryMongo } from "../../../infrastructure/db/repositories/UserRepositoryMongo.js";
import { TenantRepositoryMongo } from "../../../infrastructure/db/repositories/TenantRepositoryMongo.js";
import { SessionRepositoryRedis } from "../../../infrastructure/redis/SessionRepositoryRedis.js";
import { PasswordService } from "../../../domain/services/PasswordService.js";
import { TokenService } from "../../../domain/services/TokenService.js";
import { VerificationTokenService } from "../../../domain/services/VerificationTokenService.js";
import { PasswordResetTokenService } from "../../../domain/services/PasswordResetTokenService.js";
import { EmailService } from "../../../infrastructure/email/EmailService.js";
import { InvalidCredentialsException } from "../../../domain/exceptions/InvalidCredentialsException.js";
import { EmailNotVerifiedException } from "../../../domain/exceptions/EmailNotVerifiedException.js";
import { TenantNotFoundException } from "../../../domain/exceptions/TenantNotFoundException.js";
import { EmailVerificationTokenInvalidException } from "../../../domain/exceptions/EmailVerificationTokenInvalidException.js";
import { EmailAlreadyExistsException } from "../../../domain/exceptions/EmailAlreadyExistsException.js";
import { PasswordResetTokenInvalidException } from "../../../domain/exceptions/PasswordResetTokenInvalidException.js";
import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";

/**
 * Controller HTTP para autenticación
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class AuthController {
  constructor() {
    // Instanciar dependencias (en el futuro se puede usar inyección de dependencias)
    this.userRepository = new UserRepositoryMongo();
    this.tenantRepository = new TenantRepositoryMongo();
    this.sessionRepository = new SessionRepositoryRedis();
    this.passwordService = new PasswordService();
    this.tokenService = new TokenService();

    // Crear instancia del use case con dependencias inyectadas
    this.loginUserUseCase = new LoginUserUseCase(
      this.userRepository,
      this.tenantRepository,
      this.sessionRepository,
      this.passwordService,
      this.tokenService
    );

    // Crear instancia del use case de verificación de email
    this.verifyEmailUseCase = new VerifyEmailUseCase(
      this.userRepository,
      this.sessionRepository,
      this.tokenService
    );

    // Instanciar servicios para registro
    this.verificationTokenService = new VerificationTokenService();
    this.emailService = new EmailService();

    // Crear instancia del use case de registro
    this.registerUserUseCase = new RegisterUserUseCase(
      this.userRepository,
      this.tenantRepository,
      this.verificationTokenService,
      this.emailService
    );

    // Instanciar servicio para reset de contraseña
    this.passwordResetTokenService = new PasswordResetTokenService();

    // Crear instancia del use case de solicitud de reset de contraseña
    this.requestPasswordResetUseCase = new RequestPasswordResetUseCase(
      this.userRepository,
      this.tenantRepository,
      this.passwordResetTokenService,
      this.emailService
    );

    // Crear instancia del use case de reset de contraseña
    this.resetPasswordUseCase = new ResetPasswordUseCase(this.userRepository);

    // Crear instancias de los nuevos use cases
    this.getProfileUseCase = new GetProfileUseCase(this.userRepository);
    this.updateProfileUseCase = new UpdateProfileUseCase(this.userRepository);
    this.resendVerificationEmailUseCase = new ResendVerificationEmailUseCase(
      this.userRepository,
      this.verificationTokenService,
      this.emailService
    );
  }

  /**
   * Maneja el endpoint de login
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async login(req, res) {
    try {
      // Extraer datos del request
      const { email, password, tenantSlug } = req.body;

      // Validación básica (las validaciones detalladas están en el middleware)
      if (!email || !password) {
        return res.status(400).json(
          createResponse(false, "Email y contraseña son requeridos")
        );
      }

      // Crear DTO de request
      const loginRequest = new LoginRequest({ email, password, tenantSlug });

      // Ejecutar use case
      const loginResponse = await this.loginUserUseCase.execute(loginRequest, req);

      // Responder con éxito
      return res.json(
        createResponse(true, "Inicio de sesión exitoso", {
          token: loginResponse.token,
          user: loginResponse.user,
          sessionId: loginResponse.sessionId,
        })
      );
    } catch (error) {
      // Manejar excepciones de dominio
      if (error instanceof InvalidCredentialsException) {
        return res.status(401).json(createResponse(false, error.message));
      }

      if (error instanceof EmailNotVerifiedException) {
        return res.status(403).json(
          createResponse(false, error.message, {
            requiresVerification: true,
            email: req.body.email,
          })
        );
      }

      if (error instanceof TenantNotFoundException) {
        return res.status(400).json(createResponse(false, error.message));
      }

      // Error genérico
      console.error("[AUTH] Error al iniciar sesión:", error);
      return res.status(500).json(
        createResponse(false, "Error interno del servidor al iniciar sesión")
      );
    }
  }

  /**
   * Maneja el endpoint de verificación de email
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async verifyEmail(req, res) {
    try {
      // Extraer datos del request
      const { token } = req.body;

      // Validación básica (las validaciones detalladas están en el middleware)
      if (!token) {
        return res.status(400).json(
          createResponse(false, "Token de verificación requerido")
        );
      }

      // Crear DTO de request
      const verifyEmailRequest = new VerifyEmailRequest({ token });

      // Ejecutar use case
      const verifyEmailResponse = await this.verifyEmailUseCase.execute(
        verifyEmailRequest,
        req
      );

      // Responder con éxito
      return res.json(
        createResponse(true, "Email verificado correctamente", {
          token: verifyEmailResponse.token,
          user: verifyEmailResponse.user,
        })
      );
    } catch (error) {
      // Manejar excepciones de dominio
      if (error instanceof EmailVerificationTokenInvalidException) {
        return res.status(400).json(createResponse(false, error.message));
      }

      // Error genérico
      console.error("[AUTH] Error al verificar email:", error);
      return res.status(500).json(
        createResponse(false, "Error interno del servidor al verificar email")
      );
    }
  }

  /**
   * Maneja el endpoint de registro de usuario
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async register(req, res) {
    try {
      // Extraer datos del request
      const { email, password, name, tenantSlug } = req.body;

      // Validación básica (las validaciones detalladas están en el middleware)
      if (!email || !password || !name) {
        return res.status(400).json(
          createResponse(false, "Email, contraseña y nombre son requeridos")
        );
      }

      // Crear DTO de request
      const registerRequest = new RegisterRequest({
        email,
        password,
        name,
        tenantSlug,
      });

      // Ejecutar use case
      const registerResponse = await this.registerUserUseCase.execute(
        registerRequest
      );

      // Responder con éxito
      return res.status(201).json(
        createResponse(
          true,
          "Registro exitoso. Revisa tu correo para verificar tu email.",
          {
            requiresVerification: registerResponse.requiresVerification,
            user: registerResponse.user,
          }
        )
      );
    } catch (error) {
      // Manejar excepciones de dominio
      if (error instanceof EmailAlreadyExistsException) {
        return res.status(400).json(createResponse(false, error.message));
      }

      if (error instanceof TenantNotFoundException) {
        return res.status(400).json(createResponse(false, error.message));
      }

      // Errores de validación de Mongoose
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json(
          createResponse(false, "Error de validación", { errors })
        );
      }

      // Error de duplicado (código 11000)
      if (error.code === 11000) {
        return res.status(400).json(
          createResponse(false, "El email ya está registrado")
        );
      }

      // Error de conexión a base de datos
      if (error.name === "MongoServerError" || error.name === "MongoError") {
        return res.status(500).json(
          createResponse(false, "Error de conexión con la base de datos")
        );
      }

      // Error genérico
      console.error("[AUTH] Error al registrar usuario:", error);
      return res.status(500).json(
        createResponse(false, "Error interno del servidor al registrar usuario")
      );
    }
  }

  /**
   * Maneja el endpoint de solicitud de reset de contraseña
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async requestPasswordReset(req, res) {
    try {
      // Crear DTO de request
      const requestPasswordResetRequest = new RequestPasswordResetRequest({
        email: req.body.email,
        tenantSlug: req.body.tenantSlug,
      });

      // Ejecutar use case
      const requestPasswordResetResponse =
        await this.requestPasswordResetUseCase.execute(
          requestPasswordResetRequest
        );

      // Retornar respuesta genérica siempre (por seguridad)
      return res.json(createResponse(true, requestPasswordResetResponse.message));
    } catch (error) {
      // Manejar errores retornando respuesta genérica también
      console.error("[AUTH] Error al solicitar reset de contraseña:", error);
      return res.json(
        createResponse(
          true,
          "Si el email existe, recibirás un enlace para restablecer tu contraseña"
        )
      );
    }
  }

  /**
   * Maneja el endpoint de reset de contraseña
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async resetPassword(req, res) {
    try {
      // Extraer datos del request
      const { token, newPassword } = req.body;

      // Validación básica (las validaciones detalladas están en el middleware)
      if (!token || !newPassword) {
        return res.status(400).json(
          createResponse(false, "Token y nueva contraseña son requeridos")
        );
      }

      // Crear DTO de request
      const resetPasswordRequest = new ResetPasswordRequest({
        token,
        newPassword,
      });

      // Ejecutar use case
      const resetPasswordResponse = await this.resetPasswordUseCase.execute(
        resetPasswordRequest
      );

      // Responder con éxito
      return res.json(createResponse(true, resetPasswordResponse.message));
    } catch (error) {
      // Manejar excepciones de dominio
      if (error instanceof PasswordResetTokenInvalidException) {
        return res.status(400).json(createResponse(false, error.message));
      }

      // Errores de validación de Mongoose
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json(
          createResponse(false, "Error de validación", { errors })
        );
      }

      // Error genérico
      console.error("[AUTH] Error al restablecer contraseña:", error);
      return res.status(500).json(
        createResponse(false, "Error interno del servidor al restablecer contraseña")
      );
    }
  }

  /**
   * Maneja el endpoint de obtener perfil
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getProfile(req, res) {
    try {
      // Obtener userId y tenantId desde req.user
      const { id: userId, tenantId } = req.user;

      // Ejecutar use case
      const user = await this.getProfileUseCase.execute({ userId, tenantId });

      // Responder con éxito
      return res.json(
        createResponse(true, "Perfil obtenido correctamente", {
          user: user,
        })
      );
    } catch (error) {
      // Manejar excepciones de dominio
      if (error instanceof UserNotFoundException) {
        return res.status(404).json(createResponse(false, error.message));
      }

      // Error genérico
      console.error("[AUTH] Error al obtener perfil:", error);
      return res.status(500).json(
        createResponse(false, "Error interno del servidor al obtener perfil")
      );
    }
  }

  /**
   * Maneja el endpoint de actualizar perfil
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async updateProfile(req, res) {
    try {
      // Obtener userId y tenantId desde req.user
      const { id: userId, tenantId } = req.user;
      // Obtener name y email desde req.body
      const { name, email } = req.body;

      // Ejecutar use case
      const updatedUser = await this.updateProfileUseCase.execute({
        userId,
        tenantId,
        name,
        email,
      });

      // Responder con éxito
      return res.json(
        createResponse(true, "Perfil actualizado correctamente", {
          user: updatedUser,
        })
      );
    } catch (error) {
      // Manejar excepciones de dominio
      if (error instanceof UserNotFoundException) {
        return res.status(404).json(createResponse(false, error.message));
      }

      if (error instanceof EmailAlreadyExistsException) {
        return res.status(400).json(createResponse(false, error.message));
      }

      // Errores de validación de Mongoose
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json(
          createResponse(false, "Error de validación", { errors })
        );
      }

      // Error genérico
      console.error("[AUTH] Error al actualizar perfil:", error);
      return res.status(500).json(
        createResponse(false, "Error interno del servidor al actualizar perfil")
      );
    }
  }

  /**
   * Maneja el endpoint de reenviar email de verificación
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async resendVerification(req, res) {
    try {
      // Obtener userId y tenantId desde req.user
      const { id: userId, tenantId } = req.user;

      // Ejecutar use case
      const result = await this.resendVerificationEmailUseCase.execute({
        userId,
        tenantId,
      });

      // Responder con el mensaje del use case
      return res.json(createResponse(true, result.message));
    } catch (error) {
      // Manejar excepciones de dominio
      if (error instanceof UserNotFoundException) {
        return res.status(404).json(createResponse(false, error.message));
      }

      // Error genérico
      console.error("[AUTH] Error al reenviar email de verificación:", error);
      return res.status(500).json(
        createResponse(false, "Error interno del servidor al reenviar email")
      );
    }
  }
}

