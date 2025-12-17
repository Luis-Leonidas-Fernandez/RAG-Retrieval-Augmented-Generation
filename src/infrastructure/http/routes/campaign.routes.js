import { Router } from "express";
import { body } from "express-validator";
import { CampaignController } from "../../../interfaces/http/controllers/CampaignController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { handleValidationErrors } from "../middlewares/validation.middleware.js";

const router = Router();
const campaignController = new CampaignController();

// Validación para crear campaña desde segmento
const validateStartFromSegment = [
  body("segmentId")
    .notEmpty()
    .withMessage("segmentId es requerido")
    .isMongoId()
    .withMessage("segmentId debe ser un ObjectId válido"),
  handleValidationErrors,
];

// POST /api/campaigns/start-from-segment
router.post(
  "/start-from-segment",
  authenticateToken,
  validateStartFromSegment,
  campaignController.startFromSegment.bind(campaignController)
);

export default router;

