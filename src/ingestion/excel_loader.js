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
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const chunks = [];

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;

    worksheet.eachRow((row, rowNumber) => {
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
        return;
      }

      const text = cells.join(" | ");

      chunks.push({
        text,
        metadata: {
          rowIndex: rowNumber,
          sheetName,
          sourceFile,
        },
      });
    });
  });

  return chunks;
}


