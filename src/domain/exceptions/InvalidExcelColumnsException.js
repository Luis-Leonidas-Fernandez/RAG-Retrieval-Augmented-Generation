import { DomainException } from "./DomainException.js";

/**
 * Excepción lanzada cuando un archivo Excel no contiene las columnas obligatorias requeridas
 */
export class InvalidExcelColumnsException extends DomainException {
  constructor(missingColumns, foundColumns) {
    const missingColumnsText = missingColumns
      .map((col) => {
        // Obtener el nombre principal de la columna para mostrar
        const columnNames = {
          cliente: "Cliente",
          email: "Email",
          telefono: "Telefono",
        };
        return columnNames[col] || col;
      })
      .join(", ");

    const foundColumnsText = foundColumns.length > 0 
      ? foundColumns.join(", ")
      : "ninguna";

    const message = `El archivo Excel debe contener las siguientes columnas obligatorias: ${missingColumnsText}. Columnas encontradas: ${foundColumnsText}`;
    
    super(message);
    this.missingColumns = missingColumns;
    this.foundColumns = foundColumns;
  }
}

