import mongoose from "mongoose";

const ChunkSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    pdfId: { type: mongoose.Schema.Types.ObjectId, ref: "Pdf", required: true },
    index: Number,
    content: String,
    page: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["chunked", "embedded"],
      default: "chunked",
    },
    sectionType: {
      type: String,
      enum: ["toc", "chapter_title", "paragraph", "table", "other"],
      required: true,
      default: "paragraph",
    },
    sectionTitle: {
      type: String,
      required: false,
    },
    path: {
      type: [String],
      required: false,
    },
  },
  { timestamps: true }
);

// Índices compuestos empezando por tenantId
ChunkSchema.index({ tenantId: 1, pdfId: 1, status: 1 });
ChunkSchema.index({ tenantId: 1, pdfId: 1, index: 1 });
ChunkSchema.index({ sectionType: 1 });

export const ChunkModel = mongoose.model("Chunk", ChunkSchema);

