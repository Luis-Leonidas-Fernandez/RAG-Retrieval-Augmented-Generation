import mongoose from "mongoose";

const DocSchema = new mongoose.Schema(
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
    documentKind: {
      type: String,
      enum: ['book', 'libro', 'manual', 'narrative', 'table', 'tabular', 'report', 'clientes', 'registros', null],
      default: null,
      index: false,
    }, // Opcional: tipo de documento para filtrar flujos (book, table, etc.)
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
DocSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
DocSchema.index({ tenantId: 1, isDeleted: 1 });
DocSchema.index({ tenantId: 1, deletedAt: 1 });

export const DocModel = mongoose.model("Pdf", DocSchema, "documents");

