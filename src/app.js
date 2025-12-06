import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import routes from "./infrastructure/http/routes/index.routes.js";
import { generalRateLimit } from "./infrastructure/http/middlewares/rate-limit.middleware.js";
import { securityLogger } from "./infrastructure/http/middlewares/security-logger.middleware.js";
import { mongoSanitizeMiddleware } from "./infrastructure/http/middlewares/mongo-sanitize.middleware.js";
import { errorHandler, notFoundHandler } from "./infrastructure/http/middlewares/error-handler.middleware.js";

dotenv.config();

const app = express();

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Helmet - Headers de seguridad HTTP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"], // Permitir Chart.js desde CDN
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"], // Permitir conexiones para source maps
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Permitir embeds si es necesario
  })
);

// 2. CORS configurado - Permitir solo orígenes específicos
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, curl, etc.) solo en desarrollo
      if (!origin && process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("No permitido por CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 3. Límites de payload configurables
const EXPRESS_JSON_LIMIT = process.env.EXPRESS_JSON_LIMIT_MB 
  ? `${process.env.EXPRESS_JSON_LIMIT_MB}mb` 
  : "10mb";
app.use(express.json({ limit: EXPRESS_JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: EXPRESS_JSON_LIMIT }));


// 4. Sanitización MongoDB - Prevenir inyección NoSQL
// Middleware personalizado compatible con Express 5 (solo sanitiza req.body)
app.use(mongoSanitizeMiddleware);

// 5. Rate limiting general (después del logging para poder ver las requests bloqueadas)
app.use("/api", generalRateLimit);

// 6. Logging de seguridad
app.use(securityLogger);

// 7. Timeout para requests (15 minutos - necesario para procesar PDFs grandes)
app.use((req, res, next) => {
  req.setTimeout(900000, () => {
    res.status(408).json({
      ok: false,
      message: "Request timeout",
    });
  });
  next();
});

// Redirigir raíz a login.html
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// carpeta public/
const publicPath = path.resolve(__dirname, "../public");
app.use(express.static(publicPath));

// todas las rutas
app.use("/api", routes);

// 8. Manejo de rutas no encontradas
app.use(notFoundHandler);

// 9. Manejo de errores (debe ir al final)
app.use(errorHandler);

export default app;
