import mongoose from "mongoose";

const MetricsSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    
    // Memoria del proceso Node.js
    memory: {
      rss: { type: Number }, // Resident Set Size
      heapTotal: { type: Number }, // Total heap allocated
      heapUsed: { type: Number }, // Heap used
      heapLimit: { type: Number }, // Límite máximo del heap configurado
      external: { type: Number }, // External memory
      arrayBuffers: { type: Number }, // Array buffers
    },
    
    // Métricas del sistema
    system: {
      cpuUsage: { type: Number }, // % CPU usado (promedio)
      loadAverage: [Number], // Load average [1min, 5min, 15min]
      freeMemory: { type: Number }, // Memoria libre del sistema
      totalMemory: { type: Number }, // Memoria total del sistema
      platform: { type: String },
      arch: { type: String },
    },
    
    // Información del proceso
    process: {
      uptime: { type: Number }, // Tiempo activo en segundos
      pid: { type: Number },
      nodeVersion: { type: String },
    },
    
    // Estado de conexiones
    connections: {
      mongodb: { type: String, enum: ["connected", "disconnected", "connecting"], default: "disconnected" },
      redis: { type: String, enum: ["connected", "disconnected", "error"], default: "disconnected" },
      qdrant: { type: String, enum: ["available", "unavailable"], default: "unavailable" },
    },
    
    // Métricas del worker pool (Piscina)
    workers: {
      active: { type: Number, default: 0 },
      idle: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    
    // Alertas activas
    alerts: [{
      type: { type: String }, // 'memory_high', 'cpu_high', etc.
      level: { type: String, enum: ["warning", "critical"], default: "warning" },
      message: { type: String },
      value: { type: Number },
      threshold: { type: Number },
    }],
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas eficientes
MetricsSchema.index({ timestamp: -1 });
MetricsSchema.index({ "memory.heapUsed": 1 });
MetricsSchema.index({ timestamp: 1, "memory.heapUsed": 1 });

// TTL index para limpiar métricas antiguas automáticamente (30 días)
MetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

export const MetricsModel = mongoose.model("Metrics", MetricsSchema);

