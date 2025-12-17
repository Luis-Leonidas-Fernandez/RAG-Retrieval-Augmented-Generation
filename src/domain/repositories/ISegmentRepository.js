/**
 * Interface para repositorio de segmentos
 * Define el contrato que deben cumplir las implementaciones
 */
export class ISegmentRepository {
  /**
   * Crea un nuevo segmento
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario que crea el segmento
   * @param {Object} data - Datos del segmento (sourceDocId, descripcionQuery, canalesOrigen, clientes)
   * @returns {Promise<Object>} Segmento creado
   */
  async create(tenantId, userId, data) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un segmento por ID y tenantId
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} segmentId - ID del segmento
   * @returns {Promise<Object|null>} Segmento encontrado o null
   */
  async findById(tenantId, segmentId) {
    throw new Error("Method not implemented");
  }
}


