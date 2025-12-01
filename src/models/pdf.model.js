import mongoose from "mongoose";

const PdfSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true }, // nombre en disco
    path: { type: String, required: true },     // ruta local
    size: { type: Number, required: true },     // bytes
    mimetype: { type: String, required: true },
    status: {
      type: String,
      enum: ["uploaded", "processing", "processed", "error"],
      default: "uploaded",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // luego podés agregar: collectionId de Qdrant, numPages, etc.
  },
  {
    timestamps: true,
  }
);

// Índices compuestos empezando por tenantId
PdfSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
PdfSchema.index({ tenantId: 1, isDeleted: 1 });
PdfSchema.index({ tenantId: 1, deletedAt: 1 });

export const PdfModel = mongoose.model("Pdf", PdfSchema);
