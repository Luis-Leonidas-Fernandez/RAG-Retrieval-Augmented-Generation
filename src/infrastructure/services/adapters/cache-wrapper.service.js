import {
  getCachedRagResponse,
  setCachedRagResponse,
  getCachedEmbedding,
  setCachedEmbedding,
  invalidateRagCacheForPdf,
} from "../core/cache.service.js";

/**
 * Wrapper del servicio de caché para inyección de dependencias
 */
export class CacheService {
  /**
   * Obtiene respuesta RAG completa del caché
   */
  async getCachedRagResponse(tenantId, pdfId, question) {
    return await getCachedRagResponse(tenantId, pdfId, question);
  }

  /**
   * Guarda respuesta RAG completa en caché
   */
  async setCachedRagResponse(tenantId, pdfId, question, response) {
    return await setCachedRagResponse(tenantId, pdfId, question, response);
  }

  /**
   * Obtiene embedding del caché
   */
  async getCachedEmbedding(tenantId, question) {
    return await getCachedEmbedding(tenantId, question);
  }

  /**
   * Guarda embedding en caché
   */
  async setCachedEmbedding(tenantId, question, embedding) {
    return await setCachedEmbedding(tenantId, question, embedding);
  }

  /**
   * Invalida todas las respuestas RAG de un PDF
   */
  async invalidateRagCacheForPdf(tenantId, pdfId) {
    return await invalidateRagCacheForPdf(tenantId, pdfId);
  }
}

