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

    const structuredData = [];

    // 1) Intentar primero parsear la tabla completa uniendo todos los chunks (4 columnas)
    const fullText = chunks
      .filter((chunk) => chunk.content && typeof chunk.content === "string")
      .map((chunk) => chunk.content)
      .join("\n");

    if (fullText) {
      // Filas tipo: | CLIENTE | EMAIL | COMPRO_VEHICULO | TELEFONO |
      const rowRegex =
        /^\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/gm;
      let match;

      while ((match = rowRegex.exec(fullText)) !== null) {
        const col1 = match[1].trim(); // CLIENTE / NOMBRE
        const col2 = match[2].trim(); // EMAIL
        const col3 = match[3].trim(); // COMPRO_VEHICULO
        const col4 = match[4].trim(); // TELEFONO

        // Saltar cabecera
        const isHeaderRow =
          col1 &&
          col2 &&
          ["cliente", "nombre", "name"].includes(col1.toLowerCase()) &&
          [
            "email",
            "correo",
            "correo electrónico",
            "correo electronico",
          ].includes(col2.toLowerCase());

        if (isHeaderRow) {
          continue;
        }

        // El segundo campo debe parecer un email real
        const looksLikeEmail = col2.includes("@") && col2.includes(".");
        if (!looksLikeEmail) {
          continue;
        }

        structuredData.push({
          name: col1,
          email: col2,
          vehicle: col3,
          phone: col4,
        });

        if (structuredData.length >= this.maxRows) {
          console.log(
            `[ExtractStructuredData] Límite máximo alcanzado (${this.maxRows} registros) en parser de 4 columnas, truncando resultados`
          );
          break;
        }
      }
    }

    // 2) Fallback al comportamiento anterior si no se encontró nada con el parser de 4 columnas
    if (structuredData.length === 0) {
      console.log(
        "[ExtractStructuredData] Parser de 4 columnas no encontró registros, usando extracción por chunk (tripletes y pares)"
      );

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
              phone: triplet.phone || "",
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
                vehicle: "",
                phone: "",
              });
            }
          }
        }

        // Verificar si se alcanzó el límite máximo
        if (structuredData.length >= this.maxRows) {
          console.log(
            `[ExtractStructuredData] Límite máximo alcanzado (${this.maxRows} registros) en extracción por chunk, truncando resultados`
          );
          break;
        }
      }
    }

    // Truncar si excede el límite
    const finalData = structuredData.slice(0, this.maxRows);

    console.log(
      `[ExtractStructuredData] Extracción completada: ${finalData.length} registros encontrados`
    );

    return finalData;
  }
}

