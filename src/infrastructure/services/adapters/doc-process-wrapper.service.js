import Piscina from "piscina";
import path from "path";
import { fileURLToPath } from "url";

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear pool de workers para procesamiento de documentos (reutilizar la misma lógica del servicio)
const docPool = new Piscina({
  filename: path.join(__dirname, '../../workers/doc-processor.worker.js'),
  maxThreads: parseInt(process.env.PDF_WORKER_THREADS || '2', 10),
  minThreads: 1,
});

/**
 * Servicio wrapper para el procesamiento de documentos
 * Abstrae el uso del worker pool desde la capa de aplicación
 */
export class DocProcessService {
  /**
   * Procesa un documento usando el worker pool
   * @param {string} pdfPath - Ruta del archivo documento
   * @returns {Promise<Object>} Resultado del procesamiento con success, chunks, error
   */
  async processPdf(pdfPath) {
    try {
      const result = await docPool.run({ pdfPath });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message || "Error al procesar documento en worker",
      };
    }
  }
}

