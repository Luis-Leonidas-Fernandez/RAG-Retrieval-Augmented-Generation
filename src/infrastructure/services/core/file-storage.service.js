import fs from "fs/promises";

/**
 * Elimina físicamente un archivo PDF del disco
 * @param {string} filePath - Ruta del archivo a eliminar
 * @returns {Promise<boolean>} - true si se eliminó correctamente, false si no existía o hubo error
 */
export async function deletePdfFile(filePath) {
  try {
    if (!filePath) {
      return false;
    }

    // Verificar si el archivo existe
    try {
      await fs.access(filePath);
    } catch (accessError) {
      // Archivo no existe, no es un error
      console.log(`[File Storage] Archivo no existe (ya eliminado): ${filePath}`);
      return false;
    }

    // Eliminar archivo
    await fs.unlink(filePath);
    console.log(`[File Storage] Archivo eliminado correctamente: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[File Storage] Error al eliminar archivo ${filePath}:`, error.message);
    return false;
  }
}

