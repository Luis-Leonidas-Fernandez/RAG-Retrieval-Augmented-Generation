import fs from "fs/promises";
import path from "path";
import * as pdfParseModule from "pdf-parse";
import { isExcelFile, loadExcelChunks } from "../../../ingestion/excel_loader.js";
import { InvalidExcelColumnsException } from "../../../domain/exceptions/InvalidExcelColumnsException.js";

// Compatibilidad con distintas formas de export de pdf-parse (CJS/ESM)
const pdfParse =
  typeof pdfParseModule === "function"
    ? pdfParseModule
    : pdfParseModule.default || pdfParseModule.pdfParse;

/**
 * Servicio de procesamiento de documentos 100 % Node:
 * - Excel: se procesa con excel_loader.js
 * - PDF: se procesa con pdf-parse y se chnquea en texto
 *
 * Mantiene el contrato esperado por ProcessDocUseCase:
 *  { success: boolean, chunks?: Array<{ text, page?, sectionType? }>, error?: string }
 */
export class DocProcessService {
  /**
   * Procesa un documento (PDF o Excel) y devuelve chunks normalizados.
   * @param {string} filePath - Ruta del archivo en disco
   * @param {Object} meta - Metadatos opcionales del documento
   * @param {string} [meta.mimetype] - Mimetype del archivo
   * @param {string} [meta.originalName] - Nombre original del archivo
   * @returns {Promise<{ success: boolean, chunks?: any[], error?: string }>}
   */
  async processPdf(filePath, meta = {}) {
    const { mimetype, originalName } = meta;

    try {
      // 1) Excel → usar excel_loader.js
      if (isExcelFile(mimetype, originalName)) {
        console.log(`[DocProcessService] 📊 Detectado archivo Excel - mimetype: ${mimetype}, nombre: ${originalName}`);
        const sourceFile = originalName || path.basename(filePath);
        
        const excelChunks = await loadExcelChunks(filePath, sourceFile);
        console.log(`[DocProcessService] ✅ Excel procesado - ${excelChunks.length} chunks obtenidos del loader`);

        console.log(`[DocProcessService] 🔄 Normalizando chunks de Excel...`);
        const normalized = excelChunks.map((c, index) => {
          const normalizedChunk = {
            text: c.text,
            page: 1,
            sectionType: "table",
            sectionTitle: null,
            path: [c.metadata.sheetName ?? "Hoja"],
          };
          
          // Log de los primeros 3 chunks normalizados
          if (index < 3) {
            console.log(`[DocProcessService]   📝 Chunk normalizado ${index + 1}:`);
            console.log(`[DocProcessService]     - sectionType: ${normalizedChunk.sectionType}`);
            console.log(`[DocProcessService]     - path: ${JSON.stringify(normalizedChunk.path)}`);
            console.log(`[DocProcessService]     - text length: ${normalizedChunk.text?.length || 0} caracteres`);
            console.log(`[DocProcessService]     - text preview: ${(normalizedChunk.text || '').substring(0, 80)}...`);
          }
          
          return normalizedChunk;
        });

        console.log(`[DocProcessService] ✅ Normalización completada - ${normalized.length} chunks listos para guardar`);
        
        // Validar que todos los chunks tienen sectionType válido
        const invalidSectionTypes = normalized.filter(c => !c.sectionType || !['toc', 'chapter_title', 'paragraph', 'table', 'other'].includes(c.sectionType));
        if (invalidSectionTypes.length > 0) {
          console.error(`[DocProcessService] ❌ ERROR: ${invalidSectionTypes.length} chunks con sectionType inválido`);
          console.error(`[DocProcessService] SectionTypes inválidos:`, invalidSectionTypes.map(c => c.sectionType));
        }

        return {
          success: true,
          chunks: normalized,
        };
      }

      // 2) PDF → usar pdf-parse
      console.log(`[DocProcessService] 📄 Detectado archivo PDF - mimetype: ${mimetype}, nombre: ${originalName}`);
      const buffer = await fs.readFile(filePath);
      console.log(`[DocProcessService] 📖 Leyendo PDF (${buffer.length} bytes)...`);
      
      const parseStartTime = Date.now();
      const parsed = await pdfParse(buffer);
      const parseTime = Date.now() - parseStartTime;
      console.log(`[DocProcessService] ✅ PDF parseado en ${parseTime}ms - ${parsed.numpages} páginas`);
      
      const rawText = (parsed.text || "").trim();
      console.log(`[DocProcessService] 📝 Texto extraído: ${rawText.length} caracteres`);

      if (!rawText) {
        console.error(`[DocProcessService] ❌ ERROR: No se pudo extraer texto del documento`);
        return {
          success: false,
          error: "No se pudo extraer texto del documento",
        };
      }

      // Limpieza básica de texto: normalizar espacios y saltos de línea
      console.log(`[DocProcessService] 🧹 Limpiando y normalizando texto...`);
      const text = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
      console.log(`[DocProcessService] ✅ Texto limpiado: ${text.length} caracteres`);

      const chunkSize = 1200;
      const overlap = 200;
      console.log(`[DocProcessService] ✂️  Creando chunks - tamaño: ${chunkSize}, overlap: ${overlap}`);
      const chunkStartTime = Date.now();
      const chunkTexts = createChunks(text, chunkSize, overlap);
      const chunkTime = Date.now() - chunkStartTime;
      console.log(`[DocProcessService] ✅ ${chunkTexts.length} chunks creados en ${chunkTime}ms`);

      console.log(`[DocProcessService] 🔄 Normalizando chunks de PDF...`);
      const normalized = chunkTexts.map((chunkText, index) => {
        const normalizedChunk = {
          text: chunkText,
          page: 1, // No tenemos páginas exactas; asignamos 1 para mantener compatibilidad con el modelo actual
          sectionType: "paragraph",
        };
        
        // Log de los primeros 3 chunks normalizados
        if (index < 3) {
          console.log(`[DocProcessService]   📝 Chunk normalizado ${index + 1}:`);
          console.log(`[DocProcessService]     - sectionType: ${normalizedChunk.sectionType}`);
          console.log(`[DocProcessService]     - text length: ${normalizedChunk.text?.length || 0} caracteres`);
          console.log(`[DocProcessService]     - text preview: ${(normalizedChunk.text || '').substring(0, 80)}...`);
        }
        
        return normalizedChunk;
      });

      console.log(`[DocProcessService] ✅ Normalización completada - ${normalized.length} chunks listos para guardar`);

      return {
        success: true,
        chunks: normalized,
      };
    } catch (error) {
      // Manejar específicamente excepciones de validación de columnas
      if (error instanceof InvalidExcelColumnsException) {
        console.error(`[DocProcessService] ❌ Error de validación de columnas: ${error.message}`);
        return {
          success: false,
          error: error.message,
        };
      }

      // Otros errores
      console.error("[DocProcessService] Error al procesar documento:", error);
      return {
        success: false,
        error: error.message || "Error al procesar documento",
      };
    }
  }
}

/**
 * Divide el texto en chunks con overlap simple.
 * No respeta tablas avanzadas, pero es suficiente para un RAG básico.
 */
function createChunks(text, chunkSize = 1200, overlap = 200) {
  if (!text || typeof text !== "string") {
    console.warn(`[DocProcessService] ⚠️  createChunks: texto inválido o vacío`);
    return [];
  }

  const chunks = [];
  let start = 0;
  let chunkNumber = 0;

  while (start < text.length) {
    chunkNumber++;
    const end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end).trim();
    
    if (slice.length > 0) {
      chunks.push(slice);
      
      // Log de los primeros 3 chunks creados
      if (chunks.length <= 3) {
        console.log(`[DocProcessService]     Chunk ${chunks.length} creado: posición ${start}-${end}, tamaño: ${slice.length} caracteres`);
      }
    } else {
      console.warn(`[DocProcessService] ⚠️  Chunk ${chunkNumber} vacío omitido (posición ${start}-${end})`);
    }
    
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }

  console.log(`[DocProcessService] 📊 Resumen de chunking: ${chunks.length} chunks válidos de ${chunkNumber} intentos`);
  return chunks;
}


