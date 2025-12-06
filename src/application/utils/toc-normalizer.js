/**
 * Normaliza el contenido del índice (TOC) para quedarnos solo con la parte útil
 * Elimina separadores, duplicados, líneas fragmentadas y aplica limpieza general
 * 
 * @param {string} raw - Contenido crudo del índice
 * @returns {string|null} - Contenido normalizado o null si no hay contenido válido
 */
export function normalizeTocContent(raw) {
  if (!raw) return null;
  let text = String(raw);

  // 1) Si viene con cabeceras markdown tipo "## CHAPTERS" o "## ÍNDICE"
  // Incluye variantes en español e inglés
  const chaptersHeadingIdx = text.search(/##\s*(CHAPTERS|TABLE OF CONTENTS|BRIEF CONTENTS|INDEX|INDICE|ÍNDICE|TABLA DE CONTENIDOS|CONTENIDO|CONTENTS|CAPÍTULOS|CAPITULOS|TEMARIO)/i);
  if (chaptersHeadingIdx !== -1) {
    // Solo cortar si encontramos un patrón muy específico que indique el final del índice
    // NO cortar por "## 1" o "## Chapter 1" porque pueden estar dentro del índice
    let endIdx = text.search(/##\s*This chapter covers/i);
    if (endIdx === -1) {
      endIdx = text.search(/##\s*Este capítulo cubre/i);
    }
    // Solo cortar si encontramos un patrón claro de fin de índice
    // No cortar por números o capítulos porque pueden estar en el índice
    
    if (endIdx !== -1 && endIdx > chaptersHeadingIdx) {
      text = text.slice(chaptersHeadingIdx, endIdx);
    } else {
      text = text.slice(chaptersHeadingIdx);
    }
    
    // Limpiar markdown headers del resultado
    text = text.replace(/^##+\s*/gm, '');
  } else {
    // 2) Fallback: buscar simplemente la palabra (español e inglés)
    // PERO no cortar el contenido, solo asegurarnos de que empezamos desde ahí
    const startIdx = text.search(/\b(CHAPTERS|TABLE OF CONTENTS|BRIEF CONTENTS|INDEX|INDICE|ÍNDICE|TABLA DE CONTENIDOS|CONTENIDO|CONTENTS|CAPÍTULOS|CAPITULOS|TEMARIO)\b/i);
    if (startIdx !== -1 && startIdx > 0) {
      // Solo cortar si la palabra está muy al inicio (primeras 200 caracteres)
      // Si está más adelante, probablemente es parte del contenido del índice
      if (startIdx < 200) {
        text = text.slice(startIdx);
      }
    }
  }

  // 3) Limpiar líneas tipo tabla "Appendix A ... | Appendix A ..."
  // PRIMERO: Si el texto viene todo en una línea con pipes, dividirlo primero
  const pipeCount = (text.match(/\|/g) || []).length;
  const newlineCount = (text.match(/\n/g) || []).length;
  const hasManyPipes = pipeCount > 3;
  const hasFewNewlines = newlineCount < 3;
  
  // Si tiene muchos pipes y pocos saltos de línea, probablemente es una tabla en una línea
  if (hasManyPipes && hasFewNewlines) {
    // Dividir por pipes y procesar cada parte
    const pipeParts = text.split('|').map(p => p.trim()).filter(p => p.length > 0);
    const cleanedParts = [];
    
    for (let i = 0; i < pipeParts.length; i++) {
      const part = pipeParts[i];
      
      // Saltar separadores
      if (/^[-=_]{3,}$/.test(part)) continue;
      
      // Si la parte anterior es igual a esta, es duplicado, saltarla
      if (i > 0 && part === pipeParts[i - 1]) continue;
      
      // Si la parte es solo un número, probablemente es un número de página, combinarla con la siguiente
      if (/^\d+$/.test(part) && i + 1 < pipeParts.length) {
        const nextPart = pipeParts[i + 1];
        if (nextPart && !/^[-=_]{3,}$/.test(nextPart) && nextPart.length > 2) {
          cleanedParts.push(`${part} ${nextPart}`);
          i++; // Saltar la siguiente porque ya la combinamos
          continue;
        }
      }
      
      // Si la parte es válida, agregarla
      if (part.length > 2 && !/^[-=_]{3,}$/.test(part)) {
        cleanedParts.push(part);
      }
    }
    
    // Unir las partes limpiadas con saltos de línea
    text = cleanedParts.join('\n');
  }
  
  // Ahora procesar como líneas normales
  const lines = text.split('\n');
  const cleanedLines = lines.map((line) => {
    // Quitar separadores enormes tipo '-----', '=====', '_____'
    const trimmedLine = line.trim();
    if (/^[-=_]{3,}$/.test(trimmedLine)) return '';

    // Si la línea ya no tiene pipes (porque ya la procesamos arriba), devolverla tal cual
    if (!line.includes('|')) {
      return trimmedLine.length > 2 ? trimmedLine : '';
    }

    const parts = line
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean);

    // Nada útil
    if (parts.length === 0) return '';

    // Si las columnas son duplicadas o similares, tomar solo la primera
    if (parts.length >= 2 && parts.every((p) => p === parts[0])) {
      return parts[0];
    }

    // Si es tabla con 3+ columnas, tomar la primera columna no vacía y significativa
    if (parts.length >= 3) {
      return parts.find((p) => p.length > 2) || parts[0];
    }

    // Si hay 2 columnas diferentes, unirlas (puede ser información útil)
    if (parts.length === 2) {
      return parts.join(' | ');
    }

    // Si quedó una línea normal
    return parts[0];
  });

  // 4) Filtrar líneas vacías o demasiado cortas
  const finalLines = cleanedLines.filter((l) => l && l.length > 2);

  // 4.5) Unir líneas fragmentadas por cortes feos de OCR
  let mergedLines = [];
  for (let i = 0; i < finalLines.length; i++) {
    let line = finalLines[i];
    
    // Si empieza con "Appendix" pero la línea siguiente empieza con letra sola, unir
    if (/^Appendix\s+[A-Z]\.?$/i.test(line) && i + 1 < finalLines.length) {
      line = line + " " + finalLines[i + 1];
      i++; // Saltar la siguiente
    }
    // Si una línea termina en minúscula y la siguiente empieza con minúscula, unir (palabra cortada)
    else if (
      /[a-z]$/.test(line) &&
      i + 1 < finalLines.length &&
      /^[a-z]/.test(finalLines[i + 1])
    ) {
      line = line + " " + finalLines[i + 1];
      i++;
    }
    // Si una línea termina sin punto y la siguiente empieza con minúscula, podría ser continuación
    else if (
      !/[.!?]$/.test(line) &&
      i + 1 < finalLines.length &&
      /^[a-z]/.test(finalLines[i + 1]) &&
      finalLines[i + 1].length < 50 // Evitar unir líneas muy largas
    ) {
      line = line + " " + finalLines[i + 1];
      i++;
    }
    
    mergedLines.push(line);
  }

  // 4.6) Eliminar líneas duplicadas (usando mergedLines en lugar de finalLines)
  const uniqueLines = [];
  const seen = new Set();
  for (const l of mergedLines) {
    if (!seen.has(l)) {
      seen.add(l);
      uniqueLines.push(l);
    }
  }

  // 5) Unir y aplicar límite de tamaño
  let finalText = uniqueLines.join('\n').trim();
  const MAX_TOC_LENGTH = 8000;
  if (finalText.length > MAX_TOC_LENGTH) {
    finalText = finalText.slice(0, MAX_TOC_LENGTH).trim();
  }

  // 6) Limpieza final de espacios múltiples y saltos de línea
  finalText = finalText.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');

  return finalText.length > 0 ? finalText : null;
}

