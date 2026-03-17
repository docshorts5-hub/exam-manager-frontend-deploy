import type { AuthzSnapshot, SaaSRole } from "./types";

function normalizeRoleLike(raw: unknown): SaaSRole | null {
  const role = String(raw ?? "").trim().toLowerCase();
  if (!role) return null;
  if (["super_admin", "superadmin", "super admin", "super-admin"].includes(role)) return "super_admin";
  if (role === "super") return "super";
  if (["admin", "tenant_admin", "tenant admin"].includes(role)) return "tenant_admin";
  if (["manager", "tenant_manager", "tenant manager"].includes(role)) return "manager";
  if (["staff", "operator", "tenant_operator"].includes(role)) return "staff";
  if (["viewer", "read_only", "readonly"].includes(role)) return "viewer";
  if (role === "user") return "staff";
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
  const isSuper = !!input?.isSuper || singleRole === "super";

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
