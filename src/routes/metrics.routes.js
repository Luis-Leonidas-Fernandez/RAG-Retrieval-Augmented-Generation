import { Router } from "express";
import {
  getCurrentMetrics,
  getMetricsHistory,
  getMetricsAggregated,
  exportMetricsData,
} from "../controllers/metrics.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";

const router = Router();

// Todas las rutas requieren autenticación y rate limiting
router.use(authenticateToken);
router.use(generalUserRateLimit);

// GET /api/metrics/current - Métricas actuales
router.get("/current", getCurrentMetrics);

// GET /api/metrics/history - Métricas históricas
router.get("/history", getMetricsHistory);

// GET /api/metrics/aggregated - Métricas agregadas
router.get("/aggregated", getMetricsAggregated);

// GET /api/metrics/export - Exportar métricas
router.get("/export", exportMetricsData);

export default router;

