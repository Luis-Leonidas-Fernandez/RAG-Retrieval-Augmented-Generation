/**
 * Utilidades para estimación y manejo de tokens
 */

/**
 * Estimar tokens aproximados de un texto
 * Aproximación: 1 token ≈ 4 caracteres
 */
export function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncar texto a un máximo de tokens
 */
export function truncateToTokens(text, maxTokens) {
  if (!text || typeof text !== "string") return "";
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars);
}

/**
 * Formatear mensajes para OpenAI API
 */
export function formatMessages(messages) {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Truncar array de mensajes equitativamente para que no exceda maxTokens
 */
export function truncateMessages(messages, maxTokens) {
  if (!messages || messages.length === 0) return [];
  
  const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content || ""), 0);
  if (totalTokens <= maxTokens) return messages;

  // Calcular factor de reducción
  const reductionFactor = maxTokens / totalTokens;
  const truncated = messages.map((msg) => ({
    ...msg,
    content: truncateToTokens(msg.content, Math.floor(estimateTokens(msg.content) * reductionFactor)),
  }));

  return truncated;
}

/**
 * Calcular costo en USD basado en tokens y modelo
 */
export function calculateTokenCost(promptTokens, completionTokens, model = "gpt-4o-mini") {
  // Precios por modelo (actualizar según tarifas actuales de OpenAI)
  const PRICING = {
    "gpt-4o-mini": {
      input: 0.15 / 1000000, // $0.15 por 1M tokens input
      output: 0.6 / 1000000, // $0.60 por 1M tokens output
    },
    "gpt-4o": {
      input: 2.5 / 1000000, // $2.50 por 1M tokens input
      output: 10.0 / 1000000, // $10.00 por 1M tokens output
    },
  };

  const pricing = PRICING[model] || PRICING["gpt-4o-mini"];
  const inputCost = promptTokens * pricing.input;
  const outputCost = completionTokens * pricing.output;

  return inputCost + outputCost;
}

