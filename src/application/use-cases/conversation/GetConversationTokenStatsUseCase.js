/**
 * Caso de uso para obtener estadísticas de tokens de una conversación
 * Orquesta la lógica de negocio del proceso de obtener estadísticas de tokens
 */
export class GetConversationTokenStatsUseCase {
  constructor(conversationRepository) {
    this.conversationRepository = conversationRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener estadísticas de tokens
   * @param {Object} request - Objeto con tenantId y conversationId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.conversationId - ID de la conversación
   * @returns {Promise<Object>} Objeto con estadísticas de tokens
   */
  async execute({ tenantId, conversationId }) {
    // Obtener conversación con campos de tokens
    const conversation = await this.conversationRepository.findById(
      tenantId,
      conversationId,
      {
        select: "totalPromptTokens totalCompletionTokens totalTokens tokenCost",
      }
    );

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
}

