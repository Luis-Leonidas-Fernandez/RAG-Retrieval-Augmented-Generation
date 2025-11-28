import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");

// crear carpeta si no existe
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${timestamp}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos PDF"), false);
  }
};

// Límite de tamaño configurable (previene problemas de memoria)
const MAX_FILE_SIZE_MB = parseInt(process.env.PDF_MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

export const uploadPdfMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
}).single("pdf"); // el campo del form se llamará "pdf"

// Middleware adicional para validar tamaño después del upload
export const validatePdfSize = (req, res, next) => {
  if (req.file) {
    if (req.file.size > MAX_FILE_SIZE) {
      // Eliminar archivo si excede el límite
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: `El archivo excede el tamaño máximo permitido de ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
      });
    }
  }
  next();
};
