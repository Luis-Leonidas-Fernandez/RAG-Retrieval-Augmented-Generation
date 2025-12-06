import { GetCurrentMetricsUseCase } from "../../../application/use-cases/metrics/GetCurrentMetricsUseCase.js";
import { GetMetricsHistoryUseCase } from "../../../application/use-cases/metrics/GetMetricsHistoryUseCase.js";
import { GetMetricsAggregatedUseCase } from "../../../application/use-cases/metrics/GetMetricsAggregatedUseCase.js";
import { ExportMetricsDataUseCase } from "../../../application/use-cases/metrics/ExportMetricsDataUseCase.js";
import { MetricsRepositoryMongo } from "../../../infrastructure/db/repositories/MetricsRepositoryMongo.js";
import { MetricsCollectorService } from "../../../infrastructure/services/adapters/metrics-collector-wrapper.service.js";

/**
 * Controller HTTP para Métricas
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class MetricsController {
  constructor() {
    // Instanciar dependencias (en el futuro se puede usar inyección de dependencias)
    this.metricsRepository = new MetricsRepositoryMongo();
    this.metricsCollectorService = new MetricsCollectorService();

    // Crear instancias de los use cases con dependencias inyectadas
    this.getCurrentMetricsUseCase = new GetCurrentMetricsUseCase(
      this.metricsCollectorService
    );
    this.getMetricsHistoryUseCase = new GetMetricsHistoryUseCase(
      this.metricsRepository
    );
    this.getMetricsAggregatedUseCase = new GetMetricsAggregatedUseCase(
      this.metricsRepository
    );
    this.exportMetricsDataUseCase = new ExportMetricsDataUseCase(
      this.metricsRepository
    );
  }

  /**
   * Maneja el endpoint de obtener métricas actuales
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getCurrentMetrics(req, res) {
    try {
      console.log("[Metrics Controller] Iniciando recolección de métricas...");
      const { tenantId } = req.user;

      // Ejecutar use case
      const metrics = await this.getCurrentMetricsUseCase.execute({ tenantId });

      // Log para debug
      console.log("[Metrics Controller] Métricas recolectadas:", {
        hasMemory: !!metrics?.memory,
        hasSystem: !!metrics?.system,
        hasProcess: !!metrics?.process,
        memoryKeys: metrics?.memory ? Object.keys(metrics.memory) : null,
        systemKeys: metrics?.system ? Object.keys(metrics.system) : null,
        timestamp: metrics?.timestamp,
      });

      console.log("[Metrics Controller] Enviando respuesta exitosa");
      // Responder con éxito (mantener formato del controller actual)
      return res.json({
        ok: true,
        metrics,
      });
    } catch (error) {
      console.error("[Metrics Controller] Error al obtener métricas actuales:", error);
      console.error("[Metrics Controller] Stack trace:", error.stack);
      return res.status(500).json({
        ok: false,
        message: error.message || "Error al obtener métricas",
      });
    }
  }

  /**
   * Maneja el endpoint de obtener métricas históricas
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getMetricsHistory(req, res) {
    try {
      const { tenantId } = req.user;
      const limit = parseInt(req.query.limit || "100", 10);
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const sort = parseInt(req.query.sort || "-1", 10);

      // Ejecutar use case
      const result = await this.getMetricsHistoryUseCase.execute({
        tenantId,
        filters: {
          limit,
          startDate,
          endDate,
          sort,
        },
      });

      // Responder con éxito (mantener formato del controller actual)
      return res.json({
        ok: true,
        count: result.count,
        metrics: result.metrics,
      });
    } catch (error) {
      console.error("[Metrics Controller] Error al obtener métricas históricas:", error);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener métricas históricas",
      });
    }
  }

  /**
   * Maneja el endpoint de obtener métricas agregadas
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getMetricsAggregated(req, res) {
    try {
      const { tenantId } = req.user;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;

      // Ejecutar use case
      const aggregated = await this.getMetricsAggregatedUseCase.execute({
        tenantId,
        filters: {
          startDate,
          endDate,
        },
      });

      if (!aggregated) {
        return res.json({
          ok: true,
          message: "No hay métricas disponibles para el período especificado",
          aggregated: null,
        });
      }

      // Responder con éxito (mantener formato del controller actual)
      return res.json({
        ok: true,
        aggregated,
      });
    } catch (error) {
      console.error("[Metrics Controller] Error al obtener métricas agregadas:", error);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener métricas agregadas",
      });
    }
  }

  /**
   * Maneja el endpoint de exportar métricas
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async exportMetricsData(req, res) {
    try {
      const { tenantId } = req.user;
      const format = req.query.format || "json";
      const limit = parseInt(req.query.limit || "1000", 10);
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;

      // Ejecutar use case
      const result = await this.exportMetricsDataUseCase.execute({
        tenantId,
        format,
        filters: {
          limit,
          startDate,
          endDate,
        },
      });

      // Configurar headers y enviar respuesta (mantener formato del controller actual)
      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      return res.send(result.content);
    } catch (error) {
      console.error("[Metrics Controller] Error al exportar métricas:", error);

      // Manejar error de formato no soportado
      if (error.message.includes("Formato no soportado")) {
        return res.status(400).json({
          ok: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        ok: false,
        message: "Error al exportar métricas",
      });
    }
  }
}

