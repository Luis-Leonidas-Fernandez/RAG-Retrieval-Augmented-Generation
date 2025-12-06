/**
 * Caso de uso para obtener conversación activa
 * Orquesta la lógica de negocio del proceso de obtener conversación activa
 */
export class GetActiveConversationUseCase {
  constructor(conversationRepository) {
    this.conversationRepository = conversationRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener conversación activa
   * @param {Object} request - Objeto con tenantId, userId y pdfId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string|ObjectId} request.pdfId - ID del PDF
   * @returns {Promise<Object|null>} Conversación activa encontrada o null
   */
  async execute({ tenantId, userId, pdfId }) {
    // Buscar conversación activa
    const conversation = await this.conversationRepository.findActive(
      tenantId,
      userId,
      pdfId
    );

    return conversation;
  }
}

