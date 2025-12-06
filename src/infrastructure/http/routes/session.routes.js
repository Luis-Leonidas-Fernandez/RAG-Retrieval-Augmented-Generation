import { Router } from "express";
import { SessionController } from "../../../interfaces/http/controllers/SessionController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";

// Instanciar SessionController
const sessionController = new SessionController();

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(generalUserRateLimit);

// GET /api/sessions - Listar mis sesiones activas
router.get("/", sessionController.getMySessions.bind(sessionController));

// GET /api/sessions/history - Obtener historial de logins
router.get("/history", sessionController.getLoginHistory.bind(sessionController));

// DELETE /api/sessions/:sessionId - Cerrar sesión específica
router.delete("/:sessionId", sessionController.closeSession.bind(sessionController));

// DELETE /api/sessions - Cerrar todas mis sesiones
router.delete("/", sessionController.closeAllSessions.bind(sessionController));

export default router;

