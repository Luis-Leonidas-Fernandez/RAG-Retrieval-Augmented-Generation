import { InvalidExcelColumnsException } from "../exceptions/InvalidExcelColumnsException.js";

/**
 * Servicio de dominio para validar columnas requeridas en archivos Excel
 * Sigue principios de arquitectura limpia: lógica de negocio pura sin dependencias de infraestructura
 */
export class ExcelColumnValidator {
  /**
   * Definición de columnas obligatorias con sus variaciones aceptadas
   */
  static REQUIRED_COLUMNS = {
    cliente: ["cliente", "clientes", "nombre", "nombres", "name"],
    email: ["email", "emails", "correo", "correos", "e-mail", "mail"],
    telefono: ["telefono", "teléfono", "telefonos", "teléfonos", "phone", "phones", "celular", "celulares"],
  };

  /**
   * Definición de columnas opcionales con sus variaciones aceptadas
   */
  static OPTIONAL_COLUMNS = {
    producto: ["producto", "productos", "vehiculo", "vehículo", "vehiculos", "vehículos", "vehicle", "vehicles"],
  };

  /**
   * Normaliza un header (minúsculas, sin espacios, sin acentos opcionales)
   * @param {string} header - Header a normalizar
   * @returns {string} Header normalizado
   */
  static normalizeHeader(header) {
    if (!header || typeof header !== "string") {
      return "";
    }
    return header
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ""); // Eliminar espacios
  }

  /**
   * Verifica si un header coincide con alguna de las variaciones de una columna
   * @param {string} header - Header normalizado a verificar
   * @param {string[]} variations - Array de variaciones aceptadas
   * @returns {boolean} True si coincide
   */
  static matchesColumn(header, variations) {
    return variations.some(
      (variation) =>
        header === variation ||
        header.includes(variation) ||
        variation.includes(header)
    );
  }

  /**
   * Valida que los headers contengan todas las columnas obligatorias
   * @param {string[]} headers - Array de headers del Excel
   * @throws {InvalidExcelColumnsException} Si faltan columnas obligatorias
   */
  static validate(headers) {
    if (!Array.isArray(headers) || headers.length === 0) {
      throw new InvalidExcelColumnsException(
        Object.keys(this.REQUIRED_COLUMNS),
        []
      );
    }

    // Normalizar todos los headers
    const normalizedHeaders = headers
      .map((h) => this.normalizeHeader(String(h)))
      .filter((h) => h.length > 0); // Filtrar headers vacíos

    if (normalizedHeaders.length === 0) {
      throw new InvalidExcelColumnsException(
        Object.keys(this.REQUIRED_COLUMNS),
        []
      );
    }

    // Verificar cada columna obligatoria
    const foundColumns = [];
    const missingColumns = [];

    for (const [columnKey, variations] of Object.entries(
      this.REQUIRED_COLUMNS
    )) {
      const found = normalizedHeaders.some((header) =>
        this.matchesColumn(header, variations)
      );

      if (found) {
        foundColumns.push(columnKey);
      } else {
        missingColumns.push(columnKey);
      }
    }

    // Si faltan columnas obligatorias, lanzar excepción
    if (missingColumns.length > 0) {
      throw new InvalidExcelColumnsException(
        missingColumns,
        normalizedHeaders
      );
    }

    // Validación exitosa - retornar información útil (opcional, para logging)
    return {
      valid: true,
      foundColumns,
      foundHeaders: normalizedHeaders,
    };
  }
}

