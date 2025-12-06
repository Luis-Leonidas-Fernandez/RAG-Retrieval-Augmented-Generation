import Piscina from "piscina";
import path from "path";
import { fileURLToPath } from "url";

import { DocModel } from "../../db/models/doc.model.js";
import { ChunkModel } from "../../db/models/chunk.model.js";
import { indexPdfChunksInQdrant } from "./qdrant.service.js";
import { invalidateRagCacheForPdf } from "./cache.service.js";

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear pool de workers para procesamiento de documentos
const docPool = new Piscina({
  filename: path.join(__dirname, '../../workers/doc-processor.worker.js'),
  maxThreads: parseInt(process.env.PDF_WORKER_THREADS || '2', 10),
  minThreads: 1,
});

// Nota: getPageForChunk() fue eliminada - ahora la página se calcula directamente en el worker

export const processDocById = async (pdfId) => {
  // Verificar que el documento exista y obtener path, mimetype y tenantId
  // No usar .lean() porque necesitamos actualizar el status después
  const docDoc = await DocModel.findById(pdfId).select('path status tenantId mimetype');
  if (!docDoc) throw new Error("Documento no encontrado");
  if (!docDoc.tenantId) throw new Error("Documento no tiene tenantId asignado");
  
  const tenantId = docDoc.tenantId;

  let allChunks = null;
  let result = null;

  try {
    // Procesar documento en worker thread (CPU-intensivo)
    // Pasar mimetype al worker para logging/estadísticas
    result = await docPool.run({ 
      pdfPath: docDoc.path,
      mimetype: docDoc.mimetype || null
    });

    if (!result.success) {
      throw new Error(result.error || "Error al procesar documento en worker");
    }

    // Extraer datos del resultado del worker
    // chunks ahora viene con { text, page } desde el worker
    allChunks = result.chunks;
    const totalChunksCount = allChunks.length;
    
    // Limpiar resultado del worker para liberar memoria del worker
    result.chunks = null;

    // --- EVITAR DUPLICADOS ---
    await ChunkModel.deleteMany({ tenantId, pdfId });

    // Guardar chunks en MongoDB con información de página (en lotes para optimizar memoria)
    const BATCH_SIZE = parseInt(process.env.PDF_BATCH_SIZE || '100', 10);
    let totalInserted = 0;

    // Procesar y eliminar chunks del array original para liberar memoria progresivamente
    while (allChunks.length > 0) {
      // Extraer y remover los primeros BATCH_SIZE chunks
      const batch = allChunks.splice(0, BATCH_SIZE);
      
      const chunkDocs = await ChunkModel.insertMany(
        batch.map((chunk, idx) => ({
          tenantId, // CRÍTICO: incluir tenantId
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

    // Cambiar estado del documento
    docDoc.status = "processed";
    await docDoc.save();

    // Invalidar caché RAG para este documento (los chunks han cambiado)
    await invalidateRagCacheForPdf(tenantId.toString(), pdfId);
    console.log(`[Doc Process] Caché RAG invalidada para documento ${pdfId}`);

    // Indexar estos chunks en Qdrant (embeddings + upsert) con tenantId
    const { inserted } = await indexPdfChunksInQdrant(tenantId.toString(), pdfId);

    // Retornar solo datos necesarios (no el objeto Mongoose completo)
    return {
      pdf: {
        _id: docDoc._id.toString(),
        status: docDoc.status,
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
export const getDocPool = () => {
  return docPool;
};

/**
 * Cerrar el pool de workers de forma ordenada
 * Espera a que terminen las tareas en curso antes de cerrar
 */
export const closeDocPool = async () => {
  if (docPool) {
    try {
      await docPool.destroy();
      console.log("[Doc Pool] Pool de workers cerrado correctamente");
    } catch (error) {
      console.error("[Doc Pool] Error al cerrar pool:", error.message);
    }
  }
};

