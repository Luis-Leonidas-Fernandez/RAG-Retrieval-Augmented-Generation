import mongoose from "mongoose";

const campaignSentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    channel: {
      type: String,
      required: true,
      enum: ["EMAIL", "WHATSAPP"],
      index: true,
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    campaignId: {
      type: String,
      required: false, // ID de la campaña del servicio de mailer
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto para búsquedas eficientes por tenant, email, canal y fecha
campaignSentSchema.index({ tenantId: 1, email: 1, channel: 1, sentAt: -1 });

// Índice para consultas por tenant, canal y fecha (para filtrado semanal)
campaignSentSchema.index({ tenantId: 1, channel: 1, sentAt: -1 });

export const CampaignSentModel = mongoose.model("CampaignSent", campaignSentSchema);

