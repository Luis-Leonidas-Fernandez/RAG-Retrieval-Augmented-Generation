/**
 * Interface para repositorio de vector store
 * Define el contrato que deben cumplir las implementaciones de almacenamiento vectorial
 * Nota: Los embeddings se generan en la capa de aplicación, este repositorio solo los almacena y busca
 */
export class IVectorRepository {
  /**
   * Indexa chunks con sus embeddings en el vector store
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {Array<Object>} chunksWithEmbeddings - Array de objetos con {chunkId, vector, payload}
   *   donde payload debe incluir: tenantId, pdfId, chunkId, index, page, content
   * @returns {Promise<number>} Número de puntos indexados
   */
  async indexChunks(tenantId, pdfId, chunksWithEmbeddings) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca chunks similares usando búsqueda vectorial
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {Array<number>} vector - Vector de embedding de la consulta
   * @param {Object} options - Opciones de búsqueda (limit, scoreThreshold)
   * @returns {Promise<Array<Object>>} Array de resultados con {id, score, payload}
   *   donde payload incluye chunkId, index, page, content
   */
  async search(tenantId, pdfId, vector, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Cuenta puntos indexados para un PDF
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @returns {Promise<number|null>} Número de puntos indexados o null si hay error
   */
  async count(tenantId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Elimina puntos del vector store para un PDF
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {boolean} hardDelete - Si es true, elimina físicamente. Si es false, marca como soft-deleted
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async deleteByPdfId(tenantId, pdfId, hardDelete = false) {
    throw new Error("Method not implemented");
  }

  /**
   * Restaura puntos en el vector store (remueve marca de soft-delete)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @returns {Promise<boolean>} true si se restauró correctamente
   */
  async restoreByPdfId(tenantId, pdfId) {
    throw new Error("Method not implemented");
  }

  /**
   * Elimina puntos del vector store para múltiples PDFs
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Array<string|ObjectId>} pdfIds - IDs de los PDFs
   * @param {boolean} hardDelete - Si es true, elimina físicamente. Si es false, marca como soft-deleted
   * @returns {Promise<number>} Número de PDFs procesados
   */
  async deleteByPdfIds(tenantId, pdfIds, hardDelete = false) {
    throw new Error("Method not implemented");
  }
}

