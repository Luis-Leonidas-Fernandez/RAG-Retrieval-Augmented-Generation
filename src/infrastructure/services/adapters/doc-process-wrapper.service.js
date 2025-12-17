import fs from "fs/promises";
import path from "path";
import * as pdfParseModule from "pdf-parse";
import { isExcelFile, loadExcelChunks } from "../../../ingestion/excel_loader.js";

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
        const sourceFile = originalName || path.basename(filePath);
        const excelChunks = await loadExcelChunks(filePath, sourceFile);

        const normalized = excelChunks.map((c) => ({
          text: c.text,
          page: 1,
          sectionType: "row",
          sectionTitle: null,
          path: [c.metadata.sheetName ?? "Hoja"],
        }));

        return {
          success: true,
          chunks: normalized,
        };
      }

      // 2) PDF → usar pdf-parse
      const buffer = await fs.readFile(filePath);
      const parsed = await pdfParse(buffer);
      const rawText = (parsed.text || "").trim();

      if (!rawText) {
        return {
          success: false,
          error: "No se pudo extraer texto del documento",
        };
      }

      // Limpieza básica de texto: normalizar espacios y saltos de línea
      const text = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

      const chunkSize = 1200;
      const overlap = 200;
      const chunkTexts = createChunks(text, chunkSize, overlap);

      const normalized = chunkTexts.map((chunkText) => ({
        text: chunkText,
        page: 1, // No tenemos páginas exactas; asignamos 1 para mantener compatibilidad con el modelo actual
        sectionType: "paragraph",
      }));

      return {
        success: true,
        chunks: normalized,
      };
    } catch (error) {
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
  if (!text || typeof text !== "string") return [];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push(slice);
    }
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}


