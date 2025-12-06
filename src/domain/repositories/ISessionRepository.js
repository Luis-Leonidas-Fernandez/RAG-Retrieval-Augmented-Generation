/**
 * Interface para repositorio de sesiones
 * Define el contrato que deben cumplir las implementaciones
 */
export class ISessionRepository {
  /**
   * Crea una sesión activa
   * @param {string} tenantId - ID del tenant
   * @param {string} userId - ID del usuario
   * @param {string} token - Token JWT
   * @param {Object} req - Request object de Express (para extraer IP y User-Agent)
   * @returns {Promise<{tokenId: string, sessionId: string}>} Información de la sesión creada
   */
  async createSession(tenantId, userId, token, req) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca sesiones activas de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {Object} options - Opciones de consulta (limit, skip, sort)
   * @returns {Promise<Array<Object>>} Lista de sesiones activas
   */
  async findActiveSessions(tenantId, userId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Cierra una sesión específica del usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {string} sessionId - ID de la sesión (tokenId)
   * @returns {Promise<boolean>} true si se cerró correctamente, false si no se encontró
   */
  async closeSession(tenantId, userId, sessionId) {
    throw new Error("Method not implemented");
  }

  /**
   * Cierra todas las sesiones del usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {Object} options - Opciones (excludeCurrentSession: boolean)
   * @returns {Promise<number>} Número de sesiones cerradas
   */
  async closeAllSessions(tenantId, userId, options = {}) {
    throw new Error("Method not implemented");
  }
}

