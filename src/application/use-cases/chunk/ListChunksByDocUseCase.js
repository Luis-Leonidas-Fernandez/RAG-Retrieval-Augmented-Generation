/**
 * Caso de uso para listar chunks de un documento
 * Orquesta la lógica de negocio del proceso de listado de chunks
 */
export class ListChunksByDocUseCase {
  constructor(chunkRepository) {
    this.chunkRepository = chunkRepository;
  }

  /**
   * Ejecuta el caso de uso de listar chunks
   * @param {Object} request - Objeto con tenantId, pdfId y options
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.pdfId - ID del documento
   * @param {Object} request.options - Opciones de paginación y filtrado
   * @param {number} request.options.page - Número de página (default: 1)
   * @param {number} request.options.limit - Límite de resultados por página (default: 50)
   * @param {number} request.options.maxLimit - Límite máximo permitido (default: 500)
   * @returns {Promise<Object>} Objeto con chunks, count y metadata de paginación
   */
  async execute({ tenantId, pdfId, options = {} }) {
    const {
      page = 1,
      limit = 50,
      maxLimit = 500,
    } = options;

    // Validar límites
    const safeLimit = Math.min(Math.max(1, limit), maxLimit); // Entre 1 y maxLimit
    const safePage = Math.max(1, page); // Mínimo página 1
    const skip = (safePage - 1) * safeLimit;

    // Obtener total de chunks para metadata de paginación
    const total = await this.chunkRepository.count(tenantId, pdfId);

    // Obtener chunks paginados
    const chunks = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
      limit: safeLimit,
      skip,
      sort: { index: 1 },
      select: "index content page status createdAt",
    });

    return {
      pdfId,
      chunks,
      count: chunks.length,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: skip + safeLimit < total,
        hasPrev: safePage > 1,
      },
    };
  }
}

