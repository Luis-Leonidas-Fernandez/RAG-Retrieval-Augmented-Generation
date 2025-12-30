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
   * Limpia un valor de columna, removiendo pipes adicionales y datos concatenados
   * @param {string} value - Valor a limpiar
   * @returns {string} Valor limpio
   */
  cleanColumnValue(value) {
    if (!value) return '';
    let cleaned = String(value).trim();
    
    // Si el valor contiene pipes, probablemente es un error de parsing
    // Tomar solo la primera parte antes del primer pipe adicional
    if (cleaned.includes('|')) {
      const parts = cleaned.split('|').map(p => p.trim()).filter(p => p);
      // Si hay múltiples partes separadas por pipes, tomar solo la primera
      if (parts.length > 1) {
        cleaned = parts[0];
      } else {
        // Si solo hay una parte pero contiene el pipe, removerlo
        cleaned = cleaned.replace(/\|/g, '').trim();
      }
    }
    
    return cleaned;
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

    console.log(`[ExtractStructuredData] Longitud del texto completo: ${fullText.length} caracteres`);
    console.log(`[ExtractStructuredData] Primeros 500 caracteres del texto:`, fullText.substring(0, 500));

    if (fullText) {
      // Filas tipo: | CLIENTE | EMAIL | COMPRO_VEHICULO | TELEFONO |
      // Regex mejorado: usa [^|] en lugar de .*? para evitar capturar pipes dentro de las columnas
      const rowRegex =
        /^\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm;
      let match;
      let matchCount = 0;

      while ((match = rowRegex.exec(fullText)) !== null) {
        matchCount++;
        // Limpiar cada columna para evitar datos concatenados
        const col1 = this.cleanColumnValue(match[1]); // CLIENTE / NOMBRE
        const col2 = this.cleanColumnValue(match[2]); // EMAIL
        const col3 = this.cleanColumnValue(match[3]); // COMPRO_VEHICULO
        const col4 = this.cleanColumnValue(match[4]); // TELEFONO

        // Log de las primeras 3 filas encontradas
        if (matchCount <= 3) {
          console.log(`[ExtractStructuredData] Fila ${matchCount} encontrada:`, { col1, col2, col3, col4 });
        }

        // Validar que las columnas no estén vacías después de limpiar
        if (!col1 || !col2) {
          if (matchCount <= 5) {
            console.log(`[ExtractStructuredData] Fila ${matchCount} omitida: col1 o col2 vacías después de limpiar`);
          }
          continue;
        }

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
          console.log(`[ExtractStructuredData] Fila ${matchCount} es cabecera, omitida`);
          continue;
        }

        // El segundo campo debe parecer un email real
        const looksLikeEmail = col2.includes("@") && col2.includes(".");
        if (!looksLikeEmail) {
          if (matchCount <= 5) {
            console.log(`[ExtractStructuredData] Fila ${matchCount} omitida: col2 no parece email: "${col2}"`);
          }
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

      console.log(`[ExtractStructuredData] Total de matches del regex: ${matchCount}, registros válidos: ${structuredData.length}`);
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
              name: this.cleanColumnValue(triplet.name),
              email: this.cleanColumnValue(triplet.email),
              vehicle: this.cleanColumnValue(triplet.vehicle || ""),
              phone: this.cleanColumnValue(triplet.phone || ""),
            });
          }
        } else {
          // Si no hay tripletes, intentar extraer pares nombre-email
          const pairs = extractNameEmailPairs(chunk.content);
          if (pairs && pairs.length > 0) {
            for (const pair of pairs) {
              structuredData.push({
                name: this.cleanColumnValue(pair.name),
                email: this.cleanColumnValue(pair.email),
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

