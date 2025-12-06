/**
 * Caso de uso para generar embeddings e indexar chunks en Qdrant
 * Orquesta la lógica de negocio del proceso de embedding e indexación
 */
export class EmbedDocChunksUseCase {
  constructor(
    pdfRepository,
    chunkRepository,
    vectorRepository,
    embeddingService,
    batchSize = 50
  ) {
    this.pdfRepository = pdfRepository;
    this.chunkRepository = chunkRepository;
    this.vectorRepository = vectorRepository;
    this.embeddingService = embeddingService;
    this.batchSize = batchSize;
  }

  /**
   * Ejecuta el caso de uso de embeder chunks
   * @param {Object} request - Objeto con tenantId, userId y pdfId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string|ObjectId} request.pdfId - ID del documento
   * @returns {Promise<Object>} Objeto con pdfId e inserted (cantidad de chunks embebidos)
   * @throws {Error} Si el documento no existe o no pertenece al tenant
   */
  async execute({ tenantId, userId, pdfId }) {
    console.log(`[EmbedDocChunks] ========================================`);
    console.log(`[EmbedDocChunks] Iniciando proceso de embedding`);
    console.log(`[EmbedDocChunks] - pdfId: ${pdfId}`);
    console.log(`[EmbedDocChunks] - tenantId: ${tenantId}`);
    console.log(`[EmbedDocChunks] - userId: ${userId}`);
    console.log(`[EmbedDocChunks] - batchSize: ${this.batchSize}`);
    
    // Verificar que el documento existe y pertenece al tenant
    const pdf = await this.pdfRepository.findById(tenantId, pdfId, {
      includeDeleted: false,
    });

    if (!pdf) {
      console.error(`[EmbedDocChunks] ❌ Documento no encontrado: ${pdfId}`);
      throw new Error("Documento no encontrado");
    }

    console.log(`[EmbedDocChunks] ✓ Documento encontrado: ${pdf.originalName || pdf.fileName}`);

    // Obtener estadísticas de chunks
    const totalChunksCount = await this.chunkRepository.count(tenantId, pdfId);
    const alreadyEmbeddedCount = await this.chunkRepository.count(tenantId, pdfId, {
      status: "embedded",
    });
    
    // Verificar si hay chunks pendientes de embed
    const chunksCount = await this.chunkRepository.count(tenantId, pdfId, {
      status: "chunked",
    });

    console.log(`[EmbedDocChunks] 📊 Estadísticas:`);
    console.log(`[EmbedDocChunks]   - Total chunks: ${totalChunksCount}`);
    console.log(`[EmbedDocChunks]   - Ya embebidos: ${alreadyEmbeddedCount}`);
    console.log(`[EmbedDocChunks]   - Pendientes: ${chunksCount}`);

    if (chunksCount === 0) {
      console.log(
        `[EmbedDocChunks] ⚠️  No hay chunks con estado "chunked" para documento ${pdfId}`
      );
      console.log(`[EmbedDocChunks] ========================================`);
      return {
        pdfId,
        inserted: 0,
      };
    }

    // Procesar chunks en lotes para evitar problemas de memoria
    // Usar cursor basado en índice en lugar de skip para evitar problemas de paginación
    let totalInserted = 0;
    let processedChunkIds = [];
    let batchNumber = 0;
    let lastProcessedIndex = -1; // Usar -1 para empezar desde el principio

    let hasMore = true;

    while (hasMore) {
      batchNumber++;
      console.log(`[EmbedDocChunks] ────────────────────────────────────────`);
      console.log(`[EmbedDocChunks] 📦 Procesando lote #${batchNumber}`);
      console.log(`[EmbedDocChunks]   - Último índice procesado: ${lastProcessedIndex}`);
      console.log(`[EmbedDocChunks]   - Limit: ${this.batchSize}`);
      
      const batchStartTime = Date.now();
      
      // Obtener lote de chunks usando cursor basado en índice (más confiable que skip)
      const nextIndex = lastProcessedIndex + 1;
      console.log(`[EmbedDocChunks] 🔍 Consultando chunks con status "chunked" (index >= ${nextIndex}, limit=${this.batchSize})...`);
      const chunks = await this.chunkRepository.findByStatus(
        tenantId,
        pdfId,
        "chunked",
        {
          limit: this.batchSize,
          skip: 0, // No usar skip, usar filtro por índice
          sort: { index: 1 },
          minIndex: nextIndex, // Filtrar por índice mínimo (usando >=)
        }
      );

      if (chunks.length === 0) {
        console.log(`[EmbedDocChunks] ⚠️  No hay más chunks para procesar`);
        // Verificar si realmente no hay más chunks o si hay un problema
        const remainingCount = await this.chunkRepository.count(tenantId, pdfId, {
          status: "chunked",
        });
        console.log(`[EmbedDocChunks] 🔍 Verificación: ${remainingCount} chunks aún con status "chunked"`);
        if (remainingCount > 0) {
          console.log(`[EmbedDocChunks] ⚠️  ADVERTENCIA: Hay ${remainingCount} chunks pendientes pero no se encontraron con minIndex=${lastProcessedIndex + 1}`);
          // Obtener algunos ejemplos de chunks pendientes para diagnóstico
          const sampleChunks = await this.chunkRepository.findByStatus(
            tenantId,
            pdfId,
            "chunked",
            {
              limit: 10,
              skip: 0,
              sort: { index: 1 },
            }
          );
          if (sampleChunks.length > 0) {
            console.log(`[EmbedDocChunks] 🔍 Ejemplos de chunks pendientes (primeros 5):`);
            sampleChunks.forEach((c, i) => {
              console.log(`[EmbedDocChunks]   ${i + 1}. Index: ${c.index}, Status: ${c.status}, _id: ${c._id}`);
            });
          }
        }
        hasMore = false;
        break;
      }

      // Log de índices de chunks en este lote
      const indices = chunks.map(c => c.index).sort((a, b) => a - b);
      const minIndex = Math.min(...indices);
      const maxIndex = Math.max(...indices);
      console.log(`[EmbedDocChunks] 📋 Chunks en este lote: ${chunks.length}`);
      console.log(`[EmbedDocChunks]   - Índices: ${minIndex} a ${maxIndex}`);
      console.log(`[EmbedDocChunks]   - Rango completo: [${indices.join(', ')}]`);
      
      // Verificar si hay gaps en los índices (puede indicar chunks ya procesados)
      if (indices.length > 1) {
        const gaps = [];
        for (let i = 1; i < indices.length; i++) {
          if (indices[i] - indices[i-1] > 1) {
            gaps.push(`${indices[i-1]}-${indices[i]}`);
          }
        }
        if (gaps.length > 0) {
          console.log(`[EmbedDocChunks] ⚠️  Gaps detectados en índices: ${gaps.join(', ')} (pueden estar ya embebidos)`);
        }
      }
      
      // Verificar si el chunk 93 está en este lote
      const chunk93 = chunks.find(c => c.index === 93);
      if (chunk93) {
        console.log(`[EmbedDocChunks] ✅ Chunk 93 encontrado en este lote!`);
        console.log(`[EmbedDocChunks]   - ChunkId: ${chunk93._id}`);
        console.log(`[EmbedDocChunks]   - Content preview: ${(chunk93.content || '').substring(0, 100)}...`);
      } else {
        // Si estamos en el primer lote y el chunk 93 no está, verificar su status
        if (lastProcessedIndex === -1 && minIndex > 93) {
          console.log(`[EmbedDocChunks] ⚠️  Chunk 93 no está en los primeros chunks. Verificando status...`);
          const chunk93Check = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
            filters: { index: 93 },
            limit: 1,
          });
          if (chunk93Check.length > 0) {
            console.log(`[EmbedDocChunks]   - Chunk 93 existe con status: "${chunk93Check[0].status}"`);
            console.log(`[EmbedDocChunks]   - ChunkId: ${chunk93Check[0]._id}`);
          }
        } else if (lastProcessedIndex < 93 && minIndex > 93) {
          // Chunk 93 debería estar en este rango pero no se encontró
          console.log(`[EmbedDocChunks] ⚠️  Chunk 93 debería estar entre ${lastProcessedIndex + 1}-${minIndex - 1} pero no se encontró`);
          const chunk93Check = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
            filters: { index: 93 },
            limit: 1,
          });
          if (chunk93Check.length > 0) {
            console.log(`[EmbedDocChunks]   - Chunk 93 existe con status: "${chunk93Check[0].status}"`);
          }
        }
      }
      
      // Verificar si hay un gap grande (como 49->100) que indica chunks faltantes
      if (lastProcessedIndex >= 0 && minIndex > lastProcessedIndex + 1) {
        const gapStart = lastProcessedIndex + 1;
        const gapEnd = minIndex - 1;
        console.log(`[EmbedDocChunks] ⚠️  GAP DETECTADO: Se saltaron índices ${gapStart} a ${gapEnd} (${gapEnd - gapStart + 1} chunks)`);
        console.log(`[EmbedDocChunks]   - Esto sugiere que esos chunks ya tienen status "embedded"`);
        // Verificar algunos chunks del gap
        const sampleGapIndices = [];
        const gapSize = gapEnd - gapStart + 1;
        const samplesToCheck = Math.min(5, gapSize);
        for (let i = 0; i < samplesToCheck; i++) {
          sampleGapIndices.push(gapStart + Math.floor((gapSize / samplesToCheck) * i));
        }
        if (sampleGapIndices.length > 0) {
          console.log(`[EmbedDocChunks]   - Verificando status de índices de ejemplo: [${sampleGapIndices.join(', ')}]`);
          for (const idx of sampleGapIndices) {
            const gapChunk = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
              filters: { index: idx },
              limit: 1,
            });
            if (gapChunk.length > 0) {
              console.log(`[EmbedDocChunks]     - Index ${idx}: status="${gapChunk[0].status}"`);
            }
          }
        }
      }

      // Generar embeddings para este lote
      console.log(`[EmbedDocChunks] 🔄 Generando embeddings para ${chunks.length} chunks...`);
      const embeddingStartTime = Date.now();
      
      const texts = chunks.map((c) => c.content || "");
      const embeddings = await this.embeddingService.embedBatch(texts);
      
      const embeddingTime = Date.now() - embeddingStartTime;
      console.log(`[EmbedDocChunks] ✅ Embeddings generados en ${embeddingTime}ms`);

      if (embeddings.length !== chunks.length) {
        console.error(`[EmbedDocChunks] ❌ Error: cantidad de embeddings (${embeddings.length}) no coincide con cantidad de chunks (${chunks.length})`);
        throw new Error(
          "Error: cantidad de embeddings no coincide con cantidad de chunks"
        );
      }

      // Preparar chunks con embeddings para indexar
      console.log(`[EmbedDocChunks] 🔄 Preparando chunks para indexar en Qdrant...`);
      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        chunkId: chunk._id || chunk.id,
        vector: embeddings[i],
        payload: {
          index: chunk.index,
          page: chunk.page,
          content: chunk.content,
        },
      }));

      // Indexar en Qdrant
      console.log(`[EmbedDocChunks] 🔄 Indexando ${chunksWithEmbeddings.length} chunks en Qdrant...`);
      const qdrantStartTime = Date.now();
      
      const inserted = await this.vectorRepository.indexChunks(
        tenantId,
        pdfId,
        chunksWithEmbeddings
      );
      
      const qdrantTime = Date.now() - qdrantStartTime;
      console.log(`[EmbedDocChunks] ✅ ${inserted} chunks indexados en Qdrant en ${qdrantTime}ms`);

      totalInserted += inserted;

      // Actualizar status de los chunks a "embedded"
      console.log(`[EmbedDocChunks] 🔄 Actualizando status de chunks a "embedded"...`);
      const updateStartTime = Date.now();
      const chunkIds = chunks.map((c) => c._id || c.id);
      await this.chunkRepository.updateStatusMany(
        tenantId,
        chunkIds,
        "embedded"
      );
      
      const updateTime = Date.now() - updateStartTime;
      
      // Verificar que se actualizaron correctamente
      const verifyCount = await this.chunkRepository.count(tenantId, pdfId, {
        _id: { $in: chunkIds },
        status: "embedded",
      });
      console.log(`[EmbedDocChunks] ✅ ${verifyCount}/${chunkIds.length} chunks verificados como "embedded" en ${updateTime}ms`);

      processedChunkIds.push(...chunkIds);

      const batchTime = Date.now() - batchStartTime;
      console.log(`[EmbedDocChunks] ✅ Lote #${batchNumber} completado en ${batchTime}ms`);
      console.log(`[EmbedDocChunks] 📊 Progreso total: ${totalInserted}/${chunksCount} chunks (${Math.round((totalInserted/chunksCount)*100)}%)`);

      // Actualizar último índice procesado
      if (chunks.length > 0) {
        const maxIndexInBatch = Math.max(...chunks.map(c => c.index));
        lastProcessedIndex = maxIndexInBatch;
        console.log(`[EmbedDocChunks] 📍 Último índice procesado actualizado a: ${lastProcessedIndex}`);
      }

      // Verificar si hay más chunks
      if (chunks.length < this.batchSize) {
        hasMore = false;
      }
    }

    // Actualizar status del documento si todos los chunks están embebidos
    const remainingChunks = await this.chunkRepository.count(tenantId, pdfId, {
      status: "chunked",
    });

    console.log(`[EmbedDocChunks] ────────────────────────────────────────`);
    console.log(`[EmbedDocChunks] 📊 Resumen final:`);
    console.log(`[EmbedDocChunks]   - Chunks procesados: ${totalInserted}`);
    console.log(`[EmbedDocChunks]   - Chunks restantes: ${remainingChunks}`);

    if (remainingChunks === 0) {
      console.log(`[EmbedDocChunks] ✅ Todos los chunks están embebidos, actualizando documento a "ready"`);
      await this.pdfRepository.updateStatus(tenantId, pdfId, "ready");
    } else {
      console.log(`[EmbedDocChunks] ⚠️  Aún quedan ${remainingChunks} chunks sin embeder`);
    }

    console.log(`[EmbedDocChunks] ========================================`);

    return {
      pdfId,
      inserted: totalInserted,
    };
  }
}

