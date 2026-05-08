// src/tenant/getTenantIdFromHost.ts
// Resolve tenantId from subdomain when available, with a development fallback via .env.
// Works even if you don't have a base domain yet.

export type TenantResolution =
  | { ok: true; tenantId: string; source: "subdomain" | "env" }
  | { ok: false; reason: string };

// When you have your real base domain later, add it here (e.g. "exam.om").
// ✅ يمكن ضبطه أيضاً من .env:
//   VITE_BASE_DOMAIN=exam.om
//   VITE_BASE_DOMAIN2=example.com
// For now it can stay empty; resolution will use .env or .local/.localhost.
const KNOWN_BASE_DOMAINS: string[] = [
  // "exam.om",
  (import.meta as any).env?.VITE_BASE_DOMAIN,
  (import.meta as any).env?.VITE_BASE_DOMAIN2,
].filter(Boolean);

function cleanTenantId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractSubdomain(hostname: string): string | null {
  // If base domains are configured, use strict extraction: <tenant>.<baseDomain>
  for (const base of KNOWN_BASE_DOMAINS) {
    if (hostname === base) return null;
    if (hostname.endsWith("." + base)) {
      const sub = hostname.slice(0, -(base.length + 1));
      const first = sub.split(".")[0];
      return first || null;
    }
  }

  // Development convenience:
  // - school1.localhost
  // - school1.local
  if (hostname.endsWith(".localhost")) {
    return hostname.split(".")[0] || null;
  }
  if (hostname.endsWith(".local")) {
    return hostname.split(".")[0] || null;
  }

  return null;
}

export function resolveTenantIdFromHost(): TenantResolution {
  const hostname = window.location.hostname.toLowerCase();

  // 1) Try subdomain.
  const sub = extractSubdomain(hostname);
  if (sub) {
    const tenantId = cleanTenantId(sub);
    if (!tenantId) return { ok: false, reason: "Invalid subdomain tenantId" };
    return { ok: true, tenantId, source: "subdomain" };
  }

  // 2) Fallback: .env for localhost dev.
  const envTenant =
    (import.meta as any).env?.VITE_TENANT_ID ||
    (import.meta as any).env?.VITE_DEFAULT_TENANT_ID;

  if (envTenant && String(envTenant).trim()) {
    const tenantId = cleanTenantId(String(envTenant));
    if (!tenantId) return { ok: false, reason: "Invalid VITE_TENANT_ID" };
    return { ok: true, tenantId, source: "env" };
  }

  return {
    ok: false,
    reason:
      "No tenantId found. Use subdomain (e.g. school1.localhost / school1.local) or set VITE_TENANT_ID in .env",
  };
}

// ✅ Backward-compatible named export used by TenantContext
export function getTenantIdFromHost(): TenantResolution {
  return resolveTenantIdFromHost();
}
