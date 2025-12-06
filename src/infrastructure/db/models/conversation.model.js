import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
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
    pdfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pdf",
      required: true,
    },
    title: {
      type: String,
      default: "Nueva conversación",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    contextWindowSize: {
      type: Number,
      default: 10,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    summary: {
      type: String,
    },
    summaryGeneratedAt: {
      type: Date,
    },
    summaryMessageCount: {
      type: Number,
    },
    lastSummaryMessageIndex: {
      type: Number,
    },
    pdfDeletedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    totalPromptTokens: {
      type: Number,
      default: 0,
    },
    totalCompletionTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    tokenCost: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Índice único parcial (CRÍTICO para prevenir race conditions)
ConversationSchema.index(
  { tenantId: 1, userId: 1, pdfId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, pdfDeletedAt: null, deletedAt: null },
  }
);

// Otros índices compuestos empezando por tenantId
ConversationSchema.index({ tenantId: 1, userId: 1, isActive: 1, createdAt: -1 });
ConversationSchema.index({ tenantId: 1, userId: 1, lastMessageAt: -1 });
ConversationSchema.index({ tenantId: 1, lastMessageAt: -1 });
ConversationSchema.index({ tenantId: 1, pdfDeletedAt: 1 });
ConversationSchema.index({ tenantId: 1, isActive: 1, pdfDeletedAt: 1 });
ConversationSchema.index({ tenantId: 1, deletedAt: 1 });
ConversationSchema.index({ tenantId: 1, createdAt: -1 });

export const ConversationModel = mongoose.model("Conversation", ConversationSchema);

