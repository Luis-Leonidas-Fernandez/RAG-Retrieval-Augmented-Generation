import { Router } from "express";
import {
  getActiveConversationController,
  getConversation,
  listConversations,
  closeConversationController,
  getContext,
  getTokenStats,
} from "../controllers/conversation.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(generalUserRateLimit);

// GET /api/conversations/active/:pdfId - Obtener conversación activa
router.get("/active/:pdfId", validateIdParam("pdfId"), getActiveConversationController);

// GET /api/conversations/:conversationId - Obtener conversación específica
router.get("/:conversationId", validateIdParam("conversationId"), getConversation);

// GET /api/conversations - Listar conversaciones
router.get("/", listConversations);

// GET /api/conversations/:conversationId/context - Obtener contexto
router.get("/:conversationId/context", validateIdParam("conversationId"), getContext);

// GET /api/conversations/:conversationId/tokens - Obtener estadísticas de tokens
router.get("/:conversationId/tokens", validateIdParam("conversationId"), getTokenStats);

// DELETE /api/conversations/:conversationId - Cerrar conversación
router.delete("/:conversationId", validateIdParam("conversationId"), closeConversationController);

export default router;

