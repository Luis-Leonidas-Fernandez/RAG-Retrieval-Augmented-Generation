/**
 * Caso de uso para listar conversaciones
 * Orquesta la lógica de negocio del proceso de listado de conversaciones
 */
export class ListConversationsUseCase {
  constructor(conversationRepository) {
    this.conversationRepository = conversationRepository;
  }

  /**
   * Ejecuta el caso de uso de listar conversaciones
   * @param {Object} request - Objeto con tenantId, userId y filters
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {Object} request.filters - Filtros de búsqueda
   * @param {string|ObjectId|null} request.filters.pdfId - ID del PDF (opcional)
   * @param {number} request.filters.limit - Límite de resultados
   * @param {number} request.filters.skip - Número de resultados a saltar
   * @returns {Promise<Object>} Objeto con conversations y count
   */
  async execute({ tenantId, userId, filters = {} }) {
    const { pdfId = null, limit = 20, skip = 0 } = filters;

    // Obtener conversaciones
    const conversations = await this.conversationRepository.findAll(
      tenantId,
      userId,
      {
        pdfId,
        limit,
        skip,
        sort: { lastMessageAt: -1 }, // Más recientes primero
      }
    );

    return {
      conversations,
      count: conversations.length,
    };
  }
}

