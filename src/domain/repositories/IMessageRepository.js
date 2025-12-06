/**
 * Interface para repositorio de mensajes
 * Define el contrato que deben cumplir las implementaciones
 */
export class IMessageRepository {
  /**
   * Crea un nuevo mensaje
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} messageData - Datos del mensaje (role, content, index, metadata)
   * @returns {Promise<Object>} Mensaje creado
   */
  async create(tenantId, conversationId, messageData) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca mensajes de una conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} options - Opciones de consulta (limit, skip, sort, includeDeleted)
   * @returns {Promise<Array<Object>>} Lista de mensajes
   */
  async findByConversationId(tenantId, conversationId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca los mensajes más recientes de una conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {number} limit - Número máximo de mensajes a retornar
   * @returns {Promise<Array<Object>>} Lista de mensajes recientes (ordenados por createdAt descendente)
   */
  async findRecent(tenantId, conversationId, limit = 10) {
    throw new Error("Method not implemented");
  }

  /**
   * Cuenta mensajes de una conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} options - Opciones de filtro (includeDeleted)
   * @returns {Promise<number>} Número de mensajes
   */
  async count(tenantId, conversationId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Obtiene una conversación con sus mensajes usando agregación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @param {Object} options - Opciones de consulta (limit, sort para mensajes)
   * @returns {Promise<Object|null>} Conversación con array de mensajes o null
   */
  async findConversationWithMessages(tenantId, conversationId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza soft-delete masivo de mensajes de una conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @returns {Promise<number>} Número de mensajes actualizados
   */
  async softDeleteByConversationId(tenantId, conversationId) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza hard-delete masivo de mensajes de una conversación
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} conversationId - ID de la conversación
   * @returns {Promise<number>} Número de mensajes eliminados
   */
  async hardDeleteByConversationId(tenantId, conversationId) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza soft-delete masivo de mensajes de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de mensajes actualizados
   */
  async softDeleteByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza hard-delete masivo de mensajes de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de mensajes eliminados
   */
  async hardDeleteByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }
}

