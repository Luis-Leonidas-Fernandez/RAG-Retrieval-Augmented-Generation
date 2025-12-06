import { GetMySessionsUseCase } from "../../../application/use-cases/session/GetMySessionsUseCase.js";
import { GetLoginHistoryUseCase } from "../../../application/use-cases/session/GetLoginHistoryUseCase.js";
import { CloseSessionUseCase } from "../../../application/use-cases/session/CloseSessionUseCase.js";
import { CloseAllSessionsUseCase } from "../../../application/use-cases/session/CloseAllSessionsUseCase.js";
import { SessionRepositoryRedis } from "../../../infrastructure/redis/SessionRepositoryRedis.js";
import { LoginHistoryRepositoryMongo } from "../../../infrastructure/db/repositories/LoginHistoryRepositoryMongo.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";

/**
 * Controller HTTP para Sesiones
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class SessionController {
  constructor() {
    // Instanciar dependencias (en el futuro se puede usar inyección de dependencias)
    this.sessionRepository = new SessionRepositoryRedis();
    this.loginHistoryRepository = new LoginHistoryRepositoryMongo();

    // Crear instancias de los use cases con dependencias inyectadas
    this.getMySessionsUseCase = new GetMySessionsUseCase(
      this.sessionRepository
    );
    this.getLoginHistoryUseCase = new GetLoginHistoryUseCase(
      this.loginHistoryRepository
    );
    this.closeSessionUseCase = new CloseSessionUseCase(this.sessionRepository);
    this.closeAllSessionsUseCase = new CloseAllSessionsUseCase(
      this.sessionRepository
    );
  }

  /**
   * Maneja el endpoint de obtener mis sesiones activas
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getMySessions(req, res) {
    try {
      const { tenantId, id: userId } = req.user;

      // Ejecutar use case
      const result = await this.getMySessionsUseCase.execute({
        tenantId,
        userId,
        filters: {},
      });

      // Responder con éxito (mantener formato del controller actual)
      return res.json(
        createResponse(true, "Sesiones obtenidas correctamente", {
          sessions: result.sessions,
          count: result.count,
        })
      );
    } catch (error) {
      console.error("[Session Controller] Error al obtener sesiones:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener sesiones", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de obtener historial de logins
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getLoginHistory(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const limit = parseInt(req.query.limit || "50", 10);

      // Ejecutar use case
      const result = await this.getLoginHistoryUseCase.execute({
        tenantId,
        userId,
        filters: {
          limit,
        },
      });

      // Responder con éxito (mantener formato del controller actual)
      return res.json(
        createResponse(true, "Historial obtenido correctamente", {
          history: result.history,
          count: result.count,
        })
      );
    } catch (error) {
      console.error("[Session Controller] Error al obtener historial:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener historial", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de cerrar sesión específica
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async closeSession(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json(
          createResponse(false, "sessionId es requerido")
        );
      }

      // Ejecutar use case
      await this.closeSessionUseCase.execute({
        tenantId,
        userId,
        sessionId,
      });

      // Responder con éxito (mantener formato del controller actual)
      return res.json(
        createResponse(true, "Sesión cerrada correctamente")
      );
    } catch (error) {
      console.error("[Session Controller] Error al cerrar sesión:", error);

      // Manejar errores específicos
      if (error.message.includes("no encontrada") || error.message.includes("no se pudo cerrar")) {
        return res.status(404).json(
          createResponse(false, error.message)
        );
      }

      return res.status(500).json(
        createResponse(false, "Error al cerrar sesión", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de cerrar todas las sesiones
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async closeAllSessions(req, res) {
    try {
      const { tenantId, id: userId } = req.user;

      // Ejecutar use case
      await this.closeAllSessionsUseCase.execute({
        tenantId,
        userId,
        options: {},
      });

      // Responder con éxito (mantener formato del controller actual)
      return res.json(
        createResponse(true, "Todas las sesiones cerradas correctamente")
      );
    } catch (error) {
      console.error(
        "[Session Controller] Error al cerrar todas las sesiones:",
        error
      );
      return res.status(500).json(
        createResponse(false, "Error al cerrar todas las sesiones", {
          error: error.message,
        })
      );
    }
  }
}

