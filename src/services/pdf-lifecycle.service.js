import { PdfModel } from "../models/pdf.model.js";
import { ChunkModel } from "../models/chunk.model.js";
import { ConversationModel } from "../models/conversation.model.js";
import { invalidateRagCacheForPdf } from "./cache.service.js";
import { deletePdfFromVectorStore, restorePdfInVectorStore } from "./qdrant.service.js";

/**
 * Soft-delete de PDF con cascada
 */
export async function softDeletePdf(tenantId, pdfId, userId) {
  // Validar que PDF existe y pertenece al tenant
  const pdf = await PdfModel.findOne({
    _id: pdfId,
    tenantId, // CRÍTICO: validar tenant
    isDeleted: false,
  });

  if (!pdf) {
    throw new Error("PDF no encontrado o no pertenece al tenant");
  }

  // Marcar PDF como borrado
  pdf.isDeleted = true;
  pdf.deletedAt = new Date();
  pdf.deletedBy = userId;
  await pdf.save();

  // Cascada en conversaciones: marcar pdfDeletedAt (NO cambiar isActive)
  await ConversationModel.updateMany(
    {
      tenantId,
      pdfId,
      pdfDeletedAt: null, // Solo actualizar si no estaba ya marcado
    },
    {
      $set: { pdfDeletedAt: new Date() },
    }
  );

  // Invalidar caché RAG
  await invalidateRagCacheForPdf(tenantId, pdfId);

  // Marcar en Qdrant (soft-delete)
  await deletePdfFromVectorStore(tenantId, pdfId, false);

  return pdf;
}

/**
 * Restaurar PDF borrado
 */
export async function restorePdf(tenantId, pdfId) {
  // Validar que PDF existe y está borrado
  const pdf = await PdfModel.findOne({
    _id: pdfId,
    tenantId, // CRÍTICO: validar tenant
    isDeleted: true,
  });

  if (!pdf) {
    throw new Error("PDF no encontrado o no está borrado");
  }

  // Restaurar PDF
  pdf.isDeleted = false;
  pdf.deletedAt = null;
  pdf.deletedBy = null;
  await pdf.save();

  // Restaurar en conversaciones: limpiar pdfDeletedAt
  await ConversationModel.updateMany(
    {
      tenantId,
      pdfId,
      pdfDeletedAt: { $ne: null },
    },
    {
      $unset: { pdfDeletedAt: "" },
    }
  );

  // Restaurar en Qdrant
  await restorePdfInVectorStore(tenantId, pdfId);

  return pdf;
}

/**
 * Hard-delete de PDF (eliminación permanente, solo admin)
 */
export async function hardDeletePdf(tenantId, pdfId, userId) {
  // Validar que PDF existe y pertenece al tenant
  const pdf = await PdfModel.findOne({
    _id: pdfId,
    tenantId, // CRÍTICO: validar tenant
  });

  if (!pdf) {
    throw new Error("PDF no encontrado o no pertenece al tenant");
  }

  // Borrar de Qdrant (hard-delete)
  await deletePdfFromVectorStore(tenantId, pdfId, true);

  // Borrar chunks de MongoDB
  await ChunkModel.deleteMany({ tenantId, pdfId });

  // Borrar PDF de MongoDB
  await PdfModel.deleteOne({ _id: pdfId, tenantId });

  // Invalidar caché RAG
  await invalidateRagCacheForPdf(tenantId, pdfId);

  return { deleted: true };
}

