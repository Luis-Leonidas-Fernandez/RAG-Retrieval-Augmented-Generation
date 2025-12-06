/**
 * Entidad de dominio Tenant
 */
export class Tenant {
  constructor({ id, name, slug, settings }) {
    this.id = id;
    this.name = name;
    this.slug = slug;
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
      settings: this.settings,
    };
  }
}

