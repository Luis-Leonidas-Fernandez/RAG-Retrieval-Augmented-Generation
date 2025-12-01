import mongoose from "mongoose";

const TenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    settings: {
      maxUsers: { type: Number, default: 10 },
      maxPdfs: { type: Number, default: 100 },
      llmModel: { type: String, default: "gpt-4o-mini" },
      ragLimits: {
        maxTokens: { type: Number, default: 3500 },
        documentPriority: { type: Number, default: 0.7 },
      },
      rateLimits: {
        ragPerMinute: { type: Number, default: 500 },
        uploadPerMinute: { type: Number, default: 100 },
        processPerMinute: { type: Number, default: 200 },
      },
    },
  },
  { timestamps: true }
);

TenantSchema.index({ slug: 1 });

export const TenantModel = mongoose.model("Tenant", TenantSchema);

