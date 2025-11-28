import {
  collectMetrics,
  getHistoricalMetrics,
  getAggregatedMetrics,
  exportMetrics,
} from "../services/metrics.service.js";

/**
 * Obtener métricas actuales (en tiempo real)
 */
export const getCurrentMetrics = async (req, res) => {
  try {
    console.log("[Metrics Controller] Iniciando recolección de métricas...");
    const metrics = await collectMetrics();
    
    // Log para debug
    console.log("[Metrics Controller] Métricas recolectadas:", {
      hasMemory: !!metrics?.memory,
      hasSystem: !!metrics?.system,
      hasProcess: !!metrics?.process,
      memoryKeys: metrics?.memory ? Object.keys(metrics.memory) : null,
      systemKeys: metrics?.system ? Object.keys(metrics.system) : null,
      timestamp: metrics?.timestamp,
    });
    
    // Validar que collectMetrics retorne datos válidos
    if (!metrics || !metrics.memory || !metrics.system) {
      console.error("[Metrics Controller] collectMetrics retornó datos inválidos:", metrics);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener métricas: datos inválidos",
      });
    }
    
    console.log("[Metrics Controller] Enviando respuesta exitosa");
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
};

/**
 * Obtener métricas históricas
 */
export const getMetricsHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const sort = parseInt(req.query.sort || '-1', 10);

    const metrics = await getHistoricalMetrics({
      limit: Math.min(limit, 1000), // Máximo 1000 registros
      startDate,
      endDate,
      sort,
    });

    return res.json({
      ok: true,
      count: metrics.length,
      metrics,
    });
  } catch (error) {
    console.error("[Metrics Controller] Error al obtener métricas históricas:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener métricas históricas",
    });
  }
};

/**
 * Obtener métricas agregadas
 */
export const getMetricsAggregated = async (req, res) => {
  try {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    const aggregated = await getAggregatedMetrics(startDate, endDate);

    if (!aggregated) {
      return res.json({
        ok: true,
        message: "No hay métricas disponibles para el período especificado",
        aggregated: null,
      });
    }

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
};

/**
 * Exportar métricas
 */
export const exportMetricsData = async (req, res) => {
  try {
    const format = req.query.format || 'json'; // json o csv
    const limit = parseInt(req.query.limit || '1000', 10);
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        ok: false,
        message: "Formato no soportado. Use 'json' o 'csv'",
      });
    }

    const data = await exportMetrics(format, {
      limit: Math.min(limit, 10000), // Máximo 10000 registros para exportación
      startDate,
      endDate,
    });

    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `metrics-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(data);
  } catch (error) {
    console.error("[Metrics Controller] Error al exportar métricas:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al exportar métricas",
    });
  }
};

