import { SegmentModel } from "../models/segment.model.js";
import { ISegmentRepository } from "../../../domain/repositories/ISegmentRepository.js";
import { withTenantAndNotDeleted } from "../../../domain/utils/tenant-helpers.js";

/**
 * Implementación de ISegmentRepository usando Mongoose
 */
export class SegmentRepositoryMongo extends ISegmentRepository {
  /**
   * Crea un nuevo segmento
   */
  async create(tenantId, userId, data) {
    // Normalizar a array de URLs (único campo)
    const images = Array.isArray(data.imageUrlPromo)
      ? data.imageUrlPromo.filter(
          (u) => typeof u === "string" && u.trim()
        )
      : (typeof data.imageUrlPromo === "string" && data.imageUrlPromo.trim()
          ? [data.imageUrlPromo.trim()]
          : []);

    const segmentDoc = await SegmentModel.create({
      tenantId,
      userId,
      sourceDocId: data.sourceDocId,
      descripcionQuery: data.descripcionQuery,
      canalesOrigen: data.canalesOrigen || [],
      imageUrlPromo: images,
      clientes: Array.isArray(data.clientes) ? data.clientes : [],
    });

    return segmentDoc.toObject();
  }

  /**
   * Busca un segmento por ID y tenantId
   */
  async findById(tenantId, segmentId) {
    const query = withTenantAndNotDeleted({ _id: segmentId }, tenantId);

    const segmentDoc = await SegmentModel.findOne(query).lean();
    if (!segmentDoc) {
      return null;
    }

    return segmentDoc;
  }
}


