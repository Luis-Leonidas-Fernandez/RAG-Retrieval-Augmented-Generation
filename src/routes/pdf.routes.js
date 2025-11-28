import { Router } from "express";
import { uploadPdf, listPdfs } from "../controllers/pdf.controller.js";
import { uploadPdfMiddleware, validatePdfSize } from "../middlewares/upload.middleware.js";
import { processPdf } from "../controllers/pdf-process.controller.js";
import { embedPdfChunks } from "../controllers/pdf-embed.controller.js";
import { uploadUserRateLimit, processUserRateLimit, generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";


const router = Router();

// Rate limiting por usuario (rutas protegidas siempre requieren autenticación)
// Ya no usamos combinedRateLimit porque todas estas rutas requieren authenticateToken
// El rate limit global (200 req/min) se aplica primero, luego estos específicos por usuario

// POST /api/pdf/upload
router.post("/upload", authenticateToken, uploadUserRateLimit, uploadPdfMiddleware, validatePdfSize, uploadPdf);

// GET /api/pdf
router.get("/", authenticateToken, generalUserRateLimit, listPdfs);

router.post("/process/:id", authenticateToken, processUserRateLimit, validateIdParam("id"), processPdf);

// POST /api/pdf/embed/:id    → generar embeddings + Qdrant
router.post("/embed/:id", authenticateToken, processUserRateLimit, validateIdParam("id"), embedPdfChunks);



export default router;
