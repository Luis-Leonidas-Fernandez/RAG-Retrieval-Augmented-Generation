import dotenv from "dotenv";
dotenv.config();
import http from "http";
import app from "./app.js";
import { dbConnection, closeDbConnection } from "./config/db.js";
import { initQdrant } from "./services/qdrant.service.js";
import { initRedis, closeRedis } from "./config/redis.js";
import { closePdfPool, getPdfPool } from "./services/pdf-process.service.js";
import { startMetricsCollection, stopMetricsCollection } from "./services/metrics-collector.service.js";
import { setPdfPoolGetter } from "./services/metrics.service.js";

let server = null;
let isShuttingDown = false;

// Middleware para rechazar nuevas requests durante shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    return res.status(503).json({
      ok: false,
      message: "Servidor en proceso de cierre, por favor intente más tarde",
    });
  }
  next();
});

// Función de graceful shutdown
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    return; // Evitar múltiples llamadas
  }

  console.log(`\n[Shutdown] Recibida señal ${signal}, iniciando cierre graceful...`);
  isShuttingDown = true;

  // 1. Dejar de aceptar nuevas conexiones
  if (server) {
    server.close(() => {
      console.log("[Shutdown] Servidor HTTP cerrado");
    });
  }

  // 2. Timeout de seguridad para forzar cierre si algo se cuelga
  const shutdownTimeout = setTimeout(() => {
    console.error("[Shutdown] Timeout alcanzado (30s), forzando cierre...");
    process.exit(1);
  }, 30000); // 30 segundos máximo

  try {
    // 3. Cerrar Redis
    await closeRedis();

    // 4. Cerrar MongoDB
    await closeDbConnection();

    // 5. Cerrar Worker Pool
    await closePdfPool();

    // 6. Detener recolección de métricas
    stopMetricsCollection();

    clearTimeout(shutdownTimeout);
    console.log("[Shutdown] Cierre graceful completado exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("[Shutdown] Error durante el cierre:", error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// Manejar señales de terminación
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Manejar errores no capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Server] Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Inicializar servicios y arrancar servidor
try {
  // 1) Conectar DB (con await para evitar race conditions)
  await dbConnection();

  // 2) Inicializar Qdrant (crear colección si no existe)
  await initQdrant();

  // 3) Inicializar Redis para caché
  await initRedis();

  // 4) Crear servidor HTTP
  server = http.createServer(app);

  // 5) Iniciar servidor
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`[Server] Servidor conectado en el puerto: ${port}`);
  });

  // 6) Registrar getter del pool de workers para métricas
  setPdfPoolGetter(getPdfPool);

  // 7) Iniciar recolección periódica de métricas
  startMetricsCollection();
} catch (error) {
  console.error("[Server] Error al inicializar servicios:", error);
  process.exit(1);
}
