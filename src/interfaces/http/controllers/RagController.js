import { SearchRagQueryUseCase } from "../../../application/use-cases/rag/SearchRagQueryUseCase.js";
import { GetDocIndexUseCase } from "../../../application/use-cases/pdf/GetDocIndexUseCase.js";
import { ExtractStructuredDataUseCase } from "../../../application/use-cases/rag/ExtractStructuredDataUseCase.js";
import { RagQueryRequest } from "../../../application/dtos/RagQueryRequest.js";
import { DocRepositoryMongo } from "../../../infrastructure/db/repositories/DocRepositoryMongo.js";
import { ChunkRepositoryMongo } from "../../../infrastructure/db/repositories/ChunkRepositoryMongo.js";
import { ConversationRepositoryMongo } from "../../../infrastructure/db/repositories/ConversationRepositoryMongo.js";
import { MessageRepositoryMongo } from "../../../infrastructure/db/repositories/MessageRepositoryMongo.js";
import { QdrantVectorRepository } from "../../../infrastructure/vector-store/QdrantVectorRepository.js";
import { embedText } from "../../../infrastructure/services/core/embedding.service.js";
import { LLMService } from "../../../infrastructure/services/core/llm.service.js";
import { CacheService } from "../../../infrastructure/services/adapters/cache-wrapper.service.js";
import { ConversationSummaryService } from "../../../infrastructure/services/adapters/conversation-summary-wrapper.service.js";
import { ExportStorageService } from "../../../infrastructure/services/adapters/export-storage.service.js";
import { ExcelGeneratorService } from "../../../infrastructure/services/core/excel-generator.service.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";
import { normalizeTocContent } from "../../../application/utils/toc-normalizer.js";

/**
 * Controller HTTP para RAG
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class RagController {
  constructor() {
    // Instanciar repositorios
    this.pdfRepository = new DocRepositoryMongo();
    this.chunkRepository = new ChunkRepositoryMongo();
    this.conversationRepository = new ConversationRepositoryMongo();
    this.messageRepository = new MessageRepositoryMongo();
    this.vectorRepository = new QdrantVectorRepository();

    // Instanciar servicios
    this.embeddingService = { embedText };
    this.llmService = new LLMService();
    this.cacheService = new CacheService();
    this.conversationSummaryService = new ConversationSummaryService();
    this.extractStructuredDataUseCase = new ExtractStructuredDataUseCase(this.chunkRepository);
    this.exportStorageService = new ExportStorageService();
    this.excelGeneratorService = new ExcelGeneratorService();

    // Configuración RAG desde variables de entorno
    const ragConfig = {
      minMessagesForHistory: parseInt(process.env.RAG_MIN_MESSAGES_FOR_HISTORY || "3", 10),
      recentMessages: parseInt(process.env.RAG_RECENT_MESSAGES || "3", 10),
      maxTotalTokens: parseInt(process.env.RAG_MAX_TOTAL_TOKENS || "3500", 10),
      documentPriority: parseFloat(process.env.RAG_DOCUMENT_PRIORITY || "0.7", 10),
      conversationSummaryRefreshThreshold: parseInt(
        process.env.CONVERSATION_SUMMARY_REFRESH_THRESHOLD || "30",
        10
      ),
      searchLimit: parseInt(process.env.RAG_SEARCH_LIMIT || "20", 10),
      scoreThreshold: parseFloat(process.env.RAG_SCORE_THRESHOLD || "0.3", 10),
      maxContextLength: parseInt(process.env.RAG_MAX_CONTEXT_LENGTH || "4000", 10),
      fallbackChunksCount: parseInt(process.env.RAG_FALLBACK_CHUNKS || "20", 10),
    };

    // Crear instancia del use case con dependencias inyectadas
    this.searchRagQueryUseCase = new SearchRagQueryUseCase(
      this.pdfRepository,
      this.chunkRepository,
      this.conversationRepository,
      this.messageRepository,
      this.vectorRepository,
      this.embeddingService,
      this.llmService,
      this.cacheService,
      this.conversationSummaryService,
      ragConfig,
      this.extractStructuredDataUseCase,
      this.exportStorageService
    );
    this.getPdfIndexUseCase = new GetDocIndexUseCase(this.chunkRepository);
  }

  /**
   * Extrae la sección del índice desde el marcador "Table of Contents" o "índice"
   * @param {string} raw - Texto crudo del índice
   * @returns {string} Texto desde el marcador en adelante, o el texto completo si no encuentra el marcador
   */
  extractTocSection(raw) {
    // Buscar marcadores en español e inglés, incluyendo "CHAPTERS"
    const markerRegex = /(table of contents|chapters|índice|indice|capítulos|capitulos)/i;
    const idx = raw.search(markerRegex);
    if (idx === -1) return raw; // si no lo encuentra, devolvé tal cual
    return raw.slice(idx); // recorta todo lo que está antes del marcador
  }

  /**
   * Formatea y limpia el contenido del índice
   * @param {string} raw - Texto crudo del índice
   * @returns {string} Texto formateado y limpio
   */
  formatIndexContent(raw) {
    // 1) primero nos quedamos desde el índice
    let text = this.extractTocSection(raw);

    // Agregar saltos de línea después de números seguidos de títulos
    text = text.replace(
      /(\d{1,3})\s+(?=[A-Z][a-z]+)/g,
      '$1\n'
    );

    // 2) eliminar "-- 6 of 535 --"
    text = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '');

    // 3) sacar líneas típicas de copyright / trademark
    text = text
      .split('\n')
      .filter(line => !/O'Reilly Media|copyright|trademark/i.test(line))
      .join('\n');

    // 4) Detectar entradas del índice y agregar saltos de línea
    // Patrón: número seguido de punto y espacio (capítulos principales)
    text = text.replace(/(\d+\.\s+[A-Z])/g, '\n$1');
    
    // 5) Detectar números romanos seguidos de punto (subsecciones)
    text = text.replace(/([ivxlcdm]+\.\s+[A-Z])/gi, '\n$1');

    // 6) Limpiar espacios múltiples
    text = text.replace(/[ \t]{2,}/g, ' ');

    // 7) Limpiar saltos de línea redundantes
    text = text.replace(/\n{3,}/g, '\n\n');

    // 8) Limpiar espacios al inicio y final de líneas
    text = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return text.trim();
  }

  /**
   * Maneja el endpoint de consulta RAG
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async query(req, res) {
    const startTime = Date.now();
    try {
      const { tenantId, id: userId, tenantSettings } = req.user;
      const { pdfId, question, conversationId } = req.body;

      // Validación básica (las validaciones detalladas están en el middleware)
      if (!pdfId || !question) {
        return res.status(400).json(
          createResponse(false, "pdfId y question son requeridos")
        );
      }

      // Detectar si es solicitud de índice
      const lowerQuestion = question.toLowerCase();
      const isIndexRequest = /índice|indice|tabla de contenidos|temas del libro|temas|capítulos|contenido del libro|temario|table of contents|index|contents|chapters|chapter|topics|summary|outline/i.test(lowerQuestion);

      // Si es solicitud de índice, usar GetDocIndexUseCase
      if (isIndexRequest) {
        console.log(`[RAG Controller] Solicitud de índice detectada, usando GetDocIndexUseCase`);
        
        const indexChunks = await this.getPdfIndexUseCase.execute({ tenantId, pdfId });
        
        // Formatear respuesta
        let indexText;
        if (!indexChunks.length) {
          indexText = "No se encontró índice en este documento.";
        } else {
          // Unir contenido de todos los chunks
          indexText = indexChunks.map(c => c.content).join('\n\n');
          
          // DEBUG: Logs para diagnosticar
          console.log('[DEBUG TOC] Index chunks count:', indexChunks.length);
          console.log('[DEBUG TOC] Index text length:', indexText.length);
          console.log('[DEBUG TOC] Index text preview (first 1000 chars):', indexText.substring(0, 1000));
          console.log('[DEBUG TOC] Index text has pipes:', indexText.includes('|'));
          console.log('[DEBUG TOC] Index text has separators:', /[-=_]{3,}/.test(indexText));
          
          // Aplicar normalización completa primero (para índices guardados previamente)
          const normalizedText = normalizeTocContent(indexText);
          
          console.log('[DEBUG TOC] Normalized text length:', normalizedText ? normalizedText.length : 0);
          console.log('[DEBUG TOC] Normalized text preview (first 1000 chars):', normalizedText ? normalizedText.substring(0, 1000) : 'null');
          
          if (normalizedText) {
            // Si la normalización devolvió algo, usarlo directamente
            // No aplicar formatIndexContent porque ya está normalizado
            indexText = normalizedText;
          } else {
            // Solo si la normalización falló, aplicar formatIndexContent como fallback
            console.log('[DEBUG TOC] Normalization returned null, using formatIndexContent');
            indexText = this.formatIndexContent(indexText);
            console.log('[DEBUG TOC] After formatIndexContent length:', indexText.length);
            console.log('[DEBUG TOC] After formatIndexContent preview (first 1000 chars):', indexText.substring(0, 1000));
          }
          
          // Agregar título "Capítulos" al inicio
          indexText = "Capítulos\n\n" + indexText;
          
          console.log('[DEBUG TOC] Final index text length:', indexText.length);
        }

        // Calcular tiempo de respuesta
        const responseTime = Date.now() - startTime;

        // Logs detallados de respuesta
        console.log(`[RAG Response] 📤 Respuesta enviada al usuario:`);
        console.log(`[RAG Response]   - Tipo: Índice`);
        console.log(`[RAG Response]   - Pregunta: "${question}"`);
        console.log(`[RAG Response]   - pdfId: ${pdfId}`);
        console.log(`[RAG Response]   - tenantId: ${tenantId}`);
        console.log(`[RAG Response]   - Respuesta length: ${indexText.length} caracteres`);
        console.log(`[RAG Response]   - Respuesta preview: "${indexText.substring(0, 200)}${indexText.length > 200 ? '...' : ''}"`);
        console.log(`[RAG Response]   - Chunks de índice: ${indexChunks.length}`);
        console.log(`[RAG Response]   - Tiempo de respuesta: ${responseTime}ms`);

        // Retornar respuesta con formato consistente
        return res.json(
          createResponse(true, "Índice obtenido correctamente", {
            answer: indexText,
            context: indexChunks,
            conversationId: null, // No se guarda en conversación
            tokens: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
          })
        );
      }

      // Si NO es solicitud de índice, continuar con flujo RAG normal
      // Crear DTO de request
      const ragQueryRequest = new RagQueryRequest({
        tenantId,
        userId,
        pdfId,
        question,
        conversationId,
        tenantSettings,
      });

      // Ejecutar use case
      const ragQueryResponse = await this.searchRagQueryUseCase.execute(ragQueryRequest);

      // Calcular tiempo de respuesta
      const responseTime = Date.now() - startTime;

      // Obtener cantidad de chunks usados del contexto
      const chunksUsed = ragQueryResponse.context?.length || 0;

      // Logs detallados de respuesta
      console.log(`[RAG Response] 📤 Respuesta enviada al usuario:`);
      console.log(`[RAG Response]   - Tipo: RAG normal`);
      console.log(`[RAG Response]   - Pregunta: "${question}"`);
      console.log(`[RAG Response]   - pdfId: ${pdfId}`);
      console.log(`[RAG Response]   - tenantId: ${tenantId}`);
      console.log(`[RAG Response]   - Respuesta length: ${ragQueryResponse.answer?.length || 0} caracteres`);
      console.log(`[RAG Response]   - Respuesta preview: "${(ragQueryResponse.answer || '').substring(0, 200)}${(ragQueryResponse.answer?.length || 0) > 200 ? '...' : ''}"`);
      console.log(`[RAG Response]   - Tokens: prompt: ${ragQueryResponse.tokens?.prompt_tokens || 0}, completion: ${ragQueryResponse.tokens?.completion_tokens || 0}, total: ${ragQueryResponse.tokens?.total_tokens || 0}`);
      console.log(`[RAG Response]   - Chunks usados: ${chunksUsed}`);
      console.log(`[RAG Response]   - ConversationId: ${ragQueryResponse.conversationId || 'null'}`);
      console.log(`[RAG Response]   - Tiempo de respuesta: ${responseTime}ms`);

      // Mapear respuesta (excluyendo structuredDataFull que es solo para uso interno)
      const responseData = {
        answer: ragQueryResponse.answer,
        context: ragQueryResponse.context,
        conversationId: ragQueryResponse.conversationId,
        tokens: ragQueryResponse.tokens,
      };

      // Incluir campos de datos estructurados si existen (pero NO structuredDataFull)
      if (ragQueryResponse.structuredData !== null && ragQueryResponse.structuredData !== undefined) {
        responseData.structuredData = ragQueryResponse.structuredData;
        responseData.totalRows = ragQueryResponse.totalRows || 0;
        responseData.dataType = ragQueryResponse.dataType || 'text';
        responseData.exportId = ragQueryResponse.exportId || null;
      }

      return res.json(
        createResponse(true, "Consulta RAG procesada correctamente", responseData)
      );
    } catch (error) {
      console.error("[RAG Controller] Error:", error);
      return res.status(500).json(
        createResponse(false, "Error en consulta RAG", { error: error.message })
      );
    }
  }

  /**
   * Maneja el endpoint de exportación a Excel
   * @param {Object} req - Request object de Express
   * @param {Object} res - Response object de Express
   */
  async exportToExcel(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { exportId } = req.params;

      if (!exportId) {
        return res.status(400).json(
          createResponse(false, "exportId es requerido")
        );
      }

      // Obtener datos del almacenamiento temporal
      const exportData = await this.exportStorageService.get(exportId);

      if (!exportData) {
        return res.status(404).json(
          createResponse(false, "Export no encontrado o expirado")
        );
      }

      // Validar que el export pertenece al usuario
      if (!await this.exportStorageService.belongsToUser(exportId, userId)) {
        return res.status(403).json(
          createResponse(false, "No tienes permisos para descargar este export")
        );
      }

      // Generar XLSX on-demand
      const xlsxBuffer = await this.excelGeneratorService.generate(exportData.data);

      // Configurar headers para descarga
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `export-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', xlsxBuffer.length);

      // Enviar archivo
      res.send(xlsxBuffer);

      console.log(`[RAG Export] Archivo Excel generado y enviado: ${filename} (${xlsxBuffer.length} bytes)`);
    } catch (error) {
      console.error("[RAG Export] Error:", error);
      return res.status(500).json(
        createResponse(false, "Error al generar Excel", { error: error.message })
      );
    }
  }
}

