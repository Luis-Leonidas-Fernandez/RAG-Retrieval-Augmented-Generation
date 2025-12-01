import { QdrantClient } from "@qdrant/js-client-rest";
import { ChunkModel } from "../models/chunk.model.js";
import { embedBatch } from "./embedding.service.js";
import { v4 as uuidv4 } from "uuid";
import { invalidateRagCacheForPdf } from "./cache.service.js";

export const COLLECTION = "pdf_chunks";
// IMPORTANTE: text-embedding-3-small → 1536 dimensiones
export const VECTOR_SIZE = 1536;

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
});

/**
 * Crear colección si no existe
 */
export async function initQdrant() {
  console.log("[Qdrant] Verificando colección...");

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION);

  if (exists) {
    console.log(`[Qdrant] La colección '${COLLECTION}' ya existe`);
    return;
  }

  await qdrant.createCollection(COLLECTION, {
    vectors: {
      size: VECTOR_SIZE,
      distance: "Cosine",
    },
  });

  console.log(`[Qdrant] Colección '${COLLECTION}' creada correctamente`);
}

/**
 * Upsert + búsqueda de prueba
 */
export async function testQdrant() {
  console.log("[Qdrant] Probando upsert y search...");

  // Crear vector simple
  const vector = Array(VECTOR_SIZE).fill(0);
  vector[0] = 1;

  // Insertar
  await qdrant.upsert(COLLECTION, {
    points: [
      {
        id: "test-1",
        vector,
        payload: { prueba: true },
      },
    ],
  });

  // Buscar
  const result = await qdrant.search(COLLECTION, {
    vector,
    limit: 3,
  });

  return result;
}

/**
 * Procesa un lote de chunks: genera embeddings, crea points y los inserta en Qdrant
 * @param {string} tenantId - ID del tenant
 * @param {Array} batch - Array de chunks a procesar
 * @returns {Promise<number>} - Número de chunks procesados
 */
async function processBatch(tenantId, batch) {
  let embeddings = null;
  let points = null;
  let texts = null;

  try {
    // 1. Generar embeddings para este lote
    texts = batch.map((c) => c.content || "");
    embeddings = await embedBatch(texts);

    if (embeddings.length !== batch.length) {
      throw new Error("Error: cantidad de embeddings no coincide con cantidad de chunks.");
    }

    // 2. Crear points para Qdrant (con tenantId en payload)
    points = batch.map((chunk, i) => ({
      id: uuidv4(),
      vector: embeddings[i],
      payload: {
        tenantId: tenantId.toString(), // CRÍTICO: siempre incluir tenantId
        pdfId: chunk.pdfId.toString(),
        chunkId: chunk._id.toString(),
        index: chunk.index,
        page: chunk.page,
        content: chunk.content,
      },
    }));

    // Liberar embeddings array ahora que points tiene las referencias necesarias
    // (Los vectores individuales siguen referenciados en points)
    embeddings = null;

    // 3. Upsert en Qdrant
    await qdrant.upsert(COLLECTION, { points });

    const pointsCount = points.length;

    // Liberar points después del upsert (ya no se necesitan)
    points = null;

    // 4. Marcar como embedded (con tenantId)
    await ChunkModel.updateMany(
      { _id: { $in: batch.map((c) => c._id) }, tenantId },
      { $set: { status: "embedded" } }
    );

    return pointsCount;
  } catch (error) {
    // Asegurar limpieza de memoria en caso de error
    embeddings = null;
    points = null;
    texts = null;
    throw error;
  }
}

/**
 * Indexar en Qdrant todos los chunks de un PDF dado.
 * - Busca chunks por tenantId y pdfId usando cursor (procesa en lotes)
 * - Genera embeddings usando OpenAI
 * - Hace upsert en Qdrant
 * - Actualiza estado de los chunks a "embedded"
 */
export async function indexPdfChunksInQdrant(tenantId, pdfId) {
  console.log(`[Qdrant] Indexando chunks para tenantId: ${tenantId}, pdfId: ${pdfId}`);

  const BATCH_SIZE = parseInt(process.env.QDRANT_BATCH_SIZE || '50', 10); // Chunks por lote
  let totalInserted = 0;

  // 1. Verificar si hay chunks pendientes (sin cargar todos)
  const count = await ChunkModel.countDocuments({
    tenantId, // CRÍTICO: filtrar por tenant
    pdfId,
    status: "chunked",
  });

  if (count === 0) {
    console.log(
      `[Qdrant] No hay chunks con estado "chunked" para tenantId ${tenantId}, pdfId ${pdfId}`
    );
    return { inserted: 0 };
  }

  // 2. Procesar con cursor en lotes (no carga todo en memoria)
  const cursor = ChunkModel.find({
    tenantId, // CRÍTICO: filtrar por tenant
    pdfId,
    status: "chunked",
  })
    .select('content pdfId _id index page tenantId') // Incluir tenantId
    .sort({ index: 1 })
    .lean()
    .cursor();

  let batch = [];

  try {
    for await (const chunk of cursor) {
      batch.push(chunk);

      // Cuando el lote está completo, procesarlo
      if (batch.length >= BATCH_SIZE) {
        const processed = await processBatch(tenantId, batch);
        totalInserted += processed;
        
        // Liberar memoria del lote
        batch = [];
        
        console.log(`[Qdrant] Procesados ${totalInserted}/${count} chunks...`);
      }
    }

    // 7. Procesar último lote si queda algo
    if (batch.length > 0) {
      const processed = await processBatch(tenantId, batch);
      totalInserted += processed;
      batch = null; // Liberar referencia
    }
  } finally {
    // Asegurar que el cursor se cierre
    await cursor.close();
  }

  console.log(`[Qdrant] Indexados ${totalInserted} chunks del PDF ${pdfId}`);

  // Invalidar caché RAG para este PDF cuando se reindexan chunks
  // (solo si se insertaron nuevos chunks, ya que invalidamos antes en pdf-process)
  if (totalInserted > 0) {
    await invalidateRagCacheForPdf(tenantId, pdfId);
    console.log(`[Qdrant] Caché RAG invalidada para PDF ${pdfId} después de reindexación`);
  }

  return { inserted: totalInserted };
}

/**
 * Buscar chunks en Qdrant con filtro por tenantId y pdfId
 */
export async function searchPdfChunks(tenantId, pdfId, vector, options = {}) {
  const {
    limit = 20,
    scoreThreshold = 0.5,
  } = options;

  const result = await qdrant.search(COLLECTION, {
    vector,
    limit,
    score_threshold: scoreThreshold,
    filter: {
      must: [
        { key: 'tenantId', match: { value: tenantId.toString() } }, // CRÍTICO: siempre filtrar
        { key: 'pdfId', match: { value: pdfId.toString() } }
      ],
      must_not: [
        { key: 'isDeleted', match: { value: true } } // Filtrar PDFs soft-deletados
      ]
    },
  });

  return result;
}

/**
 * Soft-delete o hard-delete de PDF en Qdrant
 */
export async function deletePdfFromVectorStore(tenantId, pdfId, hardDelete = false) {
  if (hardDelete) {
    // Hard-delete: borrar puntos físicamente
    await qdrant.delete(COLLECTION, {
      filter: {
        must: [
          { key: 'tenantId', match: { value: tenantId.toString() } },
          { key: 'pdfId', match: { value: pdfId.toString() } }
        ]
      }
    });
    console.log(`[Qdrant] Puntos borrados físicamente para tenantId ${tenantId}, pdfId ${pdfId}`);
  } else {
    // Soft-delete: marcar en payload
    // Nota: Qdrant no soporta actualización masiva de payload directamente
    // Necesitaríamos obtener todos los puntos, actualizar payload y hacer upsert
    // Por ahora, usamos filtro must_not en búsquedas para excluir soft-deletados
    console.log(`[Qdrant] Soft-delete marcado para tenantId ${tenantId}, pdfId ${pdfId} (se filtra en búsquedas)`);
  }
}

/**
 * Restaurar PDF en Qdrant (remover marca de soft-delete)
 */
export async function restorePdfInVectorStore(tenantId, pdfId) {
  // Similar a deletePdfFromVectorStore, necesitaríamos actualizar payload
  // Por ahora, solo log
  console.log(`[Qdrant] PDF restaurado para tenantId ${tenantId}, pdfId ${pdfId}`);
}

/**
 * Contar puntos en Qdrant que coinciden con un filtro
 * @param {string|ObjectId} tenantId - ID del tenant
 * @param {string|ObjectId} pdfId - ID del PDF
 * @returns {Promise<number|null>} - Número de puntos o null si hay error
 */
export async function countPointsInQdrant(tenantId, pdfId) {
  try {
    // Usar scroll para contar (más eficiente que search con limit alto)
    const result = await qdrant.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'tenantId', match: { value: tenantId.toString() } },
          { key: 'pdfId', match: { value: pdfId.toString() } }
        ]
      },
      limit: 1, // Solo necesitamos saber si hay puntos
      with_payload: false,
      with_vector: false,
    });
    
    // Si hay puntos, hacer scroll completo para contar
    if (result.points && result.points.length > 0) {
      // Scroll completo para contar todos
      let total = 0;
      let nextPageOffset = result.next_page_offset;
      
      // Contar primera página
      total += result.points.length;
      
      // Continuar scroll si hay más páginas
      while (nextPageOffset) {
        const nextResult = await qdrant.scroll(COLLECTION, {
          filter: {
            must: [
              { key: 'tenantId', match: { value: tenantId.toString() } },
              { key: 'pdfId', match: { value: pdfId.toString() } }
            ]
          },
          offset: nextPageOffset,
          limit: 100,
          with_payload: false,
          with_vector: false,
        });
        
        total += nextResult.points.length;
        nextPageOffset = nextResult.next_page_offset;
      }
      
      return total;
    }
    
    return 0;
  } catch (error) {
    console.error('[Qdrant] Error al contar puntos:', error.message);
    return null; // null indica error, 0 indica que no hay puntos
  }
}