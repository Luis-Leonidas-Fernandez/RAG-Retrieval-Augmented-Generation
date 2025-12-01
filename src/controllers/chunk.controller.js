import { ChunkModel } from "../models/chunk.model.js";
import { createResponse } from "../utils/response.js";
import { withTenantAndNotDeleted } from "../utils/tenant-helpers.js";

export const listChunksByPdf = async (req, res) => {
  try {
    const { tenantId } = req.user; // CRÍTICO: obtener tenantId
    const { pdfId } = req.params;
    
    // Paginación con límites
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const maxLimit = parseInt(process.env.CHUNK_LIST_MAX_LIMIT || '500', 10);
    
    // Validar límites
    const safeLimit = Math.min(Math.max(1, limit), maxLimit); // Entre 1 y maxLimit
    const safePage = Math.max(1, page); // Mínimo página 1
    const skip = (safePage - 1) * safeLimit;
    
    // Query con tenantId (CRÍTICO: filtrar por tenant)
    const query = withTenantAndNotDeleted({ pdfId }, tenantId);
    
    // Obtener total para metadata
    const total = await ChunkModel.countDocuments(query);
    
    // Obtener chunks paginados
    const chunks = await ChunkModel.find(query)
      .sort({ index: 1 })
      .skip(skip)
      .limit(safeLimit)
      .select('index content page status createdAt') // Solo campos necesarios
      .lean(); // Optimizar memoria retornando objetos planos
    
    return res.json(
      createResponse(true, "Chunks obtenidos correctamente", {
        pdfId,
        chunks,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
          hasNext: skip + safeLimit < total,
          hasPrev: safePage > 1,
        },
      })
    );
  } catch (error) {
    console.error("[Chunk Controller] Error al listar chunks:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener los chunks", { error: error.message })
    );
  }
};
