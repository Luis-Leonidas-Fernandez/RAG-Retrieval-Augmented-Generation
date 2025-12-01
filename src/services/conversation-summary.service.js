import { getRedisClient, isRedisAvailable } from "../config/redis.js";
import { ConversationModel } from "../models/conversation.model.js";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CONVERSATION_SUMMARY_REFRESH_THRESHOLD = parseInt(
  process.env.CONVERSATION_SUMMARY_REFRESH_THRESHOLD || "30",
  10
);

/**
 * Obtener key de caché de resumen
 */
function getSummaryCacheKey(tenantId, conversationId) {
  return `conversation_summary:${tenantId}:${conversationId}`;
}

/**
 * Obtener o generar resumen de conversación
 * Flujo: Redis (cache) → MongoDB (fuente de verdad) → LLM (generar)
 */
export async function getOrGenerateSummary(tenantId, conversationId) {
  // 1. Intentar Redis (cache caliente)
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    const cacheKey = getSummaryCacheKey(tenantId, conversationId);
    const cached = await redis.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error("[Summary] Error al parsear caché:", err);
      }
    }
  }

  // 2. Intentar MongoDB (fuente de verdad)
  const persistent = await getPersistentSummary(tenantId, conversationId);
  if (persistent) {
    // Cachear en Redis
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      const cacheKey = getSummaryCacheKey(tenantId, conversationId);
      await redis.set(cacheKey, JSON.stringify(persistent), "EX", 86400); // 24h
    }
    return persistent;
  }

  // 3. Generar nuevo resumen con LLM
  return await generateSummary(tenantId, conversationId);
}

/**
 * Obtener resumen persistente de MongoDB
 */
async function getPersistentSummary(tenantId, conversationId) {
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    tenantId, // CRÍTICO: validar tenant
  })
    .select("summary summaryGeneratedAt summaryMessageCount lastSummaryMessageIndex messageCount")
    .lean();

  if (!conversation || !conversation.summary) {
    return null;
  }

  // Verificar si el resumen está actualizado
  if (shouldRegenerateSummary(conversation)) {
    return null; // Resumen desactualizado
  }

  return {
    summary: conversation.summary,
    generatedAt: conversation.summaryGeneratedAt,
    messageCount: conversation.summaryMessageCount,
  };
}

/**
 * Verificar si se debe regenerar el resumen
 */
export function shouldRegenerateSummary(conversation) {
  if (!conversation.lastSummaryMessageIndex) {
    return true; // Nunca se generó resumen
  }

  const newMessages = conversation.messageCount - conversation.lastSummaryMessageIndex;
  return newMessages >= CONVERSATION_SUMMARY_REFRESH_THRESHOLD;
}

/**
 * Generar resumen con LLM
 */
async function generateSummary(tenantId, conversationId) {
  const { getMessages } = await import("./message.service.js");

  // Obtener todos los mensajes antiguos (antes del último resumen)
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    tenantId, // CRÍTICO: validar tenant
  }).lean();

  if (!conversation) {
    throw new Error("Conversación no encontrada");
  }

  const lastIndex = conversation.lastSummaryMessageIndex || 0;
  const messages = await getMessages(tenantId, conversationId, {
    limit: 1000, // Obtener muchos mensajes
    sort: { index: 1 },
  });

  // Filtrar mensajes que ya están en el resumen
  const newMessages = messages.filter((msg) => msg.index >= lastIndex);

  if (newMessages.length === 0) {
    return null; // No hay mensajes nuevos para resumir
  }

  // Construir prompt para resumen
  const messagesText = newMessages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  const prompt = `Resume la siguiente conversación de forma concisa, manteniendo los puntos clave y el contexto importante:

${messagesText}

Resumen:`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const summary = completion.choices[0].message.content;

    // Guardar en MongoDB
    await updateConversationSummary(
      tenantId,
      conversationId,
      summary,
      conversation.messageCount,
      newMessages.length
    );

    // Cachear en Redis
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      const cacheKey = getSummaryCacheKey(tenantId, conversationId);
      await redis.set(
        cacheKey,
        JSON.stringify({
          summary,
          generatedAt: new Date(),
          messageCount: newMessages.length,
        }),
        "EX",
        86400
      ); // 24h
    }

    return {
      summary,
      generatedAt: new Date(),
      messageCount: newMessages.length,
    };
  } catch (error) {
    console.error("[Summary] Error al generar resumen:", error);
    throw error;
  }
}

/**
 * Actualizar resumen en MongoDB
 */
export async function updateConversationSummary(
  tenantId,
  conversationId,
  summary,
  lastSummaryMessageIndex,
  summaryMessageCount
) {
  await ConversationModel.findOneAndUpdate(
    {
      _id: conversationId,
      tenantId, // CRÍTICO: validar tenant
    },
    {
      $set: {
        summary,
        summaryGeneratedAt: new Date(),
        lastSummaryMessageIndex,
        summaryMessageCount,
      },
    }
  );
}

/**
 * Invalidar resumen (forzar regeneración)
 */
export async function invalidateConversationSummary(tenantId, conversationId, reason = "manual") {
  // Eliminar de Redis
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    const cacheKey = getSummaryCacheKey(tenantId, conversationId);
    await redis.del(cacheKey);
  }

  // Limpiar en MongoDB (opcional, o dejar para referencia histórica)
  // await ConversationModel.findOneAndUpdate(
  //   { _id: conversationId, tenantId },
  //   { $unset: { summary: "", summaryGeneratedAt: "", lastSummaryMessageIndex: "" } }
  // );

  console.log(`[Summary] Resumen invalidado para conversación ${conversationId}: ${reason}`);
}

