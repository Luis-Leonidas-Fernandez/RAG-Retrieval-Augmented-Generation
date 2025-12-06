import { DoclingDocProcessorWrapper } from "../services/adapters/docling-doc-processor-wrapper.service.js";
import { normalizeTocContent } from "../../application/utils/toc-normalizer.js";

/**
 * Función auxiliar para limpiar texto preservando estructura de tablas
 * Las filas de tabla se preservan intactas para mantener la estructura markdown
 * @param {string} text - Texto a limpiar
 * @returns {string} Texto limpio con tablas preservadas
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Dividir en líneas para procesar cada una
  const lines = text.split('\n');
  const processedLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detectar si es una fila de tabla markdown
    // Una fila de tabla debe empezar y terminar con | y tener al menos 3 pipes
    const isTableRow = trimmed.startsWith('|') && 
                       trimmed.endsWith('|') && 
                       (trimmed.match(/\|/g) || []).length >= 3;
    
    if (isTableRow) {
      // Preservar filas de tabla tal cual (solo limpiar espacios al inicio/final de la línea)
      processedLines.push(line.trim());
    } else {
      // Limpiar texto normal: múltiples espacios → uno
      const cleaned = line.replace(/\s+/g, ' ').trim();
      if (cleaned.length > 0) {
        processedLines.push(cleaned);
      }
    }
  }
  
  // Unir líneas y limpiar saltos de línea múltiples (pero preservar estructura de tablas)
  let result = processedLines.join('\n');
  
  // Reducir saltos de línea múltiples a máximo 2 (pero no entre filas de tabla consecutivas)
  // Esto preserva las tablas pero limpia espacios en blanco excesivos en texto normal
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

// Función para extraer TOC (Table of Contents) de las primeras páginas
function extractTocFromPages(pages) {
  // Analizar las primeras 10 páginas
  const pagesToAnalyze = pages.slice(0, Math.min(10, pages.length));
  
  // Palabras clave para detectar inicio del índice
  const tocKeywords = [
    "ÍNDICE",
    "Indice",
    "INDICE",
    "CONTENIDO",
    "Contenido",
    "Contents",
    "TABLE OF CONTENTS",
    "Table of Contents",
    "INDEX",
    "Index",
    "CONTENTS",
    "CHAPTERS",
    "Chapters",
    "Chapter",
    "CHAPTER"
  ];
  
  let tocStartPage = null;
  let tocStartIndex = -1;
  
  // Buscar página que contenga alguna palabra clave
  for (let i = 0; i < pagesToAnalyze.length; i++) {
    const page = pagesToAnalyze[i];
    const pageText = page.text || "";
    const upperText = pageText.toUpperCase();
    
    // Buscar palabras clave en la página
    for (const keyword of tocKeywords) {
      const keywordIndex = upperText.indexOf(keyword.toUpperCase());
      if (keywordIndex !== -1) {
        tocStartPage = page.pageNumber;
        tocStartIndex = keywordIndex;
        break;
      }
    }
    
    if (tocStartPage !== null) break;
  }
  
  // Si no se encontró TOC, retornar null
  if (tocStartPage === null) {
    return null;
  }
  
  // Encontrar la página donde empezó el TOC
  const startPageIndex = pagesToAnalyze.findIndex(p => p.pageNumber === tocStartPage);
  if (startPageIndex === -1) return null;
  
  // Extraer contenido del TOC
  let tocContent = [];
  let foundTocStart = false;
  let emptyLinesCount = 0;
  const maxEmptyLines = 2; // Cortar después de 2 líneas vacías consecutivas
  
  // Empezar desde la página donde se encontró la palabra clave
  for (let i = startPageIndex; i < pagesToAnalyze.length; i++) {
    const page = pagesToAnalyze[i];
    const pageText = page.text || "";
    const lines = pageText.split('\n');
    
    // Si es la primera página, empezar desde donde se encontró la palabra clave
    let startLineIndex = 0;
    if (i === startPageIndex && tocStartIndex !== -1) {
      // Encontrar la línea donde está la palabra clave
      let charCount = 0;
      for (let j = 0; j < lines.length; j++) {
        charCount += lines[j].length + 1; // +1 por el \n
        if (charCount > tocStartIndex) {
          startLineIndex = j;
          foundTocStart = true;
          break;
        }
      }
    } else {
      foundTocStart = true;
    }
    
    // Procesar líneas desde el inicio del TOC
    for (let j = startLineIndex; j < lines.length; j++) {
      const line = lines[j].trim();
      
      // Si encontramos líneas vacías consecutivas, cortar
      if (line === '') {
        emptyLinesCount++;
        if (emptyLinesCount >= maxEmptyLines && foundTocStart) {
          break;
        }
        continue;
      }
      
      emptyLinesCount = 0;
      
      // Detectar si la línea parece ser parte del TOC
      // Patrones comunes: números seguidos de texto, "Capítulo X", etc.
      const looksLikeToc = 
        /^\d+[\.\)\-\s]/.test(line) || // Empieza con número seguido de punto, paréntesis, guión o espacio
        /^[A-Z][a-z]+(\s+\d+)?/.test(line) || // Empieza con mayúscula seguida de minúsculas (título)
        /capítulo|chapter|parte|part/i.test(line) || // Contiene palabras clave de capítulos
        /^\s*\d+\s*$/.test(line) || // Solo número (número de página)
        (line.length > 5 && line.length < 100); // Línea razonable para un título
      
      if (looksLikeToc || foundTocStart) {
        tocContent.push(line);
        foundTocStart = true;
      } else if (foundTocStart) {
        // Si ya empezamos a extraer pero esta línea no parece TOC, podría ser el fin
        // Continuar solo si es corta (posible número de página o formato especial)
        if (line.length < 20) {
          tocContent.push(line);
        } else {
          break;
        }
      }
    }
    
    // Si encontramos líneas vacías consecutivas, salir del loop
    if (emptyLinesCount >= maxEmptyLines && foundTocStart) {
      break;
    }
  }
  
  // Si no se extrajo contenido, retornar null
  if (tocContent.length === 0) {
    return null;
  }
  
  // Unir el contenido y limpiarlo
  const content = tocContent.join('\n').trim();
  
  if (!content || content.length < 10) {
    return null;
  }
  
  return {
    page: tocStartPage,
    content: content
  };
}

/**
 * Detecta si una línea es parte de una tabla en formato markdown
 * Más específica para evitar falsos positivos en PDFs normales
 * @param {string} line - Línea a verificar
 * @returns {boolean} true si parece ser una fila de tabla markdown
 */
function isTableRow(line) {
  if (!line || typeof line !== 'string') return false;
  
  const trimmed = line.trim();
  
  // Una fila de tabla markdown debe:
  // 1. Empezar con | (puede tener espacios antes)
  // 2. Terminar con | (puede tener espacios después)
  // 3. Tener al menos 3 | (mínimo 2 columnas: | col1 | col2 |)
  // 4. Tener contenido entre los pipes (no solo pipes vacíos)
  
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return false;
  }
  
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  if (pipeCount < 3) {
    return false; // Necesita al menos 3 pipes para 2 columnas
  }
  
  // Verificar que hay contenido entre pipes (no solo espacios)
  // Ejemplo válido: | Nombre | Email | (tiene contenido)
  // Ejemplo inválido: | | | (solo pipes vacíos)
  const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
  if (cells.length < 2) {
    return false; // Debe tener al menos 2 celdas con contenido
  }
  
  return true;
}

/**
 * Función mejorada para crear chunks respetando filas de tabla
 * No corta en medio de filas de tabla para preservar nombres completos
 * @param {string} text - Texto completo a dividir
 * @param {number} chunkSize - Tamaño máximo del chunk en caracteres
 * @param {number} overlap - Tamaño del overlap en caracteres
 * @returns {string[]} Array de chunks
 */
function createChunks(text, chunkSize = 1200, overlap = 200) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  /**
   * Guarda el chunk actual y prepara el siguiente con overlap
   */
  function finalizeCurrentChunk() {
    if (currentChunk.length === 0) return;
    
    const chunkText = currentChunk.join('\n');
    chunks.push(chunkText);
    
    // Overlap: mantener últimas líneas para contexto
    const overlapChars = Math.min(overlap, chunkText.length);
    const overlapText = chunkText.slice(-overlapChars);
    const overlapLines = overlapText.split('\n').filter(l => l.trim().length > 0);
    
    currentChunk = overlapLines.length > 0 ? overlapLines : [];
    currentLength = currentChunk.join('\n').length;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTable = isTableRow(line);

    if (isTable) {
      // Es una fila de tabla - mantenerla completa (nunca cortar)
      const lineWithNewline = line + '\n';
      const lineLength = lineWithNewline.length;
      
      // Si agregar esta fila excede el límite, guardar chunk actual primero
      if (currentLength + lineLength > chunkSize && currentChunk.length > 0) {
        finalizeCurrentChunk();
      }
      
      // Agregar la fila de tabla completa (siempre cabe, incluso si excede el límite ligeramente)
      currentChunk.push(line);
      currentLength += lineLength;
    } else {
      // No es una fila de tabla - procesar palabra por palabra
      const words = line.split(/\s+/).filter(w => w.length > 0);
      
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        // Calcular longitud: palabra + espacio (excepto última palabra) + newline (excepto última línea)
        const spaceAfter = j < words.length - 1 ? 1 : 0;
        const newlineAfter = i < lines.length - 1 ? 1 : 0;
        const wordLength = word.length + spaceAfter + (j === words.length - 1 ? newlineAfter : 0);
        
        // Si agregar esta palabra excede el límite, guardar chunk actual
        if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
          finalizeCurrentChunk();
        }
        
        // Agregar palabra al chunk actual
        if (j === 0) {
          // Primera palabra de la línea - nueva línea en el chunk
          currentChunk.push(word);
          currentLength += word.length;
        } else {
          // Palabras subsecuentes - agregar a la última línea
          const lastLineIndex = currentChunk.length - 1;
          if (lastLineIndex >= 0) {
            currentChunk[lastLineIndex] += ' ' + word;
            currentLength += word.length + 1; // +1 por el espacio
          } else {
            currentChunk.push(word);
            currentLength += word.length;
          }
        }
      }
      
      // Agregar newline después de la línea (excepto última línea del texto)
      if (i < lines.length - 1 && currentChunk.length > 0) {
        currentLength += 1; // \n
      }
    }
  }
  
  // Agregar último chunk si tiene contenido
  if (currentChunk.length > 0) {
    const lastChunk = currentChunk.join('\n');
    if (lastChunk.trim().length > 0) {
      chunks.push(lastChunk);
    }
  }
  
  return chunks;
}

// Procesar documento en el worker
async function processDocInWorker(docPath, mimetype) {
  try {
    // Instanciar procesador Docling
    const docProcessor = new DoclingDocProcessorWrapper();
    
    // Log del tipo de archivo para debugging
    if (mimetype) {
      console.log(`[Worker] Procesando documento tipo: ${mimetype}`);
    }
    
    // Procesar documento con Docling (soporta múltiples formatos)
    const result = await docProcessor.processPdf(docPath);
    
    // Obtener texto limpio
    let fullText = cleanText(result.cleaned_text || "");
    
    // Validar que haya texto
    if (!fullText) {
      throw new Error("No se pudo extraer texto del documento");
    }
    
    // --- Determinar páginas ---
    const totalPages = result.metadata?.total_pages || 1;
    let pages = [];
    
    // Dividir texto por cantidad de páginas estimadas
    // Si Docling no proporciona info detallada de páginas, dividir por longitud
    const charsPerPage = Math.ceil(fullText.length / totalPages);
    
    for (let i = 0; i < totalPages; i++) {
      pages.push({
        pageNumber: i + 1,
        text: fullText.slice(i * charsPerPage, (i + 1) * charsPerPage)
      });
    }
    
    // Usar TOC de Docling si existe, sino intentar extraer de las páginas
    let tocResult = null;
    if (result.toc && result.toc.trim().length > 0) {
      // Usar TOC de Docling pero normalizado
      const cleanedToc = normalizeTocContent(result.toc);
      if (cleanedToc) {
        tocResult = {
          page: 1,
          content: cleanedToc,
        };
      }
    }
    // Si Docling no trajo TOC útil, intentamos extraerlo de las páginas
    if (!tocResult) {
      tocResult = extractTocFromPages(pages);
      // Normalizar también el resultado del fallback si existe
      if (tocResult && tocResult.content) {
        const cleaned = normalizeTocContent(tocResult.content);
        if (cleaned) {
          tocResult.content = cleaned;
        }
      }
    }
    
    // Crear chunks con el método mejorado
    const chunkSize = 1200; // 1000-1500 es lo óptimo para RAG
    const chunkTexts = createChunks(fullText, chunkSize, 200);
    
    // Calcular página para cada chunk (optimizado: O(n) en lugar de O(n*m))
    const chunksWithPages = chunkTexts.map((chunkText, index) => {
      // Encontrar posición del chunk en el texto completo
      const chunkStart = fullText.indexOf(chunkText);
      
      // Si no se encuentra, usar el índice para estimar posición aproximada
      let estimatedStart = chunkStart;
      if (chunkStart === -1) {
        // Estimar posición basada en el índice del chunk
        const avgChunkSize = fullText.length / chunkTexts.length;
        estimatedStart = Math.floor(index * avgChunkSize);
      }
      
      // Determinar página basándose en la posición
      let charCount = 0;
      let pageNumber = 1;
      
      for (let i = 0; i < pages.length; i++) {
        const pageText = pages[i].text || '';
        const pageStart = charCount;
        const pageEnd = charCount + pageText.length;
        
        if (estimatedStart >= pageStart && estimatedStart < pageEnd) {
          pageNumber = pages[i].pageNumber;
          break;
        }
        charCount = pageEnd;
      }
      
      // Si no se encontró, usar la última página
      if (pageNumber === 1 && pages.length > 0 && estimatedStart >= charCount) {
        pageNumber = pages[pages.length - 1].pageNumber;
      }
      
      return {
        text: chunkText,
        page: pageNumber,
        sectionType: 'paragraph',
      };
    });
    
    // Si se encontró TOC, agregarlo como primer chunk
    if (tocResult) {
      chunksWithPages.unshift({
        text: tocResult.content,
        page: tocResult.page,
        sectionType: 'toc',
        sectionTitle: 'ÍNDICE',
        path: ['ÍNDICE'],
      });
    }
    
    // Retornar resultado (sin fullText ni pages para optimizar memoria)
    // fullText y pages solo se usan para calcular chunks, no se necesitan después
    const finalResult = {
      success: true,
      chunks: chunksWithPages,
      totalPages, // Mantener totalPages para estadísticas si se necesita
    };
    
    // Liberar referencias grandes explícitamente
    fullText = null;
    pages = null;
    
    return finalResult;
    
  } catch (error) {
    return {
      success: false,
      error: error.message || "Error desconocido al procesar documento",
    };
  }
}

// Exportar función para Piscina
export default async function (data) {
  const { pdfPath, mimetype } = data;
  return await processDocInWorker(pdfPath, mimetype);
}

