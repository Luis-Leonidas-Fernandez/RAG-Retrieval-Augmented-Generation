import { Router } from "express";
import { ConversationController } from "../../../interfaces/http/controllers/ConversationController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

// Instanciar ConversationController
const conversationController = new ConversationController();

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(generalUserRateLimit);

// GET /api/conversations - Listar conversaciones (debe ir antes de las rutas con parámetros)
router.get("/", conversationController.listConversations.bind(conversationController));

// GET /api/conversations/active/:pdfId - Obtener conversación activa
router.get("/active/:pdfId", validateIdParam("pdfId"), conversationController.getActiveConversation.bind(conversationController));

// GET /api/conversations/:conversationId/context - Obtener contexto (debe ir antes de /:conversationId)
router.get("/:conversationId/context", validateIdParam("conversationId"), conversationController.getContext.bind(conversationController));

// GET /api/conversations/:conversationId/tokens - Obtener estadísticas de tokens (debe ir antes de /:conversationId)
router.get("/:conversationId/tokens", validateIdParam("conversationId"), conversationController.getTokenStats.bind(conversationController));

// GET /api/conversations/:conversationId - Obtener conversación específica
router.get("/:conversationId", validateIdParam("conversationId"), conversationController.getConversation.bind(conversationController));

// DELETE /api/conversations/:conversationId - Cerrar conversación
router.delete("/:conversationId", validateIdParam("conversationId"), conversationController.closeConversation.bind(conversationController));

export default router;

