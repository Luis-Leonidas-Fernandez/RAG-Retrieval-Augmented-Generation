import { Router } from "express";
import healthRoutes from "./health.routes.js";
import pdfRoutes from "./pdf.routes.js";
import chunkRoutes from "./chunk.routes.js";
import ragRoutes from "./rag.routes.js";
import authRoutes from "./auth.routes.js";
import metricsRoutes from "./metrics.routes.js";
import sessionRoutes from "./session.routes.js";
import conversationRoutes from "./conversation.routes.js";
import privacyRoutes from "./privacy.routes.js";
import adminPrivacyRoutes from "./admin-privacy.routes.js";

const router = Router();

// todas las rutas cuelgan de /api/...
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/pdf", pdfRoutes);
router.use("/chunks", chunkRoutes);
router.use("/rag", ragRoutes);
router.use("/metrics", metricsRoutes);
router.use("/sessions", sessionRoutes);
router.use("/conversations", conversationRoutes);
router.use("/privacy", privacyRoutes);
router.use("/admin/privacy", adminPrivacyRoutes);
export default router;

