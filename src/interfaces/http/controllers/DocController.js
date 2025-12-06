import { UploadDocUseCase } from "../../../application/use-cases/pdf/UploadDocUseCase.js";
import { ListDocsUseCase } from "../../../application/use-cases/pdf/ListDocsUseCase.js";
import { ProcessDocUseCase } from "../../../application/use-cases/pdf/ProcessDocUseCase.js";
import { EmbedDocChunksUseCase } from "../../../application/use-cases/pdf/EmbedDocChunksUseCase.js";
import { GetDocIndexUseCase } from "../../../application/use-cases/pdf/GetDocIndexUseCase.js";
import { DocRepositoryMongo } from "../../../infrastructure/db/repositories/DocRepositoryMongo.js";
import { ChunkRepositoryMongo } from "../../../infrastructure/db/repositories/ChunkRepositoryMongo.js";
import { QdrantVectorRepository } from "../../../infrastructure/vector-store/QdrantVectorRepository.js";
import { DocProcessService } from "../../../infrastructure/services/adapters/doc-process-wrapper.service.js";
import { CacheService } from "../../../infrastructure/services/adapters/cache-wrapper.service.js";
import { embedBatch } from "../../../infrastructure/services/core/embedding.service.js";
import { deletePdfFile } from "../../../infrastructure/services/core/file-storage.service.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";

/**
 * Controller HTTP para Documentos
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class DocController {
  constructor() {
    // Instanciar dependencias (en el futuro se puede usar inyección de dependencias)
    this.pdfRepository = new DocRepositoryMongo();
    this.chunkRepository = new ChunkRepositoryMongo();
    this.vectorRepository = new QdrantVectorRepository();

    // Instanciar servicios
    this.pdfProcessService = new DocProcessService();
    this.cacheService = new CacheService();
    this.embeddingService = { embedBatch };

    // Configuración desde variables de entorno
    const pdfBatchSize = parseInt(process.env.PDF_BATCH_SIZE || "100", 10);
    const qdrantBatchSize = parseInt(process.env.QDRANT_BATCH_SIZE || "50", 10);

    // Crear instancias de los use cases con dependencias inyectadas
    this.uploadPdfUseCase = new UploadDocUseCase(this.pdfRepository);
    this.listPdfsUseCase = new ListDocsUseCase(this.pdfRepository);
    this.processPdfUseCase = new ProcessDocUseCase(
      this.pdfRepository,
      this.chunkRepository,
      this.pdfProcessService,
      this.cacheService,
      pdfBatchSize
    );
    this.embedPdfChunksUseCase = new EmbedDocChunksUseCase(
      this.pdfRepository,
      this.chunkRepository,
      this.vectorRepository,
      this.embeddingService,
      qdrantBatchSize
    );
    this.getPdfIndexUseCase = new GetDocIndexUseCase(this.chunkRepository);
  }

  /**
   * Maneja el endpoint de subir documento
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async uploadPdf(req, res) {
    const file = req.file;
    const { tenantId, id: userId } = req.user;

    try {
      if (!file) {
        return res.status(400).json(
          createResponse(false, "No se recibió archivo")
        );
      }

      // Ejecutar use case
      const result = await this.uploadPdfUseCase.execute({
        tenantId,
        userId,
        file,
      });

      // Responder con éxito
      return res.status(201).json(
        createResponse(true, "Documento subido correctamente", {
          pdf: result.pdf,
        })
      );
    } catch (error) {
      console.error("[PDF Controller] Error al subir documento:", error);

      // Limpiar archivo si falló el guardado en DB
      if (file && file.path) {
        try {
          await deletePdfFile(file.path);
        } catch (cleanupError) {
          console.error(
            "[PDF Controller] Error al limpiar archivo después de error:",
            cleanupError
          );
        }
      }

      return res.status(400).json(
        createResponse(false, error.message || "Error al subir el documento")
      );
    }
  }

  /**
   * Maneja el endpoint de listar PDFs
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async listPdfs(req, res) {
    try {
      const { tenantId, id: userId } = req.user;

      // Parsear query params con validación
      const limit = parseInt(req.query.limit ?? "50", 10);
      const skip = parseInt(req.query.skip ?? "0", 10);
      const allUsers = req.query.allUsers === "true";

      // Validar y forzar límites seguros
      const safeLimit = Number.isNaN(limit) ? 50 : Math.min(limit, 100);
      const safeSkip = Number.isNaN(skip) ? 0 : skip;

      // Ejecutar use case
      const result = await this.listPdfsUseCase.execute({
        tenantId,
        userId,
        filters: {
          allUsers,
          limit: safeLimit,
          skip: safeSkip,
        },
      });

      // Responder con éxito
      return res.json(
        createResponse(true, "Documentos obtenidos correctamente", {
          pdfs: result.pdfs,
          count: result.count,
        })
      );
    } catch (error) {
      console.error("[PDF Controller] Error al listar documentos:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener la lista de documentos", {
          error: error.message,
        })
      );
    }
  }

  /**
   * Maneja el endpoint de procesar documento
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async processPdf(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { id: pdfId } = req.params;

      console.log(`[PDF Controller] Iniciando procesamiento de documento - pdfId: ${pdfId}, tenantId: ${tenantId}, userId: ${userId}`);

      // Ejecutar use case
      console.log(`[PDF Controller] Ejecutando ProcessPdfUseCase para documento ${pdfId}...`);
      const result = await this.processPdfUseCase.execute({
        tenantId,
        userId,
        pdfId,
      });

      console.log(`[PDF Controller] Documento procesado exitosamente - pdfId: ${pdfId}, chunks: ${result.chunks}`);

      // Responder con éxito (mantener formato del controller antiguo)
      return res.json({
        ok: true,
        message: "Documento procesado correctamente",
        pdf: result.pdf,
        chunks: result.chunks,
        embedded: result.embedded,
      });
    } catch (error) {
      console.error("[PDF Controller] Error al procesar documento:", error);
      console.error("[PDF Controller] Stack trace:", error.stack);
      return res.status(500).json({
        ok: false,
        message: error.message || "Error al procesar el documento",
      });
    }
  }

  /**
   * Maneja el endpoint de embeder chunks de PDF
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async embedPdfChunks(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { id: pdfId } = req.params;

      // Ejecutar use case
      const result = await this.embedPdfChunksUseCase.execute({
        tenantId,
        userId,
        pdfId,
      });

      // Responder con éxito (mantener formato del controller antiguo)
      return res.json({
        ok: true,
        message: "Chunks indexados en Qdrant correctamente",
        pdfId: result.pdfId,
        inserted: result.inserted,
      });
    } catch (error) {
      console.error("[PDF Controller] Error al indexar chunks en Qdrant:", error);
      return res.status(500).json({
        ok: false,
        message: error.message || "Error interno al indexar los chunks en Qdrant",
      });
    }
  }

  /**
   * Maneja el endpoint de obtener índice (TOC) de un documento
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async getPdfIndex(req, res) {
    try {
      const { tenantId } = req.user;
      const { id: pdfId } = req.params;

      // Ejecutar use case
      const index = await this.getPdfIndexUseCase.execute({
        tenantId,
        pdfId,
      });

      // Responder con éxito (puede ser array vacío, no es error)
      return res.json({
        ok: true,
        index: index || [],
      });
    } catch (error) {
      console.error("[PDF Controller] Error al obtener índice del documento:", error);
      return res.status(500).json({
        ok: false,
        message: error.message || "Error al obtener el índice del documento",
      });
    }
  }
}

