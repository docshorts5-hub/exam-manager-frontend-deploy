import { describe, expect, it, vi } from "vitest";
import { buildArchiveSnapshotName, buildResultsRunSubtitle } from "../services/resultsActions";

describe("resultsActions", () => {
  it("builds a subtitle from run id and created date", () => {
    expect(buildResultsRunSubtitle("run-123", "2026-03-07T10:20:30.000Z")).toBe(
      "Run ID: run-123 • 2026-03-07",
    );
  });

  it("falls back when created date is missing", () => {
    expect(buildResultsRunSubtitle("run-456")).toBe("Run ID: run-456 • —");
  });

  it("builds an archive snapshot descriptor", () => {
    const date = new Date("2026-03-07T10:20:30.000Z");
    const toLocaleTimeString = vi
      .spyOn(Date.prototype, "toLocaleTimeString")
      .mockReturnValue("١٠:٢٠:٣٠ ص");

    const result = buildArchiveSnapshotName(date);

    expect(result).toEqual({
      iso: "2026-03-07T10:20:30.000Z",
      name: "2026-03-07 ١٠:٢٠:٣٠ ص",
      archiveId: "arch-2026-03-07T10:20:30.000Z",
    });

    toLocaleTimeString.mockRestore();
  });
});
