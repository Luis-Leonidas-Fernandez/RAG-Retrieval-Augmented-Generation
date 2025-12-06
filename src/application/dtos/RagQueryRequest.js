/**
 * DTO para request de consulta RAG
 */
export class RagQueryRequest {
  /**
   * @param {Object} data - Datos del request
   * @param {string|ObjectId} data.tenantId - ID del tenant
   * @param {string|ObjectId} data.userId - ID del usuario
   * @param {string|ObjectId} data.pdfId - ID del PDF
   * @param {string} data.question - Pregunta del usuario
   * @param {string|ObjectId|null} data.conversationId - ID de conversación existente (opcional)
   * @param {Object} data.tenantSettings - Configuraciones del tenant (ragLimits, llmModel, etc.)
   */
  constructor(data) {
    this.tenantId = data.tenantId;
    this.userId = data.userId;
    this.pdfId = data.pdfId;
    this.question = data.question;
    this.conversationId = data.conversationId || null;
    this.tenantSettings = data.tenantSettings || {};
  }
}

