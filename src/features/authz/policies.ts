import type { AuthzSnapshot, Capability, SaaSRole } from "./types";

const ROLE_CAPS: Record<SaaSRole, Capability[]> = {
  super_admin: [
    "PLATFORM_OWNER",
    "SYSTEM_ADMIN",
    "TENANTS_MANAGE",
    "SUPER_USERS_MANAGE",
    "USERS_MANAGE",
    "TENANT_READ",
    "TENANT_WRITE",
    "TEACHERS_MANAGE",
    "EXAMS_MANAGE",
    "ROOMS_MANAGE",
    "DISTRIBUTION_RUN",
    "REPORTS_VIEW",
    "ARCHIVE_MANAGE",
    "AUDIT_VIEW",
    "SYNC_ADMIN",
    "SETTINGS_MANAGE",
    "SUPPORT_MODE",
  ],
  super: ["SYSTEM_ADMIN", "TENANTS_MANAGE", "USERS_MANAGE", "TENANT_READ", "REPORTS_VIEW"],
  tenant_admin: [
    "USERS_MANAGE",
    "TENANT_READ",
    "TENANT_WRITE",
    "TEACHERS_MANAGE",
    "EXAMS_MANAGE",
    "ROOMS_MANAGE",
    "DISTRIBUTION_RUN",
    "REPORTS_VIEW",
    "ARCHIVE_MANAGE",
    "AUDIT_VIEW",
    "SYNC_ADMIN",
    "SETTINGS_MANAGE",
  ],
  manager: [
    "TENANT_READ",
    "TEACHERS_MANAGE",
    "EXAMS_MANAGE",
    "ROOMS_MANAGE",
    "DISTRIBUTION_RUN",
    "REPORTS_VIEW",
  ],
  staff: ["TENANT_READ", "DISTRIBUTION_RUN", "REPORTS_VIEW"],
  viewer: ["TENANT_READ", "REPORTS_VIEW"],
};

export function normalizeRoles(input: unknown): SaaSRole[] {
  const roles = Array.isArray(input) ? input : [];
  return roles.filter((r): r is SaaSRole => typeof r === "string" && r in ROLE_CAPS);
}

export function capsFromRoles(roles: SaaSRole[] | undefined | null): Set<Capability> {
  const caps = new Set<Capability>();
  for (const role of roles || []) {
    for (const cap of ROLE_CAPS[role] || []) caps.add(cap);
  }
  return caps;
}

export function isPlatformOwner(snapshot: AuthzSnapshot): boolean {
  return snapshot.isSuperAdmin;
}

export function resolveEffectiveRoles(snapshot: AuthzSnapshot): SaaSRole[] {
  if (isPlatformOwner(snapshot)) return ["super_admin"];
  const normalized = normalizeRoles(snapshot.roles);
  if (snapshot.isSuper) return normalized.includes("super") ? normalized : ["super", ...normalized];
  return normalized;
}

export function canAccessCapability(snapshot: AuthzSnapshot, capability: Capability): boolean {
  if (isPlatformOwner(snapshot)) return true;
  return capsFromRoles(resolveEffectiveRoles(snapshot)).has(capability);
}

export function shouldForceOnboarding(snapshot: AuthzSnapshot): boolean {
  if (isPlatformOwner(snapshot) || snapshot.isSuper) return false;
  return !String(snapshot.displayName || "").trim();
}

export function canAccessTenantRoute(snapshot: AuthzSnapshot, routeTenantId: string): { allowed: boolean; redirectTo?: string } {
  if (!routeTenantId) return { allowed: false, redirectTo: "/" };

  if (isPlatformOwner(snapshot)) {
    if (snapshot.isSupportMode && snapshot.supportTenantId) {
      const supportTenantId = String(snapshot.supportTenantId || "").trim();
      const supportUntil = typeof snapshot.supportUntil === "number" ? snapshot.supportUntil : null;
      if (supportUntil && Date.now() >= supportUntil) return { allowed: false, redirectTo: "/super" };
      if (supportTenantId && supportTenantId !== routeTenantId) return { allowed: false, redirectTo: `/t/${supportTenantId}` };
    }
    return { allowed: true };
  }

  const tenantId = String(snapshot.tenantId || "").trim();
  if (!tenantId) return { allowed: false, redirectTo: "/" };
  if (tenantId !== routeTenantId) return { allowed: false, redirectTo: `/t/${tenantId}` };
  return { allowed: true };
}

export function resolveHomePath(snapshot: AuthzSnapshot): string {
  if (!snapshot.isAuthenticated || !snapshot.isEnabled) return "/login";
  if (isPlatformOwner(snapshot)) return "/super";
  if (snapshot.isSuper) return "/super-system";
  const tenantId = String(snapshot.tenantId || "").trim();
  if (tenantId) return `/t/${tenantId}`;
  return "/login";
}



export function canManageAdminSystemRole(snapshot: AuthzSnapshot, role: string): boolean {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (isPlatformOwner(snapshot)) return ["user", "admin", "super", "super_admin"].includes(normalizedRole);
  if (canAccessCapability(snapshot, "SUPER_USERS_MANAGE")) return ["user", "admin", "super"].includes(normalizedRole);
  if (canAccessCapability(snapshot, "USERS_MANAGE")) return ["user", "admin"].includes(normalizedRole);
  return false;
}

export function listAdminSystemAssignableRoles(snapshot: AuthzSnapshot): SaaSRole[] {
  const roles: SaaSRole[] = [];
  if (canManageAdminSystemRole(snapshot, "admin")) roles.push("tenant_admin");
  if (canManageAdminSystemRole(snapshot, "super")) roles.push("super");
  if (canManageAdminSystemRole(snapshot, "super_admin")) roles.push("super_admin");
  return roles;
}

export function resolvePrimaryRoleLabel(snapshot: AuthzSnapshot): string {
  if (isPlatformOwner(snapshot)) return "مالك المنصة";
  if (snapshot.isSuper) return "مشرف نطاق";
  const roles = resolveEffectiveRoles(snapshot);
  if (roles.includes("tenant_admin")) return "مدير جهة";
  if (roles.includes("manager")) return "مدير";
  if (roles.includes("staff")) return "مستخدم تشغيلي";
  return "مستخدم";
}
