import { saveUploadedPdf, getAllPdfs, deletePdfFile } from "../services/pdf.service.js";
import { createResponse } from "../utils/response.js";

export const uploadPdf = async (req, res) => {
  const file = req.file;
  const { tenantId, id: userId } = req.user; // CRÍTICO: obtener tenantId y userId del usuario autenticado
  
  try {
    if (!file) {
      return res.status(400).json(
        createResponse(false, "No se recibió archivo")
      );
    }

    const pdfDoc = await saveUploadedPdf(tenantId, userId, file);

    return res.status(201).json(
      createResponse(true, "PDF subido correctamente", {
        pdf: pdfDoc,
      })
    );
  } catch (error) {
    console.error("[PDF Controller] Error al subir PDF:", error);
    
    // Limpiar archivo si falló el guardado en DB
    if (file && file.path) {
      try {
        await deletePdfFile(file.path);
      } catch (cleanupError) {
        console.error("[PDF Controller] Error al limpiar archivo después de error:", cleanupError);
      }
    }
    
    return res.status(400).json(
      createResponse(false, error.message || "Error al subir el PDF")
    );
  }
};

export const listPdfs = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user; // CRÍTICO: obtener tenantId y userId
    const limit = parseInt(req.query.limit || "50", 10);
    const skip = parseInt(req.query.skip || "0", 10);
    const allUsers = req.query.allUsers === "true"; // Admin puede ver todos los PDFs del tenant

    const pdfs = await getAllPdfs(tenantId, allUsers ? null : userId, { limit, skip });
    return res.json(
      createResponse(true, "PDFs obtenidos correctamente", {
        pdfs,
        count: pdfs.length,
      })
    );
  } catch (error) {
    console.error("[PDF Controller] Error al listar PDFs:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener la lista de PDFs", { error: error.message })
    );
  }
};
