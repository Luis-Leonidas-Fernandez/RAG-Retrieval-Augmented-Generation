import { ConversationSummaryServiceImpl } from "../core/conversation-summary.service.js";
import { MessageRepositoryMongo } from "../../db/repositories/MessageRepositoryMongo.js";

/**
 * Wrapper del servicio de resúmenes de conversación para inyección de dependencias
 * Usa composición para delegar en ConversationSummaryServiceImpl
 */
export class ConversationSummaryService {
  constructor() {
    const messageRepository = new MessageRepositoryMongo();
    this.impl = new ConversationSummaryServiceImpl(messageRepository);
  }

  /**
   * Obtiene o genera resumen de conversación
   */
  async getOrGenerateSummary(tenantId, conversationId) {
    return await this.impl.getOrGenerateSummary(tenantId, conversationId);
  }

  /**
   * Invalida resumen de conversación
   */
  async invalidateConversationSummary(tenantId, conversationId, reason) {
    return await this.impl.invalidateConversationSummary(tenantId, conversationId, reason);
  }
}

