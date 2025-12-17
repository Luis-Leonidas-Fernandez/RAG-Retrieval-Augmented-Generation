/**
 * Entidad de dominio Tenant
 */
export class Tenant {
  constructor({ id, name, slug, brandName, settings }) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.brandName = brandName || null;
    this.settings = settings || {};
  }

  /**
   * Serializa la entidad a JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      brandName: this.brandName,
      settings: this.settings,
    };
  }
}

