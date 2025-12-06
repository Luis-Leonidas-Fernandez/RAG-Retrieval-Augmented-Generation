/**
 * Caso de uso para exportar métricas
 * Orquesta la lógica de negocio del proceso de exportación de métricas
 */
export class ExportMetricsDataUseCase {
  constructor(metricsRepository) {
    this.metricsRepository = metricsRepository;
  }

  /**
   * Ejecuta el caso de uso de exportar métricas
   * @param {Object} request - Objeto con tenantId, format y filters
   * @param {string|ObjectId} request.tenantId - ID del tenant (opcional, para futuras extensiones)
   * @param {string} request.format - Formato de exportación ('json' o 'csv')
   * @param {Object} request.filters - Filtros de búsqueda
   * @param {number} request.filters.limit - Límite de resultados (máximo 10000)
   * @param {string|null} request.filters.startDate - Fecha de inicio (ISO string)
   * @param {string|null} request.filters.endDate - Fecha de fin (ISO string)
   * @returns {Promise<Object>} Objeto con content, contentType y filename
   */
  async execute({ tenantId = null, format = "json", filters = {} }) {
    const { limit = 1000, startDate = null, endDate = null } = filters;

    // Validar formato
    if (!["json", "csv"].includes(format)) {
      throw new Error("Formato no soportado. Use 'json' o 'csv'");
    }

    // Validar límite máximo para exportación
    const safeLimit = Math.min(limit, 10000);

    // Obtener métricas históricas
    const metrics = await this.metricsRepository.findHistorical({
      limit: safeLimit,
      startDate,
      endDate,
      sort: -1, // Más recientes primero
    });

    let content;
    let contentType;

    if (format === "json") {
      content = JSON.stringify(metrics, null, 2);
      contentType = "application/json";
    } else if (format === "csv") {
      // Convertir a CSV simple
      if (metrics.length === 0) {
        content = "";
      } else {
        const headers = ["timestamp", "heapUsed", "heapTotal", "rss", "cpuUsage"];
        const rows = metrics.map((m) => [
          m.timestamp instanceof Date
            ? m.timestamp.toISOString()
            : m.timestamp,
          m.memory?.heapUsed || 0,
          m.memory?.heapTotal || 0,
          m.memory?.rss || 0,
          m.system?.cpuUsage || 0,
        ]);

        content = [headers.join(","), ...rows.map((r) => r.join(","))].join(
          "\n"
        );
      }
      contentType = "text/csv";
    }

    // Generar nombre de archivo
    const filename = `metrics-${new Date().toISOString().split("T")[0]}.${format}`;

    return {
      content,
      contentType,
      filename,
    };
  }
}

