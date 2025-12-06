/**
 * Caso de uso para cerrar una sesión específica
 * Orquesta la lógica de negocio del proceso de cerrar sesión
 */
export class CloseSessionUseCase {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  /**
   * Ejecuta el caso de uso de cerrar sesión
   * @param {Object} request - Objeto con tenantId, userId y sessionId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string} request.sessionId - ID de la sesión (tokenId)
   * @returns {Promise<Object>} Objeto con closed (boolean)
   */
  async execute({ tenantId, userId, sessionId }) {
    if (!sessionId) {
      throw new Error("sessionId es requerido");
    }

    // Cerrar sesión
    const closed = await this.sessionRepository.closeSession(
      tenantId,
      userId,
      sessionId
    );

    if (!closed) {
      throw new Error("Sesión no encontrada o no se pudo cerrar");
    }

    return { closed: true };
  }
}

