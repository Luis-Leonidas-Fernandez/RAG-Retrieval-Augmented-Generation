/**
 * Caso de uso para subir un documento
 * Orquesta la lógica de negocio del proceso de subida de documento
 */
export class UploadDocUseCase {
  constructor(pdfRepository) {
    this.pdfRepository = pdfRepository;
  }

  /**
   * Ejecuta el caso de uso de subir documento
   * @param {Object} request - Objeto con tenantId, userId y file
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {Object} request.file - Objeto file de multer (originalname, filename, path, size, mimetype)
   * @returns {Promise<Object>} Documento creado
   * @throws {Error} Si el archivo no existe o el MIME type no es válido
   */
  async execute({ tenantId, userId, file }) {
    // Validar que el archivo exista
    if (!file) {
      throw new Error("No se recibió archivo");
    }

    // Validar MIME type (el middleware ya lo valida, pero por seguridad adicional)
    const ALLOWED_MIME_TYPES = [
      // Documentos
      "application/pdf",
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-powerpoint", // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
      // Texto
      "text/plain", // .txt
      "text/markdown", // .md
      "text/x-markdown", // .md
      // Imágenes
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/bmp",
      "image/tiff",
      "image/webp",
    ];

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`Tipo de archivo no permitido: ${file.mimetype}`);
    }

    // Construir datos del documento
    const pdfData = {
      originalName: file.originalname,
      fileName: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      status: "uploaded", // Status inicial explícito
    };

    // Crear documento en el repositorio
    const pdf = await this.pdfRepository.create(tenantId, userId, pdfData);

    return { pdf };
  }
}

