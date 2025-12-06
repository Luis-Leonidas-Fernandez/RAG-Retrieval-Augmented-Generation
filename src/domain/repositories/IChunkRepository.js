/**
 * Interface para repositorio de chunks
 * Define el contrato que deben cumplir las implementaciones
 */
export class IChunkRepository {
  /**
   * Crea múltiples chunks en un solo lote
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Array<Object>} chunks - Array de chunks a crear (debe incluir pdfId, index, content, page, status)
   * @returns {Promise<Array<Object>>} Chunks creados
   */
  async createMany(tenantId, chunks) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca chunks por PDF y tenant
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {Object} options - Opciones de consulta (limit, skip, sort, select)
   * @returns {Promise<Array<Object>>} Lista de chunks
   */
  async findByPdfId(tenantId, pdfId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca chunks por sus IDs (usado en RAG para obtener textos después de búsqueda vectorial)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Array<string|ObjectId>} chunkIds - IDs de los chunks a buscar
   * @param {string|ObjectId} pdfId - ID del PDF (opcional, para validación adicional)
   * @returns {Promise<Array<Object>>} Chunks encontrados
   */
  async findByIds(tenantId, chunkIds, pdfId = null) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca chunks por status (chunked, embedded)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {string} status - Status a buscar (chunked, embedded)
   * @param {Object} options - Opciones adicionales (limit, skip, sort)
   * @returns {Promise<Array<Object>>} Chunks encontrados
   */
  async findByStatus(tenantId, pdfId, status, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca chunks por tipo de sección (toc, chapter_title, paragraph, table, other)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {string} sectionType - Tipo de sección a buscar (toc, chapter_title, paragraph, table, other)
   * @returns {Promise<Array<Object>>} Chunks encontrados ordenados por index (ascendente)
   */
  async findBySectionType(tenantId, pdfId, sectionType) {
    throw new Error("Method not implemented");
  }

  /**
   * Actualiza el status de múltiples chunks
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Array<string|ObjectId>} chunkIds - IDs de los chunks a actualizar
   * @param {string} status - Nuevo status (chunked, embedded)
   * @returns {Promise<number>} Número de chunks actualizados
   */
  async updateStatusMany(tenantId, chunkIds, status) {
    throw new Error("Method not implemented");
  }

  /**
   * Elimina todos los chunks de un PDF (usado al reprocesar)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @returns {Promise<number>} Número de chunks eliminados
   */
  async deleteByPdfId(tenantId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Cuenta chunks según criterios
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {Object} options - Opciones de filtro (status)
   * @returns {Promise<number>} Número de chunks que cumplen los criterios
   */
  async count(tenantId, pdfId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Elimina chunks de múltiples PDFs (hard-delete)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Array<string|ObjectId>} pdfIds - IDs de los PDFs
   * @returns {Promise<number>} Número de chunks eliminados
   */
  async deleteByPdfIds(tenantId, pdfIds) {
    throw new Error("Method not implemented");
  }
}

