/**
 * Use Case para eliminar permanentemente un documento y todos sus datos relacionados
 * Realiza hard-delete de:
 * - Vectores en Qdrant
 * - Chunks en MongoDB
 * - Documento en MongoDB
 * - Caché RAG relacionado
 */
export class HardDeleteDocUseCase {
  /**
   * @param {IDocRepository} pdfRepository - Repositorio de documentos
   * @param {IChunkRepository} chunkRepository - Repositorio de chunks
   * @param {IVectorRepository} vectorRepository - Repositorio de vectores
   * @param {CacheService} cacheService - Servicio de caché (wrapper)
   */
  constructor(pdfRepository, chunkRepository, vectorRepository, cacheService) {
    this.pdfRepository = pdfRepository;
    this.chunkRepository = chunkRepository;
    this.vectorRepository = vectorRepository;
    this.cacheService = cacheService;
  }

  /**
   * Ejecuta el hard-delete del documento
   * @param {Object} params - Parámetros de entrada
   * @param {string|ObjectId} params.tenantId - ID del tenant
   * @param {string|ObjectId} params.pdfId - ID del documento a eliminar
   * @param {string|ObjectId} params.userId - ID del usuario que realiza la eliminación (opcional, para logging)
   * @returns {Promise<Object>} Resultado con { deleted: true }
   * @throws {Error} Si el documento no existe o no pertenece al tenant
   */
  async execute({ tenantId, pdfId, userId }) {
    // Validar que documento existe y pertenece al tenant
    const pdf = await this.pdfRepository.findById(tenantId, pdfId, { includeDeleted: true });
    
    if (!pdf) {
      throw new Error("Documento no encontrado o no pertenece al tenant");
    }

    // 1. Borrar de Qdrant (hard-delete)
    await this.vectorRepository.deleteByPdfId(tenantId, pdfId, true);

    // 2. Borrar chunks de MongoDB
    await this.chunkRepository.deleteByPdfId(tenantId, pdfId);

    // 3. Borrar documento de MongoDB
    await this.pdfRepository.hardDelete(tenantId, pdfId);

    // 4. Invalidar caché RAG
    await this.cacheService.invalidateRagCacheForPdf(tenantId, pdfId);

    return { deleted: true };
  }
}

