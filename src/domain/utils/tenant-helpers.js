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

