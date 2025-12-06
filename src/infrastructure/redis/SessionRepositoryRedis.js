import {
  createActiveSession,
  getActiveSessionsByUser,
  deactivateSession,
  deactivateAllUserSessions,
} from "../services/core/session.service.js";
import { ISessionRepository } from "../../domain/repositories/ISessionRepository.js";

/**
 * Implementación de ISessionRepository usando Redis
 */
export class SessionRepositoryRedis extends ISessionRepository {
  /**
   * Crea una sesión activa en Redis
   * @param {string} tenantId - ID del tenant
   * @param {string} userId - ID del usuario
   * @param {string} token - Token JWT
   * @param {Object} req - Request object de Express (para extraer IP y User-Agent)
   * @returns {Promise<{tokenId: string, sessionId: string}>} Información de la sesión creada
   */
  async createSession(tenantId, userId, token, req) {
    const result = await createActiveSession(tenantId, userId, token, req);

    if (!result) {
      // Redis no disponible, retornar null (modo degradado)
      return null;
    }

    // sessionId es igual a tokenId
    return {
      tokenId: result.tokenId,
      sessionId: result.tokenId,
    };
  }

  /**
   * Busca sesiones activas de un usuario
   */
  async findActiveSessions(tenantId, userId, options = {}) {
    const sessions = await getActiveSessionsByUser(tenantId, userId);
    return sessions;
  }

  /**
   * Cierra una sesión específica del usuario
   */
  async closeSession(tenantId, userId, sessionId) {
    const result = await deactivateSession(tenantId, userId, sessionId);
    return result;
  }

  /**
   * Cierra todas las sesiones del usuario
   */
  async closeAllSessions(tenantId, userId, options = {}) {
    // El servicio actual cierra todas las sesiones, no hay opción para excluir la actual
    // Si en el futuro se necesita, se puede agregar la lógica aquí
    const result = await deactivateAllUserSessions(tenantId, userId);
    
    if (result) {
      // Contar sesiones cerradas (el servicio no retorna el count, así que retornamos true)
      // En el futuro se puede mejorar el servicio para retornar el count
      return 1; // Indicador de éxito, el Use Case puede calcular el count real
    }
    
    return 0;
  }
}

