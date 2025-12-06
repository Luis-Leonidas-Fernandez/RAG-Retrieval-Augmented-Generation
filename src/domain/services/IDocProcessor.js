/**
 * Interface para servicio de procesamiento de documentos
 * Define el contrato que deben cumplir las implementaciones
 */
export class IDocProcessor {
  /**
   * Procesa un documento y extrae texto limpio, markdown, TOC y metadata
   * @param {string} docPath - Ruta absoluta al archivo documento
   * @returns {Promise<{
   *   cleaned_text: string,
   *   markdown: string | null,
   *   toc: string | null,
   *   metadata: {
   *     total_pages: number,
   *     title: string | null,
   *     author: string | null
   *   }
   * }>}
   */
  async processPdf(docPath) {
    throw new Error("Method not implemented");
  }
}

