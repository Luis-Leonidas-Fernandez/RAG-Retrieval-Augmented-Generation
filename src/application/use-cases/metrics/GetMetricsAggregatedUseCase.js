/**
 * Caso de uso para obtener métricas agregadas
 * Orquesta la lógica de negocio del proceso de obtener métricas agregadas
 */
export class GetMetricsAggregatedUseCase {
  constructor(metricsRepository) {
    this.metricsRepository = metricsRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener métricas agregadas
   * @param {Object} request - Objeto con tenantId y filters
   * @param {string|ObjectId} request.tenantId - ID del tenant (opcional, para futuras extensiones)
   * @param {Object} request.filters - Filtros de búsqueda
   * @param {string|null} request.filters.startDate - Fecha de inicio (ISO string)
   * @param {string|null} request.filters.endDate - Fecha de fin (ISO string)
   * @returns {Promise<Object|null>} Métricas agregadas o null si no hay datos
   */
  async execute({ tenantId = null, filters = {} }) {
    const { startDate = null, endDate = null } = filters;

    // Obtener métricas agregadas
    const aggregated = await this.metricsRepository.findAggregated(
      startDate,
      endDate
    );

    return aggregated;
  }
}

