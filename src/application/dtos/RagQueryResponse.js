/**
 * DTO para response de consulta RAG
 */
export class RagQueryResponse {
  /**
   * @param {Object} data - Datos de la respuesta
   * @param {string} data.answer - Respuesta generada por el LLM
   * @param {Array} data.context - Chunks usados como contexto
   * @param {string|null} data.conversationId - ID de la conversación
   * @param {Object} data.tokens - Uso de tokens {prompt_tokens, completion_tokens, total_tokens}
   * @param {Array|null} data.structuredData - Datos estructurados para visualización (primeras N filas)
   * @param {Array|null} data.structuredDataFull - Datos completos para Excel (SOLO USO INTERNO, NO se expone en HTTP)
   * @param {number} data.totalRows - Total de filas encontradas
   * @param {string} data.dataType - Tipo de datos ('list', 'table', 'text')
   * @param {string|null} data.exportId - ID para descargar XLSX
   */
  constructor(data) {
    this.answer = data.answer;
    this.context = data.context || [];
    this.conversationId = data.conversationId || null;
    this.tokens = data.tokens || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    
    // Nuevos campos para datos estructurados
    this.structuredData = data.structuredData || null; // Primeras N filas para visualización
    this.structuredDataFull = data.structuredDataFull || null; // Todos los datos para Excel (hasta límite configurable en `RAG_EXPORT_MAX_ROWS`) - **SOLO USO INTERNO, NO se expone en HTTP**
    this.totalRows = data.totalRows || 0; // Total de filas encontradas
    this.dataType = data.dataType || 'text';
    this.exportId = data.exportId || null;
  }
}

