import { GetActiveConversationUseCase } from "../../../application/use-cases/conversation/GetActiveConversationUseCase.js";
import { GetConversationUseCase } from "../../../application/use-cases/conversation/GetConversationUseCase.js";
import { ListConversationsUseCase } from "../../../application/use-cases/conversation/ListConversationsUseCase.js";
import { GetConversationContextUseCase } from "../../../application/use-cases/conversation/GetConversationContextUseCase.js";
import { GetConversationTokenStatsUseCase } from "../../../application/use-cases/conversation/GetConversationTokenStatsUseCase.js";
import { CloseConversationUseCase } from "../../../application/use-cases/conversation/CloseConversationUseCase.js";
import { ConversationRepositoryMongo } from "../../../infrastructure/db/repositories/ConversationRepositoryMongo.js";
import { MessageRepositoryMongo } from "../../../infrastructure/db/repositories/MessageRepositoryMongo.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";

/**
 * Controller HTTP para Conversaciones
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class ConversationController {
  constructor() {
    // Instanciar dependencias (en el futuro se puede usar inyección de dependencias)
    this.conversationRepository = new ConversationRepositoryMongo();
    this.messageRepository = new MessageRepositoryMongo();

    // Crear instancias de los use cases con dependencias inyectadas
    this.getActiveConversationUseCase = new GetActiveConversationUseCase(
      this.conversationRepository
    );
    this.getConversationUseCase = new GetConversationUseCase(
      this.conversationRepository
    );
    this.listConversationsUseCase = new ListConversationsUseCase(
      this.conversationRepository
    );
    this.getConversationContextUseCase = new GetConversationContextUseCase(
      this.conversationRepository,
      this.messageRepository
    );
    this.getConversationTokenStatsUseCase =
      new GetConversationTokenStatsUseCase(this.conversationRepository);
    this.closeConversationUseCase = new CloseConversationUseCase(
      this.conversationRepository
    );
  }

  /**
   * Maneja el endpoint de obtener conversación activa
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getActiveConversation(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { pdfId } = req.params;

      if (!pdfId) {
        return res.status(400).json(
          createResponse(false, "pdfId es requerido")
        );
      }

      // Ejecutar use case
      const conversation = await this.getActiveConversationUseCase.execute({
        tenantId,
        userId,
        pdfId,
      });

      if (!conversation) {
        return res.status(404).json(
          createResponse(false, "No hay conversación activa para este PDF")
        );
      }

      return res.json(
        createResponse(true, "Conversación obtenida correctamente", {
          conversation,
        })
      );
    } catch (error) {
      console.error("[Conversation Controller] Error:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener conversación", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de obtener conversación específica
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getConversation(req, res) {
    try {
      const { tenantId } = req.user;
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json(
          createResponse(false, "conversationId es requerido")
        );
      }

      // Ejecutar use case
      const conversation = await this.getConversationUseCase.execute({
        tenantId,
        conversationId,
      });

      if (!conversation) {
        return res.status(404).json(
          createResponse(false, "Conversación no encontrada")
        );
      }

      return res.json(
        createResponse(true, "Conversación obtenida correctamente", {
          conversation,
        })
      );
    } catch (error) {
      console.error("[Conversation Controller] Error:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener conversación", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de listar conversaciones
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async listConversations(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const pdfId = req.query.pdfId || null;
      const limit = parseInt(req.query.limit || "20", 10);
      const skip = parseInt(req.query.skip || "0", 10);

      // Ejecutar use case
      const result = await this.listConversationsUseCase.execute({
        tenantId,
        userId,
        filters: {
          pdfId,
          limit,
          skip,
        },
      });

      return res.json(
        createResponse(true, "Conversaciones obtenidas correctamente", {
          conversations: result.conversations,
          count: result.count,
        })
      );
    } catch (error) {
      console.error("[Conversation Controller] Error:", error);
      return res.status(500).json(
        createResponse(false, "Error al listar conversaciones", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de obtener contexto de conversación
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getContext(req, res) {
    try {
      const { tenantId } = req.user;
      const { conversationId } = req.params;
      const windowSize = parseInt(req.query.window || "10", 10);

      if (!conversationId) {
        return res.status(400).json(
          createResponse(false, "conversationId es requerido")
        );
      }

      // Ejecutar use case
      const context = await this.getConversationContextUseCase.execute({
        tenantId,
        conversationId,
        windowSize,
      });

      return res.json(
        createResponse(true, "Contexto obtenido correctamente", {
          context,
          windowSize: context.length,
        })
      );
    } catch (error) {
      console.error("[Conversation Controller] Error:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener contexto", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de obtener estadísticas de tokens
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getTokenStats(req, res) {
    try {
      const { tenantId } = req.user;
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json(
          createResponse(false, "conversationId es requerido")
        );
      }

      // Ejecutar use case
      const stats = await this.getConversationTokenStatsUseCase.execute({
        tenantId,
        conversationId,
      });

      return res.json(
        createResponse(true, "Estadísticas obtenidas correctamente", {
          stats,
        })
      );
    } catch (error) {
      console.error("[Conversation Controller] Error:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener estadísticas", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de cerrar conversación
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async closeConversation(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json(
          createResponse(false, "conversationId es requerido")
        );
      }

      // Ejecutar use case
      await this.closeConversationUseCase.execute({
        tenantId,
        userId,
        conversationId,
      });

      return res.json(
        createResponse(true, "Conversación cerrada correctamente")
      );
    } catch (error) {
      console.error("[Conversation Controller] Error:", error);
      
      // Manejar errores específicos
      if (error.message === "Conversación no encontrada") {
        return res.status(404).json(
          createResponse(false, error.message)
        );
      }
      
      if (error.message.includes("permiso")) {
        return res.status(403).json(
          createResponse(false, error.message)
        );
      }

      return res.status(500).json(
        createResponse(false, "Error al cerrar conversación", {
          error: error.message,
        })
      );
    }
  }
}

