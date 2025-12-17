import mongoose from "mongoose";

const ClienteSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: false },
    vehiculo: { type: String, required: false },

    // ✅ NUEVO: WhatsApp
    telefonoRaw: { type: String, required: false },
    telefonoE164: { type: String, required: false, index: true }, // ej: 5493624236020
  },
  { _id: false }
);

const SegmentSchema = new mongoose.Schema(
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
    sourceDocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pdf",
      required: true,
    },
    descripcionQuery: {
      type: String,
      required: true,
    },
    canalesOrigen: {
      type: [String],
      default: [],
    },
    // ÚNICO campo de imágenes: array de URLs promocionales
    imageUrlPromo: {
      type: [String],
      default: [],
    },
    clientes: {
      type: [ClienteSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Índices compuestos empezando por tenantId
SegmentSchema.index({ tenantId: 1, createdAt: -1 });

// ✅ NUEVO índice para WhatsApp
SegmentSchema.index({ tenantId: 1, "clientes.telefonoE164": 1, createdAt: -1 });

export const SegmentModel = mongoose.model("Segment", SegmentSchema, "segments");


