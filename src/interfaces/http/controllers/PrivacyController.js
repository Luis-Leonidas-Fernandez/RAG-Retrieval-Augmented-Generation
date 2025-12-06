import { DeleteMyConversationUseCase } from "../../../application/use-cases/privacy/DeleteMyConversationUseCase.js";
import { DeleteAllMyDataUseCase } from "../../../application/use-cases/privacy/DeleteAllMyDataUseCase.js";
import { ToggleHistoryPreferenceUseCase } from "../../../application/use-cases/privacy/ToggleHistoryPreferenceUseCase.js";
import { GetMyDataSummaryUseCase } from "../../../application/use-cases/privacy/GetMyDataSummaryUseCase.js";
import { ConversationRepositoryMongo } from "../../../infrastructure/db/repositories/ConversationRepositoryMongo.js";
import { MessageRepositoryMongo } from "../../../infrastructure/db/repositories/MessageRepositoryMongo.js";
import { DocRepositoryMongo } from "../../../infrastructure/db/repositories/DocRepositoryMongo.js";
import { ChunkRepositoryMongo } from "../../../infrastructure/db/repositories/ChunkRepositoryMongo.js";
import { QdrantVectorRepository } from "../../../infrastructure/vector-store/QdrantVectorRepository.js";
import { LoginHistoryRepositoryMongo } from "../../../infrastructure/db/repositories/LoginHistoryRepositoryMongo.js";
import { UserRepositoryMongo } from "../../../infrastructure/db/repositories/UserRepositoryMongo.js";
import { SessionService } from "../../../infrastructure/services/adapters/session-wrapper.service.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";
import { UserNotFoundException } from "../../../domain/exceptions/UserNotFoundException.js";

/**
 * Controller HTTP para Privacy
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class PrivacyController {
  constructor() {
    // Instanciar repositorios
    this.conversationRepository = new ConversationRepositoryMongo();
    this.messageRepository = new MessageRepositoryMongo();
    this.pdfRepository = new DocRepositoryMongo();
    this.chunkRepository = new ChunkRepositoryMongo();
    this.vectorRepository = new QdrantVectorRepository();
    this.loginHistoryRepository = new LoginHistoryRepositoryMongo();
    this.userRepository = new UserRepositoryMongo();
    this.sessionService = new SessionService();

    // Configuración GDPR desde variables de entorno
    const gdprStrictMode = process.env.GDPR_STRICT_MODE === "true";

    // Instanciar use cases
    this.deleteMyConversationUseCase = new DeleteMyConversationUseCase(
      this.conversationRepository,
      this.messageRepository,
      gdprStrictMode
    );
    this.deleteAllMyDataUseCase = new DeleteAllMyDataUseCase(
      this.conversationRepository,
      this.messageRepository,
      this.pdfRepository,
      this.chunkRepository,
      this.vectorRepository,
      this.loginHistoryRepository,
      this.sessionService,
      gdprStrictMode
    );
    this.toggleHistoryPreferenceUseCase = new ToggleHistoryPreferenceUseCase(
      this.userRepository
    );
    this.getMyDataSummaryUseCase = new GetMyDataSummaryUseCase(
      this.userRepository,
      this.conversationRepository,
      this.pdfRepository,
      this.loginHistoryRepository
    );
  }

  /**
   * Maneja el endpoint de borrar mi conversación
   * DELETE /api/privacy/conversation/:conversationId
   */
  async deleteMyConversation(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { conversationId } = req.params;
      const hardDelete = req.query.hardDelete === "true";

      if (!conversationId) {
        return res.status(400).json(
          createResponse(false, "conversationId es requerido")
        );
      }

      await this.deleteMyConversationUseCase.execute({
        tenantId,
        userId,
        conversationId,
        hardDelete,
      });

      return res.json(
        createResponse(true, "Conversación borrada correctamente")
      );
    } catch (error) {
      console.error("[Privacy Controller] Error al borrar conversación:", error);

      // Manejar errores específicos
      if (
        error.message.includes("no encontrada") ||
        error.message.includes("no pertenece")
      ) {
        return res.status(404).json(createResponse(false, error.message));
      }

      if (error.message.includes("No tienes permiso")) {
        return res.status(403).json(createResponse(false, error.message));
      }

      return res.status(500).json(
        createResponse(false, "Error al borrar conversación", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de borrar todos mis datos (GDPR)
   * DELETE /api/privacy/data
   */
  async deleteAllMyData(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const hardDelete = req.query.hardDelete === "true";

      await this.deleteAllMyDataUseCase.execute({
        tenantId,
        userId,
        hardDelete,
      });

      return res.json(
        createResponse(true, "Todos tus datos han sido borrados correctamente")
      );
    } catch (error) {
      console.error("[Privacy Controller] Error al borrar datos:", error);
      return res.status(500).json(
        createResponse(false, "Error al borrar datos", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de activar/desactivar preferencia de historial
   * PUT /api/privacy/history
   */
  async toggleHistoryPreference(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { allowHistory } = req.body;

      if (typeof allowHistory !== "boolean") {
        return res.status(400).json(
          createResponse(false, "allowHistory debe ser un booleano")
        );
      }

      const result = await this.toggleHistoryPreferenceUseCase.execute({
        tenantId,
        userId,
        allowHistory,
      });

      return res.json(
        createResponse(true, "Preferencia de historial actualizada", {
          allowHistory: result.allowHistory,
        })
      );
    } catch (error) {
      console.error(
        "[Privacy Controller] Error al actualizar preferencia:",
        error
      );

      if (error instanceof UserNotFoundException) {
        return res.status(404).json(createResponse(false, error.message));
      }

      if (error.message.includes("debe ser un booleano")) {
        return res.status(400).json(createResponse(false, error.message));
      }

      return res.status(500).json(
        createResponse(false, "Error al actualizar preferencia", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de obtener resumen de mis datos (GDPR - derecho a portabilidad)
   * GET /api/privacy/data
   */
  async getMyDataSummary(req, res) {
    try {
      const { tenantId, id: userId } = req.user;

      const summary = await this.getMyDataSummaryUseCase.execute({
        tenantId,
        userId,
      });

      return res.json(
        createResponse(true, "Resumen de datos obtenido correctamente", {
          summary,
        })
      );
    } catch (error) {
      console.error("[Privacy Controller] Error al obtener resumen:", error);

      if (error instanceof UserNotFoundException) {
        return res.status(404).json(createResponse(false, error.message));
      }

      return res.status(500).json(
        createResponse(false, "Error al obtener resumen", {
          error: error.message,
        })
      );
    }
  }
}

