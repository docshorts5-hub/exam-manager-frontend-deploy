import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCloudBackupCount,
  runOwnerBackupNow,
  saveAllowlistUser,
  toggleLocalAutoBackup,
} from "../services/superAdminCenterService";

const setDoc = vi.fn();
const docFn = vi.fn((db: unknown, collection: string, id: string) => ({ db, collection, id }));
const listCloudBackups = vi.fn();
const backupNow = vi.fn();
const isAutoBackupEnabled = vi.fn();
const setAutoBackupEnabled = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: docFn,
  setDoc,
}));

vi.mock("../../../firebase/firebase", () => ({
  db: { app: "db" },
}));

vi.mock("../../../utils/dbBackupManager", () => ({
  listCloudBackups,
}));

vi.mock("../../../utils/autoCloudBackup", () => ({
  backupNow,
  isAutoBackupEnabled,
  setAutoBackupEnabled,
}));

describe("superAdminCenterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cloud backup count and falls back to zero on errors", async () => {
    listCloudBackups.mockResolvedValueOnce([{}, {}, {}]);
    await expect(loadCloudBackupCount("tenant-a")).resolves.toBe(3);

    listCloudBackups.mockRejectedValueOnce(new Error("boom"));
    await expect(loadCloudBackupCount("tenant-a")).resolves.toBe(0);
  });

  it("saves allowlist user with trimmed email and tenant", async () => {
    await saveAllowlistUser({
      email: " owner@example.com ",
      enabled: true,
      tenantId: " tenant-a ",
      role: "super_admin",
      governorate: "Baghdad",
    });

    expect(docFn).toHaveBeenCalledWith({ app: "db" }, "allowlist", "owner@example.com");
    expect(setDoc).toHaveBeenCalledWith(
      { db: { app: "db" }, collection: "allowlist", id: "owner@example.com" },
      {
        enabled: true,
        tenantId: "tenant-a",
        role: "super_admin",
        governorate: "Baghdad",
      },
      { merge: true }
    );
  });

  it("delegates owner backup and toggles local auto-backup", async () => {
    backupNow.mockResolvedValue("backup-123");
    await expect(runOwnerBackupNow({ tenantId: "tenant-a", byUid: "u1" })).resolves.toBe("backup-123");

    isAutoBackupEnabled.mockReturnValueOnce(false);
    expect(toggleLocalAutoBackup("tenant-a")).toBe(true);
    expect(setAutoBackupEnabled).toHaveBeenCalledWith("tenant-a", true);
  });
});
