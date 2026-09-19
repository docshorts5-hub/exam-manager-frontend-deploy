export type ActualAdministrativeActor =
  | "platform_owner"
  | "ministry_super"
  | "governorate_super"
  | "other";

export type TenantArea = "school" | "diploma";

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function collectIdentityRoles(source: any): string[] {
  if (!source || typeof source !== "object") {
    return [];
  }

  const values: unknown[] = [
    source?.role,
    source?.legacyRole,
    source?.roleScope,
    source?.accountType,
  ];

  if (Array.isArray(source?.roles)) {
    values.push(...source.roles);
  }

  return values
    .map(normalizeRole)
    .filter(Boolean);
}

function hasAnyRole(
  roles: Set<string>,
  allowed: readonly string[]
): boolean {
  return allowed.some((role) => roles.has(role));
}

const OWNER_ROLES = [
  "platform_owner",
  "platform-owner",
  "owner",
  "super_admin",
  "superadmin",
] as const;

const MINISTRY_ROLES = [
  "ministry_super",
  "ministry-super",
  "ministry_supervisor",
  "ministry-supervisor",
] as const;

const GOVERNORATE_ROLES = [
  "super",
  "governorate_super",
  "governorate-super",
  "regional_super",
  "super_regional",
  "governorate",
] as const;

/**
 * Resolves the REAL authenticated administrative identity.
 *
 * SECURITY INVARIANTS:
 * - Never reads localStorage/sessionStorage.
 * - Never reads effectiveRole/viewAsRole/selectedRole.
 * - Never infers identity from a read-only flag or return path.
 * - Owner > Ministry > Governorate precedence is explicit.
 *
 * Temporary tenant-view state may control destination only.
 * It must never redefine who the authenticated user really is.
 */
export function resolveActualAdministrativeActor(
  auth: any
): ActualAdministrativeActor {
  if (Boolean(auth?.isPlatformOwner)) {
    return "platform_owner";
  }

  const roles = new Set<string>([
    ...collectIdentityRoles(auth?.allow),
    ...collectIdentityRoles(auth?.profile),
    ...collectIdentityRoles(auth?.userProfile),
    ...collectIdentityRoles(auth?.user),
  ]);

  if (hasAnyRole(roles, OWNER_ROLES)) {
    return "platform_owner";
  }

  if (
    hasAnyRole(roles, MINISTRY_ROLES) ||
    auth?.allow?.isMinistrySuper === true ||
    auth?.profile?.isMinistrySuper === true ||
    auth?.userProfile?.isMinistrySuper === true
  ) {
    return "ministry_super";
  }

  if (
    hasAnyRole(roles, GOVERNORATE_ROLES) ||
    auth?.allow?.isGovernorateSuper === true ||
    auth?.profile?.isGovernorateSuper === true ||
    auth?.userProfile?.isGovernorateSuper === true
  ) {
    return "governorate_super";
  }

  return "other";
}

/**
 * Determines school/diploma from the current tenant route.
 *
 * Examples:
 * /t/x/dashboard     -> school
 * /t/x/settings      -> school
 * /t/x/dashboard12   -> diploma
 * /t/x/settings12    -> diploma
 */
export function resolveTenantAreaFromPath(
  pathname: string
): TenantArea {
  const path = String(pathname || "")
    .trim()
    .toLowerCase();

  const segments = path
    .split("/")
    .filter(Boolean);

  const tenantPageSegment =
    String(segments[2] || "").trim();

  if (
    tenantPageSegment.endsWith("12") ||
    /\/[^/?#]*12(?:\/|$)/.test(path)
  ) {
    return "diploma";
  }

  return "school";
}

/**
 * Governorate destinations are fixed by the actual tenant area.
 * Stale stored return paths are intentionally ignored.
 */
export function getGovernorateReturnPath(
  area: TenantArea
): string {
  return area === "diploma"
    ? "/exam-supers"
    : "/school-admins";
}

/**
 * Ministry return paths may remain only inside /super-system.
 *
 * Prevents:
 * - role crossover
 * - accidental /exam-supers return
 * - accidental /school-admins return
 * - protocol-relative/open redirect values
 */
export function sanitizeMinistryReturnPath(
  value: unknown
): string {
  const path = String(value || "").trim();

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return "/super-system";
  }

  if (
    path === "/super-system" ||
    path.startsWith("/super-system/")
  ) {
    return path;
  }

  return "/super-system";
}
