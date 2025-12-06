import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Caso de uso para obtener resumen de datos del usuario (GDPR - derecho a portabilidad)
 * Orquesta la lógica de negocio del proceso de obtener resumen de datos
 */
export class GetMyDataSummaryUseCase {
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
   * Ejecuta el caso de uso de obtener resumen de datos
   * @param {Object} request - Objeto con tenantId y userId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @returns {Promise<Object>} Resumen de datos del usuario
   * @throws {UserNotFoundException} Si el usuario no existe
   */
  async execute({ tenantId, userId }) {
    // Obtener usuario
    const user = await this.userRepository.findById(tenantId, userId, {
      select: "email name role createdAt",
    });

    if (!user) {
      throw new UserNotFoundException("Usuario no encontrado");
    }

    // Obtener conversaciones (sin límite práctico para el resumen)
    const conversations = await this.conversationRepository.findAll(
      tenantId,
      userId,
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

    // Obtener PDFs (sin límite práctico para el resumen)
    const pdfs = await this.pdfRepository.findAll(tenantId, {
      userId,
      limit: 1000,
    });

    // Filtrar campos de PDFs según el formato legacy
    const pdfsFiltered = pdfs.map((pdf) => ({
      _id: pdf._id,
      originalName: pdf.originalName,
      createdAt: pdf.createdAt,
      status: pdf.status,
    }));

    // Obtener historial de login (limitado a 100)
    const loginHistory = await this.loginHistoryRepository.findByUser(
      tenantId,
      userId,
      {
        limit: 100,
        select: "loggedInAt loggedOutAt sessionDuration wasActive",
      }
    );

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

