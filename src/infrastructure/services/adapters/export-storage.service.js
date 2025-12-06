import { getRedisClient, isRedisAvailable } from "../../config/redis.js";

/**
 * Servicio para almacenamiento temporal de exports en Redis
 * Guarda datos estructurados con TTL de 24 horas
 */
export class ExportStorageService {
  constructor() {
    this.redisClient = null;
    this.ttlSeconds = 24 * 60 * 60; // 24 horas en segundos
  }

  /**
   * Obtiene el cliente Redis (lazy initialization)
   */
  getRedisClient() {
    if (!this.redisClient) {
      this.redisClient = getRedisClient();
    }
    return this.redisClient;
  }

  /**
   * Guarda datos estructurados en Redis con exportId como clave
   * @param {string} exportId - ID único del export
   * @param {Array<Object>} structuredDataFull - Datos completos para Excel
   * @param {string} userId - ID del usuario que generó el export
   * @param {string} pdfId - ID del PDF
   * @returns {Promise<boolean>} true si se guardó correctamente
   */
  async save(exportId, structuredDataFull, userId, pdfId) {
    const redis = this.getRedisClient();

    if (!isRedisAvailable() || !redis) {
      console.warn("[ExportStorage] Redis no disponible, no se puede guardar el export");
      return false;
    }

    try {
      const key = `export:${exportId}`;
      const metadata = {
        userId,
        pdfId,
        createdAt: new Date().toISOString(),
        data: structuredDataFull,
      };

      const dataToStore = JSON.stringify(metadata);

      // Guardar con TTL de 24 horas
      await redis.setex(key, this.ttlSeconds, dataToStore);

      console.log(`[ExportStorage] Export guardado: ${key} (TTL: ${this.ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error(`[ExportStorage] Error al guardar export:`, error);
      return false;
    }
  }

  /**
   * Obtiene datos estructurados desde Redis
   * @param {string} exportId - ID único del export
   * @returns {Promise<Object|null>} Datos del export con metadata, o null si no existe
   */
  async get(exportId) {
    const redis = this.getRedisClient();

    if (!isRedisAvailable() || !redis) {
      console.warn("[ExportStorage] Redis no disponible, no se puede obtener el export");
      return null;
    }

    try {
      const key = `export:${exportId}`;
      const data = await redis.get(key);

      if (!data) {
        console.log(`[ExportStorage] Export no encontrado: ${key}`);
        return null;
      }

      const parsed = JSON.parse(data);
      console.log(`[ExportStorage] Export obtenido: ${key}`);
      return parsed;
    } catch (error) {
      console.error(`[ExportStorage] Error al obtener export:`, error);
      return null;
    }
  }

  /**
   * Elimina un export de Redis
   * @param {string} exportId - ID único del export
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async delete(exportId) {
    const redis = this.getRedisClient();

    if (!isRedisAvailable() || !redis) {
      return false;
    }

    try {
      const key = `export:${exportId}`;
      await redis.del(key);
      console.log(`[ExportStorage] Export eliminado: ${key}`);
      return true;
    } catch (error) {
      console.error(`[ExportStorage] Error al eliminar export:`, error);
      return false;
    }
  }

  /**
   * Verifica si el export pertenece al usuario
   * @param {string} exportId - ID único del export
   * @param {string} userId - ID del usuario a verificar
   * @returns {Promise<boolean>} true si el export pertenece al usuario
   */
  async belongsToUser(exportId, userId) {
    const exportData = await this.get(exportId);
    
    if (!exportData || !exportData.userId) {
      return false;
    }

    return exportData.userId === userId;
  }
}

