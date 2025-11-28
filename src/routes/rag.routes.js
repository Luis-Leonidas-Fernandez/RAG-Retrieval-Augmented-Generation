import { Router } from "express";
import { ragQuery } from "../controllers/rag.controller.js";
import { ragUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { validateString, validateObjectIdBody, handleValidationErrors } from "../middlewares/validation.middleware.js";

const router = Router();

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

// Rate limiting por usuario (ruta protegida siempre requiere autenticación)
// Ya no usamos combinedRateLimit porque esta ruta requiere authenticateToken

router.post("/query", authenticateToken, ragUserRateLimit, validateRagQuery, ragQuery);

export default router;
