import { describe, expect, it } from "vitest";
import { buildProgramEnterState } from "../services/superProgramEnterService";
import { safeTenantId } from "../services/superSystemShared";

describe("safeTenantId", () => {
  it("normalizes ids to a safe kebab-case identifier", () => {
    expect(safeTenantId("  School 01 / شرق ")).toBe("school-01");
  });
});

describe("buildProgramEnterState", () => {
  const tenants = [
    { id: "t1", name: "A", governorate: "مسقط", enabled: true },
    { id: "t2", name: "B", governorate: "ظفار", enabled: true },
  ];

  it("returns all tenants for platform owner", () => {
    const state = buildProgramEnterState({
      tenants,
      owner: true,
      canAccessSystem: true,
      userGovernorate: "مسقط",
      primaryRoleLabel: "مالك المنصة",
    });

    expect(state.visibleTenants).toHaveLength(2);
    expect(state.accessDescription).toContain("مالك المنصة");
  });

  it("filters tenants by governorate for regional super user", () => {
    const state = buildProgramEnterState({
      tenants,
      owner: false,
      canAccessSystem: true,
      userGovernorate: "مسقط",
      primaryRoleLabel: "مشرف نطاق",
    });

    expect(state.visibleTenants.map((tenant) => tenant.id)).toEqual(["t1"]);
    expect(state.accessDescription).toContain("مشرف نطاق");
  });

  it("returns no tenants when user has no system access", () => {
    const state = buildProgramEnterState({
      tenants,
      owner: false,
      canAccessSystem: false,
      userGovernorate: "مسقط",
    });

    expect(state.visibleTenants).toEqual([]);
  });
});
