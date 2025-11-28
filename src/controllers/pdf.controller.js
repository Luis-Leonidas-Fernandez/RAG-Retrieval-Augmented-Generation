import { saveUploadedPdf, getAllPdfs, deletePdfFile } from "../services/pdf.service.js";

export const uploadPdf = async (req, res) => {
  const file = req.file;
  
  try {
    if (!file) {
      return res.status(400).json({
        ok: false,
        message: "No se recibió archivo",
      });
    }

    const pdfDoc = await saveUploadedPdf(file);

    return res.status(201).json({
      ok: true,
      message: "PDF subido correctamente",
      pdf: pdfDoc,
    });
  } catch (error) {
    console.error("Error al subir PDF:", error);
    
    // Limpiar archivo si falló el guardado en DB
    if (file && file.path) {
      try {
        await deletePdfFile(file.path);
      } catch (cleanupError) {
        console.error("[PDF Controller] Error al limpiar archivo después de error:", cleanupError);
      }
    }
    
    return res.status(400).json({
      ok: false,
      message: error.message || "Error al subir el PDF",
    });
  }
};

export const listPdfs = async (req, res) => {
  try {
    const pdfs = await getAllPdfs();
    return res.json({
      ok: true,
      pdfs,
    });
  } catch (error) {
    console.error("Error al listar PDFs:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener la lista de PDFs",
    });
  }
};
