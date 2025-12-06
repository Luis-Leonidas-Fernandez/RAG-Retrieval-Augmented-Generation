/**
 * Caso de uso para obtener sesiones activas del usuario
 * Orquesta la lógica de negocio del proceso de listado de sesiones
 */
export class GetMySessionsUseCase {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener sesiones activas
   * @param {Object} request - Objeto con tenantId, userId y filters
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {Object} request.filters - Filtros de búsqueda (opcional por ahora)
   * @returns {Promise<Object>} Objeto con sessions (array) y count
   */
  async execute({ tenantId, userId, filters = {} }) {
    // Obtener sesiones activas
    const sessions = await this.sessionRepository.findActiveSessions(
      tenantId,
      userId,
      filters
    );

    return {
      sessions,
      count: sessions.length,
    };
  }
}

