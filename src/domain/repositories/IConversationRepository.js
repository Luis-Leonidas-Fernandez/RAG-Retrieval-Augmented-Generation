/**
 * Interface para repositorio de conversaciones
 * Define el contrato que deben cumplir las implementaciones
 */
export class IConversationRepository {
  /**
   * Crea una nueva conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Object} conversationData - Datos de la conversación (userId, pdfId, title, isActive, contextWindowSize)
   * @returns {Promise<Object>} Conversación creada
   */
  async create(tenantId, conversationData) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca una conversación por ID y tenantId
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} options - Opciones adicionales (includeDeleted: boolean, select: string)
   * @returns {Promise<Object|null>} Conversación encontrada o null
   */
  async findById(tenantId, conversationId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca la conversación activa de un usuario para un PDF específico
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {string|ObjectId} pdfId - ID del PDF
   * @returns {Promise<Object|null>} Conversación activa encontrada o null
   */
  async findActive(tenantId, userId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Lista todas las conversaciones de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {Object} options - Opciones de consulta (pdfId, limit, skip, sort)
   * @returns {Promise<Array<Object>>} Lista de conversaciones
   */
  async findAll(tenantId, userId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Actualiza una conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} updateData - Datos a actualizar (title, isActive, messageCount, lastMessageAt, summary, etc.)
   * @returns {Promise<Object>} Conversación actualizada
   */
  async update(tenantId, conversationId, updateData) {
    throw new Error("Method not implemented");
  }

  /**
   * Cierra una conversación (marca isActive = false)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @returns {Promise<Object>} Conversación cerrada
   */
  async close(tenantId, conversationId) {
    throw new Error("Method not implemented");
  }

  /**
   * Actualiza las estadísticas de tokens de una conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} tokenData - Datos de tokens (promptTokens, completionTokens, totalTokens, cost)
   * @returns {Promise<Object>} Conversación actualizada
   */
  async updateTokenStats(tenantId, conversationId, tokenData) {
    throw new Error("Method not implemented");
  }

  /**
   * Marca pdfDeletedAt en todas las conversaciones de un PDF (cascada al soft-delete de PDF)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF eliminado
   * @returns {Promise<number>} Número de conversaciones actualizadas
   */
  async markPdfDeleted(tenantId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Remueve pdfDeletedAt de todas las conversaciones de un PDF (cascada al restore de PDF)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF restaurado
   * @returns {Promise<number>} Número de conversaciones actualizadas
   */
  async unmarkPdfDeleted(tenantId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca una conversación con sus mensajes usando agregación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} options - Opciones de consulta (limit, sort para mensajes)
   * @returns {Promise<Object|null>} Conversación con array de mensajes o null
   */
  async findWithMessages(tenantId, conversationId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza soft-delete de una conversación (marca deletedAt)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @returns {Promise<Object>} Conversación actualizada con deletedAt
   */
  async softDelete(tenantId, conversationId) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza hard-delete de una conversación (elimina físicamente)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async hardDelete(tenantId, conversationId) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza soft-delete masivo de conversaciones de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de conversaciones actualizadas
   */
  async softDeleteByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza hard-delete masivo de conversaciones de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de conversaciones eliminadas
   */
  async hardDeleteByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }
}

