/**
 * Caso de uso para obtener contexto de conversación
 * Orquesta la lógica de negocio del proceso de obtener contexto (ventana deslizante)
 */
export class GetConversationContextUseCase {
  constructor(conversationRepository, messageRepository) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener contexto
   * @param {Object} request - Objeto con tenantId, conversationId y windowSize
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.conversationId - ID de la conversación
   * @param {number|null} request.windowSize - Tamaño de la ventana de contexto (opcional)
   * @returns {Promise<Array>} Array de mensajes en orden cronológico
   */
  async execute({ tenantId, conversationId, windowSize = null }) {
    // Obtener conversación para verificar que existe y obtener contextWindowSize por defecto
    const conversation = await this.conversationRepository.findById(
      tenantId,
      conversationId
    );

    if (!conversation) {
      throw new Error("Conversación no encontrada");
    }

    // Determinar tamaño de ventana
    const size = windowSize || conversation.contextWindowSize || 10;

    // Obtener últimos N mensajes (más recientes primero)
    const messages = await this.messageRepository.findRecent(
      tenantId,
      conversationId,
      size
    );

    // Revertir orden para tener cronológico (más antiguos primero)
    return messages.reverse();
  }
}

