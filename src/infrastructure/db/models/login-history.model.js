import mongoose from "mongoose";

const LoginHistorySchema = new mongoose.Schema(
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
    tokenId: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    deviceInfo: {
      type: String,
    },
    loggedInAt: {
      type: Date,
      default: Date.now,
    },
    loggedOutAt: {
      type: Date,
    },
    sessionDuration: {
      type: Number, // minutos
    },
    wasActive: {
      type: Boolean,
      default: true,
    },
    anonymizedAt: {
      type: Date,
    },
    anonymized: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Índices compuestos empezando por tenantId
LoginHistorySchema.index({ tenantId: 1, userId: 1, loggedInAt: -1 });
LoginHistorySchema.index({ tenantId: 1, tokenId: 1 });
LoginHistorySchema.index({ tenantId: 1, loggedInAt: -1 });
LoginHistorySchema.index({ tenantId: 1, anonymized: 1, loggedInAt: -1 });

export const LoginHistoryModel = mongoose.model("LoginHistory", LoginHistorySchema);

