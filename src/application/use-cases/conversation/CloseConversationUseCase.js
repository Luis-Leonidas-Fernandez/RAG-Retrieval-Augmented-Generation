/**
 * Caso de uso para cerrar una conversación
 * Orquesta la lógica de negocio del proceso de cerrar conversación
 */
export class CloseConversationUseCase {
  constructor(conversationRepository) {
    this.conversationRepository = conversationRepository;
  }

  /**
   * Ejecuta el caso de uso de cerrar conversación
   * @param {Object} request - Objeto con tenantId, userId y conversationId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario (para validación)
   * @param {string|ObjectId} request.conversationId - ID de la conversación
   * @returns {Promise<Object>} Conversación cerrada
   * @throws {Error} Si la conversación no existe o no pertenece al usuario/tenant
   */
  async execute({ tenantId, userId, conversationId }) {
    // Verificar que la conversación existe y pertenece al usuario y tenant
    const conversation = await this.conversationRepository.findById(
      tenantId,
      conversationId
    );

    if (!conversation) {
      throw new Error("Conversación no encontrada");
    }

    // Validar que la conversación pertenece al usuario
    if (conversation.userId?.toString() !== userId?.toString()) {
      throw new Error("No tienes permiso para cerrar esta conversación");
    }

    // Cerrar conversación
    const closedConversation = await this.conversationRepository.close(
      tenantId,
      conversationId
    );

    if (!closedConversation) {
      throw new Error("Error al cerrar la conversación");
    }

    return closedConversation;
  }
}

