/**
 * Interface para repositorio de tenants
 * Define el contrato que deben cumplir las implementaciones
 */
export class ITenantRepository {
  /**
   * Busca un tenant por slug
   * @param {string} slug - Slug del tenant
   * @returns {Promise<Tenant|null>} Tenant encontrado o null
   */
  async findBySlug(slug) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un tenant por ID
   * @param {string} id - ID del tenant
   * @returns {Promise<Tenant|null>} Tenant encontrado o null
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca o crea el tenant "default"
   * @returns {Promise<Tenant>} Tenant default (existente o creado)
   */
  async createOrGetDefault() {
    throw new Error("Method not implemented");
  }
}

