/**
 * Interface para repositorio de métricas
 * Define el contrato que deben cumplir las implementaciones
 */
export class IMetricsRepository {
  /**
   * Guarda métricas del sistema
   * @param {Object} metricsData - Datos de métricas (timestamp, memory, system, process, connections, workers, alerts)
   * @returns {Promise<Object>} Métricas guardadas
   */
  async save(metricsData) {
    throw new Error("Method not implemented");
  }

  /**
   * Obtiene métricas históricas
   * @param {Object} options - Opciones de consulta (limit, startDate, endDate, sort)
   * @returns {Promise<Array<Object>>} Lista de métricas históricas
   */
  async findHistorical(options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Obtiene métricas agregadas (promedios, máximos, mínimos) para un período
   * @param {Date|string} startDate - Fecha de inicio
   * @param {Date|string} endDate - Fecha de fin
   * @returns {Promise<Object|null>} Métricas agregadas o null si no hay datos
   *   Estructura: {count, period: {start, end}, memory: {heapUsed: {avg, min, max}}, cpu: {avg, min, max}}
   */
  async findAggregated(startDate, endDate) {
    throw new Error("Method not implemented");
  }
}

