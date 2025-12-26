import { Router } from "express";
import { DocController } from "../../../interfaces/http/controllers/DocController.js";
import { uploadDocMiddleware, validateDocSize } from "../middlewares/upload.middleware.js";
import { 
  uploadUserRateLimit, 
  processUserRateLimit, 
  generalUserRateLimit,
  uploadTenantRateLimit,
  processTenantRateLimit,
} from "../middlewares/user-rate-limit.middleware.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

// Instanciar DocController
const pdfController = new DocController();

const router = Router();

// Rate limiting por usuario (rutas protegidas siempre requieren autenticación)
// Ya no usamos combinedRateLimit porque todas estas rutas requieren authenticateToken
// El rate limit global (200 req/min) se aplica primero, luego estos específicos por usuario

// POST /api/pdf/upload
router.post("/upload", 
  authenticateToken, 
  uploadTenantRateLimit,  // Límite por tenant
  uploadUserRateLimit,    // Límite por usuario
  uploadDocMiddleware, 
  validateDocSize, 
  pdfController.uploadPdf.bind(pdfController)
);

// GET /api/pdf
router.get("/", authenticateToken, generalUserRateLimit, pdfController.listPdfs.bind(pdfController));

router.post("/process/:id", 
  authenticateToken, 
  processTenantRateLimit,  // Límite por tenant
  processUserRateLimit,    // Límite por usuario
  validateIdParam("id"), 
  pdfController.processPdf.bind(pdfController)
);

// POST /api/pdf/embed/:id    → generar embeddings + Qdrant
router.post("/embed/:id", 
  authenticateToken, 
  processTenantRateLimit,  // Límite por tenant
  processUserRateLimit,    // Límite por usuario
  validateIdParam("id"), 
  pdfController.embedPdfChunks.bind(pdfController)
);

// GET /api/pdf/:id/index    → obtener índice (TOC) del PDF
router.get("/:id/index",
  authenticateToken,
  generalUserRateLimit,
  validateIdParam("id"),
  pdfController.getPdfIndex.bind(pdfController)
);

// DELETE /api/pdf/:id - Eliminar documento y todos sus datos
router.delete("/:id",
  authenticateToken,
  generalUserRateLimit,
  validateIdParam("id"),
  pdfController.deletePdf.bind(pdfController)
);

export default router;

