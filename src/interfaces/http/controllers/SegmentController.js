import { CreateSegmentFromRagUseCase } from "../../../application/use-cases/segment/CreateSegmentFromRagUseCase.js";
import { GetSegmentByIdUseCase } from "../../../application/use-cases/segment/GetSegmentByIdUseCase.js";
import { DocRepositoryMongo } from "../../../infrastructure/db/repositories/DocRepositoryMongo.js";
import { SegmentRepositoryMongo } from "../../../infrastructure/db/repositories/SegmentRepositoryMongo.js";
import { createResponse } from "../../../infrastructure/http/utils/response.js";
import { CloudinaryService } from "../../../infrastructure/services/adapters/CloudinaryService.js";

/**
 * Controller HTTP para Segmentos
 * Implementa la capa de interfaces HTTP de la arquitectura hexagonal
 */
export class SegmentController {
  constructor() {
    this.segmentRepository = new SegmentRepositoryMongo();
    this.docRepository = new DocRepositoryMongo();

    this.createSegmentFromRagUseCase = new CreateSegmentFromRagUseCase(
      this.segmentRepository,
      this.docRepository
    );
    this.getSegmentByIdUseCase = new GetSegmentByIdUseCase(
      this.segmentRepository
    );

    this.cloudinaryService = new CloudinaryService();
  }

  /**
   * POST /api/segments/create/from-rag
   * Crea un segmento a partir de un resultado RAG (segmentCandidate)
   */
  async createFromRag(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const payload = req.body;

      console.log("[SegmentController] 📥 Request createFromRag recibido");
      console.log("[SegmentController] TenantId:", tenantId);
      console.log("[SegmentController] UserId:", userId);
      console.log("[SegmentController] Payload keys:", Object.keys(payload || {}));
      console.log("[SegmentController] Payload.preview:", {
        sourceDocId: payload?.sourceDocId,
        descripcionQuery: payload?.descripcionQuery,
        canalesOrigen: payload?.canalesOrigen,
        imageUrlPromo: payload?.imageUrlPromo,
        clientesCount: Array.isArray(payload?.clientes) ? payload.clientes.length : 0,
      });

      const result = await this.createSegmentFromRagUseCase.execute({
        tenantId,
        userId,
        payload,
      });

      return res.status(201).json(
        createResponse(true, "Segmento creado correctamente", {
          segment: result.segment,
        })
      );
    } catch (error) {
      console.error("[SegmentController] ❌ Error en createFromRag:", error.message);
      console.error("[SegmentController] Error type:", error.constructor?.name);
      if (error.stack) {
        console.error("[SegmentController] Error stack:", error.stack);
      }
      return res.status(400).json(
        createResponse(false, error.message || "Error al crear segmento")
      );
    }
  }

  /**
   * POST /api/segments/upload-image
   * Sube una imagen a Cloudinary y devuelve la URL segura
   */
  async uploadImage(req, res) {
    try {
      const { tenantId, id: userId } = req.user;

      if (!this.cloudinaryService || !this.cloudinaryService.isConfigured) {
        return res.status(500).json(
          createResponse(
            false,
            "Cloudinary no está configurado. Revisa CLOUDINARY_URL en el servidor."
          )
        );
      }

      if (!req.file || !req.file.buffer) {
        return res
          .status(400)
          .json(createResponse(false, "No se recibió ninguna imagen válida."));
      }

      const originalName = req.file.originalname || "segment-image";
      const timestamp = Date.now();
      const publicId = `segment-${tenantId}-${userId}-${timestamp}`;

      console.log("[SegmentController] 📤 Iniciando subida de imagen a Cloudinary...");
      console.log("[SegmentController] Tamaño del buffer:", req.file.buffer.length, "bytes");
      console.log("[SegmentController] Nombre original:", originalName);

      const result = await this.cloudinaryService.uploadImageBuffer(
        req.file.buffer,
        {
          folder: "segments",
          publicId,
          originalName,
        }
      ).catch((error) => {
        // Capturar y transformar errores específicos
        console.error("[SegmentController] ❌ Error capturado en uploadImageBuffer:", {
          name: error.name,
          message: error.message,
          timeout: error.timeout,
          http_code: error.http_code || error.originalError?.http_code,
        });

        // Detectar errores de timeout
        if (error.timeout || 
            error.name === 'CloudinaryTimeoutError' || 
            error.http_code === 499 || 
            error.message?.includes('Timeout') ||
            error.originalError?.http_code === 499) {
          throw new Error(
            'La subida de imagen tardó demasiado. Intenta con una imagen más pequeña o verifica tu conexión a internet.'
          );
        }

        // Re-lanzar otros errores
        throw error;
      });

      console.log("[SegmentController] ✅ Imagen subida correctamente:", {
        publicId: result.public_id,
        url: result.secure_url || result.url,
      });

      return res.status(201).json(
        createResponse(true, "Imagen subida correctamente", {
          imageUrl: result.secure_url || result.url,
          publicId: result.public_id,
        })
      );
    } catch (error) {
      console.error("[SegmentController] ❌ Error en uploadImage:", {
        name: error.constructor?.name,
        message: error.message,
        stack: error.stack,
      });

      // Determinar código de estado y mensaje según el tipo de error
      let statusCode = 500;
      let errorMessage = error.message || "Error al subir imagen para segmento";

      if (error.message?.includes('Timeout') || error.message?.includes('tardó demasiado')) {
        statusCode = 408; // Request Timeout
        errorMessage = error.message;
      } else if (error.message?.includes('Cloudinary no está configurado')) {
        statusCode = 500;
        errorMessage = "Cloudinary no está configurado. Contacta al administrador.";
      } else if (error.message?.includes('Buffer de imagen inválido')) {
        statusCode = 400;
        errorMessage = "La imagen recibida no es válida.";
      }

      return res.status(statusCode).json(
        createResponse(false, errorMessage)
      );
    }
  }

  /**
   * GET /api/segments/:segmentId
   * Obtiene un segmento por ID (incluyendo clientes[])
   */
  async getById(req, res) {
    try {
      const { tenantId } = req.user;
      const { segmentId } = req.params;

      const result = await this.getSegmentByIdUseCase.execute({
        tenantId,
        segmentId,
      });

      return res.json(
        createResponse(true, "Segmento obtenido correctamente", {
          segment: result.segment,
        })
      );
    } catch (error) {
      if (error.code === "SEGMENT_NOT_FOUND") {
        return res
          .status(404)
          .json(createResponse(false, "Segmento no encontrado"));
      }

      console.error("[SegmentController] Error en getById:", error);
      return res.status(500).json(
        createResponse(false, "Error al obtener segmento", {
          error: error.message,
        })
      );
    }
  }
}


