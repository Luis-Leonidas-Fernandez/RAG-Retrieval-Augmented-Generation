import mongoose from "mongoose";

const PdfSchema = new mongoose.Schema(
  {
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
    // luego podés agregar: collectionId de Qdrant, numPages, etc.
  },
  {
    timestamps: true,
  }
);

export const PdfModel = mongoose.model("Pdf", PdfSchema);
