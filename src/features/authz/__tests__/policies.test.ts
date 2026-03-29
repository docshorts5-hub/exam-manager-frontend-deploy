import { describe, expect, it } from "vitest";
import {
  canAccessCapability,
  canAccessTenantRoute,
  canManageAdminSystemRole,
  isPlatformOwner,
  normalizeRoles,
  resolveEffectiveRoles,
  resolveHomePath,
  resolvePrimaryRoleLabel,
  shouldForceOnboarding,
} from "../policies";
import { buildAuthzSnapshot } from "../snapshot";
import type { AuthzSnapshot } from "../types";

function baseSnapshot(overrides: Partial<AuthzSnapshot> = {}): AuthzSnapshot {
  return {
    isAuthenticated: true,
    isEnabled: true,
    isSuperAdmin: false,
    isSuper: false,
    tenantId: "tenant-a",
    roles: ["staff"],
    supportTenantId: null,
    supportUntil: null,
    isSupportMode: false,
    displayName: "User Name",
    ...overrides,
  };
}

describe("authz policies", () => {
  it("filters unknown roles", () => {
    expect(normalizeRoles(["staff", "unknown", 1, null])).toEqual(["staff"]);
  });

  it("gives super admin precedence over other roles", () => {
    expect(resolveEffectiveRoles(baseSnapshot({ isSuperAdmin: true, roles: ["viewer"] }))).toEqual(["super_admin"]);
  });

  it("preserves super role for regional users", () => {
    expect(resolveEffectiveRoles(baseSnapshot({ isSuper: true, roles: ["viewer"] }))).toEqual(["super", "viewer"]);
  });

  it("treats super admin as platform owner with all capabilities", () => {
    const snapshot = baseSnapshot({ isSuperAdmin: true, roles: ["viewer"] });
    expect(isPlatformOwner(snapshot)).toBe(true);
    expect(resolvePrimaryRoleLabel(snapshot)).toBe("مالك المنصة");
    expect(canAccessCapability(snapshot, "PLATFORM_OWNER")).toBe(true);
    expect(canAccessCapability(snapshot, "SUPER_USERS_MANAGE")).toBe(true);
    expect(canAccessCapability(snapshot, "SETTINGS_MANAGE")).toBe(true);
  });

  it("distinguishes regional super users from the platform owner", () => {
    expect(resolvePrimaryRoleLabel(baseSnapshot({ isSuper: true }))).toBe("مشرف نطاق");
  });

  it("does not give platform owner capability to regional super users", () => {
    const snapshot = baseSnapshot({ isSuper: true, roles: ["super"] });
    expect(isPlatformOwner(snapshot)).toBe(false);
    expect(canAccessCapability(snapshot, "PLATFORM_OWNER")).toBe(false);
    expect(canAccessCapability(snapshot, "SUPER_USERS_MANAGE")).toBe(false);
    expect(canAccessCapability(snapshot, "TENANTS_MANAGE")).toBe(true);
  });



  it("lets the platform owner manage every admin-system role", () => {
    const snapshot = baseSnapshot({ isSuperAdmin: true, roles: ["super_admin"] });
    expect(canManageAdminSystemRole(snapshot, "admin")).toBe(true);
    expect(canManageAdminSystemRole(snapshot, "super")).toBe(true);
    expect(canManageAdminSystemRole(snapshot, "super_admin")).toBe(true);
  });

  it("limits regional super users to admin/user roles inside admin-system role management", () => {
    const snapshot = baseSnapshot({ isSuper: true, roles: ["super"] });
    expect(canManageAdminSystemRole(snapshot, "admin")).toBe(true);
    expect(canManageAdminSystemRole(snapshot, "super")).toBe(false);
    expect(canManageAdminSystemRole(snapshot, "super_admin")).toBe(false);
  });

  it("allows capability from tenant role", () => {
    expect(canAccessCapability(baseSnapshot({ roles: ["tenant_admin"] }), "SETTINGS_MANAGE")).toBe(true);
  });

  it("forces onboarding when regular user has no display name", () => {
    expect(shouldForceOnboarding(baseSnapshot({ displayName: "" }))).toBe(true);
    expect(shouldForceOnboarding(baseSnapshot({ isSuperAdmin: true, displayName: "" }))).toBe(false);
  });

  it("gives platform owner direct tenant access even without support mode", () => {
    expect(
      canAccessTenantRoute(
        baseSnapshot({
          isSuperAdmin: true,
          isSupportMode: false,
          supportTenantId: null,
        }),
        "tenant-a"
      )
    ).toEqual({ allowed: true });
  });

  it("keeps support session tenant pinning when owner is already in support mode", () => {
    expect(
      canAccessTenantRoute(
        baseSnapshot({
          isSuperAdmin: true,
          isSupportMode: true,
          supportTenantId: "tenant-a",
          supportUntil: Date.now() + 60_000,
        }),
        "tenant-b"
      )
    ).toEqual({ allowed: false, redirectTo: "/t/tenant-a" });
  });

  it("redirects regular user to own tenant when route tenant mismatches", () => {
    expect(canAccessTenantRoute(baseSnapshot({ tenantId: "tenant-a" }), "tenant-b")).toEqual({
      allowed: false,
      redirectTo: "/t/tenant-a",
    });
  });

  it("resolves home path by role and auth state", () => {
    expect(resolveHomePath(baseSnapshot({ isSuperAdmin: true }))).toBe("/super");
    expect(resolveHomePath(baseSnapshot({ isSuper: true }))).toBe("/super-system");
    expect(resolveHomePath(baseSnapshot({ tenantId: "tenant-a" }))).toBe("/t/tenant-a");
    expect(resolveHomePath(baseSnapshot({ isAuthenticated: false }))).toBe("/login");
  });
});

describe("buildAuthzSnapshot", () => {
  it("marks super_admin as platform owner when derived from auth state", () => {
    const snapshot = buildAuthzSnapshot({
      user: { displayName: "Owner" },
      profile: { enabled: true, role: "super_admin", tenantId: "default" },
      isSuperAdmin: true,
      isSuper: false,
    });
    expect(snapshot.isSuperAdmin).toBe(true);
    expect(snapshot.tenantId).toBe("default");
    expect(snapshot.displayName).toBe("Owner");
  });
});
