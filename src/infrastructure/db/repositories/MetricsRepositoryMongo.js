import { MetricsModel } from "../models/metrics.model.js";
import { IMetricsRepository } from "../../../domain/repositories/IMetricsRepository.js";

/**
 * Implementación de IMetricsRepository usando Mongoose
 */
export class MetricsRepositoryMongo extends IMetricsRepository {
  /**
   * Guarda métricas del sistema
   */
  async save(metricsData) {
    const metricsDoc = await MetricsModel.create(metricsData);
    return metricsDoc.toObject();
  }

  /**
   * Obtiene métricas históricas
   */
  async findHistorical(options = {}) {
    const {
      limit = 100,
      startDate,
      endDate,
      sort = -1, // -1 para más recientes primero
    } = options;

    const query = {};

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    return await MetricsModel.find(query)
      .sort({ timestamp: sort })
      .limit(limit)
      .lean();
  }

  /**
   * Obtiene métricas agregadas (promedios, máximos, mínimos) para un período
   */
  async findAggregated(startDate, endDate) {
    const query = { timestamp: {} };
    if (startDate) {
      query.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      query.timestamp.$lte = new Date(endDate);
    }

    const metrics = await MetricsModel.find(query)
      .select("memory.heapUsed system.cpuUsage timestamp")
      .lean();

    if (metrics.length === 0) {
      return null;
    }

    // Extraer valores y calcular agregaciones
    const heapUsedValues = [];
    const cpuValues = [];

    for (const m of metrics) {
      if (m.memory && typeof m.memory.heapUsed === "number") {
        heapUsedValues.push(m.memory.heapUsed);
      }
      if (m.system && typeof m.system.cpuUsage === "number" && !isNaN(m.system.cpuUsage)) {
        cpuValues.push(m.system.cpuUsage);
      }
    }

    // Calcular agregaciones
    const result = {
      count: metrics.length,
      period: {
        start: metrics[metrics.length - 1].timestamp,
        end: metrics[0].timestamp,
      },
      memory: heapUsedValues.length > 0
        ? {
            heapUsed: {
              avg: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length,
              min: Math.min(...heapUsedValues),
              max: Math.max(...heapUsedValues),
            },
          }
        : null,
      cpu: cpuValues.length > 0
        ? {
            avg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
            min: Math.min(...cpuValues),
            max: Math.max(...cpuValues),
          }
        : null,
    };

    return result;
  }
}

