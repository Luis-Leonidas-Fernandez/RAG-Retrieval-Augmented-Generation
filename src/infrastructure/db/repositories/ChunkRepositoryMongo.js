import { ChunkModel } from "../models/chunk.model.js";
import { IChunkRepository } from "../../../domain/repositories/IChunkRepository.js";
import { withTenantAndNotDeleted } from "../../../domain/utils/tenant-helpers.js";
import { buildFlexibleNameRegex } from "../../../application/utils/text-utils.js";

/**
 * Implementación de IChunkRepository usando Mongoose
 */
export class ChunkRepositoryMongo extends IChunkRepository {
  /**
   * Crea múltiples chunks en un solo lote
   */
  async createMany(tenantId, chunks) {
    console.log(`[ChunkRepository] 📝 Creando ${chunks.length} chunks para tenantId: ${tenantId}`);
    
    // Validar que todos los chunks tengan los campos requeridos
    const invalidChunks = chunks.filter(chunk => !chunk.pdfId || !chunk.content);
    if (invalidChunks.length > 0) {
      console.error(`[ChunkRepository] ⚠️  ERROR: ${invalidChunks.length} chunks inválidos (sin pdfId o content)`);
      console.error(`[ChunkRepository] Chunks inválidos:`, invalidChunks.map((c, i) => ({
        index: i,
        hasPdfId: !!c.pdfId,
        hasContent: !!c.content,
        contentLength: c.content?.length || 0
      })));
    }

    // Asegurar que todos los chunks tengan tenantId
    const chunksWithTenant = chunks.map((chunk) => ({
      ...chunk,
      tenantId,
    }));

    // Log de ejemplo del primer chunk para diagnóstico
    if (chunksWithTenant.length > 0) {
      const firstChunk = chunksWithTenant[0];
      console.log(`[ChunkRepository] 📄 Ejemplo del primer chunk:`);
      console.log(`[ChunkRepository]   - pdfId: ${firstChunk.pdfId}`);
      console.log(`[ChunkRepository]   - index: ${firstChunk.index}`);
      console.log(`[ChunkRepository]   - page: ${firstChunk.page}`);
      console.log(`[ChunkRepository]   - sectionType: ${firstChunk.sectionType}`);
      console.log(`[ChunkRepository]   - content length: ${firstChunk.content?.length || 0} caracteres`);
      console.log(`[ChunkRepository]   - content preview: ${(firstChunk.content || '').substring(0, 100)}...`);
      
      // Contar chunks por sectionType
      const sectionTypeCounts = chunksWithTenant.reduce((acc, chunk) => {
        const type = chunk.sectionType || 'paragraph';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      console.log(`[ChunkRepository] 📊 Distribución por sectionType:`, sectionTypeCounts);
    }

    try {
      const startTime = Date.now();
      const chunkDocs = await ChunkModel.insertMany(chunksWithTenant);
      const insertTime = Date.now() - startTime;
      
      console.log(`[ChunkRepository] ✅ ${chunkDocs.length} chunks insertados exitosamente en ${insertTime}ms`);
      
      // Verificar que se guardaron correctamente
      const savedIds = chunkDocs.map(doc => doc._id.toString());
      console.log(`[ChunkRepository] 📋 IDs de los primeros 3 chunks guardados:`, savedIds.slice(0, 3));
      
      return chunkDocs.map((doc) => doc.toObject());
    } catch (error) {
      console.error(`[ChunkRepository] ❌ ERROR al insertar chunks:`, error.message);
      console.error(`[ChunkRepository] Detalles del error:`, {
        name: error.name,
        code: error.code,
        writeErrors: error.writeErrors?.length || 0,
      });
      
      // Si hay errores de escritura, mostrar detalles
      if (error.writeErrors && error.writeErrors.length > 0) {
        console.error(`[ChunkRepository] Errores de escritura (primeros 3):`, 
          error.writeErrors.slice(0, 3).map(err => ({
            index: err.index,
            code: err.code,
            errmsg: err.errmsg
          }))
        );
      }
      
      throw error;
    }
  }

  /**
   * Busca chunks por PDF y tenant
   */
  async findByPdfId(tenantId, pdfId, options = {}) {
    const {
      limit = null,
      skip = 0,
      sort = { index: 1 },
      select = null,
    } = options;

    const query = withTenantAndNotDeleted({ pdfId }, tenantId);

    let queryBuilder = ChunkModel.find(query);

    if (select) {
      queryBuilder = queryBuilder.select(select);
    }

    queryBuilder = queryBuilder.sort(sort);

    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    queryBuilder = queryBuilder.skip(skip).lean();

    return await queryBuilder;
  }

  /**
   * Busca chunks por sus IDs
   */
  async findByIds(tenantId, chunkIds, pdfId = null) {
    const query = withTenantAndNotDeleted(
      {
        _id: { $in: chunkIds },
      },
      tenantId
    );

    if (pdfId) {
      query.pdfId = pdfId;
    }

    return await ChunkModel.find(query)
      .select("_id content index page pdfId")
      .sort({ index: 1 })
      .lean();
  }

  /**
   * Busca un chunk por nombre en el contenido
   * Usa regex flexible para coincidencia parcial de nombres
   * 
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {string} rawName - Nombre a buscar (sin normalizar)
   * @returns {Promise<Object|null>} Chunk encontrado o null
   */
  async findChunkByName(tenantId, pdfId, rawName) {
    if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
      return null;
    }

    const regex = buildFlexibleNameRegex(rawName);
    
    const query = withTenantAndNotDeleted(
      {
        pdfId,
        content: regex,
      },
      tenantId
    );

    return await ChunkModel.findOne(query).lean();
  }

  /**
   * Busca un chunk por vehículo en el contenido
   * Usa regex flexible para coincidencia parcial de vehículos
   * 
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} pdfId - ID del PDF
   * @param {string} rawVehicle - Vehículo a buscar (sin normalizar)
   * @returns {Promise<Object|null>} Chunk encontrado o null
   */
  async findChunkByVehicle(tenantId, pdfId, rawVehicle) {
    if (!rawVehicle || typeof rawVehicle !== "string" || !rawVehicle.trim()) {
      return null;
    }

    const regex = buildFlexibleNameRegex(rawVehicle);
    
    const query = withTenantAndNotDeleted(
      {
        pdfId,
        content: regex,
      },
      tenantId
    );

    return await ChunkModel.findOne(query).lean();
  }

  /**
   * Busca chunks por status
   */
  async findByStatus(tenantId, pdfId, status, options = {}) {
    const { limit = null, skip = 0, sort = { index: 1 }, minIndex = null } = options;

    const query = {
      tenantId,
      pdfId,
      status,
    };

    // Si se especifica minIndex, filtrar por índice mínimo (más confiable que skip)
    if (minIndex !== null && minIndex !== undefined) {
      query.index = { $gte: minIndex };
    }

    let queryBuilder = ChunkModel.find(query).sort(sort);

    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    // Solo usar skip si no se está usando minIndex
    if (minIndex === null || minIndex === undefined) {
      queryBuilder = queryBuilder.skip(skip);
    }

    queryBuilder = queryBuilder.lean();

    return await queryBuilder;
  }

  /**
   * Busca chunks por tipo de sección
   */
  async findBySectionType(tenantId, pdfId, sectionType) {
    const query = {
      tenantId,
      pdfId,
      sectionType,
    };

    return await ChunkModel.find(query)
      .sort({ index: 1 })
      .lean();
  }

  /**
   * Actualiza el status de múltiples chunks
   */
  async updateStatusMany(tenantId, chunkIds, status) {
    const result = await ChunkModel.updateMany(
      { _id: { $in: chunkIds }, tenantId },
      { $set: { status } }
    );

    return result.modifiedCount;
  }

  /**
   * Elimina todos los chunks de un PDF
   */
  async deleteByPdfId(tenantId, pdfId) {
    const result = await ChunkModel.deleteMany({ tenantId, pdfId });
    return result.deletedCount;
  }

  /**
   * Cuenta chunks según criterios
   */
  async count(tenantId, pdfId, options = {}) {
    const { status = null } = options;

    const query = { tenantId, pdfId };
    if (status) {
      query.status = status;
    }

    return await ChunkModel.countDocuments(query);
  }

  /**
   * Elimina chunks de múltiples PDFs
   */
  async deleteByPdfIds(tenantId, pdfIds) {
    const result = await ChunkModel.deleteMany({
      tenantId,
      pdfId: { $in: pdfIds },
    });
    return result.deletedCount;
  }
}

