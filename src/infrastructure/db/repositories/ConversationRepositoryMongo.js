import { ConversationModel } from "../models/conversation.model.js";
import { IConversationRepository } from "../../../domain/repositories/IConversationRepository.js";
import { withTenantAndNotDeleted, withTenantAndActive } from "../../../domain/utils/tenant-helpers.js";

/**
 * Implementación de IConversationRepository usando Mongoose
 */
export class ConversationRepositoryMongo extends IConversationRepository {
  /**
   * Crea una nueva conversación
   */
  async create(tenantId, conversationData) {
    const conversationDoc = await ConversationModel.create({
      tenantId,
      ...conversationData,
    });

    return conversationDoc.toObject();
  }

  /**
   * Busca una conversación por ID y tenantId
   */
  async findById(tenantId, conversationId, options = {}) {
    const { includeDeleted = false, select = null } = options;

    const query = { _id: conversationId, tenantId };
    if (!includeDeleted) {
      query.deletedAt = null;
    }

    let queryBuilder = ConversationModel.findOne(query);

    if (select) {
      queryBuilder = queryBuilder.select(select);
    }

    const conversationDoc = await queryBuilder.lean();

    return conversationDoc;
  }

  /**
   * Busca la conversación activa de un usuario para un PDF específico
   */
  async findActive(tenantId, userId, pdfId) {
    const conversation = await ConversationModel.findOne(
      withTenantAndActive(
        {
          userId,
          pdfId,
        },
        tenantId
      )
    ).lean();

    return conversation;
  }

  /**
   * Lista todas las conversaciones de un usuario
   */
  async findAll(tenantId, userId, options = {}) {
    const { pdfId = null, limit = 20, skip = 0, sort = { lastMessageAt: -1 } } = options;

    const query = withTenantAndNotDeleted({ userId }, tenantId);

    if (pdfId) {
      query.pdfId = pdfId;
    }

    return await ConversationModel.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();
  }

  /**
   * Actualiza una conversación
   */
  async update(tenantId, conversationId, updateData) {
    const conversationDoc = await ConversationModel.findOneAndUpdate(
      { _id: conversationId, tenantId },
      updateData,
      { new: true }
    );

    if (!conversationDoc) {
      return null;
    }

    return conversationDoc.toObject();
  }

  /**
   * Cierra una conversación
   */
  async close(tenantId, conversationId) {
    const conversationDoc = await ConversationModel.findOneAndUpdate(
      { _id: conversationId, tenantId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!conversationDoc) {
      return null;
    }

    return conversationDoc.toObject();
  }

  /**
   * Actualiza las estadísticas de tokens de una conversación
   */
  async updateTokenStats(tenantId, conversationId, tokenData) {
    const updateOperation = {
      $inc: {
        totalPromptTokens: tokenData.promptTokens || 0,
        totalCompletionTokens: tokenData.completionTokens || 0,
        totalTokens: tokenData.totalTokens || 0,
      },
    };

    if (tokenData.cost !== undefined) {
      updateOperation.$inc.tokenCost = tokenData.cost;
    }

    const conversationDoc = await ConversationModel.findByIdAndUpdate(
      conversationId,
      updateOperation,
      { new: true }
    );

    if (!conversationDoc) {
      return null;
    }

    return conversationDoc.toObject();
  }

  /**
   * Marca pdfDeletedAt en todas las conversaciones de un PDF
   */
  async markPdfDeleted(tenantId, pdfId) {
    const result = await ConversationModel.updateMany(
      {
        tenantId,
        pdfId,
        pdfDeletedAt: null, // Solo actualizar si no estaba ya marcado
      },
      {
        $set: { pdfDeletedAt: new Date() },
      }
    );

    return result.modifiedCount;
  }

  /**
   * Remueve pdfDeletedAt de todas las conversaciones de un PDF
   */
  async unmarkPdfDeleted(tenantId, pdfId) {
    const result = await ConversationModel.updateMany(
      {
        tenantId,
        pdfId,
        pdfDeletedAt: { $ne: null },
      },
      {
        $unset: { pdfDeletedAt: "" },
      }
    );

    return result.modifiedCount;
  }

  /**
   * Busca una conversación con sus mensajes usando agregación
   */
  async findWithMessages(tenantId, conversationId, options = {}) {
    const { limit = 50, sort = { index: 1 } } = options;

    const conversations = await ConversationModel.aggregate([
      {
        $match: {
          _id: conversationId,
          tenantId,
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
                    { $eq: ["$tenantId", tenantId] },
                    { $eq: ["$deletedAt", null] },
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

    if (!conversations || conversations.length === 0) {
      return null;
    }

    return conversations[0];
  }

  /**
   * Realiza soft-delete de una conversación
   */
  async softDelete(tenantId, conversationId) {
    const conversationDoc = await ConversationModel.findByIdAndUpdate(
      conversationId,
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!conversationDoc) {
      return null;
    }

    return conversationDoc.toObject();
  }

  /**
   * Realiza hard-delete de una conversación
   */
  async hardDelete(tenantId, conversationId) {
    const result = await ConversationModel.deleteOne({
      _id: conversationId,
      tenantId,
    });

    return result.deletedCount > 0;
  }

  /**
   * Realiza soft-delete masivo de conversaciones de un usuario
   */
  async softDeleteByUser(tenantId, userId) {
    const result = await ConversationModel.updateMany(
      { tenantId, userId },
      { $set: { deletedAt: new Date() } }
    );

    return result.modifiedCount;
  }

  /**
   * Realiza hard-delete masivo de conversaciones de un usuario
   */
  async hardDeleteByUser(tenantId, userId) {
    const result = await ConversationModel.deleteMany({ tenantId, userId });
    return result.deletedCount;
  }
}

