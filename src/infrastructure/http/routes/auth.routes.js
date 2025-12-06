import { Router } from "express";
import { AuthController } from "../../../interfaces/http/controllers/AuthController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authRateLimit } from "../middlewares/rate-limit.middleware.js";
import {
  handleValidationErrors,
} from "../middlewares/validation.middleware.js";
import { body } from "express-validator";

// Instanciar AuthController
const authController = new AuthController();

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
  body("tenantSlug")
    .optional()
    .trim()
    .toLowerCase()
    .isLength({ min: 1, max: 50 })
    .withMessage("El tenantSlug debe tener entre 1 y 50 caracteres"),
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
// Usa el nuevo AuthController con arquitectura hexagonal
router.post("/register", authRateLimit, validateRegister, authController.register.bind(authController));

// POST /api/auth/login - Login (sin autenticación)
// Rate limit estricto (5 req/min por IP) para prevenir fuerza bruta
// Usa el nuevo AuthController con arquitectura hexagonal
router.post("/login", authRateLimit, validateLogin, authController.login.bind(authController));

// GET /api/auth/profile - Perfil (requiere autenticación)
router.get("/profile", authenticateToken, authController.getProfile.bind(authController));

// PUT /api/auth/profile - Actualizar perfil (requiere autenticación)
router.put("/profile", authenticateToken, validateUpdateProfile, authController.updateProfile.bind(authController));

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
// Usa el nuevo AuthController con arquitectura hexagonal
router.post("/verify-email", authRateLimit, validateVerifyEmail, authController.verifyEmail.bind(authController));

// POST /api/auth/resend-verification - Reenviar email de verificación (requiere autenticación)
router.post("/resend-verification", authenticateToken, authRateLimit, authController.resendVerification.bind(authController));

// Validación para solicitar reset de contraseña
const validateRequestPasswordReset = [
  body("email")
    .isEmail()
    .withMessage("Debe ser un email válido")
    .normalizeEmail()
    .trim(),
  body("tenantSlug")
    .optional()
    .trim()
    .toLowerCase()
    .isLength({ min: 1, max: 50 })
    .withMessage("El tenantSlug debe tener entre 1 y 50 caracteres"),
  handleValidationErrors,
];

// Validación para resetear contraseña
const validateResetPassword = [
  body("token")
    .notEmpty()
    .withMessage("Token de reset requerido")
    .trim(),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("La nueva contraseña debe tener al menos 6 caracteres"),
  body("confirmPassword")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Las contraseñas no coinciden");
      }
      return true;
    })
    .withMessage("Las contraseñas no coinciden"),
  handleValidationErrors,
];

// POST /api/auth/request-password-reset - Solicitar reset de contraseña (sin autenticación)
// Usa el nuevo AuthController con arquitectura hexagonal
router.post("/request-password-reset", authRateLimit, validateRequestPasswordReset, authController.requestPasswordReset.bind(authController));

// POST /api/auth/reset-password - Resetear contraseña con token (sin autenticación)
// Usa el nuevo AuthController con arquitectura hexagonal
router.post("/reset-password", authRateLimit, validateResetPassword, authController.resetPassword.bind(authController));

export default router;

