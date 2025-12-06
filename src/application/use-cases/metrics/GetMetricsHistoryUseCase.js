/**
 * Caso de uso para obtener métricas históricas
 * Orquesta la lógica de negocio del proceso de obtener métricas históricas
 */
export class GetMetricsHistoryUseCase {
  constructor(metricsRepository) {
    this.metricsRepository = metricsRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener métricas históricas
   * @param {Object} request - Objeto con tenantId y filters
   * @param {string|ObjectId} request.tenantId - ID del tenant (opcional, para futuras extensiones)
   * @param {Object} request.filters - Filtros de búsqueda
   * @param {number} request.filters.limit - Límite de resultados (máximo 1000)
   * @param {string|null} request.filters.startDate - Fecha de inicio (ISO string)
   * @param {string|null} request.filters.endDate - Fecha de fin (ISO string)
   * @param {number} request.filters.sort - Orden de ordenamiento (-1 para más recientes primero)
   * @returns {Promise<Object>} Objeto con metrics (array) y count
   */
  async execute({ tenantId = null, filters = {} }) {
    const {
      limit = 100,
      startDate = null,
      endDate = null,
      sort = -1,
    } = filters;

    // Validar límite máximo
    const safeLimit = Math.min(limit, 1000);

    // Obtener métricas históricas
    const metrics = await this.metricsRepository.findHistorical({
      limit: safeLimit,
      startDate,
      endDate,
      sort,
    });

    return {
      metrics,
      count: metrics.length,
    };
  }
}

