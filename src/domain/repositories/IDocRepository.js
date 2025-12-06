/**
 * Interface para repositorio de documentos
 * Define el contrato que deben cumplir las implementaciones
 */
export class IDocRepository {
  /**
   * Crea un nuevo documento
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario que sube el documento
   * @param {Object} pdfData - Datos del documento (originalName, fileName, path, size, mimetype)
   * @returns {Promise<Object>} Documento creado
   */
  async create(tenantId, userId, pdfData) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un documento por ID y tenantId
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del documento
   * @param {Object} options - Opciones adicionales (includeDeleted: boolean)
   * @returns {Promise<Object|null>} Documento encontrado o null
   */
  async findById(tenantId, pdfId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Lista todos los documentos de un tenant
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Object} options - Opciones de consulta (userId, limit, skip, includeDeleted)
   * @returns {Promise<Array>} Lista de documentos
   */
  async findAll(tenantId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Actualiza el status de un documento
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del documento
   * @param {string} status - Nuevo status (uploaded, processing, processed, error)
   * @returns {Promise<Object>} Documento actualizado
   */
  async updateStatus(tenantId, pdfId, status) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza soft-delete de un documento (marca como eliminado sin borrarlo físicamente)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del documento
   * @param {string|ObjectId} userId - ID del usuario que realiza la eliminación
   * @returns {Promise<Object>} Documento actualizado con isDeleted=true
   */
  async softDelete(tenantId, pdfId, userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Restaura un documento que fue soft-deleted
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del documento
   * @returns {Promise<Object>} Documento restaurado
   */
  async restore(tenantId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Elimina permanentemente un documento (hard-delete)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del documento
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async hardDelete(tenantId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Cuenta documentos según criterios
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Object} options - Opciones de filtro (userId, includeDeleted, status)
   * @returns {Promise<number>} Número de documentos que cumplen los criterios
   */
  async count(tenantId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza soft-delete masivo de documentos de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de documentos actualizados
   */
  async softDeleteByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Realiza hard-delete masivo de documentos de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<number>} Número de documentos eliminados
   */
  async hardDeleteByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Obtiene IDs de documentos de un usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @returns {Promise<Array<string|ObjectId>>} Array de IDs de documentos
   */
  async findPdfIdsByUser(tenantId, userId) {
    throw new Error("Method not implemented");
  }
}

