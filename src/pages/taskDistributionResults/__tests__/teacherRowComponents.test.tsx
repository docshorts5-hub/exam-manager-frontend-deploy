import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeacherRow } from "../components/TeacherRow";

vi.mock("../components/ResultsEmptyTeacherCell", () => ({
  ResultsEmptyTeacherCell: ({ teacher, subColKey }: any) => (
    <td data-testid={`empty-${teacher}-${subColKey}`}>EMPTY:{teacher}:{subColKey}</td>
  ),
}));

vi.mock("../components/ResultsAssignedTeacherCell", () => ({
  ResultsAssignedTeacherCell: ({ teacher, sc, list }: any) => (
    <td data-testid={`assigned-${teacher}-${sc.key}`}>ASSIGNED:{teacher}:{sc.key}:{list.length}</td>
  ),
}));

describe("teacher row components", () => {
  const baseProps = {
    teacher: "أحمد",
    teacherIndex: 0,
    allSubCols: [
      { key: "col-1", dateISO: "2026-01-01", subject: "math", period: "P1" },
      { key: "col-2", dateISO: "2026-01-02", subject: "physics", period: "P2" },
    ],
    displayDates: ["2026-01-01", "2026-01-02"],
    matrix2: {
      أحمد: {
        "col-1": [],
        "col-2": [{ __uid: "u1", taskType: "INVIGILATION" }],
      },
    },
    teacherTotals: { أحمد: 6 },
    columnColor: () => ({ colBg: "#000", headBg: "#111" }),
    teacherRowColor: () => ({ stripe: "#d4af37" }),
    getSubjectBackground: () => "#123",
    taskLabel: () => "مراقبة",
    normalizeSubject: (s: string) => s.toUpperCase(),
    formatPeriod: (p?: string) => `PERIOD:${p || ""}`,
    getCommitteeNo: () => undefined,
    isDraggableTaskType: () => true,
    dragSrcUid: null,
    dragOverUid: null,
    setDragSrcUid: () => undefined,
    setDragOverUid: () => undefined,
    onSwap: () => undefined,
    onDropToEmpty: () => undefined,
    onDropToCell: () => undefined,
    onAddToEmpty: () => undefined,
    invigilationDeficitBySubCol: { "col-1": 0, "col-2": 1 },
    reserveCountBySubCol: { "col-1": 0, "col-2": 0 },
    requiredBySubCol: { "col-1": 1, "col-2": 1 },
    getUnavailabilityReasonForCell: () => null,
    blockedCellMsg: {},
    onDeleteByUid: () => undefined,
    selectedCell: null,
    onSelectCell: () => undefined,
    isConflictUid: () => false,
    styles: {
      tableText: "#fff",
      tableFontSize: "14px",
      goldLine: "#d4af37",
      goldLineSoft: "#b8860b",
    },
  };

  it("renders teacher identity, total, and chooses empty vs assigned cells by matrix contents", () => {
    render(
      <table>
        <tbody>
          <TeacherRow {...baseProps} />
        </tbody>
      </table>,
    );

    expect(screen.getByText("أحمد")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByTestId("empty-أحمد-col-1").textContent).toContain("EMPTY:أحمد:col-1");
    expect(screen.getByTestId("assigned-أحمد-col-2").textContent).toContain("ASSIGNED:أحمد:col-2:1");
  });

  it("falls back to zero total when teacher total is missing", () => {
    render(
      <table>
        <tbody>
          <TeacherRow {...baseProps} teacherTotals={{}} />
        </tbody>
      </table>,
    );

    expect(screen.getByText("0")).toBeTruthy();
  });
});
