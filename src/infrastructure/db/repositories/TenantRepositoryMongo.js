import { TenantModel } from "../models/tenant.model.js";
import { Tenant } from "../../../domain/entities/Tenant.js";
import { ITenantRepository } from "../../../domain/repositories/ITenantRepository.js";

/**
 * Implementación de ITenantRepository usando Mongoose
 */
export class TenantRepositoryMongo extends ITenantRepository {
  /**
   * Busca un tenant por slug
   */
  async findBySlug(slug) {
    const tenantDoc = await TenantModel.findOne({ slug: slug.toLowerCase() });

    if (!tenantDoc) {
      return null;
    }

    return this._toDomainEntity(tenantDoc);
  }

  /**
   * Busca un tenant por ID
   */
  async findById(id) {
    const tenantDoc = await TenantModel.findById(id);

    if (!tenantDoc) {
      return null;
    }

    return this._toDomainEntity(tenantDoc);
  }

  /**
   * Busca o crea el tenant "default"
   */
  async createOrGetDefault() {
    let tenantDoc = await TenantModel.findOne({ slug: "default" });

    if (!tenantDoc) {
      tenantDoc = await TenantModel.create({
        name: "Default Tenant",
        slug: "default",
      });
    }

    return this._toDomainEntity(tenantDoc);
  }

  /**
   * Convierte un documento Mongoose a entidad de dominio Tenant
   */
  _toDomainEntity(tenantDoc) {
    return new Tenant({
      id: tenantDoc._id.toString(),
      name: tenantDoc.name,
      slug: tenantDoc.slug,
      settings: tenantDoc.settings,
    });
  }
}

