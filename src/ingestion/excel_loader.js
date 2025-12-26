import path from "path";
import ExcelJS from "exceljs";
import { ExcelColumnValidator } from "../domain/services/ExcelColumnValidator.js";

/**
 * Determina si un archivo es Excel por mimetype o extensión.
 */
export function isExcelFile(mimeType, filename) {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") return true;

  if (!mimeType) return false;

  return (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12"
  );
}

/**
 * Carga un archivo Excel desde disco y lo convierte en chunks semánticos.
 * Cada fila se transforma en un texto estructurado + metadatos.
 *
 * @param {string} filePath Ruta absoluta al archivo Excel en disco
 * @param {string} sourceFile Nombre de archivo original (para metadata)
 * @returns {Promise<Array<{ text: string, metadata: object }>>}
 */
export async function loadExcelChunks(filePath, sourceFile) {
  console.log(`[ExcelLoader] 📊 Iniciando carga de Excel - archivo: ${sourceFile}, path: ${filePath}`);
  const startTime = Date.now();
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const loadTime = Date.now() - startTime;
  console.log(`[ExcelLoader] ✅ Archivo Excel cargado en ${loadTime}ms`);
  
  // Validar columnas en la primera hoja antes de procesar
  const firstWorksheet = workbook.worksheets[0];
  if (!firstWorksheet) {
    throw new Error("El archivo Excel no contiene hojas válidas");
  }

  // Extraer headers de la primera fila
  const headerRow = firstWorksheet.getRow(1);
  if (!headerRow) {
    throw new Error("El archivo Excel no contiene una fila de encabezados válida");
  }

  const headers = [];
  // Verificar que la fila tenga celdas antes de iterar
  if (headerRow.cellCount > 0) {
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value;
      if (value != null && value !== undefined) {
        headers.push(String(value));
      }
    });
  }

  // Validar que se encontraron headers antes de validar
  if (headers.length === 0) {
    throw new Error("El archivo Excel no contiene columnas en la primera fila. Asegúrate de que la primera fila contenga los encabezados: Cliente, Email, Telefono");
  }

  // Validar columnas usando el servicio de dominio
  console.log(`[ExcelLoader] 🔍 Validando columnas requeridas...`);
  console.log(`[ExcelLoader]   Headers encontrados: ${headers.join(", ")}`);
  
  try {
    ExcelColumnValidator.validate(headers);
    console.log(`[ExcelLoader] ✅ Validación de columnas exitosa`);
  } catch (error) {
    console.error(`[ExcelLoader] ❌ Error de validación: ${error.message}`);
    throw error; // Propagar la excepción
  }
  
  const chunks = [];
  let totalSheets = 0;
  let totalRows = 0;
  let skippedRows = 0;

  workbook.eachSheet((worksheet) => {
    totalSheets++;
    const sheetName = worksheet.name;
    let sheetRows = 0;
    console.log(`[ExcelLoader] 📄 Procesando hoja: "${sheetName}"`);

    // Flag para saltar la primera fila (header) solo en la primera hoja
    const isFirstSheet = totalSheets === 1;
    let isFirstRow = isFirstSheet;

    worksheet.eachRow((row, rowNumber) => {
      // Saltar la primera fila (header) en la primera hoja
      if (isFirstRow && rowNumber === 1) {
        isFirstRow = false;
        return;
      }
      totalRows++;
      // row.values es un array tipo [ , col1, col2, ... ]
      const cells = row.values
        .slice(1) // ignorar índice 0 vacío
        .map((value) => {
          // Manejar diferentes tipos de valores de ExcelJS para evitar [object Object]
          let raw = "";
          
          if (value == null || value === undefined) {
            raw = "";
          } else if (value instanceof Date) {
            // Formatear fechas como string legible (YYYY-MM-DD)
            raw = value.toISOString().split('T')[0];
          } else if (typeof value === 'object') {
            // Si es un objeto, intentar extraer valor útil
            if (value.text !== undefined) {
              raw = String(value.text);
            } else if (value.richText && Array.isArray(value.richText)) {
              raw = value.richText.map(rt => rt.text || '').join('');
            } else if (value.formula) {
              raw = String(value.formula);
            } else if (value.result !== undefined) {
              // Si tiene resultado calculado, usar ese
              raw = String(value.result);
            } else {
              // Último recurso: intentar JSON stringify para objetos simples
              try {
                const jsonStr = JSON.stringify(value);
                // Si el JSON es muy largo o parece un objeto complejo, usar toString
                if (jsonStr.length > 100 || jsonStr.startsWith('{')) {
                  raw = String(value);
                } else {
                  raw = jsonStr;
                }
              } catch {
                raw = String(value);
              }
            }
          } else {
            raw = String(value);
          }
          
          return raw.trim();
        })
        .filter(cell => cell !== ""); // Filtrar celdas vacías

      if (cells.length === 0) {
        skippedRows++;
        if (rowNumber <= 3) {
          console.log(`[ExcelLoader]   ⏭️  Fila ${rowNumber} vacía, omitida`);
        }
        return;
      }

      // Formato con pipes para que coincida con el parser: | col1 | col2 | col3 | col4 |
      const text = `| ${cells.join(" | ")} |`;
      sheetRows++;

      chunks.push({
        text,
        metadata: {
          rowIndex: rowNumber,
          sheetName,
          sourceFile,
        },
      });
      
      // Log de las primeras 3 filas procesadas
      if (chunks.length <= 3) {
        console.log(`[ExcelLoader]   📝 Chunk ${chunks.length} (fila ${rowNumber}):`);
        console.log(`[ExcelLoader]     - Texto: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        console.log(`[ExcelLoader]     - Celdas: ${cells.length}`);
        console.log(`[ExcelLoader]     - Hoja: ${sheetName}`);
      }
    });
    
    console.log(`[ExcelLoader]   ✅ Hoja "${sheetName}" procesada - ${sheetRows} filas convertidas a chunks`);
  });

  const processTime = Date.now() - startTime;
  console.log(`[ExcelLoader] 📊 Resumen de procesamiento:`);
  console.log(`[ExcelLoader]   - Total hojas: ${totalSheets}`);
  console.log(`[ExcelLoader]   - Total filas procesadas: ${totalRows}`);
  console.log(`[ExcelLoader]   - Filas omitidas (vacías): ${skippedRows}`);
  console.log(`[ExcelLoader]   - Chunks generados: ${chunks.length}`);
  console.log(`[ExcelLoader]   - Tiempo total: ${processTime}ms`);
  
  if (chunks.length === 0) {
    console.warn(`[ExcelLoader] ⚠️  ADVERTENCIA: No se generaron chunks del archivo Excel`);
  }

  return chunks;
}


