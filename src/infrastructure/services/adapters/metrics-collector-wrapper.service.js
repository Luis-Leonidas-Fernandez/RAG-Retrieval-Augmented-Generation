import { collectMetrics } from "../core/metrics.service.js";

/**
 * Servicio wrapper para la recolección de métricas en tiempo real
 * Abstrae el uso de collectMetrics desde la capa de aplicación
 */
export class MetricsCollectorService {
  /**
   * Recolecta métricas actuales del sistema
   * @returns {Promise<Object>} Métricas del sistema (memory, system, process, connections, workers, alerts)
   */
  async collectCurrentMetrics() {
    return await collectMetrics();
  }
}

