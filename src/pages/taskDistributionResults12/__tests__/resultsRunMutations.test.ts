import { beforeEach, describe, expect, it, vi } from "vitest";

const saveRun = vi.fn();
const writeMasterTable = vi.fn();

vi.mock("../../../utils/taskDistributionStorage", () => ({
  saveRun,
}));

vi.mock("../masterTableStorage", () => ({
  writeMasterTable,
}));

import {
  buildManualEditWarning,
  persistEditedResultsRun,
  undoEditedResultsRun,
} from "../services/resultsRunMutations";

describe("resultsRunMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a manual edit warning with a default message", () => {
    const result = buildManualEditWarning();
    expect(result.nowISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.warning).toContain("تعديل يدوي");
  });

  it("persists edited assignments and appends a warning", () => {
    const run = {
      runId: "run-1",
      createdAtISO: "2026-01-01T10:00:00.000Z",
      warnings: ["existing"],
      assignments: [{ __uid: "a1" }],
    };
    const nextAssignments = [{ __uid: "a2" }];

    const updated = persistEditedResultsRun({
      tenantId: "tenant-1",
      run,
      nextAssignments,
      note: "manual note",
    });

    expect(updated.assignments).toEqual(nextAssignments);
    expect(updated.warnings).toContain("existing");
    expect(updated.warnings).toContain("manual note");
    expect(saveRun).toHaveBeenCalledWith("tenant-1", updated);
    expect(writeMasterTable).toHaveBeenCalledWith(nextAssignments, {
      runId: "run-1",
      runCreatedAtISO: "2026-01-01T10:00:00.000Z",
      source: "manual",
    });
  });

  it("undoes assignments and appends an undo warning", () => {
    const run = {
      runId: "run-2",
      createdAtISO: "2026-01-02T10:00:00.000Z",
      warnings: [],
      assignments: [{ __uid: "a1" }],
    };
    const restoredAssignments = [{ __uid: "a-old" }];

    const updated = undoEditedResultsRun({
      tenantId: "tenant-2",
      run,
      assignments: restoredAssignments,
    });

    expect(updated.assignments).toEqual(restoredAssignments);
    expect(updated.warnings.at(-1)).toContain("تراجع عن آخر تعديل يدوي");
    expect(saveRun).toHaveBeenCalledWith("tenant-2", updated);
    expect(writeMasterTable).toHaveBeenCalledWith(restoredAssignments, {
      runId: "run-2",
      runCreatedAtISO: "2026-01-02T10:00:00.000Z",
      source: "manual",
    });
  });
});
