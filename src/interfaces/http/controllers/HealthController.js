import { HealthCheckUseCase } from "../../../application/use-cases/system/HealthCheckUseCase.js";

/**
 * Controller HTTP para Health Check
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 * 
 * NOTA: Este controller replica EXACTAMENTE el formato JSON del controller legacy
 */
export class HealthController {
  constructor() {
    this.healthCheckUseCase = new HealthCheckUseCase();
  }

  /**
   * Maneja el endpoint de health check
   * GET /api/health
   */
  async healthCheck(req, res) {
    try {
      const result = await this.healthCheckUseCase.execute();

      // Retornar EXACTAMENTE el mismo formato que el controller legacy
      return res.json(result);
    } catch (error) {
      // En caso de error, retornar status DOWN
      console.error("[Health Controller] Error:", error);
      return res.status(500).json({
        ok: false,
        status: "DOWN",
        timestamp: new Date(),
        uptime: process.uptime(),
        error: error.message,
      });
    }
  }
}

