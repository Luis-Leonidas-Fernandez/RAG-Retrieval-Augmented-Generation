import { Router } from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  verifyEmail,
  resendVerification,
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authRateLimit } from "../middlewares/rate-limit.middleware.js";
import {
  handleValidationErrors,
} from "../middlewares/validation.middleware.js";
import { body } from "express-validator";

const router = Router();

// Validación para registro
const validateRegister = [
  body("email")
    .isEmail()
    .withMessage("Debe ser un email válido")
    .normalizeEmail()
    .trim(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("El nombre es requerido y no puede exceder 100 caracteres")
    .escape(),
  handleValidationErrors,
];

// Validación para login
const validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Debe ser un email válido")
    .normalizeEmail()
    .trim(),
  body("password")
    .notEmpty()
    .withMessage("La contraseña es requerida"),
  handleValidationErrors,
];

// Validación para actualizar perfil
const validateUpdateProfile = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("El nombre no puede exceder 100 caracteres")
    .escape(),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Debe ser un email válido")
    .normalizeEmail()
    .trim(),
  handleValidationErrors,
];

// POST /api/auth/register - Registro (sin autenticación)
// Rate limit estricto (5 req/min por IP) para prevenir ataques de registro masivo
// Este rate limit es más estricto que el global y se aplica antes que el global
router.post("/register", authRateLimit, validateRegister, register);

// POST /api/auth/login - Login (sin autenticación)
// Rate limit estricto (5 req/min por IP) para prevenir fuerza bruta
router.post("/login", authRateLimit, validateLogin, login);

// GET /api/auth/profile - Perfil (requiere autenticación)
router.get("/profile", authenticateToken, getProfile);

// PUT /api/auth/profile - Actualizar perfil (requiere autenticación)
router.put("/profile", authenticateToken, validateUpdateProfile, updateProfile);

// Validación para verificar email
const validateVerifyEmail = [
  body("token")
    .notEmpty()
    .withMessage("Token de verificación requerido")
    .trim(),
  handleValidationErrors,
];

// Validación para reenviar verificación
const validateResendVerification = [
  body("email")
    .isEmail()
    .withMessage("Debe ser un email válido")
    .normalizeEmail()
    .trim(),
  handleValidationErrors,
];

// POST /api/auth/verify-email - Verificar email (sin autenticación)
router.post("/verify-email", authRateLimit, validateVerifyEmail, verifyEmail);

// POST /api/auth/resend-verification - Reenviar email de verificación (sin autenticación)
router.post("/resend-verification", authRateLimit, validateResendVerification, resendVerification);

export default router;

