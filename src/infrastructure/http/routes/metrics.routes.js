import { Router } from "express";
import { MetricsController } from "../../../interfaces/http/controllers/MetricsController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";

// Instanciar MetricsController
const metricsController = new MetricsController();

const router = Router();

// Todas las rutas requieren autenticación y rate limiting
router.use(authenticateToken);
router.use(generalUserRateLimit);

// GET /api/metrics/current - Métricas actuales
router.get("/current", metricsController.getCurrentMetrics.bind(metricsController));

// GET /api/metrics/history - Métricas históricas
router.get("/history", metricsController.getMetricsHistory.bind(metricsController));

// GET /api/metrics/aggregated - Métricas agregadas
router.get("/aggregated", metricsController.getMetricsAggregated.bind(metricsController));

// GET /api/metrics/export - Exportar métricas
router.get("/export", metricsController.exportMetricsData.bind(metricsController));

export default router;

