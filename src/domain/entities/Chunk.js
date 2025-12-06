/**
 * Entidad de dominio Chunk
 */
export class Chunk {
  constructor({
    id,
    tenantId,
    pdfId,
    index,
    content,
    page,
    status,
    sectionType,
    sectionTitle,
    path,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.tenantId = tenantId;
    this.pdfId = pdfId;
    this.index = index;
    this.content = content;
    this.page = page || 1;
    this.status = status || "chunked";
    this.sectionType = sectionType || "paragraph";
    this.sectionTitle = sectionTitle;
    this.path = path;
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
      pdfId: this.pdfId,
      index: this.index,
      content: this.content,
      page: this.page,
      status: this.status,
      sectionType: this.sectionType,
      sectionTitle: this.sectionTitle,
      path: this.path,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

