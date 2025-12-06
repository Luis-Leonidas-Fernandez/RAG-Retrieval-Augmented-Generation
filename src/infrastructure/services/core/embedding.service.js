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
    console.log(`[Embedding] ⚠️  Array vacío recibido`);
    return [];
  }

  console.log(`[Embedding] 🔄 Iniciando generación de embeddings`);
  console.log(`[Embedding]   - Total textos: ${texts.length}`);
  console.log(`[Embedding]   - Batch size inicial: ${batchSize}`);
  console.log(`[Embedding]   - Modelo: ${EMBEDDING_MODEL}`);

  // Validación: límite máximo para evitar problemas de memoria
  // Cada vector tiene 1536 dimensiones × 4 bytes = ~6KB
  // 200 textos = ~1.2MB de vectores (manejable)
  const MAX_TEXTS = parseInt(process.env.EMBEDDING_MAX_TEXTS || '200', 10);
  if (texts.length > MAX_TEXTS) {
    console.error(`[Embedding] ❌ Error: máximo ${MAX_TEXTS} textos por lote. Recibidos: ${texts.length}`);
    throw new Error(
      `embedBatch: máximo ${MAX_TEXTS} textos por lote para evitar problemas de memoria. ` +
      `Recibidos: ${texts.length}. Ajusta EMBEDDING_MAX_TEXTS o procesa en lotes más pequeños.`
    );
  }

  // Ajustar batchSize desde variable de entorno si existe
  const envBatchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '0', 10);
  if (envBatchSize > 0) {
    batchSize = envBatchSize;
    console.log(`[Embedding]   - Batch size ajustado desde env: ${batchSize}`);
  }

  // Calcular tokens aproximados (1 token ≈ 4 chars)
  const estimatedTokens = texts.reduce((sum, t) => sum + Math.ceil((t || "").length / 4), 0);
  console.log(`[Embedding]   - Tokens estimados: ${estimatedTokens.toLocaleString()}`);
  
  // Si es muy grande, reducir batch size
  if (estimatedTokens > 800000) { // ~80% del límite de OpenAI
    const oldBatchSize = batchSize;
    batchSize = Math.max(16, Math.floor(batchSize / 2));
    console.log(`[Embedding]   - Batch size reducido: ${oldBatchSize} → ${batchSize} (tokens muy grandes)`);
  }

  const allVectors = [];
  let batchNumber = 0;
  const totalBatches = Math.ceil(texts.length / batchSize);
  console.log(`[Embedding]   - Total de batches: ${totalBatches}`);

  for (let i = 0; i < texts.length; i += batchSize) {
    batchNumber++;
    const batchStart = i;
    const batchEnd = Math.min(i + batchSize, texts.length);
    const currentBatchSize = batchEnd - batchStart;
    
    console.log(`[Embedding] 📦 Procesando batch #${batchNumber}/${totalBatches}: textos ${batchStart} a ${batchEnd - 1} (${currentBatchSize} textos)`);
    
    const batchStartTime = Date.now();
    
    // Preprocesar cada texto antes de embeder
    const slice = texts.slice(i, i + batchSize).map((t) => {
      if (!t || !t.trim()) return "";
      return preprocessForEmbedding(t);
    });

    const apiStartTime = Date.now();
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice,
    });
    const apiTime = Date.now() - apiStartTime;

    const batchTime = Date.now() - batchStartTime;
    console.log(`[Embedding] ✅ Batch #${batchNumber} completado en ${batchTime}ms (API: ${apiTime}ms, ${response.data.length} vectores generados)`);

    response.data.forEach((item) => {
      allVectors.push(item.embedding);
    });
  }

  console.log(`[Embedding] ✅ Total de vectores generados: ${allVectors.length}`);
  console.log(`[Embedding]   - Dimensiones por vector: ${allVectors[0]?.length || 'N/A'}`);

  return allVectors;
}

