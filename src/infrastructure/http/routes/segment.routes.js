import { Router } from "express";
import { body } from "express-validator";
import multer from "multer";
import { SegmentController } from "../../../interfaces/http/controllers/SegmentController.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import {
  validateObjectIdBody,
  handleValidationErrors,
  validateIdParam,
} from "../middlewares/validation.middleware.js";

const router = Router();

// Instanciar controller hexagonal
const segmentController = new SegmentController();

// -----------------------------
// Validaciones
// -----------------------------

// Validación para crear segmento desde RAG
const validateCreateSegmentFromRag = [
  validateObjectIdBody("sourceDocId"),
  body("clientes")
    .isArray({ min: 1 })
    .withMessage("clientes debe ser un array con al menos un elemento"),
  body("imageUrlPromo")
    .custom((value) => {
      // Aceptar array con al menos una URL
      if (!Array.isArray(value)) {
        throw new Error("imageUrlPromo debe ser un array");
      }
      if (value.length === 0) {
        throw new Error("imageUrlPromo debe contener al menos una URL");
      }
      // Validar que todos los elementos sean strings no vacíos
      const allValidStrings = value.every(
        (u) => typeof u === "string" && u.trim().length > 0
      );
      if (!allValidStrings) {
        throw new Error("imageUrlPromo debe contener solo strings no vacíos");
      }
      return true;
    })
    .withMessage("imageUrlPromo debe ser un array con al menos una URL válida"),
  handleValidationErrors,
];

// Configuración de subida de imagen para segmentos (Cloudinary)
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      cb(
        new Error(
          "Solo se permiten imágenes (jpg, jpeg, png, gif, webp) para el segmento."
        ),
        false
      );
      return;
    }

    cb(null, true);
  },
}).single("image");

// -----------------------------
// Rutas
// -----------------------------

// POST /api/segments/create/from-rag
router.post(
  "/create/from-rag",
  authenticateToken,
  validateCreateSegmentFromRag,
  segmentController.createFromRag.bind(segmentController)
);

// POST /api/segments/upload-image
router.post(
  "/upload-image",
  authenticateToken,
  (req, res, next) => {
    imageUpload(req, res, (err) => {
      if (err) {
        const message =
          err.message ||
          `Error al subir la imagen. Tamaño máximo permitido: ${MAX_IMAGE_SIZE_MB} MB.`;
        return res.status(400).json({
          ok: false,
          message,
        });
      }
      next();
    });
  },
  segmentController.uploadImage.bind(segmentController)
);

// GET /api/segments/:segmentId
router.get(
  "/:segmentId",
  authenticateToken,
  validateIdParam("segmentId"),
  segmentController.getById.bind(segmentController)
);

export default router;


