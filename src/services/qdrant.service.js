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
 * @param {Array} batch - Array de chunks a procesar
 * @returns {Promise<number>} - Número de chunks procesados
 */
async function processBatch(batch) {
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

    // 2. Crear points para Qdrant
    points = batch.map((chunk, i) => ({
      id: uuidv4(),
      vector: embeddings[i],
      payload: {
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

    // 4. Marcar como embedded
    await ChunkModel.updateMany(
      { _id: { $in: batch.map((c) => c._id) } },
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
 * - Busca chunks por pdfId usando cursor (procesa en lotes)
 * - Genera embeddings usando OpenAI
 * - Hace upsert en Qdrant
 * - Actualiza estado de los chunks a "embedded"
 */
export async function indexPdfChunksInQdrant(pdfId) {
  console.log(`[Qdrant] Indexando chunks para pdfId: ${pdfId}`);

  const BATCH_SIZE = parseInt(process.env.QDRANT_BATCH_SIZE || '50', 10); // Chunks por lote
  let totalInserted = 0;

  // 1. Verificar si hay chunks pendientes (sin cargar todos)
  const count = await ChunkModel.countDocuments({
    pdfId,
    status: "chunked",
  });

  if (count === 0) {
    console.log(
      `[Qdrant] No hay chunks con estado "chunked" para pdfId ${pdfId}`
    );
    return { inserted: 0 };
  }

  // 2. Procesar con cursor en lotes (no carga todo en memoria)
  const cursor = ChunkModel.find({
    pdfId,
    status: "chunked",
  })
    .select('content pdfId _id index page') // Solo campos necesarios
    .sort({ index: 1 })
    .lean()
    .cursor();

  let batch = [];

  try {
    for await (const chunk of cursor) {
      batch.push(chunk);

      // Cuando el lote está completo, procesarlo
      if (batch.length >= BATCH_SIZE) {
        const processed = await processBatch(batch);
        totalInserted += processed;
        
        // Liberar memoria del lote
        batch = [];
        
        console.log(`[Qdrant] Procesados ${totalInserted}/${count} chunks...`);
      }
    }

    // 7. Procesar último lote si queda algo
    if (batch.length > 0) {
      const processed = await processBatch(batch);
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
    await invalidateRagCacheForPdf(pdfId);
    console.log(`[Qdrant] Caché RAG invalidada para PDF ${pdfId} después de reindexación`);
  }

  return { inserted: totalInserted };
}