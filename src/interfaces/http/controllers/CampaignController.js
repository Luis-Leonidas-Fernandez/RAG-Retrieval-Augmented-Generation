import { createResponse } from "../../../infrastructure/http/utils/response.js";
import { CampaignServiceWrapper } from "../../../infrastructure/services/adapters/campaign-service-wrapper.service.js";
import { SegmentRepositoryMongo } from "../../../infrastructure/db/repositories/SegmentRepositoryMongo.js";
import { TenantRepositoryMongo } from "../../../infrastructure/db/repositories/TenantRepositoryMongo.js";
import { CampaignFilterService } from "../../../infrastructure/services/core/campaign-filter.service.js";
import { CampaignSentModel } from "../../../infrastructure/db/models/campaign-sent.model.js";
import { getTenantBrandName } from "../../../domain/utils/tenant-helpers.js";

/**
 * Controller HTTP para Campañas
 * Actúa como proxy hacia el segundo backend de campañas
 */
export class CampaignController {
  constructor() {
    this.campaignService = new CampaignServiceWrapper();
    this.segmentRepository = new SegmentRepositoryMongo();
    this.tenantRepository = new TenantRepositoryMongo();
    this.campaignFilterService = new CampaignFilterService();
  }

  /**
   * POST /api/campaigns/start-from-segment
   * Crea e inicia una campaña desde un segmento RAG
   */
  async startFromSegment(req, res) {
    try {
      const { tenantId, id: userId } = req.user;
      const { segmentId } = req.body;
      const jwtToken = req.headers.authorization?.replace("Bearer ", "") || null;

      // 1. Validaciones iniciales
      if (!segmentId) {
        console.error("[CampaignController] ❌ Validación fallida: segmentId es requerido");
        return res.status(400).json(
          createResponse(false, "segmentId es requerido")
        );
      }

      // 2. Validar JWT antes de continuar (mover antes de la consulta a DB)
      if (!jwtToken) {
        console.error("[CampaignController] ❌ JWT no disponible en headers");
        return res.status(401).json(
          createResponse(false, "Token de autenticación requerido")
        );
      }

      // 3. Obtener el segmento desde MongoDB para construir el payload
      const segment = await this.segmentRepository.findById(tenantId, segmentId);
      
      if (!segment) {
        console.error("[CampaignController] ❌ Segmento no encontrado:", segmentId);
        return res.status(404).json(
          createResponse(false, "Segmento no encontrado")
        );
      }

      // Obtener tenant para determinar brandName efectivo
      let tenant = null;
      try {
        tenant = await this.tenantRepository.findById(tenantId);
      } catch (e) {
        console.warn("[CampaignController] ⚠️ Error al cargar tenant por ID:", tenantId, e?.message);
      }

      const brandName = getTenantBrandName(tenant);

      // 4. Construir payload para el segundo backend
      const nombreCampaña = `Promos ${brandName} del mes`;
      const primeraImagen =
        Array.isArray(segment.imageUrlPromo) && segment.imageUrlPromo.length > 0
          ? segment.imageUrlPromo[0]
          : null;

      const payload = {
        segmentId: segment._id?.toString() || segment.id,
        nombreCampaña,
        canales: segment.canalesOrigen || ["email"],
        jwtToken: jwtToken, // ⚠️ IMPORTANTE: JWT para que el servicio de campañas pueda autenticarse con vector-rag cuando haga la llamada de vuelta
        ...(primeraImagen && {
          plantillaEmail: {
            templateId: "ford-promo-default",
            asunto: nombreCampaña,
            imagenPromoUrl: primeraImagen,
          },
        }),
      };

      // 4.5. NOTA: La validación de límite de campañas por tenant se eliminó.
      // El límite es por cliente individual (cada cliente puede recibir hasta 2 campañas por semana).
      // El filtrado de clientes en SearchRagQueryUseCase ya asegura que solo se muestren clientes
      // que tienen menos de 2 campañas, por lo que no es necesario validar un límite global por tenant.

      // 5. Llamar al segundo backend
      const result = await this.campaignService.createCampaignFromRag(jwtToken, payload);

      // Preparar respuesta final
      const finalResponse = createResponse(true, result.message || "Campaña creada e iniciada correctamente", {
        campaign: result.data,
      });

      // 6. (Opcional) Registrar envíos de campaña para tracking
      if (result.ok && result.data?.campaignId && segment?.clientes && Array.isArray(segment.clientes)) {
        try {
          const emails = segment.clientes
            .map(c => c.email)
            .filter(email => email && email.trim());
          
          if (emails.length > 0) {
            // Determinar canal desde payload.canales
            const canales = payload.canales || segment.canalesOrigen || ["email"];
            const hasWhatsApp = canales.some(c => c.toLowerCase().includes('whatsapp') || c.toLowerCase().includes('wa'));
            const channel = hasWhatsApp ? 'WHATSAPP' : 'EMAIL';
            
            // Registrar envíos (pre-registro cuando se crea la campaña)
            // Nota: Esto puede hacerse cuando realmente se envían, pero pre-registramos aquí para tracking
            await this.campaignFilterService.recordCampaignsSent(
              tenantId,
              emails,
              channel,
              result.data.campaignId
            );
          }
        } catch (error) {
          // No fallar la respuesta si el registro de envíos falla
          console.error("[CampaignController] ⚠️ Error al registrar envíos de campaña:", error.message);
        }
      }

      return res.status(201).json(finalResponse);
    } catch (error) {
      const safeTenantId = req?.user?.tenantId;
      const safeUserId = req?.user?.id;
      const safeSegmentId = req?.body?.segmentId;

      console.error("[CampaignController] ❌ Error en startFromSegment:");
      console.error("[CampaignController]   - Mensaje:", error.message);
      console.error("[CampaignController]   - Tipo:", error.constructor?.name);
      console.error("[CampaignController]   - TenantId:", safeTenantId);
      console.error("[CampaignController]   - UserId:", safeUserId);
      console.error("[CampaignController]   - SegmentId:", safeSegmentId);
      
      if (error.stack) {
        console.error("[CampaignController]   - Stack:", error.stack);
      }

      // Determinar código de estado según el tipo de error
      let statusCode = 500;
      if (error.message?.includes("Timeout") || error.message?.includes("timeout")) {
        statusCode = 504; // Gateway Timeout
      } else if (error.message?.includes("401") || error.message?.includes("autenticación")) {
        statusCode = 502; // Bad Gateway (el servicio de campañas tuvo un problema de auth)
      } else if (error.message?.includes("404") || error.message?.includes("no encontrado")) {
        statusCode = 404;
      }
      
      return res.status(statusCode).json(
        createResponse(false, error.message || "Error al crear campaña")
      );
    }
  }
}

