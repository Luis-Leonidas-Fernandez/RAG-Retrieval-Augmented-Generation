import { ChunkModel } from "../models/chunk.model.js";

export const listChunksByPdf = async (req, res) => {
  try {
    const { pdfId } = req.params;
    
    // Paginación con límites
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const maxLimit = parseInt(process.env.CHUNK_LIST_MAX_LIMIT || '500', 10);
    
    // Validar límites
    const safeLimit = Math.min(Math.max(1, limit), maxLimit); // Entre 1 y maxLimit
    const safePage = Math.max(1, page); // Mínimo página 1
    const skip = (safePage - 1) * safeLimit;
    
    // Obtener total para metadata
    const total = await ChunkModel.countDocuments({ pdfId });
    
    // Obtener chunks paginados
    const chunks = await ChunkModel.find({ pdfId })
      .sort({ index: 1 })
      .skip(skip)
      .limit(safeLimit)
      .select('index content page status createdAt') // Solo campos necesarios
      .lean(); // Optimizar memoria retornando objetos planos
    
    return res.json({
      ok: true,
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
    });
  } catch (error) {
    console.error("Error al listar chunks:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener los chunks",
    });
  }
};
