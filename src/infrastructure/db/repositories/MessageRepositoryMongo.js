import { MessageModel } from "../models/message.model.js";
import { ConversationModel } from "../models/conversation.model.js";
import { IMessageRepository } from "../../../domain/repositories/IMessageRepository.js";
import { withTenantAndNotDeleted } from "../../../domain/utils/tenant-helpers.js";

/**
 * Implementación de IMessageRepository usando Mongoose
 */
export class MessageRepositoryMongo extends IMessageRepository {
  /**
   * Crea un nuevo mensaje
   * Nota: Este método también actualiza la conversación (messageCount, lastMessageAt)
   * pero esa lógica debería estar en un UseCase. Por ahora mantenemos compatibilidad.
   */
  async create(tenantId, conversationId, messageData) {
    // Validar que la conversación existe y pertenece al tenant
    const conv = await ConversationModel.findOne({
      _id: conversationId,
      tenantId,
    });

    if (!conv) {
      throw new Error("Conversación no encontrada o no pertenece al tenant");
    }

    // Crear mensaje
    const messageDoc = await MessageModel.create({
      tenantId,
      conversationId,
      ...messageData,
    });

    return messageDoc.toObject();
  }

  /**
   * Busca mensajes de una conversación
   */
  async findByConversationId(tenantId, conversationId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      sort = { index: 1 },
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
   * Busca los mensajes más recientes de una conversación
   */
  async findRecent(tenantId, conversationId, limit = 10) {
    return await this.findByConversationId(tenantId, conversationId, {
      limit,
      sort: { createdAt: -1 },
    });
  }

  /**
   * Cuenta mensajes de una conversación
   */
  async count(tenantId, conversationId, options = {}) {
    const { includeDeleted = false } = options;

    const query = withTenantAndNotDeleted({ conversationId }, tenantId);

    if (includeDeleted) {
      delete query.deletedAt;
    }

    return await MessageModel.countDocuments(query);
  }

  /**
   * Obtiene una conversación con sus mensajes usando agregación
   */
  async findConversationWithMessages(tenantId, conversationId, options = {}) {
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
   * Realiza soft-delete masivo de mensajes de una conversación
   */
  async softDeleteByConversationId(tenantId, conversationId) {
    const result = await MessageModel.updateMany(
      { tenantId, conversationId },
      { $set: { deletedAt: new Date() } }
    );

    return result.modifiedCount;
  }

  /**
   * Realiza hard-delete masivo de mensajes de una conversación
   */
  async hardDeleteByConversationId(tenantId, conversationId) {
    const result = await MessageModel.deleteMany({ tenantId, conversationId });
    return result.deletedCount;
  }

  /**
   * Realiza soft-delete masivo de mensajes de un usuario
   */
  async softDeleteByUser(tenantId, userId) {
    const result = await MessageModel.updateMany(
      { tenantId, userId },
      { $set: { deletedAt: new Date() } }
    );

    return result.modifiedCount;
  }

  /**
   * Realiza hard-delete masivo de mensajes de un usuario
   */
  async hardDeleteByUser(tenantId, userId) {
    const result = await MessageModel.deleteMany({ tenantId, userId });
    return result.deletedCount;
  }
}

