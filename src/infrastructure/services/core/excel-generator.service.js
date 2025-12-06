import ExcelJS from "exceljs";

/**
 * Servicio para generar archivos XLSX con columnas dinámicas
 * Detecta automáticamente todas las propiedades únicas de los objetos y crea columnas para cada una
 */
export class ExcelGeneratorService {
  /**
   * Genera un archivo XLSX desde un array de objetos
   * @param {Array<Object>} data - Array de objetos con datos estructurados
   * @returns {Promise<Buffer>} Buffer del archivo XLSX
   */
  async generate(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Los datos deben ser un array no vacío");
    }

    console.log(`[ExcelGenerator] Generando XLSX con ${data.length} filas`);

    // Crear nuevo workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Datos");

    // Detectar TODAS las columnas posibles analizando todas las filas
    const allColumns = new Set();
    
    for (const row of data) {
      if (row && typeof row === "object") {
        Object.keys(row).forEach((key) => {
          allColumns.add(key);
        });
      }
    }

    // Convertir Set a Array y ordenar alfabéticamente (opcional, puede cambiarse)
    const columns = Array.from(allColumns).sort();

    console.log(`[ExcelGenerator] Columnas detectadas: ${columns.join(", ")}`);

    // Crear encabezados
    const headers = columns.map((col) => this.formatColumnName(col));
    worksheet.addRow(headers);

    // Estilizar encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    // Agregar datos
    for (const row of data) {
      const rowData = columns.map((col) => {
        const value = row[col];
        
        // Manejar valores null/undefined
        if (value === null || value === undefined) {
          return "";
        }
        
        // Mantener el tipo de dato original
        return value;
      });
      
      worksheet.addRow(rowData);
    }

    // Ajustar ancho de columnas automáticamente
    columns.forEach((col, index) => {
      let maxLength = headers[index].length;
      
      // Encontrar la longitud máxima del contenido en esta columna
      for (const row of data) {
        const value = row[col];
        if (value !== null && value !== undefined) {
          const cellValue = String(value);
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
          }
        }
      }
      
      // Establecer ancho (mínimo 10, máximo 50)
      const columnWidth = Math.min(Math.max(maxLength + 2, 10), 50);
      worksheet.getColumn(index + 1).width = columnWidth;
    });

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();

    console.log(`[ExcelGenerator] XLSX generado exitosamente (${buffer.length} bytes)`);

    return Buffer.from(buffer);
  }

  /**
   * Formatea el nombre de una columna para mostrarlo en el Excel
   * Capitaliza y formatea nombres de propiedades
   * @param {string} columnName - Nombre de la propiedad (ej: "name", "email", "vehicle")
   * @returns {string} Nombre formateado (ej: "Name", "Email", "Vehicle")
   */
  formatColumnName(columnName) {
    if (!columnName || typeof columnName !== "string") {
      return "";
    }

    // Capitalizar primera letra
    return columnName.charAt(0).toUpperCase() + columnName.slice(1);
  }
}

