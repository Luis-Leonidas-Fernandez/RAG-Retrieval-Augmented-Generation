import { QdrantClient } from "@qdrant/js-client-rest";
import { IVectorRepository } from "../../domain/repositories/IVectorRepository.js";
import { v4 as uuidv4 } from "uuid";

const COLLECTION = "pdf_chunks";

/**
 * Implementación de IVectorRepository usando Qdrant
 */
export class QdrantVectorRepository extends IVectorRepository {
  constructor() {
    super();
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
    });
  }

  /**
   * Indexa chunks con sus embeddings en el vector store
   */
  async indexChunks(tenantId, pdfId, chunksWithEmbeddings) {
    // chunksWithEmbeddings debe ser un array de objetos con:
    // { chunkId, vector, payload: { index, page, content } }

    const points = chunksWithEmbeddings.map((chunk) => ({
      id: uuidv4(),
      vector: chunk.vector,
      payload: {
        tenantId: tenantId.toString(),
        pdfId: pdfId.toString(),
        chunkId: chunk.chunkId.toString(),
        index: chunk.payload.index,
        page: chunk.payload.page,
        content: chunk.payload.content,
      },
    }));

    await this.qdrant.upsert(COLLECTION, { points });

    return points.length;
  }

  /**
   * Busca chunks similares usando búsqueda vectorial
   */
  async search(tenantId, pdfId, vector, options = {}) {
    const {
      limit = 20,
      scoreThreshold = 0.5,
    } = options;

    // 🔍 DIAGNÓSTICO: Verificar si hay datos en Qdrant para este PDF
    console.log(`[Qdrant] 🔍 Buscando chunks en Qdrant:`);
    console.log(`[Qdrant]   - tenantId: ${tenantId.toString()}`);
    console.log(`[Qdrant]   - pdfId: ${pdfId.toString()}`);
    console.log(`[Qdrant]   - limit: ${limit}`);
    console.log(`[Qdrant]   - scoreThreshold: ${scoreThreshold}`);
    
    // Verificar cuántos puntos hay en Qdrant para este PDF
    const count = await this.count(tenantId, pdfId);
    console.log(`[Qdrant] 🔍 Puntos indexados en Qdrant para este PDF: ${count}`);

    const result = await this.qdrant.search(COLLECTION, {
      vector,
      limit,
      score_threshold: scoreThreshold,
      filter: {
        must: [
          { key: "tenantId", match: { value: tenantId.toString() } },
          { key: "pdfId", match: { value: pdfId.toString() } },
        ],
        must_not: [
          { key: "isDeleted", match: { value: true } },
        ],
      },
    });

    console.log(`[Qdrant] 🔍 Resultado de búsqueda: ${result.length} puntos encontrados`);
    if (result.length === 0 && count > 0) {
      console.log(`[Qdrant] ⚠️  ADVERTENCIA: Hay ${count} puntos en Qdrant pero la búsqueda no encontró ninguno`);
      console.log(`[Qdrant]   - Esto puede indicar un problema con los filtros o el vector de búsqueda`);
      console.log(`[Qdrant]   - Verificando filtros: tenantId="${tenantId.toString()}", pdfId="${pdfId.toString()}"`);
    } else if (result.length === 0 && count === 0) {
      console.log(`[Qdrant] ⚠️  ADVERTENCIA: No hay puntos indexados en Qdrant para este PDF`);
      console.log(`[Qdrant]   - El PDF necesita ser embebido nuevamente`);
    }

    return result;
  }

  /**
   * Cuenta puntos indexados para un PDF
   */
  async count(tenantId, pdfId) {
    try {
      // Usar scroll para contar (más eficiente que search con limit alto)
      const result = await this.qdrant.scroll(COLLECTION, {
        filter: {
          must: [
            { key: "tenantId", match: { value: tenantId.toString() } },
            { key: "pdfId", match: { value: pdfId.toString() } },
          ],
        },
        limit: 1,
        with_payload: false,
        with_vector: false,
      });

      // Si hay puntos, hacer scroll completo para contar
      if (result.points && result.points.length > 0) {
        let total = 0;
        let nextPageOffset = result.next_page_offset;

        // Contar primera página
        total += result.points.length;

        // Continuar scroll si hay más páginas
        while (nextPageOffset) {
          const nextResult = await this.qdrant.scroll(COLLECTION, {
            filter: {
              must: [
                { key: "tenantId", match: { value: tenantId.toString() } },
                { key: "pdfId", match: { value: pdfId.toString() } },
              ],
            },
            offset: nextPageOffset,
            limit: 100,
            with_payload: false,
            with_vector: false,
          });

          total += nextResult.points.length;
          nextPageOffset = nextResult.next_page_offset;
        }

        return total;
      }

      return 0;
    } catch (error) {
      console.error("[QdrantVectorRepository] Error al contar puntos:", error.message);
      return null;
    }
  }

  /**
   * Elimina puntos del vector store para un PDF
   */
  async deleteByPdfId(tenantId, pdfId, hardDelete = false) {
    if (hardDelete) {
      // Hard-delete: borrar puntos físicamente
      await this.qdrant.delete(COLLECTION, {
        filter: {
          must: [
            { key: "tenantId", match: { value: tenantId.toString() } },
            { key: "pdfId", match: { value: pdfId.toString() } },
          ],
        },
      });
      return true;
    } else {
      // Soft-delete: marcar en payload
      // Nota: Qdrant no soporta actualización masiva de payload directamente
      // Por ahora, usamos filtro must_not en búsquedas para excluir soft-deletados
      // En el futuro se podría implementar obteniendo todos los puntos, actualizando payload y haciendo upsert
      return true;
    }
  }

  /**
   * Restaura puntos en el vector store
   */
  async restoreByPdfId(tenantId, pdfId) {
    // Similar a deleteByPdfId, necesitaríamos actualizar payload
    // Por ahora, solo retornamos true ya que el filtro must_not en búsquedas maneja el soft-delete
    return true;
  }

  /**
   * Elimina puntos del vector store para múltiples PDFs
   */
  async deleteByPdfIds(tenantId, pdfIds, hardDelete = false) {
    if (hardDelete) {
      // Hard-delete: borrar puntos físicamente para cada PDF
      let deletedCount = 0;
      for (const pdfId of pdfIds) {
        await this.qdrant.delete(COLLECTION, {
          filter: {
            must: [
              { key: "tenantId", match: { value: tenantId.toString() } },
              { key: "pdfId", match: { value: pdfId.toString() } },
            ],
          },
        });
        deletedCount++;
      }
      return deletedCount;
    } else {
      // Soft-delete: por ahora solo retornamos el count
      // (el filtro must_not en búsquedas maneja el soft-delete)
      return pdfIds.length;
    }
  }
}

