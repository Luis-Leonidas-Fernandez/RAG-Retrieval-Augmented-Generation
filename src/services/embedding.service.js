import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

/**
 * Preprocesa el texto antes de enviarlo a OpenAI para embeddings
 */
function preprocessForEmbedding(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .substring(0, 8000); // Límite de OpenAI
}  

/**
 * Embebe un solo texto y devuelve el vector (array de floats)
 */
export async function embedText(text) {
  if (!text || !text.trim()) {
    throw new Error("Texto vacío para embedding");
  }

  // Preprocesar el texto antes de embeder
  const processedText = preprocessForEmbedding(text);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: processedText,
  });

  return response.data[0].embedding;
}

/**
 * Embebe un array de strings en batch.
 * Devuelve un array de arrays de floats en el mismo orden.
 */
export async function embedBatch(texts, batchSize = 64) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  // Validación: límite máximo para evitar problemas de memoria
  // Cada vector tiene 1536 dimensiones × 4 bytes = ~6KB
  // 200 textos = ~1.2MB de vectores (manejable)
  const MAX_TEXTS = parseInt(process.env.EMBEDDING_MAX_TEXTS || '200', 10);
  if (texts.length > MAX_TEXTS) {
    throw new Error(
      `embedBatch: máximo ${MAX_TEXTS} textos por lote para evitar problemas de memoria. ` +
      `Recibidos: ${texts.length}. Ajusta EMBEDDING_MAX_TEXTS o procesa en lotes más pequeños.`
    );
  }

  // Ajustar batchSize desde variable de entorno si existe
  const envBatchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '0', 10);
  if (envBatchSize > 0) {
    batchSize = envBatchSize;
  }

  // Calcular tokens aproximados (1 token ≈ 4 chars)
  const estimatedTokens = texts.reduce((sum, t) => sum + Math.ceil((t || "").length / 4), 0);
  
  // Si es muy grande, reducir batch size
  if (estimatedTokens > 800000) { // ~80% del límite de OpenAI
    batchSize = Math.max(16, Math.floor(batchSize / 2));
  }

  const allVectors = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    // Preprocesar cada texto antes de embeder
    const slice = texts.slice(i, i + batchSize).map((t) => {
      if (!t || !t.trim()) return "";
      return preprocessForEmbedding(t);
    });

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice,
    });

    response.data.forEach((item) => {
      allVectors.push(item.embedding);
    });
  }

  return allVectors;
}

