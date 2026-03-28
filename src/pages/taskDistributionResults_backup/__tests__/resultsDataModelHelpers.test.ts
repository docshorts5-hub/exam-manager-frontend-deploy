import { describe, expect, it } from "vitest";
import { buildResultsConflictUids, buildResultsWarnings } from "../services/resultsDataModelHelpers";

const normalizeSubject = (s: string) => String(s || "").trim();

describe("resultsDataModelHelpers", () => {
  it("builds warnings only for assignments missing from exam schedule", () => {
    const warnings = buildResultsWarnings({
      examsFromStorage: [
        { dateISO: "2026-01-01", period: "AM", subject: "رياضيات" },
      ],
      assignments: [
        { taskType: "INVIGILATION", dateISO: "2026-01-01", period: "AM", subject: "رياضيات" },
        { taskType: "INVIGILATION", dateISO: "2026-01-02", period: "AM", subject: "علوم" },
        { taskType: "CORRECTION_FREE", dateISO: "2026-01-03", period: "AM", subject: "لغة" },
      ],
      normalizeSubject,
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("علوم");
    expect(warnings[0]).toContain("عدد: 1");
  });

  it("detects conflicting assignment uids for same teacher/date/period", () => {
    const conflicts = buildResultsConflictUids({
      assignments: [
        { __uid: "a1", taskType: "INVIGILATION", teacherName: "أحمد", dateISO: "2026-01-01", period: "AM" },
        { __uid: "a2", taskType: "RESERVE", teacherName: "أحمد", dateISO: "2026-01-01", period: "AM" },
        { __uid: "a3", taskType: "INVIGILATION", teacherName: "أحمد", dateISO: "2026-01-01", period: "PM" },
        { __uid: "a4", taskType: "CORRECTION_FREE", teacherName: "أحمد", dateISO: "2026-01-01", period: "AM" },
      ],
    });

    expect(conflicts.has("a1")).toBe(true);
    expect(conflicts.has("a2")).toBe(true);
    expect(conflicts.has("a3")).toBe(false);
    expect(conflicts.has("a4")).toBe(false);
  });
});
