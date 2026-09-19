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
  platform_viewer: [
    "TENANT_READ",
    "REPORTS_VIEW",
    "AUDIT_VIEW",
  ],
  ministry_super: [
    "SYSTEM_ADMIN",
    "REPORTS_VIEW",
    "AUDIT_VIEW",
  ],
  super: [
    "SYSTEM_ADMIN",
    "TENANTS_MANAGE",
    "USERS_MANAGE",
    "REPORTS_VIEW",
  ],
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

  if (normalized.includes("ministry_super")) return ["ministry_super"];
  if (snapshot.isSuper || normalized.includes("super")) return ["super"];

  return normalized;
}

export function canAccessCapability(snapshot: AuthzSnapshot, capability: Capability): boolean {
  if (isPlatformOwner(snapshot)) return true;
  return capsFromRoles(resolveEffectiveRoles(snapshot)).has(capability);
}

function safeReadBrowserStorage(key: string): string {
  if (typeof window === "undefined") return "";

  try {
    return String(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

export function isGovernorateReadOnlyTenantView(routeTenantId: string): boolean {
  const targetTenantId = String(routeTenantId || "").trim();
  if (!targetTenantId) return false;

  const expiresAt = Number(safeReadBrowserStorage("governorateSuperViewExpiresAt") || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const readOnlyFlag = [
    safeReadBrowserStorage("governorateSuperReadOnly"),
    safeReadBrowserStorage("viewAsReadOnly"),
    safeReadBrowserStorage("readOnly"),
  ].some((value) => ["1", "true", "yes"].includes(value.toLowerCase()));

  if (!readOnlyFlag) return false;

  const storedTenantIds = [
    safeReadBrowserStorage("governorateSuperViewTenantId"),
    safeReadBrowserStorage("viewAsTenantId"),
    safeReadBrowserStorage("effectiveTenantId"),
    safeReadBrowserStorage("selectedTenantId"),
    safeReadBrowserStorage("tenantId"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return storedTenantIds.includes(targetTenantId);
}

export function shouldForceOnboarding(snapshot: AuthzSnapshot): boolean {
  if (isPlatformOwner(snapshot) || canAccessCapability(snapshot, "SYSTEM_ADMIN")) return false;
  return !String(snapshot.displayName || "").trim();
}

export function canAccessTenantRoute(
  snapshot: AuthzSnapshot,
  routeTenantId: string
): { allowed: boolean; redirectTo?: string } {
  if (!routeTenantId) return { allowed: false, redirectTo: "/" };

  if (isPlatformOwner(snapshot)) {
    if (snapshot.isSupportMode && snapshot.supportTenantId) {
      const supportTenantId = String(snapshot.supportTenantId || "").trim();
      const supportUntil = typeof snapshot.supportUntil === "number" ? snapshot.supportUntil : null;

      if (supportUntil && Date.now() >= supportUntil) {
        return { allowed: false, redirectTo: "/super" };
      }

      if (supportTenantId && supportTenantId !== routeTenantId) {
        return { allowed: false, redirectTo: `/t/${supportTenantId}` };
      }
    }

    return { allowed: true };
  }

  const roles = resolveEffectiveRoles(snapshot);

  if (roles.includes("ministry_super")) {
    return { allowed: false, redirectTo: "/super" };
  }

  if (roles.includes("super")) {
    return { allowed: false, redirectTo: "/super-system" };
  }

  const tenantId = String(snapshot.tenantId || "").trim();
  if (!tenantId) return { allowed: false, redirectTo: "/" };
  if (tenantId !== routeTenantId) return { allowed: false, redirectTo: `/t/${tenantId}` };

  return { allowed: true };
}

export function resolveHomePath(snapshot: AuthzSnapshot): string {
  if (!snapshot.isAuthenticated || !snapshot.isEnabled) return "/login";
  if (isPlatformOwner(snapshot)) return "/super";

  const roles = resolveEffectiveRoles(snapshot);

  if (roles.includes("ministry_super")) return "/super-system";
  if (roles.includes("super")) return "/super-system";
  if (roles.includes("platform_viewer")) return "/super";

  const tenantId = String(snapshot.tenantId || "").trim();
  if (tenantId) return `/t/${tenantId}`;

  return "/login";
}

export function canManageAdminSystemRole(snapshot: AuthzSnapshot, role: string): boolean {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (isPlatformOwner(snapshot)) {
    return [
      "user",
      "tenant_admin",
      "admin", // legacy
      "super",
      "ministry_super",
      "super_admin",
    ].includes(normalizedRole);
  }

  if (canAccessCapability(snapshot, "SUPER_USERS_MANAGE")) {
    return ["user", "tenant_admin", "admin", "super", "ministry_super"].includes(normalizedRole);
  }

  if (canAccessCapability(snapshot, "USERS_MANAGE")) {
    return ["user", "tenant_admin", "admin"].includes(normalizedRole);
  }

  return false;
}

export function listAdminSystemAssignableRoles(snapshot: AuthzSnapshot): SaaSRole[] {
  const roles: SaaSRole[] = [];

  if (canManageAdminSystemRole(snapshot, "tenant_admin")) roles.push("tenant_admin");
  if (canManageAdminSystemRole(snapshot, "super")) roles.push("super");
  if (canManageAdminSystemRole(snapshot, "ministry_super")) roles.push("ministry_super");
  if (canManageAdminSystemRole(snapshot, "super_admin")) roles.push("super_admin");

  return roles;
}

export function resolvePrimaryRoleLabel(snapshot: AuthzSnapshot): string {
  if (isPlatformOwner(snapshot)) return "مالك المنصة";

  const roles = resolveEffectiveRoles(snapshot);

  if (roles.includes("ministry_super")) return "سوبر الوزارة";
  if (roles.includes("super")) return "سوبر المحافظات";
  if (roles.includes("tenant_admin")) return "مدير المدرسة";

  return "مستخدم";
}
