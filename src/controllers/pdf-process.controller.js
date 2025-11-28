import { processPdfById } from "../services/pdf-process.service.js";

export const processPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await processPdfById(id);

    res.json({
      ok: true,
      message: "PDF procesado correctamente",
      pdf: result.pdf,
      chunks: result.chunks,      
      embedded: result.embedded, // 👈 NUEVO (opcional)
    });
  } catch (error) {
    console.error("Error al procesar PDF:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

