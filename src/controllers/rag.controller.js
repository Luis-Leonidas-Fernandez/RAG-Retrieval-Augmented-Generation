import { queryRag } from "../services/rag.service.js";
import { getOrCreateActiveConversation } from "../services/conversation.service.js";
import { createResponse } from "../utils/response.js";

export const ragQuery = async (req, res) => {
  try {
    const { tenantId, id: userId, tenantSettings } = req.user;
    const { pdfId, question, conversationId } = req.body;

    if (!pdfId || !question) {
      return res.status(400).json(
        createResponse(false, "pdfId y question son requeridos")
      );
    }

    // Obtener o crear conversación activa si no se proporciona conversationId
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      const conversation = await getOrCreateActiveConversation(tenantId, userId, pdfId);
      activeConversationId = conversation._id.toString();
    }

    // Llamar a queryRag con tenantId y conversationId
    const response = await queryRag(
      tenantId,
      pdfId,
      question,
      activeConversationId,
      tenantSettings
    );

    return res.json(
      createResponse(true, "Consulta RAG procesada correctamente", {
        answer: response.answer,
        context: response.context,
        conversationId: activeConversationId,
        tokens: response.tokens,
      })
    );
  } catch (err) {
    console.error("[RAG Controller] Error:", err);
    return res.status(500).json(
      createResponse(false, "Error en consulta RAG", { error: err.message })
    );
  }
};
