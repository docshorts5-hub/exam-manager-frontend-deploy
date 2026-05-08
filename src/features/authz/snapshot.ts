import type { AuthzSnapshot, SaaSRole } from "./types";

function normalizeRoleLike(raw: unknown): SaaSRole | null {
  const role = String(raw ?? "").trim().toLowerCase();
  if (!role) return null;

  if (["super_admin", "superadmin", "super admin", "super-admin"].includes(role)) {
    return "super_admin";
  }

  if (["ministry_super", "ministry super", "ministry-super", "super_ministry"].includes(role)) {
    return "ministry_super";
  }

  if (role === "super") {
    return "super";
  }

  if (["tenant_admin", "tenant admin", "tenant-admin", "admin"].includes(role)) {
    return "tenant_admin";
  }

  return null;
}

function normalizeRolesArray(input: unknown): SaaSRole[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => normalizeRoleLike(x))
    .filter((x): x is SaaSRole => !!x);
}

export function buildAuthzSnapshot(input: any): AuthzSnapshot {
  const profile = input?.profile || input?.allow || input?.userProfile || null;
  const user = input?.user || null;

  const explicitRoles = normalizeRolesArray(profile?.roles || []);
  const singleRole = normalizeRoleLike(profile?.role);
  const roles = explicitRoles.length ? explicitRoles : singleRole ? [singleRole] : [];

  const isSuperAdmin = !!input?.isSuperAdmin || singleRole === "super_admin";
  const isSuper = !!input?.isSuper || singleRole === "super" || singleRole === "ministry_super";

  return {
    isAuthenticated: !!user,
    isEnabled: profile?.enabled === true,
    isSuperAdmin,
    isSuper,
    tenantId: input?.tenantId ?? profile?.tenantId ?? null,
    roles,
    supportTenantId: input?.supportTenantId ?? null,
    supportUntil: typeof input?.supportUntil === "number" ? input.supportUntil : null,
    isSupportMode: !!input?.isSupportMode,
    displayName: profile?.userName ?? profile?.name ?? user?.displayName ?? null,
  };
}
