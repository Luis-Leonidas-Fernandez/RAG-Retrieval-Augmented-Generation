import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Caso de uso para activar/desactivar preferencia de historial
 * Orquesta la lógica de negocio del proceso de actualización de preferencia
 */
export class ToggleHistoryPreferenceUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Ejecuta el caso de uso de actualizar preferencia de historial
   * @param {Object} request - Objeto con tenantId, userId y allowHistory
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {boolean} request.allowHistory - Nuevo valor de la preferencia
   * @returns {Promise<Object>} Usuario actualizado con allowHistory
   * @throws {Error} Si allowHistory no es un booleano
   * @throws {UserNotFoundException} Si el usuario no existe
   */
  async execute({ tenantId, userId, allowHistory }) {
    // Validar que allowHistory sea un booleano
    if (typeof allowHistory !== "boolean") {
      throw new Error("allowHistory debe ser un booleano");
    }

    // Actualizar usuario
    const updatedUser = await this.userRepository.updateByTenant(
      tenantId,
      userId,
      {
        allowHistory,
      }
    );

    if (!updatedUser) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    return {
      allowHistory: updatedUser.allowHistory,
    };
  }
}

