import { Router } from "express";
import { PrivacyController } from "../../../interfaces/http/controllers/PrivacyController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

// Instanciar PrivacyController
const privacyController = new PrivacyController();

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(generalUserRateLimit);

// DELETE /api/privacy/conversation/:conversationId - Borrar mi conversación
router.delete(
  "/conversation/:conversationId",
  validateIdParam("conversationId"),
  privacyController.deleteMyConversation.bind(privacyController)
);

// DELETE /api/privacy/data - Borrar todos mis datos (GDPR)
router.delete("/data", privacyController.deleteAllMyData.bind(privacyController));

// PUT /api/privacy/history - Activar/desactivar historial
router.put(
  "/history",
  privacyController.toggleHistoryPreference.bind(privacyController)
);

// GET /api/privacy/data - Obtener resumen de mis datos (GDPR)
router.get("/data", privacyController.getMyDataSummary.bind(privacyController));

export default router;

