import { MessageModel } from "../models/message.model.js";
import { ConversationModel } from "../models/conversation.model.js";
import { withTenantAndNotDeleted } from "../utils/tenant-helpers.js";
import { calculateTokenCost } from "../utils/token-utils.js";

/**
 * Obtener mensajes de una conversación (función genérica)
 */
export async function getMessages(tenantId, conversationId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    sort = { index: 1 }, // Orden por defecto: ascendente por index
    includeDeleted = false,
  } = options;

  const query = withTenantAndNotDeleted({ conversationId }, tenantId);

  if (includeDeleted) {
    delete query.deletedAt;
  }

  return await MessageModel.find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .lean();
}

/**
 * Contar mensajes de una conversación
 */
export async function countMessages(tenantId, conversationId) {
  return await MessageModel.countDocuments(
    withTenantAndNotDeleted({ conversationId }, tenantId)
  );
}

/**
 * Crear mensaje con sincronización atómica
 */
export async function createMessage(tenantId, conversationId, role, content, metadata = {}) {
  // Validar que conversation pertenece al tenant
  const conv = await ConversationModel.findOne({
    _id: conversationId,
    tenantId, // CRÍTICO: validar tenant
  });

  if (!conv) {
    throw new Error("Conversación no encontrada o no pertenece al tenant");
  }

  // Actualización atómica: incrementar messageCount y obtener nuevo valor
  const updateData = {
    $inc: { messageCount: 1 },
    $set: { lastMessageAt: new Date() },
  };

  // Si es el primer mensaje (messageCount será 1 después del incremento), generar título
  if (conv.messageCount === 0 && role === "user") {
    const title = content.substring(0, 50).trim() || "Nueva conversación";
    updateData.$set.title = title;
  }

  const updatedConv = await ConversationModel.findOneAndUpdate(
    { _id: conversationId, tenantId },
    updateData,
    { new: true }
  ).lean();

  if (!updatedConv) {
    throw new Error("Error al actualizar conversación");
  }

  // Calcular index desde messageCount (empieza en 0)
  const index = updatedConv.messageCount - 1;

  // Crear mensaje
  const message = await MessageModel.create({
    tenantId,
    conversationId,
    role,
    content,
    index,
    metadata,
  });

  // Actualizar acumuladores de tokens si metadata.tokens existe
  if (metadata.tokens) {
    const tokenUpdates = {
      $inc: {
        totalPromptTokens: metadata.tokens.prompt_tokens || 0,
        totalCompletionTokens: metadata.tokens.completion_tokens || 0,
        totalTokens: metadata.tokens.total_tokens || 0,
      },
    };

    // Calcular y actualizar costo
    if (metadata.tokens.prompt_tokens && metadata.tokens.completion_tokens) {
      const cost = calculateTokenCost(
        metadata.tokens.prompt_tokens,
        metadata.tokens.completion_tokens,
        metadata.llmModel || "gpt-4o-mini"
      );
      tokenUpdates.$inc.tokenCost = cost;
    }

    await ConversationModel.findByIdAndUpdate(conversationId, tokenUpdates);
  }

  return message;
}

/**
 * Obtener conversación con mensajes usando $lookup
 */
export async function getConversationWithMessages(tenantId, conversationId, options = {}) {
  const { limit = 50, sort = { index: 1 } } = options;

  const conversation = await ConversationModel.aggregate([
    {
      $match: {
        _id: conversationId,
        tenantId, // CRÍTICO: validar tenant
      },
    },
    {
      $lookup: {
        from: "messages",
        let: { convId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversationId", "$$convId"] },
                  { $eq: ["$tenantId", tenantId] }, // Filtrar por tenant
                  { $eq: ["$deletedAt", null] }, // No incluir borrados
                ],
              },
            },
          },
          { $sort: sort },
          { $limit: limit },
        ],
        as: "messages",
      },
    },
  ]);

  if (!conversation || conversation.length === 0) {
    return null;
  }

  return conversation[0];
}

/**
 * Obtener mensajes recientes (últimos N)
 */
export async function getRecentMessages(tenantId, conversationId, limit = 10) {
  return await getMessages(tenantId, conversationId, {
    limit,
    sort: { createdAt: -1 }, // Más recientes primero
  });
}

