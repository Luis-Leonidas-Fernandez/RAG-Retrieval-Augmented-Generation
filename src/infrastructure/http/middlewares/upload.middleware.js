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

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = [
  // Documentos
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  // Texto
  "text/plain", // .txt
  "text/markdown", // .md
  "text/x-markdown", // .md
  // Imágenes
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/webp",
];

// Extensiones permitidas (validación adicional)
const ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".md", ".markdown",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Validar extensión
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error(`Tipo de archivo no permitido. Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(", ")}`), false);
    return;
  }
  
  // Validar MIME type
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo MIME no permitido: ${file.mimetype}. Tipos permitidos: ${ALLOWED_MIME_TYPES.join(", ")}`), false);
  }
};

// Límite de tamaño configurable (previene problemas de memoria)
const MAX_FILE_SIZE_MB = parseInt(process.env.PDF_MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

export const uploadDocMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
}).single("doc"); // el campo del form se llamará "doc"

// Middleware adicional para validar tamaño después del upload
export const validateDocSize = (req, res, next) => {
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

