import { deactivateAllUserSessions } from "../core/session.service.js";

/**
 * Servicio wrapper para operaciones de sesión
 * Abstrae el uso de funciones de sesión desde la capa de aplicación
 */
export class SessionService {
  /**
   * Desactiva todas las sesiones de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<boolean>} true si se desactivaron correctamente
   */
  async deactivateAllUserSessions(tenantId, userId) {
    return await deactivateAllUserSessions(tenantId, userId);
  }
}

