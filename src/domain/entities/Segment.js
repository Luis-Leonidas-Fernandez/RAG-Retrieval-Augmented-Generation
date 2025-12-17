/**
 * Entidad de dominio Segment
 */
export class Segment {
  constructor({
    id,
    tenantId,
    userId,
    sourceDocId,
    descripcionQuery,
    canalesOrigen,
    imageUrlPromo,
    clientes,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.tenantId = tenantId;
    this.userId = userId;
    this.sourceDocId = sourceDocId;
    this.descripcionQuery = descripcionQuery;
    this.canalesOrigen = Array.isArray(canalesOrigen) ? canalesOrigen : [];
    // Normalizar a ARRAY: siempre trabajamos con array de URLs
    this.imageUrlPromo = Array.isArray(imageUrlPromo)
      ? imageUrlPromo
      : (imageUrlPromo ? [imageUrlPromo] : []);
    this.clientes = Array.isArray(clientes) ? clientes : [];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Serializa la entidad a JSON
   */
  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      userId: this.userId,
      sourceDocId: this.sourceDocId,
      descripcionQuery: this.descripcionQuery,
      canalesOrigen: this.canalesOrigen,
      imageUrlPromo: this.imageUrlPromo,
      clientes: this.clientes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}


