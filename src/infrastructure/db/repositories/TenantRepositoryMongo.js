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
    const normalizedSlug = slug.toLowerCase();
    console.log('[TENANT_REPOSITORY] 🔍 Buscando tenant con slug:', normalizedSlug);
    console.log('[TENANT_REPOSITORY] Base de datos conectada:', TenantModel.db?.databaseName || 'desconocida');
    console.log('[TENANT_REPOSITORY] Colección:', TenantModel.collection?.name || 'desconocida');
    
    const tenantDoc = await TenantModel.findOne({ slug: normalizedSlug });

    if (!tenantDoc) {
      console.error('[TENANT_REPOSITORY] ❌ Tenant NO encontrado con slug:', normalizedSlug);
      console.error('[TENANT_REPOSITORY] Verificando si hay tenants en la colección...');
      
      // Log adicional: contar cuántos tenants hay en total
      const totalTenants = await TenantModel.countDocuments({});
      console.log('[TENANT_REPOSITORY] Total de tenants en la colección:', totalTenants);
      
      if (totalTenants > 0) {
        // Listar los slugs existentes para debug
        const existingTenants = await TenantModel.find({}).select('slug name').lean();
        console.log('[TENANT_REPOSITORY] Tenants existentes:', existingTenants.map(t => ({ slug: t.slug, name: t.name })));
      }
      
      return null;
    }

    console.log('[TENANT_REPOSITORY] ✅ Tenant encontrado:');
    console.log('[TENANT_REPOSITORY] - ID:', tenantDoc._id.toString());
    console.log('[TENANT_REPOSITORY] - Name:', tenantDoc.name);
    console.log('[TENANT_REPOSITORY] - Slug:', tenantDoc.slug);

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
    console.log('[TENANT_REPOSITORY] 🔍 Buscando tenant "default"...');
    console.log('[TENANT_REPOSITORY] Base de datos:', TenantModel.db?.databaseName || 'desconocida');
    console.log('[TENANT_REPOSITORY] Colección:', TenantModel.collection?.name || 'desconocida');
    
    let tenantDoc = await TenantModel.findOne({ slug: "default" });

    if (!tenantDoc) {
      console.log('[TENANT_REPOSITORY] 📝 Tenant "default" no existe, creándolo...');
      try {
        tenantDoc = await TenantModel.create({
          name: "Default Tenant",
          slug: "default",
        });
        console.log('[TENANT_REPOSITORY] ✅ Tenant "default" creado exitosamente:');
        console.log('[TENANT_REPOSITORY] - ID:', tenantDoc._id.toString());
        console.log('[TENANT_REPOSITORY] - Name:', tenantDoc.name);
        console.log('[TENANT_REPOSITORY] - Slug:', tenantDoc.slug);

        // Verificar que realmente se guardó con retry (para manejar consistencia eventual)
        console.log('[TENANT_REPOSITORY] 🔍 Verificando que el tenant se guardó en MongoDB...');
        let verifyTenant = null;
        const maxRetries = 3;
        const retryDelays = [50, 100, 200]; // ms
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            verifyTenant = await TenantModel.findById(tenantDoc._id).lean();
            if (verifyTenant) {
              console.log(`[TENANT_REPOSITORY] ✅ Verificación exitosa (intento ${attempt + 1}/${maxRetries})`);
              console.log('[TENANT_REPOSITORY] - Verified ID:', verifyTenant._id.toString());
              console.log('[TENANT_REPOSITORY] - Verified Slug:', verifyTenant.slug);
              break;
            }
          } catch (verifyError) {
            console.warn(`[TENANT_REPOSITORY] ⚠️ Error en verificación (intento ${attempt + 1}/${maxRetries}):`, verifyError.message);
          }
          
          // Si no se encontró y no es el último intento, esperar antes de reintentar
          if (!verifyTenant && attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          }
        }
        
        if (!verifyTenant) {
          console.warn('[TENANT_REPOSITORY] ⚠️ Tenant no encontrado en verificación inmediata (puede ser delay de consistencia)');
          console.warn('[TENANT_REPOSITORY] El tenant fue creado exitosamente, pero la verificación no lo encontró después de varios intentos');
          console.warn('[TENANT_REPOSITORY] Esto puede ser normal en MongoDB con réplicas. El tenant debería estar disponible en breve.');
          // No lanzar error, el tenant fue creado exitosamente
        }
      } catch (createError) {
        console.error('[TENANT_REPOSITORY] ❌ Error al crear tenant:', createError);
        console.error('[TENANT_REPOSITORY] Error name:', createError.name);
        console.error('[TENANT_REPOSITORY] Error code:', createError.code);
        console.error('[TENANT_REPOSITORY] Error message:', createError.message);
        if (createError.errors) {
          console.error('[TENANT_REPOSITORY] Validation errors:', createError.errors);
        }
        if (createError.stack) {
          console.error('[TENANT_REPOSITORY] Error stack:', createError.stack);
        }
        throw createError;
      }
    } else {
      console.log('[TENANT_REPOSITORY] ✅ Tenant "default" ya existe, ID:', tenantDoc._id.toString());
    }

    return this._toDomainEntity(tenantDoc);
  }

  /**
   * Crea un nuevo tenant con los datos proporcionados
   * @param {{ name: string, slug: string, brandName?: string }} params
   */
  async createTenant({ name, slug, brandName }) {
    const tenantDoc = await TenantModel.create({
      name,
      slug,
      brandName,
    });
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
      brandName: tenantDoc.brandName,
      settings: tenantDoc.settings,
    });
  }
}


