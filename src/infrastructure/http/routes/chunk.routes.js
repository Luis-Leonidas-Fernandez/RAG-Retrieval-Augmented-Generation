import { Router } from "express";
import { ChunkController } from "../../../interfaces/http/controllers/ChunkController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

// Instanciar ChunkController
const chunkController = new ChunkController();

const router = Router();

// Rate limiting por usuario (ruta protegida siempre requiere autenticación)
// Ya no usamos combinedRateLimit porque esta ruta requiere authenticateToken

router.get("/:pdfId", authenticateToken, generalUserRateLimit, validateIdParam("pdfId"), chunkController.listChunksByPdf.bind(chunkController));

export default router;

