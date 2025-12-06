import { ResetPasswordResponse } from "../../dtos/ResetPasswordResponse.js";
import { PasswordResetTokenInvalidException } from "../../../domain/exceptions/PasswordResetTokenInvalidException.js";

/**
 * Caso de uso para resetear contraseña
 * Orquesta la lógica de negocio del proceso de reseteo de contraseña
 */
export class ResetPasswordUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Ejecuta el caso de uso de reset de contraseña
   * @param {ResetPasswordRequest} resetPasswordRequest - DTO con token y newPassword
   * @returns {Promise<ResetPasswordResponse>} DTO con mensaje de éxito
   * @throws {PasswordResetTokenInvalidException} Si el token es inválido o expirado
   */
  async execute(resetPasswordRequest) {
    // 1. Buscar usuario por token de reset válido
    const user = await this.userRepository.findByResetToken(
      resetPasswordRequest.token
    );

    // 2. Si no existe, lanzar excepción
    if (!user) {
      throw new PasswordResetTokenInvalidException(
        "Token inválido o expirado"
      );
    }

    // 3. Actualizar password, marcar email como verificado y limpiar tokens
    await this.userRepository.update(user.id, {
      password: resetPasswordRequest.newPassword, // texto plano, Mongoose lo hashea
      emailVerified: true, // marcar email como verificado al resetear contraseña
      resetPasswordToken: undefined, // limpiar token
      resetPasswordExpires: undefined, // limpiar expiración
    });

    // 4. Retornar respuesta de éxito
    return new ResetPasswordResponse({
      message: "Contraseña restablecida correctamente",
    });
  }
}

