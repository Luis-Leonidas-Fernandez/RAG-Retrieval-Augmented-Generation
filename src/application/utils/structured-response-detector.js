/**
 * Detecta si una pregunta requiere respuesta estructurada (lista/tabla)
 * @param {string} question - La pregunta del usuario
 * @returns {boolean} true si requiere respuesta estructurada
 */
export function needsStructuredResponse(question) {
  if (!question || typeof question !== 'string') {
    return false;
  }
  
  const q = question.toLowerCase().trim();
  
  // Lista de plurales comunes que indican múltiples elementos
  const plurales = [
    'nombres', 'clientes', 'emails', 'registros', 'resultados',
    'personas', 'vehículos', 'vehiculos', 'contactos', 'datos',
    'elementos', 'items', 'entradas', 'filas', 'renglones'
  ];
  
  // Detectar si usa plural
  const tienePlural = plurales.some(plural => {
    // Buscar el plural como palabra completa
    const regex = new RegExp(`\\b${plural}\\b`, 'i');
    return regex.test(q);
  });
  
  // Palabras clave que indican lista/tabla
  const palabrasClave = [
    'lista', 'listame', 'listar',
    'mostrame todos', 'muéstrame todos', 'muéstrame la tabla', 'muestrame la tabla',
    'cuáles son', 'cuales son', 'cuáles son los', 'cuales son los', 'cuáles son las', 'cuales son las',
    'top 10', 'top 5', 'los más', 'las más',
    'los más frecuentes', 'los que más se repiten', 'que más se repiten',
    'tabla de', 'tabla con',
    'dame todos', 'dame todas'
  ];
  
  // Detectar palabras clave
  const tienePalabraClave = palabrasClave.some(keyword => {
    return q.includes(keyword);
  });
  
  return tienePlural || tienePalabraClave;
}

