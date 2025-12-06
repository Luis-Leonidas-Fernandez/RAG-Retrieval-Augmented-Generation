import v8 from "v8";
import { saveMetrics } from "./metrics.service.js";

let metricsInterval = null;
let gcInterval = null;
const METRICS_COLLECTION_INTERVAL = parseInt(process.env.METRICS_COLLECTION_INTERVAL || '30000', 10); // 30 segundos por defecto
const GC_CHECK_INTERVAL = parseInt(process.env.METRICS_GC_CHECK_INTERVAL || '60000', 10); // 60 segundos por defecto
const GC_MEMORY_THRESHOLD = parseInt(process.env.METRICS_GC_MEMORY_THRESHOLD || '85', 10); // 85% por defecto

/**
 * Forzar garbage collection si está disponible y la memoria está alta
 */
function forceGarbageCollectionIfNeeded() {
  if (!global.gc) {
    return; // GC no disponible (requiere flag --expose-gc)
  }

  try {
    const memory = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapLimit = heapStats.heap_size_limit;
    const heapUsagePercent = (memory.heapUsed / heapLimit) * 100;

    // Forzar GC si el uso de heap supera el umbral configurado
    if (heapUsagePercent > GC_MEMORY_THRESHOLD) {
      global.gc();
      const afterMemory = process.memoryUsage();
      const freed = (memory.heapUsed - afterMemory.heapUsed) / (1024 * 1024);
      const afterHeapUsagePercent = (afterMemory.heapUsed / heapLimit) * 100;
      console.log(`[Metrics GC] Garbage collection forzado. Memoria liberada: ${freed.toFixed(2)} MB (${heapUsagePercent.toFixed(2)}% → ${afterHeapUsagePercent.toFixed(2)}%)`);
    }
  } catch (error) {
    console.warn("[Metrics GC] Error al forzar GC:", error.message);
  }
}

/**
 * Iniciar recolección periódica de métricas
 */
export function startMetricsCollection() {
  if (metricsInterval) {
    console.warn("[Metrics Collector] La recolección de métricas ya está activa");
    return;
  }

  console.log(`[Metrics Collector] Iniciando recolección periódica de métricas (cada ${METRICS_COLLECTION_INTERVAL / 1000}s)`);
  
  if (global.gc) {
    console.log(`[Metrics Collector] Garbage collection manual habilitado (verificando cada ${GC_CHECK_INTERVAL / 1000}s, umbral: ${GC_MEMORY_THRESHOLD}%)`);
  } else {
    console.warn("[Metrics Collector] Garbage collection manual NO disponible. Ejecuta Node.js con flag --expose-gc para habilitarlo.");
  }

  // Guardar métricas inmediatamente
  saveMetrics().catch(err => {
    console.error("[Metrics Collector] Error en primera recolección:", err.message);
  });

  // Guardar métricas periódicamente (con manejo de errores mejorado)
  metricsInterval = setInterval(async () => {
    try {
      await saveMetrics();
      // saveMetrics ya maneja errores internamente y no los relanza
      // por lo que el intervalo continúa ejecutándose incluso si hay errores
    } catch (err) {
      // Fallback adicional si saveMetrics relanza errores
      console.error("[Metrics Collector] Error inesperado al guardar métricas:", err.message);
    }
  }, METRICS_COLLECTION_INTERVAL);

  // Verificar y forzar GC periódicamente si la memoria está alta
  if (global.gc) {
    gcInterval = setInterval(() => {
      forceGarbageCollectionIfNeeded();
    }, GC_CHECK_INTERVAL);
  }
}

/**
 * Detener recolección periódica de métricas
 */
export function stopMetricsCollection() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (gcInterval) {
    clearInterval(gcInterval);
    gcInterval = null;
  }
  console.log("[Metrics Collector] Recolección de métricas detenida");
}

/**
 * Verificar si la recolección está activa
 */
export function isMetricsCollectionActive() {
  return metricsInterval !== null;
}

