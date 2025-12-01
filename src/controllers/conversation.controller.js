import {
  getOrCreateActiveConversation,
  getFullConversation,
  listUserConversations,
  getActiveConversation,
  closeConversation,
  buildContextWindow,
  getConversationTokenStats,
} from "../services/conversation.service.js";
import { createResponse } from "../utils/response.js";

/**
 * Obtener conversación activa para un PDF
 */
export const getActiveConversationController = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { pdfId } = req.params;

    if (!pdfId) {
      return res.status(400).json(
        createResponse(false, "pdfId es requerido")
      );
    }

    const conversation = await getActiveConversation(tenantId, userId, pdfId);

    if (!conversation) {
      return res.status(404).json(
        createResponse(false, "No hay conversación activa para este PDF")
      );
    }

    return res.json(
      createResponse(true, "Conversación obtenida correctamente", {
        conversation,
      })
    );
  } catch (error) {
    console.error("[Conversation Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener conversación", { error: error.message })
    );
  }
};

/**
 * Obtener conversación específica con mensajes
 */
export const getConversation = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json(
        createResponse(false, "conversationId es requerido")
      );
    }

    const conversation = await getFullConversation(tenantId, conversationId);

    if (!conversation) {
      return res.status(404).json(
        createResponse(false, "Conversación no encontrada")
      );
    }

    return res.json(
      createResponse(true, "Conversación obtenida correctamente", {
        conversation,
      })
    );
  } catch (error) {
    console.error("[Conversation Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener conversación", { error: error.message })
    );
  }
};

/**
 * Listar conversaciones del usuario
 */
export const listConversations = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const pdfId = req.query.pdfId || null;
    const limit = parseInt(req.query.limit || "20", 10);
    const skip = parseInt(req.query.skip || "0", 10);

    const conversations = await listUserConversations(tenantId, userId, {
      pdfId,
      limit,
      skip,
    });

    return res.json(
      createResponse(true, "Conversaciones obtenidas correctamente", {
        conversations,
        count: conversations.length,
      })
    );
  } catch (error) {
    console.error("[Conversation Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al listar conversaciones", { error: error.message })
    );
  }
};

/**
 * Cerrar conversación
 */
export const closeConversationController = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json(
        createResponse(false, "conversationId es requerido")
      );
    }

    await closeConversation(tenantId, conversationId);

    return res.json(
      createResponse(true, "Conversación cerrada correctamente")
    );
  } catch (error) {
    console.error("[Conversation Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al cerrar conversación", { error: error.message })
    );
  }
};

/**
 * Obtener contexto con ventana deslizante
 */
export const getContext = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { conversationId } = req.params;
    const windowSize = parseInt(req.query.window || "10", 10);

    if (!conversationId) {
      return res.status(400).json(
        createResponse(false, "conversationId es requerido")
      );
    }

    const context = await buildContextWindow(tenantId, conversationId, windowSize);

    return res.json(
      createResponse(true, "Contexto obtenido correctamente", {
        context,
        windowSize: context.length,
      })
    );
  } catch (error) {
    console.error("[Conversation Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener contexto", { error: error.message })
    );
  }
};

/**
 * Obtener estadísticas de tokens de una conversación
 */
export const getTokenStats = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json(
        createResponse(false, "conversationId es requerido")
      );
    }

    const stats = await getConversationTokenStats(tenantId, conversationId);

    return res.json(
      createResponse(true, "Estadísticas obtenidas correctamente", {
        stats,
      })
    );
  } catch (error) {
    console.error("[Conversation Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener estadísticas", { error: error.message })
    );
  }
};

