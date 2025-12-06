import { AdminDeleteUserDataUseCase } from "../../../application/use-cases/admin/AdminDeleteUserDataUseCase.js";
import { AdminExportUserDataUseCase } from "../../../application/use-cases/admin/AdminExportUserDataUseCase.js";
import { ConversationRepositoryMongo } from "../../../infrastructure/db/repositories/ConversationRepositoryMongo.js";
import { MessageRepositoryMongo } from "../../../infrastructure/db/repositories/MessageRepositoryMongo.js";
import { DocRepositoryMongo } from "../../../infrastructure/db/repositories/DocRepositoryMongo.js";
import { ChunkRepositoryMongo } from "../../../infrastructure/db/repositories/ChunkRepositoryMongo.js";
import { LoginHistoryRepositoryMongo } from "../../../infrastructure/db/repositories/LoginHistoryRepositoryMongo.js";
import { UserRepositoryMongo } from "../../../infrastructure/db/repositories/UserRepositoryMongo.js";
import { SessionService } from "../../../infrastructure/services/adapters/session-wrapper.service.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";
import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Controller HTTP para Admin Privacy
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 * 
 * NOTA: Este controller replica EXACTAMENTE el comportamiento de admin-privacy.controller.js legacy
 */
export class AdminPrivacyController {
  constructor() {
    // Instanciar repositorios
    this.conversationRepository = new ConversationRepositoryMongo();
    this.messageRepository = new MessageRepositoryMongo();
    this.pdfRepository = new DocRepositoryMongo();
    this.chunkRepository = new ChunkRepositoryMongo();
    this.loginHistoryRepository = new LoginHistoryRepositoryMongo();
    this.userRepository = new UserRepositoryMongo();
    this.sessionService = new SessionService();

    // Configuración GDPR desde variables de entorno
    const gdprStrictMode = process.env.GDPR_STRICT_MODE === "true";

    // Instanciar use cases
    this.adminDeleteUserDataUseCase = new AdminDeleteUserDataUseCase(
      this.userRepository,
      this.conversationRepository,
      this.messageRepository,
      this.pdfRepository,
      this.chunkRepository,
      this.loginHistoryRepository,
      this.sessionService,
      gdprStrictMode
    );
    this.adminExportUserDataUseCase = new AdminExportUserDataUseCase(
      this.userRepository,
      this.conversationRepository,
      this.pdfRepository,
      this.loginHistoryRepository
    );
  }

  /**
   * Maneja el endpoint de borrar datos de un usuario (admin)
   * DELETE /api/admin/privacy/user/:userId
   */
  async deleteUserData(req, res) {
    try {
      const { tenantId } = req.user; // Admin debe estar en el mismo tenant
      const { userId } = req.params; // userId objetivo
      const hardDelete = req.query.hardDelete === "true";

      if (!userId) {
        return res.status(400).json(
          createResponse(false, "userId es requerido")
        );
      }

      await this.adminDeleteUserDataUseCase.execute({
        tenantId,
        targetUserId: userId,
        hardDelete,
      });

      return res.json(
        createResponse(true, "Datos del usuario borrados correctamente")
      );
    } catch (error) {
      console.error("[Admin Privacy Controller] Error:", error);

      if (error instanceof UserNotFoundException) {
        return res.status(404).json(createResponse(false, error.message));
      }

      return res.status(500).json(
        createResponse(false, "Error al borrar datos del usuario", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de exportar datos de un usuario (GDPR - derecho a portabilidad)
   * GET /api/admin/privacy/user/:userId/export
   */
  async exportUserData(req, res) {
    try {
      const { tenantId } = req.user;
      const { userId } = req.params; // userId objetivo

      if (!userId) {
        return res.status(400).json(
          createResponse(false, "userId es requerido")
        );
      }

      const summary = await this.adminExportUserDataUseCase.execute({
        tenantId,
        targetUserId: userId,
      });

      return res.json(
        createResponse(true, "Datos exportados correctamente", {
          data: summary,
        })
      );
    } catch (error) {
      console.error("[Admin Privacy Controller] Error:", error);

      if (error instanceof UserNotFoundException) {
        return res.status(404).json(createResponse(false, error.message));
      }

      return res.status(500).json(
        createResponse(false, "Error al exportar datos", {
          error: error.message,
        })
      );
    }
  }
}

