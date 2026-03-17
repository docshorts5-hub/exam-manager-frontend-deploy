// src/services/tenantPaths.ts
/**
 * ✅ Centralized paths for multi-tenant Firestore structure.
 * Structure:
 *  - tenants/{tenantId}/exams/{id}
 *  - tenants/{tenantId}/teachers/{id}
 *  - tenants/{tenantId}/rooms/{id}
 *  - tenants/{tenantId}/audit/{id}
 *  - tenants/{tenantId}/settings/{docId}
 */
export function tenantCol(tenantId: string, sub: string) {
  return `tenants/${tenantId}/${sub}`;
}

export function tenantDoc(tenantId: string, sub: string, id: string) {
  return `tenants/${tenantId}/${sub}/${id}`;
}
