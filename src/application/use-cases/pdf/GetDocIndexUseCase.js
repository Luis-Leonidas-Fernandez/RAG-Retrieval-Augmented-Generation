/**
 * Caso de uso para obtener el índice (TOC) de un documento
 * Retorna los chunks con sectionType='toc' ordenados por index
 */
export class GetDocIndexUseCase {
  constructor(chunkRepository) {
    this.chunkRepository = chunkRepository;
  }

  /**
   * Ejecuta el caso de uso de obtener índice del documento
   * @param {Object} request - Objeto con tenantId y pdfId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.pdfId - ID del documento
   * @returns {Promise<Array<Object>>} Array de chunks con sectionType='toc' ordenados por index (puede estar vacío)
   */
  async execute({ tenantId, pdfId }) {
    // Buscar chunks con sectionType='toc' para el documento
    const tocChunks = await this.chunkRepository.findBySectionType(
      tenantId,
      pdfId,
      'toc'
    );

    // Retornar array (puede estar vacío si no hay TOC)
    return tocChunks || [];
  }
}

