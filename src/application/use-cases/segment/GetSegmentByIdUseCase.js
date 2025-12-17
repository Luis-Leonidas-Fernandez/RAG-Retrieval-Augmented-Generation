/**
 * Caso de uso para obtener un segmento por ID
 */
export class GetSegmentByIdUseCase {
  constructor(segmentRepository) {
    this.segmentRepository = segmentRepository;
  }

  /**
   * Ejecuta la obtención de segmento
   * @param {Object} params
   * @param {string|ObjectId} params.tenantId - ID del tenant
   * @param {string|ObjectId} params.segmentId - ID del segmento
   */
  async execute({ tenantId, segmentId }) {
    if (!segmentId) {
      throw new Error("segmentId es requerido");
    }

    const segment = await this.segmentRepository.findById(tenantId, segmentId);
    if (!segment) {
      const error = new Error("Segmento no encontrado");
      error.code = "SEGMENT_NOT_FOUND";
      throw error;
    }

    return { segment };
  }
}


