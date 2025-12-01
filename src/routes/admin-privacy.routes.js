import { Router } from "express";
import {
  deleteUserData,
  exportUserData,
} from "../controllers/admin-privacy.controller.js";
import { authenticateToken, requireAdmin } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

const router = Router();

// Todas las rutas requieren autenticación y admin
router.use(authenticateToken);
router.use(requireAdmin);
router.use(generalUserRateLimit);

// DELETE /api/admin/privacy/user/:userId - Borrar datos de usuario (admin)
router.delete("/user/:userId", validateIdParam("userId"), deleteUserData);

// GET /api/admin/privacy/user/:userId/export - Exportar datos de usuario (GDPR)
router.get("/user/:userId/export", validateIdParam("userId"), exportUserData);

export default router;

