import { Router } from "express";
import {
  deleteMyConversation,
  deleteAllMyData,
  toggleHistoryPreference,
  getMyDataSummary,
} from "../controllers/privacy.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(generalUserRateLimit);

// DELETE /api/privacy/conversation/:conversationId - Borrar mi conversación
router.delete("/conversation/:conversationId", validateIdParam("conversationId"), deleteMyConversation);

// DELETE /api/privacy/data - Borrar todos mis datos (GDPR)
router.delete("/data", deleteAllMyData);

// PUT /api/privacy/history - Activar/desactivar historial
router.put("/history", toggleHistoryPreference);

// GET /api/privacy/data - Obtener resumen de mis datos (GDPR)
router.get("/data", getMyDataSummary);

export default router;

