import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    metadata: {
      pdfId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pdf",
      },
      chunks: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Chunk",
        },
      ],
      tokens: {
        prompt_tokens: Number,
        completion_tokens: Number,
        total_tokens: Number,
      },
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Índices compuestos empezando por tenantId
MessageSchema.index({ tenantId: 1, conversationId: 1, index: 1 });
MessageSchema.index({ tenantId: 1, conversationId: 1, createdAt: -1 });
MessageSchema.index({ tenantId: 1, conversationId: 1 });
MessageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });
MessageSchema.index({ tenantId: 1, conversationId: 1, deletedAt: 1 });

export const MessageModel = mongoose.model("Message", MessageSchema);

