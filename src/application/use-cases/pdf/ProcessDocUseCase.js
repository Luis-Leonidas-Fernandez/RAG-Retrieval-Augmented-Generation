/**
 * Caso de uso para procesar un documento
 * Orquesta la lógica de negocio del proceso de chunking de documento
 */
export class ProcessDocUseCase {
  constructor(pdfRepository, chunkRepository, pdfProcessService, cacheService, batchSize = 100) {
    this.pdfRepository = pdfRepository;
    this.chunkRepository = chunkRepository;
    this.pdfProcessService = pdfProcessService;
    this.cacheService = cacheService;
    this.batchSize = batchSize;
  }

  /**
   * Ejecuta el caso de uso de procesar documento
   * @param {Object} request - Objeto con tenantId, userId y pdfId
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {string|ObjectId} request.pdfId - ID del documento a procesar
   * @returns {Promise<Object>} Objeto con pdf, chunks (cantidad) y embedded (cantidad)
   * @throws {Error} Si el documento no existe, no pertenece al tenant o está eliminado
   */
  async execute({ tenantId, userId, pdfId }) {
    console.log(`[ProcessDocUseCase] Iniciando ejecución - pdfId: ${pdfId}, tenantId: ${tenantId}, userId: ${userId}`);
    
    // Verificar que el documento existe y pertenece al tenant (no esté soft-deleted)
    console.log(`[ProcessDocUseCase] Buscando documento en base de datos...`);
    const pdf = await this.pdfRepository.findById(tenantId, pdfId, {
      includeDeleted: false,
    });

    if (!pdf) {
      console.error(`[ProcessDocUseCase] Documento no encontrado - pdfId: ${pdfId}`);
      throw new Error("Documento no encontrado");
    }

    console.log(`[ProcessDocUseCase] Documento encontrado - nombre: ${pdf.name}, path: ${pdf.path}, status: ${pdf.status}`);

    if (!pdf.path) {
      console.error(`[ProcessDocUseCase] Documento no tiene ruta válida - pdfId: ${pdfId}`);
      throw new Error("Documento no tiene ruta de archivo válida");
    }

    // Procesar documento usando el servicio (worker pool)
    console.log(`[ProcessDocUseCase] Procesando documento con pdfProcessService - path: ${pdf.path}`);
    const startTime = Date.now();
    const result = await this.pdfProcessService.processPdf(pdf.path);
    const processingTime = Date.now() - startTime;
    console.log(`[ProcessDocUseCase] Procesamiento completado en ${processingTime}ms`);

    if (!result.success) {
      console.error(`[ProcessDocUseCase] Error en el procesamiento: ${result.error}`);
      throw new Error(result.error || "Error al procesar documento en worker");
    }

    console.log(`[ProcessDocUseCase] Documento procesado exitosamente - chunks obtenidos: ${result.chunks?.length || 0}`);

    const allChunks = result.chunks;
    const totalChunksCount = allChunks.length;
    console.log(`[ProcessDocUseCase] Total de chunks a guardar: ${totalChunksCount}`);

    // Validar que hay chunks para guardar
    if (totalChunksCount === 0) {
      console.error(`[ProcessDocUseCase] ⚠️  ADVERTENCIA: No hay chunks para guardar. El documento puede estar vacío o el procesamiento falló.`);
      throw new Error("No se generaron chunks del documento");
    }

    // Estadísticas de los chunks antes de guardar
    const tocChunks = allChunks.filter(c => c.sectionType === 'toc');
    const paragraphChunks = allChunks.filter(c => c.sectionType === 'paragraph');
    const otherChunks = allChunks.filter(c => !['toc', 'paragraph'].includes(c.sectionType));
    
    console.log(`[ProcessDocUseCase] 📊 Estadísticas de chunks:`);
    console.log(`[ProcessDocUseCase]   - Total: ${totalChunksCount}`);
    console.log(`[ProcessDocUseCase]   - TOC: ${tocChunks.length}`);
    console.log(`[ProcessDocUseCase]   - Paragraphs: ${paragraphChunks.length}`);
    console.log(`[ProcessDocUseCase]   - Otros: ${otherChunks.length}`);
    
    // Calcular tamaño total del contenido
    const totalContentSize = allChunks.reduce((sum, chunk) => sum + (chunk.text?.length || 0), 0);
    console.log(`[ProcessDocUseCase]   - Tamaño total del contenido: ${totalContentSize} caracteres`);

    // Eliminar chunks existentes del documento (evitar duplicados)
    console.log(`[ProcessDocUseCase] Eliminando chunks existentes del documento...`);
    const deletedCount = await this.chunkRepository.deleteByPdfId(tenantId, pdfId);
    console.log(`[ProcessDocUseCase] Chunks existentes eliminados: ${deletedCount}`);

    // Guardar chunks en lotes para optimizar memoria
    let totalInserted = 0;
    let allInsertedChunks = [];

    // Procesar y eliminar chunks del array original para liberar memoria progresivamente
    let batchNumber = 0;
    while (allChunks.length > 0) {
      // Extraer y remover los primeros BATCH_SIZE chunks
      const batch = allChunks.splice(0, this.batchSize);
      batchNumber++;
      console.log(`[ProcessDocUseCase] Procesando batch ${batchNumber} - ${batch.length} chunks (restantes: ${allChunks.length})`);

      const chunkData = batch.map((chunk, idx) => {
        const chunkObj = {
          pdfId,
          index: totalInserted + idx,
          content: chunk.text,
          page: chunk.page,
          status: "chunked",
          sectionType: chunk.sectionType || "paragraph",
        };

        // Agregar campos opcionales solo si existen
        if (chunk.sectionTitle) {
          chunkObj.sectionTitle = chunk.sectionTitle;
        }
        if (chunk.path && Array.isArray(chunk.path)) {
          chunkObj.path = chunk.path;
        }

        return chunkObj;
      });

      const insertedChunks = await this.chunkRepository.createMany(
        tenantId,
        chunkData
      );

      totalInserted += insertedChunks.length;
      allInsertedChunks.push(...insertedChunks);
      console.log(`[ProcessDocUseCase] Batch ${batchNumber} guardado - Total insertado hasta ahora: ${totalInserted}`);

      // batch se libera automáticamente después de la iteración
    }

    console.log(`[ProcessDocUseCase] Todos los chunks guardados - Total: ${totalInserted}`);

    // Verificar que se guardaron correctamente consultando la BD
    const verifyCount = await this.chunkRepository.count(tenantId, pdfId);
    console.log(`[ProcessDocUseCase] 🔍 Verificación: ${verifyCount} chunks encontrados en MongoDB para este documento`);
    
    if (verifyCount !== totalInserted) {
      console.error(`[ProcessDocUseCase] ⚠️  DISCREPANCIA: Se insertaron ${totalInserted} chunks pero se encontraron ${verifyCount} en la BD`);
    }

    // Cambiar estado del documento a "processed"
    console.log(`[ProcessDocUseCase] Actualizando estado del documento a "processed"...`);
    const updatedPdf = await this.pdfRepository.updateStatus(
      tenantId,
      pdfId,
      "processed"
    );

    if (!updatedPdf) {
      console.error(`[ProcessDocUseCase] Error al actualizar estado del documento - pdfId: ${pdfId}`);
      throw new Error("Error al actualizar estado del documento");
    }

    console.log(`[ProcessDocUseCase] Estado del documento actualizado a "processed"`);

    // Invalidar caché RAG para este documento (los chunks han cambiado)
    if (this.cacheService && this.cacheService.invalidateRagCacheForPdf) {
      await this.cacheService.invalidateRagCacheForPdf(
        tenantId.toString(),
        pdfId
      );
      console.log(`[ProcessDocUseCase] Caché RAG invalidada para documento ${pdfId}`);
    }

    console.log(`[ProcessDocUseCase] Ejecución completada exitosamente - pdfId: ${pdfId}, chunks: ${totalInserted}`);

    // Verificación final: obtener algunos chunks de ejemplo para confirmar
    const sampleChunks = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
      limit: 3,
      sort: { index: 1 },
      select: "index page sectionType content"
    });
    
    if (sampleChunks.length > 0) {
      console.log(`[ProcessDocUseCase] 📋 Ejemplo de chunks guardados (primeros 3):`);
      sampleChunks.forEach((chunk, i) => {
        console.log(`[ProcessDocUseCase]   Chunk ${i + 1}:`);
        console.log(`[ProcessDocUseCase]     - _id: ${chunk._id}`);
        console.log(`[ProcessDocUseCase]     - index: ${chunk.index}`);
        console.log(`[ProcessDocUseCase]     - page: ${chunk.page}`);
        console.log(`[ProcessDocUseCase]     - sectionType: ${chunk.sectionType}`);
        console.log(`[ProcessDocUseCase]     - content preview: ${(chunk.content || '').substring(0, 80)}...`);
      });
    } else {
      console.error(`[ProcessDocUseCase] ⚠️  ADVERTENCIA: No se pudieron recuperar chunks de ejemplo después de guardar`);
    }

    // Retornar datos necesarios
    return {
      pdf: {
        _id: updatedPdf._id?.toString() || updatedPdf.id || pdfId,
        status: updatedPdf.status,
      },
      chunks: totalInserted,
      embedded: 0, // No se embeben en este paso, eso es para EmbedDocChunksUseCase
    };
  }
}

