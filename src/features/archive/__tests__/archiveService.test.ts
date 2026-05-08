import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeArchiveItems, restoreArchivedRun } from "../services/archiveService";

const listArchivedRuns = vi.fn();
const saveRun = vi.fn();

vi.mock("../../../utils/taskDistributionStorage", () => ({
  listArchivedRuns,
  saveRun,
  deleteArchivedRun: vi.fn(),
}));

vi.mock("../../../services/functionsClient", () => ({
  callFn: vi.fn(),
}));

vi.mock("../../../services/cloudArchive.service", () => ({
  listCloudArchive: vi.fn(),
}));

describe("archiveService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges local and cloud archive rows into a single both-source item", () => {
    listArchivedRuns.mockReturnValue([
      {
        archiveId: "run-1",
        name: "Local copy",
        createdAtISO: "2026-03-01T10:00:00.000Z",
        run: { runId: "local-run" },
      },
    ]);

    const items = mergeArchiveItems("tenant-a", [
      {
        archiveId: "run-1",
        name: "Cloud copy",
        createdAtISO: "2026-03-02T10:00:00.000Z",
      } as any,
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].archiveId).toBe("run-1");
    expect(items[0].__source).toBe("both");
    expect(items[0].name).toBe("Local copy");
    expect(items[0].run).toEqual({ runId: "local-run" });
    expect(items[0].createdAtISO).toBe("2026-03-01T10:00:00.000Z");
  });

  it("restores a run only when archive row includes a run payload", () => {
    expect(restoreArchivedRun("tenant-a", { archiveId: "a-1", run: { runId: "r-1" } } as any)).toBe(true);
    expect(saveRun).toHaveBeenCalledWith("tenant-a", { runId: "r-1" });

    saveRun.mockClear();
    expect(restoreArchivedRun("tenant-a", { archiveId: "a-2" } as any)).toBe(false);
    expect(saveRun).not.toHaveBeenCalled();
  });
});
