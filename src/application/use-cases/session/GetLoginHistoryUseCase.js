/**
 * Caso de uso para obtener historial de logins
 * Orquesta la lógica de negocio del proceso de obtener historial de logins
 */
export class GetLoginHistoryUseCase {
  constructor(loginHistoryRepository) {
    this.loginHistoryRepository = loginHistoryRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener historial de logins
   * @param {Object} request - Objeto con tenantId, userId y filters
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {Object} request.filters - Filtros de búsqueda
   * @param {number} request.filters.limit - Límite de resultados
   * @param {number} request.filters.skip - Número de resultados a saltar
   * @param {string|null} request.filters.startDate - Fecha de inicio (ISO string)
   * @param {string|null} request.filters.endDate - Fecha de fin (ISO string)
   * @returns {Promise<Object>} Objeto con history (array) y count
   */
  async execute({ tenantId, userId, filters = {} }) {
    const {
      limit = 50,
      skip = 0,
      startDate = null,
      endDate = null,
    } = filters;

    // Obtener historial de logins
    const history = await this.loginHistoryRepository.findByUser(
      tenantId,
      userId,
      {
        limit,
        skip,
        sort: { loggedInAt: -1 }, // Más recientes primero
        startDate,
        endDate,
      }
    );

    return {
      history,
      count: history.length,
    };
  }
}

