import mongoose from "mongoose";

const ChunkSchema = new mongoose.Schema(
  {
    pdfId: { type: mongoose.Schema.Types.ObjectId, ref: "Pdf", required: true },
    index: Number,
    content: String,
    page: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["chunked", "embedded"],
      default: "chunked",
    },
  },
  { timestamps: true }
);

export const ChunkModel = mongoose.model("Chunk", ChunkSchema);
