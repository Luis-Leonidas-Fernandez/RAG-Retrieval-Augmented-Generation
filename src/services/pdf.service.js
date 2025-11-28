import { PdfModel } from "../models/pdf.model.js";
import fs from "fs/promises";
import path from "path";

/**
 * Eliminar archivo PDF del disco
 * @param {string} filePath - Ruta del archivo a eliminar
 * @returns {Promise<boolean>} - true si se eliminó correctamente, false si no existía o hubo error
 */
export const deletePdfFile = async (filePath) => {
  try {
    if (!filePath) {
      return false;
    }

    // Verificar si el archivo existe
    try {
      await fs.access(filePath);
    } catch (accessError) {
      // Archivo no existe, no es un error
      console.log(`[PDF Service] Archivo no existe (ya eliminado): ${filePath}`);
      return false;
    }

    // Eliminar archivo
    await fs.unlink(filePath);
    console.log(`[PDF Service] Archivo eliminado correctamente: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[PDF Service] Error al eliminar archivo ${filePath}:`, error.message);
    return false;
  }
};

export const saveUploadedPdf = async (file) => {
  if (!file) {
    throw new Error("No se recibió archivo");
  }

  const doc = await PdfModel.create({
    originalName: file.originalname,
    fileName: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
  });

  return doc;
};

export const getAllPdfs = async (options = {}) => {
  const { limit = 50, skip = 0 } = options;
  
  // Usar .lean() para retornar objetos JavaScript planos (menos memoria)
  // Solo seleccionar campos necesarios para reducir memoria
  const docs = await PdfModel.find()
    .select('originalName fileName path size mimetype status createdAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
  
  return docs;
};




// luego acá vas a agregar:
// - marcar status = "processing"
// - llamar al microservicio en Python
// - guardar info de Qdrant, etc.
