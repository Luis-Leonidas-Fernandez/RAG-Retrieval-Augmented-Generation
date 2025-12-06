import { extractNameEmailPairs, extractNameEmailVehiclePairs } from "../../utils/extract-pairs.js";

/**
 * Caso de uso para extraer datos estructurados de chunks de un PDF
 * Extrae información como nombres, emails y vehículos de todos los chunks del PDF
 */
export class ExtractStructuredDataUseCase {
  constructor(chunkRepository) {
    this.chunkRepository = chunkRepository;
    // Límite configurable via variable de entorno (por defecto: 10,000)
    this.maxRows = parseInt(process.env.RAG_EXPORT_MAX_ROWS || "10000", 10);
  }

  /**
   * Ejecuta la extracción de datos estructurados
   * @param {string} tenantId - ID del tenant
   * @param {string} pdfId - ID del PDF
   * @param {string} question - Pregunta del usuario (para determinar qué tipo de datos extraer)
   * @returns {Promise<Array<Object>>} Array de objetos con datos estructurados
   */
  async execute(tenantId, pdfId, question = "") {
    console.log(`[ExtractStructuredData] Iniciando extracción para tenantId: ${tenantId}, pdfId: ${pdfId}`);

    // Buscar TODOS los chunks del PDF en MongoDB
    const chunks = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
      sort: { index: 1 },
      select: "content index page",
    });

    console.log(`[ExtractStructuredData] Encontrados ${chunks.length} chunks para procesar`);

    if (!chunks || chunks.length === 0) {
      console.log(`[ExtractStructuredData] No se encontraron chunks`);
      return [];
    }

    // Extraer datos estructurados de todos los chunks
    const structuredData = [];

    for (const chunk of chunks) {
      if (!chunk.content || typeof chunk.content !== "string") {
        continue;
      }

      // Intentar extraer tripletes nombre-email-vehículo primero (más completo)
      const triplets = extractNameEmailVehiclePairs(chunk.content);
      if (triplets && triplets.length > 0) {
        // Agregar todas las ocurrencias encontradas
        for (const triplet of triplets) {
          structuredData.push({
            name: triplet.name,
            email: triplet.email,
            vehicle: triplet.vehicle || "",
          });
        }
      } else {
        // Si no hay tripletes, intentar extraer pares nombre-email
        const pairs = extractNameEmailPairs(chunk.content);
        if (pairs && pairs.length > 0) {
          for (const pair of pairs) {
            structuredData.push({
              name: pair.name,
              email: pair.email,
            });
          }
        }
      }

      // Verificar si se alcanzó el límite máximo
      if (structuredData.length >= this.maxRows) {
        console.log(`[ExtractStructuredData] Límite máximo alcanzado (${this.maxRows} registros), truncando resultados`);
        break;
      }
    }

    // Truncar si excede el límite
    const finalData = structuredData.slice(0, this.maxRows);

    console.log(`[ExtractStructuredData] Extracción completada: ${finalData.length} registros encontrados`);

    // Retornar TODAS las ocurrencias, sin filtrar duplicados
    return finalData;
  }
}

