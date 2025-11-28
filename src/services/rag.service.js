import OpenAI from "openai";
import { qdrant, COLLECTION } from "./qdrant.service.js";
import { ChunkModel } from "../models/chunk.model.js";
import {
  getCachedRagResponse,
  setCachedRagResponse,
  getCachedEmbedding,
  setCachedEmbedding,
} from "./cache.service.js";
import dotenv from "dotenv";
dotenv.config();


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


/**
 * QUERY RAG con caché de embeddings y respuestas completas
 */
export async function queryRag(pdfId, question) {
  console.log(`[RAG] Buscando contexto para pregunta: ${question}`);

  let questionVector = null;
  let search = null;
  let chunks = null;
  let contextText = "";
  let usedChunks = [];

  try {
    // 1. Verificar caché de respuesta completa (antes de cualquier procesamiento)
    const cachedResponse = await getCachedRagResponse(pdfId, question);
    if (cachedResponse) {
      console.log(`[RAG] Respuesta obtenida desde caché`);
      return cachedResponse;
    }

    // 2. Verificar caché de embedding
    questionVector = await getCachedEmbedding(question);
    
    if (!questionVector) {
      // 3. Si no hay caché de embedding, generar embedding
      console.log(`[RAG] Generando embedding para pregunta`);
      const embeddingResponse = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
        input: question,
      });

      questionVector = embeddingResponse.data[0].embedding;

      // 4. Guardar embedding en caché
      await setCachedEmbedding(question, questionVector);
      console.log(`[RAG] Embedding guardado en caché`);
    } else {
      console.log(`[RAG] Embedding obtenido desde caché`);
    }

    // 5. Buscar en Qdrant con parámetros mejorados
    const SEARCH_LIMIT = parseInt(process.env.RAG_SEARCH_LIMIT || '20', 10); // Aumentado de 10 a 20
    const SCORE_THRESHOLD = parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.5'); // Reducido de 0.7 a 0.5
    
    search = await qdrant.search(COLLECTION, {
      vector: questionVector,
      limit: SEARCH_LIMIT,
      score_threshold: SCORE_THRESHOLD,
      filter: {
        must: [
          {
            key: "pdfId",
            match: { value: pdfId }
          }
        ]
      }
    });

    console.log(`[RAG] Encontrados ${search.length} chunks similares con score >= ${SCORE_THRESHOLD}`);

    // 6. Obtener chunkIds
    const ids = search.map((hit) => hit.payload.chunkId);

    // 7. Buscar textos en Mongo para hacer el contexto real (solo campos necesarios)
    chunks = await ChunkModel.find({ _id: { $in: ids } })
      .select('content index page') // Solo campos necesarios
      .sort({ index: 1 })
      .lean();

    // 8. Limitar tamaño del contexto para evitar strings gigantes
    const MAX_CONTEXT_LENGTH = parseInt(process.env.RAG_MAX_CONTEXT_LENGTH || '4000', 10);

    for (const chunk of chunks) {
      const chunkText = chunk.content || "";
      // Calcular tamaño total considerando el separador "\n\n" si ya hay contenido
      const separatorLength = contextText ? 2 : 0; // "\n\n" = 2 caracteres
      const totalLength = contextText.length + separatorLength + chunkText.length;
      
      // Si agregar este chunk excedería el límite, detener
      if (totalLength > MAX_CONTEXT_LENGTH) {
        break;
      }
      contextText += (contextText ? "\n\n" : "") + chunkText;
      usedChunks.push(chunk);
    }

    // 8.5. Fallback: Si no se encontraron chunks o el contexto está vacío, buscar en los primeros chunks
    // Esto es útil para encontrar tablas de contenido, índices, o información estructural
    if (usedChunks.length === 0 || contextText.trim().length === 0) {
      console.log(`[RAG] No se encontraron chunks similares, usando fallback: buscando en primeros chunks del documento`);
      
      // Límite de contexto más amplio para el fallback (para incluir más información estructural)
      const FALLBACK_CONTEXT_LENGTH = parseInt(process.env.RAG_FALLBACK_CONTEXT_LENGTH || '8000', 10);
      const FALLBACK_CHUNKS_COUNT = parseInt(process.env.RAG_FALLBACK_CHUNKS || '20', 10);
      
      // Primero intentar buscar chunks que contengan palabras clave relacionadas con tablas de contenido
      const keywords = ['capítulo', 'chapter', 'contenido', 'contents', 'índice', 'index', 'table of contents'];
      const keywordRegex = new RegExp(keywords.join('|'), 'i');
      
      let fallbackChunks = await ChunkModel.find({ 
        pdfId,
        content: { $regex: keywordRegex }
      })
        .select('content index page')
        .sort({ index: 1 })
        .limit(10)
        .lean();
      
      // Si no encontramos chunks con keywords, buscar en los primeros chunks del documento
      if (fallbackChunks.length === 0) {
        console.log(`[RAG] No se encontraron chunks con palabras clave, buscando en los primeros ${FALLBACK_CHUNKS_COUNT} chunks`);
        fallbackChunks = await ChunkModel.find({ pdfId })
          .select('content index page')
          .sort({ index: 1 })
          .limit(FALLBACK_CHUNKS_COUNT)
          .lean();
      } else {
        console.log(`[RAG] Encontrados ${fallbackChunks.length} chunks con palabras clave relacionadas`);
      }

      if (fallbackChunks.length > 0) {
        contextText = "";
        usedChunks = [];
        
        for (const chunk of fallbackChunks) {
          const chunkText = chunk.content || "";
          const separatorLength = contextText ? 2 : 0;
          const totalLength = contextText.length + separatorLength + chunkText.length;
          
          // Usar el límite ampliado para el fallback
          if (totalLength > FALLBACK_CONTEXT_LENGTH) {
            break;
          }
          contextText += (contextText ? "\n\n" : "") + chunkText;
          usedChunks.push(chunk);
        }
        
        console.log(`[RAG] Usando ${usedChunks.length} chunks del inicio del documento como fallback (contexto: ${contextText.length} caracteres)`);
      }
    }

    // 9. Crear prompt
    const prompt = `Eres un asistente experto. Responde basándote **únicamente** en este contexto:

---------------------
${contextText}
---------------------

Pregunta: ${question}

Instrucciones:
- Si la respuesta está en el contexto, responde de forma clara y concisa.
- Si NO está en el contexto, di: "No encontré esa información en el documento".
- Cita fragmentos específicos cuando sea relevante.`;

    // 10. Llamar al modelo LLM
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // eficiente y barato
      messages: [
        { role: "system", content: "Eres un asistente útil para responder preguntas de documentos PDF." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
    });

    const answer = completion.choices[0].message.content;

    // 11. Preparar respuesta
    const response = {
      answer,
      context: usedChunks, // Solo los chunks usados en el contexto
    };

    // 12. Guardar respuesta completa en caché antes de retornar
    await setCachedRagResponse(pdfId, question, response);
    console.log(`[RAG] Respuesta guardada en caché`);

    return response;
  } catch (error) {
    // Asegurar limpieza de memoria en caso de error
    questionVector = null;
    search = null;
    chunks = null;
    contextText = null;
    usedChunks = null;
    throw error;
  } finally {
    // Limpieza final adicional (por si acaso)
    contextText = null;
  }
}
