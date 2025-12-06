/**
 * Caso de uso para borrar todos los datos del usuario (GDPR)
 * Orquesta la lógica de negocio del proceso de borrado completo de datos
 */
export class DeleteAllMyDataUseCase {
  constructor(
    conversationRepository,
    messageRepository,
    pdfRepository,
    chunkRepository,
    vectorRepository,
    loginHistoryRepository,
    sessionService,
    gdprStrictMode = false
  ) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.pdfRepository = pdfRepository;
    this.chunkRepository = chunkRepository;
    this.vectorRepository = vectorRepository;
    this.loginHistoryRepository = loginHistoryRepository;
    this.sessionService = sessionService;
    this.gdprStrictMode = gdprStrictMode;
  }

  /**
   * Ejecuta el caso de uso de borrar todos los datos del usuario
   * @param {Object} request - Objeto con tenantId, userId y hardDelete
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {boolean} request.hardDelete - Si es true, elimina físicamente. Si es false, hace soft-delete
   * @returns {Promise<Object>} Objeto con deleted (boolean) y hardDelete (boolean)
   */
  async execute({ tenantId, userId, hardDelete = false }) {
    // Desactivar todas las sesiones
    await this.sessionService.deactivateAllUserSessions(tenantId, userId);

    // Determinar si hacer hard-delete según GDPR_STRICT_MODE inyectado
    const shouldHardDelete = hardDelete || this.gdprStrictMode;

    if (shouldHardDelete) {
      // Hard-delete: eliminar físicamente

      // Obtener IDs de PDFs del usuario para borrar chunks y vectores
      const pdfIds = await this.pdfRepository.findPdfIdsByUser(
        tenantId,
        userId
      );

      // Borrar mensajes
      await this.messageRepository.hardDeleteByUser(tenantId, userId);

      // Borrar conversaciones
      await this.conversationRepository.hardDeleteByUser(tenantId, userId);

      // Borrar chunks de los PDFs del usuario
      if (pdfIds.length > 0) {
        await this.chunkRepository.deleteByPdfIds(tenantId, pdfIds);
      }

      // Borrar vectores de Qdrant para los PDFs del usuario
      if (pdfIds.length > 0) {
        await this.vectorRepository.deleteByPdfIds(
          tenantId,
          pdfIds,
          true
        );
      }

      // Borrar PDFs
      await this.pdfRepository.hardDeleteByUser(tenantId, userId);

      // Borrar historial de login
      await this.loginHistoryRepository.hardDeleteByUser(tenantId, userId);
    } else {
      // Soft-delete: marcar como borrado

      // Soft-delete mensajes
      await this.messageRepository.softDeleteByUser(tenantId, userId);

      // Soft-delete conversaciones
      await this.conversationRepository.softDeleteByUser(tenantId, userId);

      // Soft-delete PDFs
      await this.pdfRepository.softDeleteByUser(tenantId, userId);

      // Anonimizar historial de login
      await this.loginHistoryRepository.anonymizeByUser(tenantId, userId);
    }

    return { deleted: true, hardDelete: shouldHardDelete };
  }
}

