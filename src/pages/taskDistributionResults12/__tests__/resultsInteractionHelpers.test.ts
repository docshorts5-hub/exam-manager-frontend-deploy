import { describe, expect, it, vi } from "vitest";
import {
  addResultsBlockedCellMessage,
  buildResultsBlockedCellKey,
  removeResultsBlockedCellMessage,
  safeLoadResultsUnavailability,
} from "../services/resultsInteractionHelpers";
import { scheduleResultsBlockedCellMessage } from "../services/resultsBlockedCellLifecycle";

describe("resultsInteractionHelpers", () => {
  it("builds blocked-cell keys with trimmed teacher and sub-column values", () => {
    expect(buildResultsBlockedCellKey("  أحمد ", "  2026-06-01|AM ")).toBe("أحمد||2026-06-01|AM");
  });

  it("adds blocked-cell messages immutably", () => {
    const prev = { "old||key": "old" };
    const next = addResultsBlockedCellMessage(prev, "Teacher A", "sub-1", "blocked");
    expect(next).toEqual({
      "old||key": "old",
      "Teacher A||sub-1": "blocked",
    });
    expect(prev).toEqual({ "old||key": "old" });
  });

  it("removes blocked-cell messages immutably", () => {
    const prev = {
      "Teacher A||sub-1": "blocked",
      "Teacher B||sub-2": "other",
    };
    const next = removeResultsBlockedCellMessage(prev, "Teacher A", "sub-1");
    expect(next).toEqual({ "Teacher B||sub-2": "other" });
    expect(prev).toEqual({
      "Teacher A||sub-1": "blocked",
      "Teacher B||sub-2": "other",
    });
  });

  it("returns loaded unavailability rules when loader succeeds", () => {
    const loader = vi.fn(() => [{ teacherId: "t1" }]);
    expect(safeLoadResultsUnavailability(loader as any)).toEqual([{ teacherId: "t1" }]);
  });

  it("returns an empty array when loader throws", () => {
    const loader = vi.fn(() => {
      throw new Error("boom");
    });
    expect(safeLoadResultsUnavailability(loader as any)).toEqual([]);
  });
  it("schedules adding then removing blocked-cell messages", () => {
    let state: Record<string, string> = {};
    const setBlockedCellMsg = (updater: (prev: Record<string, string>) => Record<string, string>) => {
      state = updater(state);
    };
    let scheduled: (() => void) | null = null;
    const scheduler = (callback: () => void, delayMs: number) => {
      expect(delayMs).toBe(8000);
      scheduled = callback;
      return 1;
    };

    scheduleResultsBlockedCellMessage(setBlockedCellMsg, "Teacher A", "sub-1", "blocked", scheduler);
    expect(state).toEqual({ "Teacher A||sub-1": "blocked" });
    expect(scheduled).toBeTruthy();

    scheduled?.();
    expect(state).toEqual({});
  });

});
