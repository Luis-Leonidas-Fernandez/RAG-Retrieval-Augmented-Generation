/**
 * Interface para repositorio de historial de logins
 * Define el contrato que deben cumplir las implementaciones
 */
export class ILoginHistoryRepository {
  /**
   * Busca historial de logins de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {Object} options - Opciones de consulta (limit, skip, sort, startDate, endDate)
   * @returns {Promise<Array<Object>>} Lista de registros de historial de login
   */
  async findByUser(tenantId, userId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Anonimiza el historial de logins de un usuario (GDPR)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de registros anonimizados
   */
  async anonymizeByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Elimina permanentemente el historial de logins de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de registros eliminados
   */
  async hardDeleteByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }
}

