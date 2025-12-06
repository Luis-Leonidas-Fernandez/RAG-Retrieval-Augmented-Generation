import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Caso de uso para que un admin exporte todos los datos de un usuario (GDPR - derecho a portabilidad)
 * Orquesta la lógica de negocio del proceso de exportación de datos por admin
 * 
 * NOTA: Este Use Case replica EXACTAMENTE la estructura JSON de getUserDataSummary del legacy,
 * pero para un usuario objetivo (targetUserId) en lugar del usuario autenticado.
 */
export class AdminExportUserDataUseCase {
  constructor(
    userRepository,
    conversationRepository,
    pdfRepository,
    loginHistoryRepository
  ) {
    this.userRepository = userRepository;
    this.conversationRepository = conversationRepository;
    this.pdfRepository = pdfRepository;
    this.loginHistoryRepository = loginHistoryRepository;
  }

  /**
   * Ejecuta el caso de uso de exportar datos del usuario objetivo
   * @param {Object} request - Objeto con tenantId y targetUserId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.targetUserId - ID del usuario objetivo (a exportar)
   * @returns {Promise<Object>} Resumen de datos del usuario (mismo formato que getUserDataSummary legacy)
   * @throws {UserNotFoundException} Si el usuario objetivo no existe en el tenant
   */
  async execute({ tenantId, targetUserId }) {
    // Obtener usuario objetivo
    const user = await this.userRepository.findById(tenantId, targetUserId, {
      select: "email name role createdAt",
    });

    if (!user) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    // Obtener conversaciones (sin límite práctico para el export)
    const conversations = await this.conversationRepository.findAll(
      tenantId,
      targetUserId,
      {
        limit: 1000,
      }
    );

    // Filtrar campos de conversaciones según el formato legacy
    const conversationsFiltered = conversations.map((conv) => ({
      _id: conv._id,
      pdfId: conv.pdfId,
      title: conv.title,
      createdAt: conv.createdAt,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv.messageCount,
    }));

    // Obtener PDFs (sin límite práctico para el export)
    const pdfs = await this.pdfRepository.findAll(tenantId, {
      userId: targetUserId,
      limit: 1000,
    });

    // Filtrar campos de PDFs según el formato legacy
    const pdfsFiltered = pdfs.map((pdf) => ({
      _id: pdf._id,
      originalName: pdf.originalName,
      createdAt: pdf.createdAt,
      status: pdf.status,
    }));

    // Obtener historial de login (limitado a 100 como en el legacy)
    const loginHistory = await this.loginHistoryRepository.findByUser(
      tenantId,
      targetUserId,
      {
        limit: 100,
        select: "loggedInAt loggedOutAt sessionDuration wasActive",
      }
    );

    // Retornar EXACTAMENTE el mismo formato que getUserDataSummary del legacy
    return {
      user,
      conversations: conversationsFiltered.length,
      pdfs: pdfsFiltered.length,
      loginHistory: loginHistory.length,
      data: {
        conversations: conversationsFiltered,
        pdfs: pdfsFiltered,
        loginHistory,
      },
    };
  }
}

