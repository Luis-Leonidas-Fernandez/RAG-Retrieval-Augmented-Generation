import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";
import { EmailAlreadyExistsException } from "../../../domain/exceptions/EmailAlreadyExistsException.js";

/**
 * Caso de uso para actualizar perfil de usuario
 * Orquesta la lógica de negocio del proceso de actualización de perfil
 */
export class UpdateProfileUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Ejecuta el caso de uso de actualizar perfil
   * @param {Object} request - Objeto con userId, tenantId, name y email
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string} request.name - Nuevo nombre (opcional)
   * @param {string} request.email - Nuevo email (opcional)
   * @returns {Promise<Object>} Usuario actualizado (sin password)
   * @throws {UserNotFoundException} Si el usuario no existe o no pertenece al tenant
   * @throws {EmailAlreadyExistsException} Si el email ya está en uso por otro usuario en el tenant
   */
  async execute({ userId, tenantId, name, email }) {
    // Verificar que el usuario existe y pertenece al tenant
    const existingUser = await this.userRepository.findByIdAndTenant(userId, tenantId);
    if (!existingUser) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    // Construir objeto de actualización solo con campos proporcionados
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (email !== undefined) {
      // Normalizar email a lowercase + trim
      const normalizedEmail = email.toLowerCase().trim();
      updateData.email = normalizedEmail;

      // Verificar si el email ya está en uso por otro usuario en el mismo tenant
      const emailExists = await this.userRepository.existsByEmailInTenant(
        normalizedEmail,
        tenantId,
        userId
      );

      if (emailExists) {
        throw new EmailAlreadyExistsException(
          "El email ya está en uso por otro usuario en este tenant"
        );
      }
    }

    // Si no hay nada que actualizar, retornar usuario actual
    if (Object.keys(updateData).length === 0) {
      return existingUser.toJSON ? existingUser.toJSON() : existingUser;
    }

    // Actualizar usuario
    const updatedUser = await this.userRepository.update(userId, updateData);

    if (!updatedUser) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    // Retornar usuario actualizado (sin password)
    return updatedUser.toJSON ? updatedUser.toJSON() : updatedUser;
  }
}

