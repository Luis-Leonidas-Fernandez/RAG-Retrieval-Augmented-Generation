import os from "os";
import process from "process";
import v8 from "v8";
import mongoose from "mongoose";
import { MetricsModel } from "../models/metrics.model.js";
import { isRedisAvailable } from "../config/redis.js";
import { qdrant } from "./qdrant.service.js";

// Pool de workers será pasado como parámetro cuando sea necesario
let pdfPoolGetter = null;

/**
 * Registrar función para obtener el pool de workers
 */
export function setPdfPoolGetter(getter) {
  pdfPoolGetter = getter;
}

// Umbrales configurables para alertas
const MEMORY_WARNING_THRESHOLD = parseInt(process.env.METRICS_MEMORY_WARNING || '80', 10); // 80% del heap total
const MEMORY_CRITICAL_THRESHOLD = parseInt(process.env.METRICS_MEMORY_CRITICAL || '95', 10); // 95% del heap total
const CPU_WARNING_THRESHOLD = parseInt(process.env.METRICS_CPU_WARNING || '80', 10); // 80% CPU
const CPU_CRITICAL_THRESHOLD = parseInt(process.env.METRICS_CPU_CRITICAL || '95', 10); // 95% CPU

// Variables para calcular uso de CPU (inicializadas con valores absolutos)
let lastCpuUsage = process.cpuUsage(); // Valores absolutos en microsegundos
let lastUptime = process.uptime(); // Tiempo absoluto en segundos

// Cache para estado de Qdrant (evitar verificar en cada recolección)
let qdrantStatusCache = {
  status: "unavailable",
  lastChecked: 0,
  checkInterval: parseInt(process.env.METRICS_QDRANT_CHECK_INTERVAL || '60000', 10), // 60 segundos por defecto
};

// Timeout para verificación de Qdrant (evitar promesas colgadas)
const QDRANT_CHECK_TIMEOUT = 3000; // 3 segundos máximo

/**
 * Calcular uso de CPU (aproximado)
 * Calcula el porcentaje de CPU usado por el proceso respecto al tiempo real transcurrido
 */
function calculateCpuUsage() {
  const currentUptime = process.uptime();
  const elapsedTimeInSeconds = currentUptime - lastUptime;

  // Si no ha pasado tiempo suficiente (menos de 0.1 segundos), retornar 0
  if (elapsedTimeInSeconds <= 0 || elapsedTimeInSeconds < 0.1) {
    // Actualizar valores de referencia para próxima medición
    lastCpuUsage = process.cpuUsage();
    lastUptime = currentUptime;
    return 0;
  }

  // Obtener diferencia de tiempo de CPU usado desde la última medición
  // process.cpuUsage(lastCpuUsage) devuelve la diferencia en microsegundos
  const cpuUsageDiff = process.cpuUsage(lastCpuUsage);
  
  // Convertir diferencia de tiempos de CPU de microsegundos a segundos
  const userTimeInSeconds = cpuUsageDiff.user / 1000000;
  const systemTimeInSeconds = cpuUsageDiff.system / 1000000;
  const totalCpuTimeInSeconds = userTimeInSeconds + systemTimeInSeconds;

  // Calcular porcentaje: (tiempo de CPU usado / tiempo real transcurrido) * 100
  // Este porcentaje representa el uso de CPU de UN solo core
  // Ejemplo: si usa 0.5 segundos de CPU en 1 segundo real = 50% de un core
  let cpuPercent = (totalCpuTimeInSeconds / elapsedTimeInSeconds) * 100;

  // Limitar a 100% máximo (aunque en sistemas multi-core puede exceder)
  cpuPercent = Math.min(Math.max(cpuPercent, 0), 100);

  // Actualizar valores de referencia para próxima medición
  lastCpuUsage = process.cpuUsage(); // Obtener valores absolutos actuales
  lastUptime = currentUptime;

  return cpuPercent;
}

/**
 * Verificar estado de Qdrant con timeout y caché para evitar acumulación de promesas
 */
async function checkQdrantStatus() {
  const now = Date.now();
  
  // Usar caché si la verificación fue reciente (reduce llamadas a Qdrant)
  if (now - qdrantStatusCache.lastChecked < qdrantStatusCache.checkInterval) {
    return qdrantStatusCache.status;
  }

  // Verificar con timeout para evitar promesas colgadas que acumulan memoria
  let timeoutId = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Timeout"));
      }, QDRANT_CHECK_TIMEOUT);
    });
    
    const qdrantPromise = qdrant.getCollections();
    
    // Usar Promise.race y asegurarse de limpiar timeout después
    await Promise.race([qdrantPromise, timeoutPromise]);
    
    // Si llegamos aquí, Qdrant respondió - limpiar timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    qdrantStatusCache.status = "available";
    qdrantStatusCache.lastChecked = now;
    return "available";
  } catch (error) {
    // Limpiar timeout si existe
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Si falla o timeout, marcar como unavailable y actualizar caché
    qdrantStatusCache.status = "unavailable";
    qdrantStatusCache.lastChecked = now;
    return "unavailable";
  }
}

/**
 * Obtener estado de las conexiones (optimizado para evitar acumulación de memoria)
 */
async function getConnectionStatus() {
  const connections = {
    mongodb: "disconnected",
    redis: "disconnected",
    qdrant: "unavailable",
  };

  // MongoDB (verificación síncrona, no bloquea)
  if (mongoose.connection.readyState === 1) {
    connections.mongodb = "connected";
  } else if (mongoose.connection.readyState === 2) {
    connections.mongodb = "connecting";
  }

  // Redis (verificación síncrona, no bloquea)
  if (isRedisAvailable()) {
    connections.redis = "connected";
  }

  // Qdrant (con caché y timeout para evitar acumulación de promesas)
  connections.qdrant = await checkQdrantStatus();

  return connections;
}

/**
 * Obtener métricas del worker pool
 */
function getWorkerPoolMetrics() {
  try {
    const pool = pdfPoolGetter ? pdfPoolGetter() : null;
    
    if (!pool) {
      return { active: 0, idle: 0, total: 0 };
    }

    // Piscina no expone directamente estas métricas, así que usamos valores por defecto
    // Podríamos mantener un contador propio si es necesario
    return {
      active: 0, // No disponible directamente en Piscina
      idle: 0, // No disponible directamente en Piscina
      total: parseInt(process.env.PDF_WORKER_THREADS || '2', 10),
    };
  } catch (error) {
    return { active: 0, idle: 0, total: 0 };
  }
}

/**
 * Generar alertas basadas en umbrales
 */
function generateAlerts(memory, cpuUsage, heapLimit) {
  const alerts = [];

  // Alerta de memoria - calcular porcentaje respecto al límite máximo del heap (no heapTotal)
  const heapUsagePercent = (memory.heapUsed / heapLimit) * 100;
  
  if (heapUsagePercent >= MEMORY_CRITICAL_THRESHOLD) {
    alerts.push({
      type: "memory_high",
      level: "critical",
      message: `Uso de memoria crítico: ${heapUsagePercent.toFixed(2)}%`,
      value: heapUsagePercent,
      threshold: MEMORY_CRITICAL_THRESHOLD,
    });
  } else if (heapUsagePercent >= MEMORY_WARNING_THRESHOLD) {
    alerts.push({
      type: "memory_high",
      level: "warning",
      message: `Uso de memoria alto: ${heapUsagePercent.toFixed(2)}%`,
      value: heapUsagePercent,
      threshold: MEMORY_WARNING_THRESHOLD,
    });
  }

  // Alerta de CPU
  if (cpuUsage >= CPU_CRITICAL_THRESHOLD) {
    alerts.push({
      type: "cpu_high",
      level: "critical",
      message: `Uso de CPU crítico: ${cpuUsage.toFixed(2)}%`,
      value: cpuUsage,
      threshold: CPU_CRITICAL_THRESHOLD,
    });
  } else if (cpuUsage >= CPU_WARNING_THRESHOLD) {
    alerts.push({
      type: "cpu_high",
      level: "warning",
      message: `Uso de CPU alto: ${cpuUsage.toFixed(2)}%`,
      value: cpuUsage,
      threshold: CPU_WARNING_THRESHOLD,
    });
  }

  return alerts;
}

/**
 * Recolectar métricas actuales del sistema (optimizado para memoria)
 */
export async function collectMetrics() {
  const memory = process.memoryUsage();
  const cpuUsage = calculateCpuUsage();
  
  // Obtener el límite máximo del heap desde V8 (en bytes)
  const heapStats = v8.getHeapStatistics();
  const heapLimit = heapStats.heap_size_limit;
  
  // Obtener estado de conexiones (con caché para Qdrant)
  const connections = await getConnectionStatus();
  
  // Obtener métricas del worker pool (síncrono, no bloquea)
  const workers = getWorkerPoolMetrics();
  
  // Generar alertas (pasar heapLimit para calcular porcentaje respecto al límite máximo)
  const alerts = generateAlerts(memory, cpuUsage, heapLimit);

  // Crear objeto de métricas (solo datos necesarios)
  const metrics = {
    timestamp: new Date().toISOString(), // Convertir a ISO string para serialización JSON
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      heapLimit: heapLimit, // Límite máximo del heap configurado
      external: memory.external,
      arrayBuffers: memory.arrayBuffers || 0,
    },
    system: {
      cpuUsage,
      loadAverage: [...os.loadavg()], // Copiar array para evitar referencia
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      platform: os.platform(),
      arch: os.arch(),
    },
    process: {
      uptime: process.uptime(),
      pid: process.pid,
      nodeVersion: process.version,
    },
    connections,
    workers,
    alerts,
  };

  return metrics;
}

/**
 * Guardar métricas en MongoDB (optimizado para evitar acumulación de memoria)
 */
export async function saveMetrics() {
  let metrics = null;
  
  try {
    metrics = await collectMetrics();
    
    if (!metrics) {
      return null;
    }
    
    // Guardar en MongoDB
    await MetricsModel.create(metrics);
    
    // Log alertas si existen (copiar array para no mantener referencia)
    const alertsToLog = metrics.alerts ? [...metrics.alerts] : [];
    if (alertsToLog.length > 0) {
      alertsToLog.forEach(alert => {
        console.warn(`[Metrics Alert - ${alert.level.toUpperCase()}] ${alert.message}`);
      });
      // Limpiar array después de loggear
      alertsToLog.length = 0;
    }
    
    // Retornar métricas sin las alertas para liberar memoria
    const result = { ...metrics };
    
    // Limpiar referencias explícitamente
    metrics.alerts = null;
    metrics.connections = null;
    metrics.workers = null;
    metrics = null;
    
    // Forzar garbage collection si está disponible y la memoria está alta
    if (global.gc) {
      const memory = process.memoryUsage();
      const heapStats = v8.getHeapStatistics();
      const heapLimit = heapStats.heap_size_limit;
      const heapUsagePercent = (memory.heapUsed / heapLimit) * 100;
      if (heapUsagePercent > 85) {
        global.gc();
      }
    }
    
    return result;
  } catch (error) {
    console.error("[Metrics] Error al guardar métricas:", error.message);
    // Liberar métricas en caso de error
    if (metrics) {
      metrics.alerts = null;
      metrics.connections = null;
      metrics.workers = null;
      metrics = null;
    }
    // No relanzar error para evitar que detenga la recolección periódica
    return null;
  }
}

/**
 * Obtener métricas históricas
 */
export async function getHistoricalMetrics(options = {}) {
  const {
    limit = 100,
    startDate,
    endDate,
    sort = -1, // -1 para más recientes primero
  } = options;

  const query = {};

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  const metrics = await MetricsModel.find(query)
    .sort({ timestamp: sort })
    .limit(limit)
    .lean();

  return metrics;
}

/**
 * Obtener métricas agregadas (promedios, máximos, mínimos) - optimizado para memoria
 */
export async function getAggregatedMetrics(startDate, endDate) {
  const query = { timestamp: {} };
  if (startDate) query.timestamp.$gte = new Date(startDate);
  if (endDate) query.timestamp.$lte = new Date(endDate);

  const metrics = await MetricsModel.find(query)
    .select('memory.heapUsed system.cpuUsage timestamp') // Solo campos necesarios
    .lean();

  if (metrics.length === 0) {
    return null;
  }

  // Extraer valores y calcular agregaciones (liberar referencias progresivamente)
  const heapUsedValues = [];
  const cpuValues = [];
  
  for (const m of metrics) {
    if (m.memory && typeof m.memory.heapUsed === 'number') {
      heapUsedValues.push(m.memory.heapUsed);
    }
    if (m.system && typeof m.system.cpuUsage === 'number' && !isNaN(m.system.cpuUsage)) {
      cpuValues.push(m.system.cpuUsage);
    }
  }

  // Calcular agregaciones
  const result = {
    count: metrics.length,
    period: {
      start: metrics[metrics.length - 1].timestamp,
      end: metrics[0].timestamp,
    },
    memory: heapUsedValues.length > 0 ? {
      heapUsed: {
        avg: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length,
        min: Math.min(...heapUsedValues),
        max: Math.max(...heapUsedValues),
      },
    } : null,
    cpu: cpuValues.length > 0 ? {
      avg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      min: Math.min(...cpuValues),
      max: Math.max(...cpuValues),
    } : null,
  };

  // Limpiar arrays grandes después de usar
  heapUsedValues.length = 0;
  cpuValues.length = 0;

  return result;
}

/**
 * Exportar métricas a JSON
 */
export async function exportMetrics(format = 'json', options = {}) {
  const metrics = await getHistoricalMetrics(options);

  if (format === 'json') {
    return JSON.stringify(metrics, null, 2);
  } else if (format === 'csv') {
    // Convertir a CSV simple
    if (metrics.length === 0) return '';

    const headers = ['timestamp', 'heapUsed', 'heapTotal', 'rss', 'cpuUsage'];
    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.memory.heapUsed,
      m.memory.heapTotal,
      m.memory.rss,
      m.system.cpuUsage || 0,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  throw new Error(`Formato no soportado: ${format}`);
}

