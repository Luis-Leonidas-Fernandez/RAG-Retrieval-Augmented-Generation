import path from "path";
import ExcelJS from "exceljs";

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
  
  const chunks = [];
  let totalSheets = 0;
  let totalRows = 0;
  let skippedRows = 0;

  workbook.eachSheet((worksheet) => {
    totalSheets++;
    const sheetName = worksheet.name;
    let sheetRows = 0;
    console.log(`[ExcelLoader] 📄 Procesando hoja: "${sheetName}"`);

    worksheet.eachRow((row, rowNumber) => {
      totalRows++;
      // row.values es un array tipo [ , col1, col2, ... ]
      const cells = row.values
        .slice(1) // ignorar índice 0 vacío
        .map((value, index) => {
          const raw = value == null ? "" : String(value).trim();
          if (!raw) return null;
          // Etiquetamos genéricamente; si conoces nombres de columnas puedes mapearlos aquí
          return `col${index + 1}: ${raw}`;
        })
        .filter(Boolean);

      if (cells.length === 0) {
        skippedRows++;
        if (rowNumber <= 3) {
          console.log(`[ExcelLoader]   ⏭️  Fila ${rowNumber} vacía, omitida`);
        }
        return;
      }

      const text = cells.join(" | ");
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


