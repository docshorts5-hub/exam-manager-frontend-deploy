import { beforeEach, describe, expect, it, vi } from "vitest";

const loadTenantArray = vi.fn();
const replaceTenantArray = vi.fn();

vi.mock("../../services/tenantData", () => ({
  loadTenantArray,
  replaceTenantArray,
}));

describe("createTenantArrayRepository", () => {
  beforeEach(() => {
    loadTenantArray.mockReset();
    replaceTenantArray.mockReset();
  });

  it("delegates list to loadTenantArray", async () => {
    const rows = [{ id: "1", name: "A" }];
    loadTenantArray.mockResolvedValue(rows);
    const { createTenantArrayRepository } = await import("../createTenantArrayRepository");
    const repo = createTenantArrayRepository<{ id: string; name: string }>("teachers");

    await expect(repo.list("tenant-a")).resolves.toEqual(rows);
    expect(loadTenantArray).toHaveBeenCalledWith("tenant-a", "teachers");
  });

  it("delegates replaceAll with audit metadata", async () => {
    replaceTenantArray.mockResolvedValue(undefined);
    const { createTenantArrayRepository } = await import("../createTenantArrayRepository");
    const repo = createTenantArrayRepository<{ id: string }>("rooms");

    await repo.replaceAll("tenant-a", [{ id: "r1" }], { byUid: "user-1", auditEntity: "rooms" });

    expect(replaceTenantArray).toHaveBeenCalledWith("tenant-a", "rooms", [{ id: "r1" }], {
      by: "user-1",
      audit: { action: "save", entity: "rooms" },
    });
  });
});
