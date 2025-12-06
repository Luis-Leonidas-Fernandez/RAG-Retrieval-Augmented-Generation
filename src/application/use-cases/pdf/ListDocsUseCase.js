/**
 * Caso de uso para listar documentos
 * Orquesta la lógica de negocio del proceso de listado de documentos
 */
export class ListDocsUseCase {
  constructor(pdfRepository) {
    this.pdfRepository = pdfRepository;
  }

  /**
   * Ejecuta el caso de uso de listar documentos
   * @param {Object} request - Objeto con tenantId, userId y filters
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {Object} request.filters - Filtros de búsqueda
   * @param {boolean} request.filters.allUsers - Si es true, lista todos los documentos del tenant (admin)
   * @param {number} request.filters.limit - Límite de resultados
   * @param {number} request.filters.skip - Número de resultados a saltar
   * @returns {Promise<Object>} Objeto con pdfs (array) y count (número)
   */
  async execute({ tenantId, userId, filters }) {
    const { allUsers = false, limit = 50, skip = 0 } = filters;

    // Si allUsers es true, pasar userId = null para ver todos los documentos del tenant
    const filterUserId = allUsers ? null : userId;

    // Obtener documentos del repositorio
    const pdfs = await this.pdfRepository.findAll(tenantId, {
      userId: filterUserId,
      limit,
      skip,
      includeDeleted: false, // No incluir documentos eliminados
    });

    return {
      pdfs,
      count: pdfs.length,
    };
  }
}

