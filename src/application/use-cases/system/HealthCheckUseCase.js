/**
 * Caso de uso para verificar el estado del servicio (health check)
 * Orquesta la lógica de negocio del proceso de verificación de salud del sistema
 * 
 * NOTA: Este Use Case replica EXACTAMENTE el formato JSON del controller legacy
 */
export class HealthCheckUseCase {
  /**
   * Ejecuta el caso de uso de health check
   * @returns {Promise<Object>} Objeto con ok, status, timestamp y uptime
   */
  async execute() {
    return {
      ok: true,
      status: "UP",
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }
}

