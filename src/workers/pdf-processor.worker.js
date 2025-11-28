import fs from "fs/promises";
import { PDFParse } from "pdf-parse";

// Función auxiliar para limpiar texto
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')           // Múltiples espacios → uno
    .replace(/\n{3,}/g, '\n\n')      // Múltiples saltos → dos
    .trim();
}

// Función para crear chunks por palabras con overlap
function createChunks(text, chunkSize = 1200, overlap = 200) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const word of words) {
    if (currentLength + word.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      // Overlap: mantener últimas palabras para contexto
      const overlapWords = currentChunk.slice(-Math.floor(overlap / 10));
      currentChunk = overlapWords;
      currentLength = overlapWords.join(' ').length;
    }
    currentChunk.push(word);
    currentLength += word.length + 1;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  return chunks;
}

// Procesar PDF en el worker
async function processPdfInWorker(pdfPath) {
  try {
    // Leer archivo desde disco
    const buffer = await fs.readFile(pdfPath);
    
    // Crear parser con el buffer local
    const parser = new PDFParse({ data: buffer });
    
    // Info para saber cuántas páginas tiene
    const info = await parser.getInfo({ parsePageInfo: true });
    
    // Esto sí devuelve el texto completo
    const textResult = await parser.getText();
    await parser.destroy();
    
    // Liberar buffer después del parseo (el parser ya no lo necesita)
    // Nota: El buffer se liberará automáticamente cuando el parser sea destruido
    
    // Limpiar el texto extraído
    let fullText = cleanText(textResult.text || "");
    
    // Liberar referencia del resultado del parser
    textResult.text = null;
    
    // Validar que haya texto
    if (!fullText) {
      throw new Error("No se pudo extraer texto del PDF");
    }
    
    // --- Determinar páginas ---
    let totalPages = info.pages?.length || 1;
    let pages = [];
    
    if (info.pages && info.pages.every(p => !p.text)) {
      // PDF escaneado → dividir texto por cantidad de páginas estimadas
      const charsPerPage = Math.ceil(fullText.length / totalPages);
      
      for (let i = 0; i < totalPages; i++) {
        pages.push({
          pageNumber: i + 1,
          text: fullText.slice(i * charsPerPage, (i + 1) * charsPerPage)
        });
      }
    } else {
      // PDF digital → dividir por saltos de página si existen
      const splitByPage = fullText.split(/\n-- \d+ of \d+ --/g);
      
      // Si no detectamos delimitadores → consideramos 1 sola página
      if (splitByPage.length === 1) {
        pages = [{ pageNumber: 1, text: fullText }];
      } else {
        pages = splitByPage.map((text, idx) => ({
          pageNumber: idx + 1,
          text: text.trim()
        }));
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
      };
    });
    
    // Retornar resultado (sin fullText ni pages para optimizar memoria)
    // fullText y pages solo se usan para calcular chunks, no se necesitan después
    const result = {
      success: true,
      chunks: chunksWithPages,
      totalPages, // Mantener totalPages para estadísticas si se necesita
    };
    
    // Liberar referencias grandes explícitamente
    fullText = null;
    pages = null;
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      error: error.message || "Error desconocido al procesar PDF",
    };
  }
}

// Exportar función para Piscina
export default async function (data) {
  const { pdfPath } = data;
  return await processPdfInWorker(pdfPath);
}

