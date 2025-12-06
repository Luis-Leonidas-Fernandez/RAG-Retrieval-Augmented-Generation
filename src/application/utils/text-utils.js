/**
 * Utilidades de normalización de texto para comparación de nombres
 */

/**
 * Normaliza texto para comparar nombres
 * - Quita tildes con NFD
 * - Elimina símbolos
 * - Colapsa espacios múltiples
 * - Convierte a minúsculas
 * 
 * @param {string} name - Nombre a normalizar
 * @returns {string} Nombre normalizado
 */
export function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-zA-Z0-9 ]/g, "") // quita símbolos
    .replace(/\s+/g, " ") // colapsa espacios
    .trim()
    .toLowerCase();
}

/**
 * Genera regex flexible para buscar un nombre dentro del chunk
 * - Escapa caracteres especiales de regex
 * - Convierte espacios a .* para coincidencia parcial
 * - Retorna RegExp case-insensitive
 * 
 * @param {string} name - Nombre para construir el regex
 * @returns {RegExp} Expresión regular para búsqueda flexible
 */
export function buildFlexibleNameRegex(name) {
  if (!name || typeof name !== "string") {
    return /^$/; // Regex que no coincide con nada
  }
  
  // Escapar caracteres especiales de regex
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  // Convertir espacios múltiples a .* para coincidencia parcial
  const pattern = escaped.replace(/\s+/g, ".*");
  
  return new RegExp(pattern, "i");
}

