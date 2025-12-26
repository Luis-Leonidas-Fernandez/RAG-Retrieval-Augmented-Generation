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

/**
 * Detecta si una pregunta solicita clientes para campañas
 * @param {string} question - La pregunta del usuario
 * @returns {Object} { isCampaign: boolean, channel: 'EMAIL' | 'WHATSAPP' | null }
 */
export function isCampaignRequest(question) {
  if (!question || typeof question !== 'string') {
    return { isCampaign: false, channel: null };
  }
  
  const q = question.toLowerCase().trim();
  
  // Keywords para email
  const emailKeywords = ['email', 'correo', 'campaña.*email', 'email.*campaña', 'correo.*campaña', 'campaña.*correo'];
  
  // Keywords para WhatsApp
  const whatsappKeywords = ['whatsapp', 'wa', 'campaña.*whatsapp', 'whatsapp.*campaña', 'campaña.*wa', 'wa.*campaña'];
  
  // Keywords que indican exclusión (clientes que aún no tienen)
  const exclusionKeywords = ['no.*tienen', 'aún.*no', 'sin.*campaña', 'que.*aún', 'que.*todavía', 'aun.*no', 'todavia'];
  
  // Verificar si tiene keywords de exclusión
  const hasExclusion = exclusionKeywords.some(kw => {
    const regex = new RegExp(kw, 'i');
    return regex.test(q);
  });
  
  // Verificar si menciona email
  const isEmail = emailKeywords.some(kw => {
    const regex = new RegExp(kw, 'i');
    return regex.test(q);
  });
  
  // Verificar si menciona WhatsApp
  const isWhatsApp = whatsappKeywords.some(kw => {
    const regex = new RegExp(kw, 'i');
    return regex.test(q);
  });
  
  // Si tiene exclusión y menciona un canal específico
  if (hasExclusion && (isEmail || isWhatsApp)) {
    return {
      isCampaign: true,
      channel: isEmail ? 'EMAIL' : (isWhatsApp ? 'WHATSAPP' : null),
    };
  }
  
  // Si menciona campaña y un canal, también puede ser solicitud de campaña
  if ((isEmail || isWhatsApp) && q.includes('campaña')) {
    return {
      isCampaign: true,
      channel: isEmail ? 'EMAIL' : (isWhatsApp ? 'WHATSAPP' : null),
    };
  }
  
  return { isCampaign: false, channel: null };
}

