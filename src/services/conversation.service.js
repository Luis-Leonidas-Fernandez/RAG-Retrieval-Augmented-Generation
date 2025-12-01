import { ConversationModel } from "../models/conversation.model.js";
import { PdfModel } from "../models/pdf.model.js";
import { MessageModel } from "../models/message.model.js";
import { withTenantAndNotDeleted, withTenantAndActive } from "../utils/tenant-helpers.js";

/**
 * Validar que PDF existe y no está borrado
 */
export async function validatePdfExists(tenantId, pdfId) {
  const pdf = await PdfModel.findOne({
    _id: pdfId,
    tenantId, // CRÍTICO: validar tenant
    isDeleted: false,
  });

  if (!pdf) {
    throw new Error("PDF no encontrado o no pertenece al tenant");
  }

  return pdf;
}

/**
 * Obtener o crear conversación activa
 */
export async function getOrCreateActiveConversation(tenantId, userId, pdfId) {
  // Validar que PDF existe
  await validatePdfExists(tenantId, pdfId);

  // Buscar conversación activa existente
  let conversation = await ConversationModel.findOne(
    withTenantAndActive(
      {
        userId,
        pdfId,
      },
      tenantId
    )
  ).lean();

  if (conversation) {
    return conversation;
  }

  // Crear nueva conversación
  try {
    conversation = await ConversationModel.create({
      tenantId,
      userId,
      pdfId,
      title: "Nueva conversación",
      isActive: true,
      contextWindowSize: 10,
      messageCount: 0,
    });

    return conversation.toObject();
  } catch (error) {
    // Manejar error de índice único (race condition)
    if (error.code === 11000) {
      // Intentar obtener la conversación que se creó en paralelo
      conversation = await ConversationModel.findOne(
        withTenantAndActive(
          {
            userId,
            pdfId,
          },
          tenantId
        )
      ).lean();

      if (conversation) {
        return conversation;
      }
    }
    throw error;
  }
}

/**
 * Obtener conversación completa con mensajes
 */
export async function getFullConversation(tenantId, conversationId, options = {}) {
  const { getConversationWithMessages } = await import("./message.service.js");
  return await getConversationWithMessages(tenantId, conversationId, options);
}

/**
 * Construir ventana de contexto
 */
export async function buildContextWindow(tenantId, conversationId, windowSize = null) {
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    tenantId, // CRÍTICO: validar tenant
  }).lean();

  if (!conversation) {
    throw new Error("Conversación no encontrada");
  }

  const size = windowSize || conversation.contextWindowSize || 10;

  // Obtener últimos N mensajes
  const messageService = await import("./message.service.js");
  const messages = await messageService.getMessages(tenantId, conversationId, {
    limit: size,
    sort: { createdAt: -1 }, // Más recientes primero
  });

  // Revertir orden para tener cronológico
  return messages.reverse();
}

/**
 * Listar conversaciones del usuario
 */
export async function listUserConversations(tenantId, userId, options = {}) {
  const { pdfId = null, limit = 20, skip = 0 } = options;

  const query = withTenantAndNotDeleted({ userId }, tenantId);

  if (pdfId) {
    query.pdfId = pdfId;
  }

  return await ConversationModel.find(query)
    .sort({ lastMessageAt: -1 }) // Más recientes primero
    .limit(limit)
    .skip(skip)
    .lean();
}

/**
 * Obtener conversación activa
 */
export async function getActiveConversation(tenantId, userId, pdfId) {
  return await ConversationModel.findOne(
    withTenantAndActive(
      {
        userId,
        pdfId,
      },
      tenantId
    )
  ).lean();
}

/**
 * Cerrar conversación
 */
export async function closeConversation(tenantId, conversationId) {
  const conversation = await ConversationModel.findOneAndUpdate(
    {
      _id: conversationId,
      tenantId, // CRÍTICO: validar tenant
    },
    { isActive: false },
    { new: true }
  );

  if (!conversation) {
    throw new Error("Conversación no encontrada");
  }

  return conversation;
}

/**
 * Obtener estadísticas de tokens de una conversación
 */
export async function getConversationTokenStats(tenantId, conversationId) {
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    tenantId, // CRÍTICO: validar tenant
  })
    .select("totalPromptTokens totalCompletionTokens totalTokens tokenCost")
    .lean();

  if (!conversation) {
    throw new Error("Conversación no encontrada");
  }

  return {
    promptTokens: conversation.totalPromptTokens || 0,
    completionTokens: conversation.totalCompletionTokens || 0,
    totalTokens: conversation.totalTokens || 0,
    cost: conversation.tokenCost || 0,
  };
}

