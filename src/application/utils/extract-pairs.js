import { normalizeName } from "./text-utils.js";

/**
 * Regex que detecta formato de tabla: "| Nombre | email@dominio.com |"
 * Captura grupos:
 * - Grupo 1: Nombre (entre pipes, puede tener espacios)
 * - Grupo 2: Email (formato email@dominio.com)
 */
const PAIR_REGEX = /\|\s*([^|]+?)\s*\|\s*([^\s|]+@[^\s|]+)\s*\|/g;

/**
 * Extrae pares nombre-email del contenido del chunk
 * Busca formato de tabla: | Nombre | email@dominio.com |
 * 
 * @param {string} text - Texto del chunk donde buscar pares
 * @returns {Array<{name: string, email: string, normalized: string}>} Array de pares encontrados
 */
export function extractNameEmailPairs(text) {
  if (!text || typeof text !== "string") {
    return [];
  }
  
  const results = [];
  let match;
  
  // Reiniciar el regex para múltiples búsquedas
  PAIR_REGEX.lastIndex = 0;
  
  while ((match = PAIR_REGEX.exec(text)) !== null) {
    const name = match[1].trim();
    const email = match[2].trim();
    
    // Validar que el email tenga formato válido básico
    if (email.includes("@") && email.includes(".")) {
      results.push({
        name,
        email,
        normalized: normalizeName(name),
      });
    }
  }
  
  return results;
}

/**
 * Regex que detecta formato de tabla con 3 columnas: "| Nombre | Email | Vehículo |"
 * Captura grupos:
 * - Grupo 1: Nombre (entre pipes, puede tener espacios)
 * - Grupo 2: Email (formato email@dominio.com o cualquier texto)
 * - Grupo 3: Vehículo (cualquier texto)
 */
const TRIPLE_REGEX = /\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/g;

/**
 * Extrae tripletes nombre-email-vehículo del contenido del chunk
 * Busca formato de tabla tipo: | CLIENTE | EMAIL | COMPRO_VEHICULO | TELEFONO |
 *
 * NOTA: Para evitar filas desordenadas cuando hay más de 3 columnas,
 * filtramos explícitamente:
 *  - Saltamos la fila de cabecera (CLIENTE | EMAIL | ...)
 *  - Exigimos que el segundo campo "parezca" un email real (contenga @ y .)
 *
 * @param {string} text - Texto del chunk donde buscar tripletes
 * @returns {Array<{name: string, email: string, vehicle: string, normalized: {name: string, vehicle: string}}>} Array de tripletes encontrados
 */
export function extractNameEmailVehiclePairs(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const results = [];
  let match;

  // Reiniciar el regex para múltiples búsquedas
  TRIPLE_REGEX.lastIndex = 0;

  while ((match = TRIPLE_REGEX.exec(text)) !== null) {
    const name = match[1].trim();
    const email = match[2].trim();
    const vehicle = match[3].trim();

    // 1) Saltar la fila de cabecera tipo: | CLIENTE | EMAIL | COMPRO_VEHICULO |
    const isHeaderRow =
      name &&
      email &&
      ["cliente", "nombre", "name"].includes(name.toLowerCase()) &&
      ["email", "correo", "correo electrónico", "correo electronico"].includes(
        email.toLowerCase()
      );

    if (isHeaderRow) {
      continue;
    }

    // 2) El segundo campo DEBE parecer un email real
    const looksLikeEmail = email.includes("@") && email.includes(".");
    if (!looksLikeEmail) {
      continue;
    }

    // 3) Validación final: nombre + email válidos
    if (name && email) {
      results.push({
        name,
        email,
        vehicle,
        normalized: {
          name: normalizeName(name),
          vehicle: normalizeName(vehicle),
        },
      });
    }
  }

  return results;
}

