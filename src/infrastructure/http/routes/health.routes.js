// src/infrastructure/http/routes/health.routes.js
import { Router } from "express";
import { HealthController } from "../../../interfaces/http/controllers/HealthController.js";

// Instanciar HealthController
const healthController = new HealthController();

const router = Router();

router.get("/", healthController.healthCheck.bind(healthController)); // GET /api/health

export default router;

