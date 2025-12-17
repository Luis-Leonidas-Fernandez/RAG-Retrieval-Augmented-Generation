/**
 * Caso de uso para crear un segmento a partir de un resultado RAG
 * Recibe el JSON estructurado (segmentCandidate) desde el frontend.
 */
export class CreateSegmentFromRagUseCase {
  constructor(segmentRepository, docRepository) {
    this.segmentRepository = segmentRepository;
    this.docRepository = docRepository;
  }

  /**
   * Ejecuta la creación de segmento
   * @param {Object} params
   * @param {string|ObjectId} params.tenantId - ID del tenant (desde el token)
   * @param {string|ObjectId} params.userId - ID del usuario (desde el token)
   * @param {Object} params.payload - JSON basado en segmentCandidate
   */
  async execute({ tenantId, userId, payload }) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload de segmento inválido");
    }

    console.log("[CreateSegmentFromRagUseCase] 🚀 Iniciando creación de segmento");
    console.log("[CreateSegmentFromRagUseCase] TenantId:", tenantId);
    console.log("[CreateSegmentFromRagUseCase] UserId:", userId);
    console.log("[CreateSegmentFromRagUseCase] Payload recibido (preview):", {
      sourceDocId: payload.sourceDocId,
      descripcionQuery: payload.descripcionQuery,
      canalesOrigen: payload.canalesOrigen,
      imageUrlPromo: payload.imageUrlPromo,
      clientesCount: Array.isArray(payload.clientes) ? payload.clientes.length : 0,
    });

    const {
      sourceDocId,
      descripcionQuery,
      canalesOrigen,
      imageUrlPromo, // puede ser string o array
      clientes,
    } = payload;

    if (!sourceDocId) {
      console.error("[CreateSegmentFromRagUseCase] ❌ Validación fallida: sourceDocId es requerido");
      throw new Error("sourceDocId es requerido");
    }

    if (!Array.isArray(clientes) || clientes.length === 0) {
      console.error("[CreateSegmentFromRagUseCase] ❌ Validación fallida: clientes vacío o no es array");
      throw new Error("clientes debe ser un array con al menos un elemento");
    }

    // Normalizar imágenes: al menos una requerida
    console.log("[CreateSegmentFromRagUseCase] 🔄 Normalizando imágenes desde imageUrlPromo:", imageUrlPromo);

    let images = Array.isArray(imageUrlPromo)
      ? imageUrlPromo.filter(
          (u) => typeof u === "string" && u.trim()
        )
      : (typeof imageUrlPromo === "string" && imageUrlPromo.trim()
          ? [imageUrlPromo.trim()]
          : []);

    console.log("[CreateSegmentFromRagUseCase] 🔍 Imágenes normalizadas:", images);

    if (images.length === 0) {
      console.error("[CreateSegmentFromRagUseCase] ❌ Validación fallida: no hay imágenes promocionales");
      throw new Error(
        "Debes subir al menos una imagen promocional para crear un segmento"
      );
    }

    // Validar que el documento fuente existe y pertenece al tenant
    console.log("[CreateSegmentFromRagUseCase] 🔍 Verificando documento fuente en tenant:", tenantId);
    const doc = await this.docRepository.findById(tenantId, sourceDocId, {
      includeDeleted: false,
    });

    if (!doc) {
      console.error("[CreateSegmentFromRagUseCase] ❌ Validación fallida: documento fuente no encontrado o no pertenece al tenant");
      throw new Error("Documento fuente no encontrado o no pertenece al tenant");
    }

    // Normalizar datos del segmento; forzar tenantId y userId desde contexto,
    // ignorando cualquier valor que venga en el payload para esos campos.
    const segmentData = {
      sourceDocId,
      descripcionQuery: descripcionQuery || "",
      canalesOrigen: Array.isArray(canalesOrigen) ? canalesOrigen : ["EMAIL"],
      // ÚNICO campo con TODAS las URLs
      imageUrlPromo: images,
      clientes: clientes.map((c) => ({
        nombre: String(c?.nombre || "").trim(),
        email: String(c?.email || "").trim(),
        vehiculo: String(c?.vehiculo || "").trim(),
        telefonoRaw: c?.telefonoRaw ?? c?.telefono ?? null,
        telefonoE164: c?.telefonoE164 ?? null,
      })),
    };

    console.log("[CreateSegmentFromRagUseCase] ✅ SegmentData construido:", segmentData);

    const created = await this.segmentRepository.create(
      tenantId,
      userId,
      segmentData
    );

    return { segment: created };
  }
}


