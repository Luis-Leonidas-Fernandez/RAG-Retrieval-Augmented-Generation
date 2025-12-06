import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Caso de uso para obtener perfil de usuario
 * Orquesta la lógica de negocio del proceso de obtener perfil
 */
export class GetProfileUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener perfil
   * @param {Object} request - Objeto con userId y tenantId
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @returns {Promise<Object>} Datos del usuario (sin password)
   * @throws {UserNotFoundException} Si el usuario no existe o no pertenece al tenant
   */
  async execute({ userId, tenantId }) {
    // Buscar usuario por ID y tenantId
    const user = await this.userRepository.findByIdAndTenant(userId, tenantId, {
      select: "email name role createdAt",
    });

    if (!user) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    // Retornar datos del usuario (ya viene sin password por el select)
    return user;
  }
}

