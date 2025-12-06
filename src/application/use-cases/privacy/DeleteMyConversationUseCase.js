/**
 * Caso de uso para borrar una conversación del usuario
 * Orquesta la lógica de negocio del proceso de borrado de conversación (GDPR)
 */
export class DeleteMyConversationUseCase {
  constructor(conversationRepository, messageRepository, gdprStrictMode = false) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.gdprStrictMode = gdprStrictMode;
  }

  /**
   * Ejecuta el caso de uso de borrar conversación
   * @param {Object} request - Objeto con tenantId, userId, conversationId y hardDelete
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string|ObjectId} request.conversationId - ID de la conversación
   * @param {boolean} request.hardDelete - Si es true, elimina físicamente. Si es false, hace soft-delete
   * @returns {Promise<Object>} Objeto con deleted (boolean) y hardDelete (boolean)
   * @throws {Error} Si la conversación no existe, no pertenece al tenant o no pertenece al usuario
   */
  async execute({ tenantId, userId, conversationId, hardDelete = false }) {
    // Verificar que la conversación existe y pertenece al usuario y tenant
    const conversation = await this.conversationRepository.findById(
      tenantId,
      conversationId
    );

    if (!conversation) {
      throw new Error("Conversación no encontrada o no pertenece al tenant");
    }

    // Validar que la conversación pertenece al usuario
    if (conversation.userId?.toString() !== userId?.toString()) {
      throw new Error("No tienes permiso para borrar esta conversación");
    }

    // Determinar si hacer hard-delete según GDPR_STRICT_MODE inyectado
    const shouldHardDelete = hardDelete || this.gdprStrictMode;

    if (shouldHardDelete) {
      // Hard-delete: eliminar físicamente
      await this.messageRepository.hardDeleteByConversationId(
        tenantId,
        conversationId
      );
      await this.conversationRepository.hardDelete(tenantId, conversationId);
    } else {
      // Soft-delete: marcar como borrado
      await this.messageRepository.softDeleteByConversationId(
        tenantId,
        conversationId
      );
      await this.conversationRepository.softDelete(tenantId, conversationId);
    }

    return { deleted: true, hardDelete: shouldHardDelete };
  }
}

