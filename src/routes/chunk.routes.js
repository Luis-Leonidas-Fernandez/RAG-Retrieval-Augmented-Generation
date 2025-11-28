import { Router } from "express";
import { listChunksByPdf } from "../controllers/chunk.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

const router = Router();

// Rate limiting por usuario (ruta protegida siempre requiere autenticación)
// Ya no usamos combinedRateLimit porque esta ruta requiere authenticateToken

router.get("/:pdfId", authenticateToken, generalUserRateLimit, validateIdParam("pdfId"), listChunksByPdf);

export default router;
