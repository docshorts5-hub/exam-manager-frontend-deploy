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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function safeTenantId(tenantId: string | null | undefined) {
  return clean(tenantId) || "default";
}

export function safePathSegment(value: string, label = "path segment") {
  const segment = clean(value);
  if (!segment) throw new Error(`${label} is required.`);
  if (segment.includes("/") || segment.includes("\\")) {
    throw new Error(`Invalid ${label}: ${segment}`);
  }
  return segment;
}

export function tenantCol(tenantId: string, sub: string) {
  return `tenants/${safeTenantId(tenantId)}/${safePathSegment(sub, "subcollection")}`;
}

export function tenantDoc(tenantId: string, sub: string, id: string) {
  return `tenants/${safeTenantId(tenantId)}/${safePathSegment(sub, "subcollection")}/${safePathSegment(id, "doc id")}`;
}

export function tenantSettingsDoc(tenantId: string, id: string) {
  return tenantDoc(tenantId, "settings", id);
}
