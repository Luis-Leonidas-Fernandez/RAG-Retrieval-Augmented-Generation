import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Caso de uso para que un admin borre todos los datos de un usuario (GDPR)
 * Orquesta la lógica de negocio del proceso de borrado completo de datos por admin
 * 
 * NOTA: Este Use Case replica EXACTAMENTE la lógica de deleteAllUserData del legacy,
 * pero para un usuario objetivo (targetUserId) en lugar del usuario autenticado.
 */
export class AdminDeleteUserDataUseCase {
  constructor(
    userRepository,
    conversationRepository,
    messageRepository,
    pdfRepository,
    chunkRepository,
    loginHistoryRepository,
    sessionService,
    gdprStrictMode = false
  ) {
    this.userRepository = userRepository;
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.pdfRepository = pdfRepository;
    this.chunkRepository = chunkRepository;
    this.loginHistoryRepository = loginHistoryRepository;
    this.sessionService = sessionService;
    this.gdprStrictMode = gdprStrictMode;
  }

  /**
   * Ejecuta el caso de uso de borrar todos los datos del usuario objetivo
   * @param {Object} request - Objeto con tenantId, targetUserId y hardDelete
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.targetUserId - ID del usuario objetivo (a borrar)
   * @param {boolean} request.hardDelete - Si es true, elimina físicamente. Si es false, hace soft-delete
   * @returns {Promise<Object>} Objeto con deleted (boolean) y hardDelete (boolean)
   * @throws {UserNotFoundException} Si el usuario objetivo no existe en el tenant
   */
  async execute({ tenantId, targetUserId, hardDelete = false }) {
    // Validar que el usuario objetivo existe en el tenant
    const user = await this.userRepository.findById(tenantId, targetUserId);
    if (!user) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    // Desactivar todas las sesiones del usuario objetivo
    await this.sessionService.deactivateAllUserSessions(tenantId, targetUserId);

    // Determinar si hacer hard-delete según GDPR_STRICT_MODE inyectado
    const shouldHardDelete = hardDelete || this.gdprStrictMode;

    if (shouldHardDelete) {
      // Hard-delete: eliminar físicamente
      // NOTA: El legacy NO borra vectores de Qdrant explícitamente, así que no los borramos aquí

      // Obtener IDs de PDFs del usuario para borrar chunks
      const pdfIds = await this.pdfRepository.findPdfIdsByUser(
        tenantId,
        targetUserId
      );

      // Borrar mensajes
      await this.messageRepository.hardDeleteByUser(tenantId, targetUserId);

      // Borrar conversaciones
      await this.conversationRepository.hardDeleteByUser(
        tenantId,
        targetUserId
      );

      // Borrar chunks de los PDFs del usuario
      if (pdfIds.length > 0) {
        await this.chunkRepository.deleteByPdfIds(tenantId, pdfIds);
      }

      // Borrar PDFs
      await this.pdfRepository.hardDeleteByUser(tenantId, targetUserId);

      // Borrar historial de login
      await this.loginHistoryRepository.hardDeleteByUser(
        tenantId,
        targetUserId
      );
    } else {
      // Soft-delete: marcar como borrado

      // Soft-delete mensajes
      await this.messageRepository.softDeleteByUser(tenantId, targetUserId);

      // Soft-delete conversaciones
      await this.conversationRepository.softDeleteByUser(
        tenantId,
        targetUserId
      );

      // Soft-delete PDFs
      await this.pdfRepository.softDeleteByUser(tenantId, targetUserId);

      // Anonimizar historial de login
      await this.loginHistoryRepository.anonymizeByUser(
        tenantId,
        targetUserId
      );
    }

    return { deleted: true, hardDelete: shouldHardDelete };
  }
}

