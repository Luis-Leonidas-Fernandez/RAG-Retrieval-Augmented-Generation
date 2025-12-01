import { Router } from "express";
import {
  getMySessions,
  closeSession,
  closeAllSessions,
  getLoginHistoryController,
} from "../controllers/session.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(generalUserRateLimit);

// GET /api/sessions - Listar mis sesiones activas
router.get("/", getMySessions);

// GET /api/sessions/history - Obtener historial de logins
router.get("/history", getLoginHistoryController);

// DELETE /api/sessions/:sessionId - Cerrar sesión específica
router.delete("/:sessionId", closeSession);

// DELETE /api/sessions - Cerrar todas mis sesiones
router.delete("/", closeAllSessions);

export default router;

