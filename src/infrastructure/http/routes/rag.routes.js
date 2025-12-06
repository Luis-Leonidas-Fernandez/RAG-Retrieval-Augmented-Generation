import { Router } from "express";
import { RagController } from "../../../interfaces/http/controllers/RagController.js";
import { ragUserRateLimit, ragTenantRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { validateString, validateObjectIdBody, handleValidationErrors } from "../middlewares/validation.middleware.js";

const router = Router();

// Instanciar controller hexagonal
const ragController = new RagController();

// Validación para RAG query
const validateRagQuery = [
  validateString("question", {
    minLength: 3,
    maxLength: 1000,
    required: true,
  }),
  validateObjectIdBody("pdfId"),
  handleValidationErrors,
];

// Rate limiting: primero por tenant, luego por usuario
// Orden: IP (global) → Tenant → User

router.post("/query", 
  authenticateToken, 
  ragTenantRateLimit,  // Primero: límite por tenant
  ragUserRateLimit,    // Segundo: límite por usuario
  validateRagQuery, 
  ragController.query.bind(ragController)
);

router.get("/export/:exportId",
  authenticateToken,
  ragController.exportToExcel.bind(ragController)
);

export default router;

