import { ListChunksByDocUseCase } from "../../../application/use-cases/chunk/ListChunksByDocUseCase.js";
import { ChunkRepositoryMongo } from "../../../infrastructure/db/repositories/ChunkRepositoryMongo.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";

/**
 * Controller HTTP para Chunks
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class ChunkController {
  constructor() {
    // Instanciar dependencias (en el futuro se puede usar inyección de dependencias)
    this.chunkRepository = new ChunkRepositoryMongo();

    // Crear instancia del use case con dependencias inyectadas
    this.listChunksByDocUseCase = new ListChunksByDocUseCase(
      this.chunkRepository
    );
  }

  /**
   * Maneja el endpoint de listar chunks por PDF
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async listChunksByPdf(req, res) {
    try {
      const { tenantId } = req.user;
      const { pdfId } = req.params;

      // Parsear query params
      const page = parseInt(req.query.page || "1", 10);
      const limit = parseInt(req.query.limit || "50", 10);
      const maxLimit = parseInt(
        process.env.CHUNK_LIST_MAX_LIMIT || "500",
        10
      );

      // Ejecutar use case
      const result = await this.listChunksByDocUseCase.execute({
        tenantId,
        pdfId,
        options: {
          page,
          limit,
          maxLimit,
        },
      });

      // Responder con éxito (mantener formato del controller actual)
      return res.json(
        createResponse(true, "Chunks obtenidos correctamente", {
          pdfId: result.pdfId,
          chunks: result.chunks,
          pagination: result.pagination,
        })
      );
    } catch (error) {
      console.error("[Chunk Controller] Error al listar chunks:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener los chunks", {
          error: error.message,
        })
      );
    }
  }
}

