/**
 * Helpers para NUNCA olvidar el filtro de tenantId en queries
 */

export function withTenant(query, tenantId) {
  return { ...query, tenantId };
}

export function withTenantAndNotDeleted(query, tenantId) {
  return { ...query, tenantId, deletedAt: null };
}

export function withTenantAndActive(query, tenantId) {
  return { ...query, tenantId, isActive: true, deletedAt: null };
}

/**
 * Obtiene el brandName efectivo de un tenant:
 * - tenant.brandName si está definido y no vacío
 * - si no, tenant.name
 * - si tampoco, fallback "Ford"
 */
export function getTenantBrandName(tenant) {
  if (!tenant) {
    return "Ford";
  }

  const raw =
    (tenant.brandName && String(tenant.brandName)) ||
    (tenant.name && String(tenant.name)) ||
    "";

  const trimmed = raw.trim();
  return trimmed || "Ford";
}

