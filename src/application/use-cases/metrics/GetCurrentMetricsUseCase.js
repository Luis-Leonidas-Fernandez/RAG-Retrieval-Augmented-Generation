/**
 * Caso de uso para obtener métricas actuales del sistema
 * Orquesta la lógica de negocio del proceso de obtener métricas en tiempo real
 */
export class GetCurrentMetricsUseCase {
  constructor(metricsCollectorService) {
    this.metricsCollectorService = metricsCollectorService;
  }

  /**
   * Ejecuta el caso de uso de obtener métricas actuales
   * @param {Object} request - Objeto con tenantId (opcional, para futuras extensiones)
   * @returns {Promise<Object>} Métricas actuales del sistema
   */
  async execute({ tenantId = null }) {
    // Recolectar métricas actuales del sistema
    const metrics = await this.metricsCollectorService.collectCurrentMetrics();

    // Validar que collectMetrics retorne datos válidos
    if (!metrics || !metrics.memory || !metrics.system) {
      throw new Error("Error al obtener métricas: datos inválidos");
    }

    return metrics;
  }
}

