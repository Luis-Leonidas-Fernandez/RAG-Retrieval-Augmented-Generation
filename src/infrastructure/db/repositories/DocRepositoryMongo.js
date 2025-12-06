import { DocModel } from "../models/doc.model.js";
import { IDocRepository } from "../../../domain/repositories/IDocRepository.js";

/**
 * Implementación de IDocRepository usando Mongoose
 */
export class DocRepositoryMongo extends IDocRepository {
  /**
   * Crea un nuevo documento
   */
  async create(tenantId, userId, pdfData) {
    const pdfDoc = await DocModel.create({
      tenantId,
      userId,
      ...pdfData,
    });

    return pdfDoc.toObject();
  }

  /**
   * Busca un documento por ID y tenantId
   */
  async findById(tenantId, pdfId, options = {}) {
    const { includeDeleted = false } = options;

    const query = { _id: pdfId, tenantId };
    if (!includeDeleted) {
      query.isDeleted = false;
    }

    const pdfDoc = await DocModel.findOne(query);

    if (!pdfDoc) {
      return null;
    }

    return pdfDoc.toObject();
  }

  /**
   * Lista todos los documentos de un tenant
   */
  async findAll(tenantId, options = {}) {
    const { userId = null, limit = 50, skip = 0, includeDeleted = false } = options;

    const query = { tenantId };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    if (userId) {
      query.userId = userId;
    }

    const pdfs = await DocModel.find(query)
      .select("originalName fileName path size mimetype status createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return pdfs;
  }

  /**
   * Actualiza el status de un documento
   */
  async updateStatus(tenantId, pdfId, status) {
    const pdfDoc = await DocModel.findOneAndUpdate(
      { _id: pdfId, tenantId },
      { $set: { status } },
      { new: true }
    );

    if (!pdfDoc) {
      return null;
    }

    return pdfDoc.toObject();
  }

  /**
   * Realiza soft-delete de un documento
   */
  async softDelete(tenantId, pdfId, userId) {
    const pdfDoc = await DocModel.findOne({
      _id: pdfId,
      tenantId,
      isDeleted: false,
    });

    if (!pdfDoc) {
      return null;
    }

    pdfDoc.isDeleted = true;
    pdfDoc.deletedAt = new Date();
    pdfDoc.deletedBy = userId;
    await pdfDoc.save();

    return pdfDoc.toObject();
  }

  /**
   * Restaura un documento que fue soft-deleted
   */
  async restore(tenantId, pdfId) {
    const pdfDoc = await DocModel.findOne({
      _id: pdfId,
      tenantId,
      isDeleted: true,
    });

    if (!pdfDoc) {
      return null;
    }

    pdfDoc.isDeleted = false;
    pdfDoc.deletedAt = null;
    pdfDoc.deletedBy = null;
    await pdfDoc.save();

    return pdfDoc.toObject();
  }

  /**
   * Elimina permanentemente un documento
   */
  async hardDelete(tenantId, pdfId) {
    const result = await DocModel.deleteOne({ _id: pdfId, tenantId });
    return result.deletedCount > 0;
  }

  /**
   * Cuenta documentos según criterios
   */
  async count(tenantId, options = {}) {
    const { userId = null, includeDeleted = false, status = null } = options;

    const query = { tenantId };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    if (userId) {
      query.userId = userId;
    }
    if (status) {
      query.status = status;
    }

    return await DocModel.countDocuments(query);
  }

  /**
   * Realiza soft-delete masivo de documentos de un usuario
   */
  async softDeleteByUser(tenantId, userId) {
    const result = await DocModel.updateMany(
      { tenantId, userId },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    return result.modifiedCount;
  }

  /**
   * Realiza hard-delete masivo de documentos de un usuario
   */
  async hardDeleteByUser(tenantId, userId) {
    const result = await DocModel.deleteMany({ tenantId, userId });
    return result.deletedCount;
  }

  /**
   * Obtiene IDs de documentos de un usuario
   */
  async findPdfIdsByUser(tenantId, userId) {
    const pdfs = await DocModel.find({ tenantId, userId })
      .select("_id")
      .lean();

    return pdfs.map((p) => p._id);
  }
}

