import OpenAI from "openai";
import { searchPdfChunks } from "./qdrant.service.js";
import { ChunkModel } from "../models/chunk.model.js";
import {
  getCachedRagResponse,
  setCachedRagResponse,
  getCachedEmbedding,
  setCachedEmbedding,
} from "./cache.service.js";
import { withTenantAndNotDeleted } from "../utils/tenant-helpers.js";
import { estimateTokens, truncateToTokens, truncateMessages } from "../utils/token-utils.js";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RAG_MIN_MESSAGES_FOR_HISTORY = parseInt(process.env.RAG_MIN_MESSAGES_FOR_HISTORY || "3", 10);
const RAG_RECENT_MESSAGES = parseInt(process.env.RAG_RECENT_MESSAGES || "3", 10);
const RAG_MAX_TOTAL_TOKENS = parseInt(process.env.RAG_MAX_TOTAL_TOKENS || "3500", 10);
const RAG_DOCUMENT_PRIORITY = parseFloat(process.env.RAG_DOCUMENT_PRIORITY || "0.7", 10);
const CONVERSATION_SUMMARY_REFRESH_THRESHOLD = parseInt(
  process.env.CONVERSATION_SUMMARY_REFRESH_THRESHOLD || "30",
  10
);

/**
 * Verificar si se necesita historial basado en messageCount y palabras clave
 */
async function requiresHistory(tenantId, question, conversationId) {
  if (!conversationId) return false;

  const { ConversationModel } = await import("../models/conversation.model.js");
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    tenantId, // CRÍTICO: validar tenant
  })
    .select("messageCount")
    .lean();

  if (!conversation) return false;

  // Si hay pocos mensajes, no usar historial
  if (conversation.messageCount < RAG_MIN_MESSAGES_FOR_HISTORY) {
    return false;
  }

  // Palabras clave que indican referencia al historial
  const historyKeywords = ["antes", "mencionaste", "dijiste", "anteriormente", "previamente", "ya hablamos"];
  const hasHistoryKeyword = historyKeywords.some((keyword) =>
    question.toLowerCase().includes(keyword)
  );

  // Si hay muchos mensajes O hay palabra clave, usar historial
  return conversation.messageCount >= RAG_MIN_MESSAGES_FOR_HISTORY || hasHistoryKeyword;
}

/**
 * Construir contexto optimizado con historial y documento
 */
async function buildOptimizedContext(tenantId, conversationId, question, documentContext) {
  const messageService = await import("./message.service.js");
  const summaryService = await import("./conversation-summary.service.js");

  // Obtener mensajes recientes
  const recentMessages = await messageService.getRecentMessages(tenantId, conversationId, RAG_RECENT_MESSAGES);

  // Obtener o generar resumen de mensajes antiguos
  const summary = await summaryService.getOrGenerateSummary(tenantId, conversationId);

  // Calcular tokens disponibles
  const documentTokens = estimateTokens(documentContext);
  const documentBudget = Math.floor(RAG_MAX_TOTAL_TOKENS * RAG_DOCUMENT_PRIORITY);
  const historyBudget = RAG_MAX_TOTAL_TOKENS - documentBudget;

  // Truncar contexto del documento si es necesario
  let optimizedDocumentContext = documentContext;
  if (documentTokens > documentBudget) {
    optimizedDocumentContext = truncateToTokens(documentContext, documentBudget);
  }

  // Construir contexto histórico
  let historyContext = null;
  let totalTokens = estimateTokens(optimizedDocumentContext);

  if (recentMessages.length > 0 || summary) {
    const historyMessages = [];

    // Agregar resumen si existe
    if (summary && summary.summary) {
      historyMessages.push({
        role: "system",
        content: `Resumen de conversación anterior: ${summary.summary}`,
      });
    }

    // Agregar mensajes recientes (truncados)
    const truncatedRecent = truncateMessages(recentMessages, historyBudget);
    historyMessages.push(...truncatedRecent.map((msg) => ({
      role: msg.role,
      content: truncateToTokens(msg.content, Math.floor(historyBudget / truncatedRecent.length)),
    })));

    const historyText = historyMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    totalTokens += estimateTokens(historyText);

    // Si excede el presupuesto, truncar más
    if (totalTokens > RAG_MAX_TOTAL_TOKENS) {
      const excess = totalTokens - RAG_MAX_TOTAL_TOKENS;
      const reductionFactor = (RAG_MAX_TOTAL_TOKENS - documentTokens) / (totalTokens - documentTokens);
      historyContext = truncateToTokens(historyText, Math.floor(estimateTokens(historyText) * reductionFactor));
    } else {
      historyContext = historyText;
    }
  }

  return {
    documentContext: optimizedDocumentContext,
    historyContext,
    totalTokens: estimateTokens(optimizedDocumentContext) + (historyContext ? estimateTokens(historyContext) : 0),
  };
}

/**
 * Construir prompt optimizado
 */
function buildOptimizedPrompt(documentContext, historyContext, question, totalTokens) {
  let prompt = `Eres un asistente experto. Responde basándote **únicamente** en este contexto:\n\n`;

  if (historyContext) {
    prompt += `Historial de conversación:\n${historyContext}\n\n`;
  }

  prompt += `Contexto del documento:\n---------------------\n${documentContext}\n---------------------\n\n`;
  prompt += `Pregunta: ${question}\n\n`;
  prompt += `Instrucciones:\n`;
  prompt += `- Si la respuesta está en el contexto, responde de forma clara y concisa.\n`;
  prompt += `- Si NO está en el contexto, di: "No encontré esa información en el documento".\n`;
  prompt += `- Cita fragmentos específicos cuando sea relevante.`;

  return prompt;
}

/**
 * QUERY RAG con caché, multi-tenant y conversaciones
 */
export async function queryRag(tenantId, pdfId, question, conversationId = null, tenantSettings = {}) {
  console.log(`[RAG] Buscando contexto para pregunta: ${question} (tenantId: ${tenantId})`);

  // Usar settings del tenant o defaults
  const maxTokens = tenantSettings?.ragLimits?.maxTokens || RAG_MAX_TOTAL_TOKENS;
  const documentPriority = tenantSettings?.ragLimits?.documentPriority || RAG_DOCUMENT_PRIORITY;
  const llmModel = tenantSettings?.llmModel || "gpt-4o-mini";

  let questionVector = null;
  let search = null;
  let chunks = null;
  let contextText = "";
  let usedChunks = [];

  try {
    // 1. Verificar caché de respuesta completa (con tenantId)
    const cachedResponse = await getCachedRagResponse(tenantId, pdfId, question);
    if (cachedResponse) {
      console.log(`[RAG] Respuesta obtenida desde caché`);
      return cachedResponse;
    }

    // 2. Verificar caché de embedding (con tenantId)
    questionVector = await getCachedEmbedding(tenantId, question);

    if (!questionVector) {
      // 3. Si no hay caché de embedding, generar embedding
      console.log(`[RAG] Generando embedding para pregunta`);
      const embeddingResponse = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
        input: question,
      });

      questionVector = embeddingResponse.data[0].embedding;

      // 4. Guardar embedding en caché (con tenantId)
      await setCachedEmbedding(tenantId, question, questionVector);
      console.log(`[RAG] Embedding guardado en caché`);
    } else {
      console.log(`[RAG] Embedding obtenido desde caché`);
    }

    // 5. Buscar en Qdrant con filtro por tenantId
    const SEARCH_LIMIT = parseInt(process.env.RAG_SEARCH_LIMIT || "20", 10);
    const SCORE_THRESHOLD = parseFloat(process.env.RAG_SCORE_THRESHOLD || "0.5", 10);

    search = await searchPdfChunks(tenantId, pdfId, questionVector, {
      limit: SEARCH_LIMIT,
      scoreThreshold: SCORE_THRESHOLD,
    });

    console.log(`[RAG] Encontrados ${search.length} chunks similares con score >= ${SCORE_THRESHOLD}`);

    // 6. Obtener chunkIds
    const ids = search.map((hit) => hit.payload.chunkId);

    // 7. Buscar textos en Mongo (con tenantId)
    chunks = await ChunkModel.find(
      withTenantAndNotDeleted(
        {
          _id: { $in: ids },
          pdfId,
        },
        tenantId
      )
    )
      .select("content index page")
      .sort({ index: 1 })
      .lean();

    // 8. Construir contexto del documento
    const MAX_CONTEXT_LENGTH = parseInt(process.env.RAG_MAX_CONTEXT_LENGTH || "4000", 10);

    for (const chunk of chunks) {
      const chunkText = chunk.content || "";
      const separatorLength = contextText ? 2 : 0;
      const totalLength = contextText.length + separatorLength + chunkText.length;

      if (totalLength > MAX_CONTEXT_LENGTH) {
        break;
      }
      contextText += (contextText ? "\n\n" : "") + chunkText;
      usedChunks.push(chunk);
    }

    // 8.5. Fallback si no hay chunks
    if (usedChunks.length === 0 || contextText.trim().length === 0) {
      console.log(`[RAG] No se encontraron chunks similares, usando fallback`);
      const FALLBACK_CHUNKS_COUNT = parseInt(process.env.RAG_FALLBACK_CHUNKS || "20", 10);

      const fallbackChunks = await ChunkModel.find(
        withTenantAndNotDeleted({ pdfId }, tenantId)
      )
        .select("content index page")
        .sort({ index: 1 })
        .limit(FALLBACK_CHUNKS_COUNT)
        .lean();

      contextText = "";
      usedChunks = [];

      for (const chunk of fallbackChunks) {
        const chunkText = chunk.content || "";
        const separatorLength = contextText ? 2 : 0;
        const totalLength = contextText.length + separatorLength + chunkText.length;

        if (totalLength > MAX_CONTEXT_LENGTH) {
          break;
        }
        contextText += (contextText ? "\n\n" : "") + chunkText;
        usedChunks.push(chunk);
      }
    }

    // 9. Construir contexto optimizado (con historial si aplica)
    let optimizedContext = {
      documentContext: contextText,
      historyContext: null,
      totalTokens: estimateTokens(contextText),
    };

    if (conversationId && (await requiresHistory(tenantId, question, conversationId))) {
      optimizedContext = await buildOptimizedContext(tenantId, conversationId, question, contextText);
    }

    // 10. Construir prompt
    const prompt = buildOptimizedPrompt(
      optimizedContext.documentContext,
      optimizedContext.historyContext,
      question,
      optimizedContext.totalTokens
    );

    // 11. Llamar al modelo LLM
    const completion = await openai.chat.completions.create({
      model: llmModel,
      messages: [
        { role: "system", content: "Eres un asistente útil para responder preguntas de documentos PDF." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    const answer = completion.choices[0].message.content;
    const usage = completion.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    // 12. Guardar mensajes en conversación si existe
    if (conversationId) {
      const messageService = await import("./message.service.js");
      const { ConversationModel } = await import("../models/conversation.model.js");

      // Guardar mensaje del usuario
      await messageService.createMessage(tenantId, conversationId, "user", question, {
        pdfId,
        tokens: {
          prompt_tokens: estimateTokens(prompt),
          completion_tokens: 0,
          total_tokens: estimateTokens(prompt),
        },
      });

      // Guardar mensaje del assistant
      await messageService.createMessage(tenantId, conversationId, "assistant", answer, {
        pdfId,
        chunks: usedChunks.map((c) => c._id),
        tokens: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
        },
        llmModel,
      });

      // Invalidar resumen si hay muchos mensajes nuevos
      const conversation = await ConversationModel.findOne({
        _id: conversationId,
        tenantId,
      }).lean();

      if (conversation && conversation.messageCount % CONVERSATION_SUMMARY_REFRESH_THRESHOLD === 0) {
        const summaryService = await import("./conversation-summary.service.js");
        await summaryService.invalidateConversationSummary(tenantId, conversationId, "threshold_reached");
      }
    }

    // 13. Preparar respuesta
    const response = {
      answer,
      context: usedChunks,
      tokens: usage,
      conversationId: conversationId || null,
    };

    // 14. Guardar respuesta completa en caché (con tenantId)
    await setCachedRagResponse(tenantId, pdfId, question, response);
    console.log(`[RAG] Respuesta guardada en caché`);

    return response;
  } catch (error) {
    console.error("[RAG] Error:", error);
    throw error;
  } finally {
    // Limpieza de memoria
    questionVector = null;
    search = null;
    chunks = null;
    contextText = null;
    usedChunks = null;
  }
}
