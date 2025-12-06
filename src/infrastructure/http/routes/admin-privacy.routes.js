import { Router } from "express";
import { AdminPrivacyController } from "../../../interfaces/http/controllers/AdminPrivacyController.js";
import { authenticateToken, requireAdmin } from "../middlewares/auth.middleware.js";
import { generalUserRateLimit } from "../middlewares/user-rate-limit.middleware.js";
import { validateIdParam } from "../middlewares/validation.middleware.js";

// Instanciar AdminPrivacyController
const adminPrivacyController = new AdminPrivacyController();

const router = Router();

// Todas las rutas requieren autenticación y admin
router.use(authenticateToken);
router.use(requireAdmin);
router.use(generalUserRateLimit);

// DELETE /api/admin/privacy/user/:userId - Borrar datos de usuario (admin)
router.delete(
  "/user/:userId",
  validateIdParam("userId"),
  adminPrivacyController.deleteUserData.bind(adminPrivacyController)
);

// GET /api/admin/privacy/user/:userId/export - Exportar datos de usuario (GDPR)
router.get(
  "/user/:userId/export",
  validateIdParam("userId"),
  adminPrivacyController.exportUserData.bind(adminPrivacyController)
);

export default router;

