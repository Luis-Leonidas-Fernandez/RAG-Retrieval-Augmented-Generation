/**
 * Caso de uso para obtener conversación con mensajes
 * Orquesta la lógica de negocio del proceso de obtener conversación completa
 */
export class GetConversationUseCase {
  constructor(conversationRepository) {
    this.conversationRepository = conversationRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener conversación
   * @param {Object} request - Objeto con tenantId y conversationId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.conversationId - ID de la conversación
   * @param {Object} request.options - Opciones de consulta (limit, sort para mensajes)
   * @returns {Promise<Object|null>} Conversación con mensajes o null
   */
  async execute({ tenantId, conversationId, options = {} }) {
    // Obtener conversación con mensajes usando agregación
    const conversation = await this.conversationRepository.findWithMessages(
      tenantId,
      conversationId,
      options
    );

    return conversation;
  }
}

