import { PdfModel } from "../models/pdf.model.js";
import { indexPdfChunksInQdrant } from "../services/qdrant.service.js";

export const embedPdfChunks = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el PDF exista (solo verificar existencia, no cargar datos)
    const pdf = await PdfModel.findById(id).select('_id').lean();
    if (!pdf) {
      return res.status(404).json({
        ok: false,
        message: "PDF no encontrado",
      });
    }

    // Llamar al servicio que indexa los chunks en Qdrant
    const result = await indexPdfChunksInQdrant(id);

    return res.json({
      ok: true,
      message: "Chunks indexados en Qdrant correctamente",
      pdfId: id,
      inserted: result.inserted,
    });
  } catch (error) {
    console.error("Error al indexar chunks en Qdrant:", error);
    return res.status(500).json({
      ok: false,
      message:
        error.message || "Error interno al indexar los chunks en Qdrant",
    });
  }
};