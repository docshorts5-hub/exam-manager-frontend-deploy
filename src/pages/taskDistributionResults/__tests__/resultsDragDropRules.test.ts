import { describe, expect, it } from "vitest";
import {
  colKeyOf,
  conflictInvReserve,
  parseColKey,
  teacherColAssignments,
  teacherHasInvOrResInSameSlot,
  validatePlacement,
} from "../services/resultsDragDropRules";

describe("resultsDragDropRules", () => {
  const base = [
    { __uid: "a1", teacherName: "Ali", dateISO: "2026-01-01", period: "AM", subject: "Math", taskType: "INVIGILATION" },
    { __uid: "a2", teacherName: "Ali", dateISO: "2026-01-01", period: "AM", subject: "Math", taskType: "CORRECTION_FREE" },
    { __uid: "a3", teacherName: "Sara", dateISO: "2026-01-01", period: "PM", subject: "Science", taskType: "RESERVE" },
  ];

  it("builds and parses column keys consistently", () => {
    const key = colKeyOf(base[0]);
    expect(key).toBe("2026-01-01__AM__Math");
    expect(parseColKey(key)).toEqual({ dateISO: "2026-01-01", period: "AM", subject: "Math" });
  });

  it("detects invigilation/reserve conflict", () => {
    expect(conflictInvReserve("INVIGILATION", new Set(["RESERVE"]))).toBe(true);
    expect(conflictInvReserve("RESERVE", new Set(["INVIGILATION"]))).toBe(true);
    expect(conflictInvReserve("CORRECTION_FREE", new Set(["INVIGILATION"]))).toBe(false);
  });

  it("returns assignments for the same teacher and column", () => {
    const list = teacherColAssignments(base, "Ali", "2026-01-01__AM__Math");
    expect(list).toHaveLength(2);
    expect(list.map((x) => x.__uid)).toEqual(["a1", "a2"]);
  });

  it("blocks adding a third task to the same teacher column", () => {
    const msg = validatePlacement(base, "Ali", "2026-01-01__AM__Math", "REVIEW_FREE");
    expect(msg).toContain("الحد الأقصى");
  });

  it("blocks duplicate draggable task type in same column", () => {
    const list = [base[0]];
    const msg = validatePlacement(list, "Ali", "2026-01-01__AM__Math", "INVIGILATION");
    expect(msg).toContain("نفس نوع المهمة");
  });

  it("detects same-slot invigilation or reserve conflict", () => {
    expect(teacherHasInvOrResInSameSlot(base, "Sara", "2026-01-01", "PM")).toBe(true);
    expect(teacherHasInvOrResInSameSlot(base, "Ali", "2026-01-01", "PM")).toBe(false);
  });
});
