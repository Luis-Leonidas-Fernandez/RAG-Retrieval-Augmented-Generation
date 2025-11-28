// src/routes/health.routes.js
import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";

const router = Router();

router.get("/", healthCheck); // GET /api/health

export default router;
