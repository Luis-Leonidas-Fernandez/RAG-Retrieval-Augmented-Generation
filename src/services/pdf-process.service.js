import Piscina from "piscina";
import path from "path";
import { fileURLToPath } from "url";

import { PdfModel } from "../models/pdf.model.js";
import { ChunkModel } from "../models/chunk.model.js";
import { indexPdfChunksInQdrant } from "./qdrant.service.js";
import { invalidateRagCacheForPdf } from "./cache.service.js";

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear pool de workers para procesamiento de PDFs
const pdfPool = new Piscina({
  filename: path.join(__dirname, '../workers/pdf-processor.worker.js'),
  maxThreads: parseInt(process.env.PDF_WORKER_THREADS || '2', 10),
  minThreads: 1,
});

// Nota: getPageForChunk() fue eliminada - ahora la página se calcula directamente en el worker

export const processPdfById = async (pdfId) => {
  // Verificar que el PDF exista y obtener solo el campo necesario (path)
  // No usar .lean() porque necesitamos actualizar el status después
  const pdfDoc = await PdfModel.findById(pdfId).select('path status');
  if (!pdfDoc) throw new Error("PDF no encontrado");

  let allChunks = null;
  let result = null;

  try {
    // Procesar PDF en worker thread (CPU-intensivo)
    result = await pdfPool.run({ pdfPath: pdfDoc.path });

    if (!result.success) {
      throw new Error(result.error || "Error al procesar PDF en worker");
    }

    // Extraer datos del resultado del worker
    // chunks ahora viene con { text, page } desde el worker
    allChunks = result.chunks;
    const totalChunksCount = allChunks.length;
    
    // Limpiar resultado del worker para liberar memoria del worker
    result.chunks = null;

    // --- EVITAR DUPLICADOS ---
    await ChunkModel.deleteMany({ pdfId });

    // Guardar chunks en MongoDB con información de página (en lotes para optimizar memoria)
    const BATCH_SIZE = parseInt(process.env.PDF_BATCH_SIZE || '100', 10);
    let totalInserted = 0;

    // Procesar y eliminar chunks del array original para liberar memoria progresivamente
    while (allChunks.length > 0) {
      // Extraer y remover los primeros BATCH_SIZE chunks
      const batch = allChunks.splice(0, BATCH_SIZE);
      
      const chunkDocs = await ChunkModel.insertMany(
        batch.map((chunk, idx) => ({
          pdfId,
          index: totalInserted + idx,
          content: chunk.text,
          page: chunk.page,
          status: "chunked",
        }))
      );

      totalInserted += chunkDocs.length;
      
      // batch se libera automáticamente después de la iteración
      // allChunks ahora tiene menos elementos, liberando memoria progresivamente
    }

    // Liberar referencias grandes (ya debería estar vacío, pero por si acaso)
    allChunks = null;

    // Cambiar estado del PDF
    pdfDoc.status = "processed";
    await pdfDoc.save();

    // Invalidar caché RAG para este PDF (los chunks han cambiado)
    await invalidateRagCacheForPdf(pdfId);
    console.log(`[PDF Process] Caché RAG invalidada para PDF ${pdfId}`);

    // Indexar estos chunks en Qdrant (embeddings + upsert)
    const { inserted } = await indexPdfChunksInQdrant(pdfId);

    // Retornar solo datos necesarios (no el objeto Mongoose completo)
    return {
      pdf: {
        _id: pdfDoc._id.toString(),
        status: pdfDoc.status,
      },
      chunks: totalInserted,
      embedded: inserted,
    };
  } catch (error) {
    // Asegurar liberación de memoria en caso de error
    allChunks = null;
    if (result) {
      result.chunks = null;
    }
    result = null;
    throw error;
  }
};

/**
 * Obtener el pool de workers (para métricas)
 */
export const getPdfPool = () => {
  return pdfPool;
};

/**
 * Cerrar el pool de workers de forma ordenada
 * Espera a que terminen las tareas en curso antes de cerrar
 */
export const closePdfPool = async () => {
  if (pdfPool) {
    try {
      await pdfPool.destroy();
      console.log("[PDF Pool] Pool de workers cerrado correctamente");
    } catch (error) {
      console.error("[PDF Pool] Error al cerrar pool:", error.message);
    }
  }
};
