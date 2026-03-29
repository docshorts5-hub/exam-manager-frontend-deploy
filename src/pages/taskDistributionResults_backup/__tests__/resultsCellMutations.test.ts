import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addTaskToResultsEmptyCell,
  deleteAssignmentFromResultsRun,
} from "../services/resultsCellMutations";

describe("resultsCellMutations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes an assignment by uid and persists the change", () => {
    const persistEditedAssignments = vi.fn();
    const run = {
      assignments: [
        {
          __uid: "u1",
          taskType: "INVIGILATION",
          teacherName: "Ali",
          dateISO: "2026-01-01",
          period: "AM",
          subject: "Math",
        },
        { __uid: "u2", taskType: "RESERVE", teacherName: "Sara", dateISO: "2026-01-01", period: "PM", subject: "Physics" },
      ],
    };

    deleteAssignmentFromResultsRun({
      run,
      uid: "u1",
      normalizeSubject: (s) => s,
      persistEditedAssignments,
    });

    expect(persistEditedAssignments).toHaveBeenCalledTimes(1);
    const [nextAssignments, note] = persistEditedAssignments.mock.calls[0];
    expect(nextAssignments).toEqual([{ __uid: "u2", taskType: "RESERVE", teacherName: "Sara", dateISO: "2026-01-01", period: "PM", subject: "Physics" }]);
    expect(note).toContain("حذف");
    expect(note).toContain("Ali");
  });

  it("blocks adding to a non-empty cell", () => {
    const persistEditedAssignments = vi.fn();
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {} as any);

    addTaskToResultsEmptyCell({
      run: {
        assignments: [
          { __uid: "u1", teacherName: "Ali", dateISO: "2026-01-01", period: "AM", subject: "Math", taskType: "INVIGILATION" },
        ],
      },
      dstTeacher: "Ali",
      dstColKey: "2026-01-01__AM__Math",
      taskType: "RESERVE",
      normalizeSubject: (s) => s,
      getUnavailabilityReasonForCell: () => null,
      markCellBlocked: vi.fn(),
      teacherNameToId: new Map(),
      colKeyToExamId: {},
      examKeyToCommittees: {},
      invigilatorsPerRoomForSubject: () => 1,
      persistEditedAssignments,
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(persistEditedAssignments).not.toHaveBeenCalled();
  });

  it("marks the cell blocked when teacher is unavailable", () => {
    const markCellBlocked = vi.fn();
    const persistEditedAssignments = vi.fn();

    addTaskToResultsEmptyCell({
      run: { assignments: [] },
      dstTeacher: "Ali",
      dstColKey: "2026-01-01__AM__Math",
      taskType: "INVIGILATION",
      normalizeSubject: (s) => s,
      getUnavailabilityReasonForCell: () => "إجازة",
      markCellBlocked,
      teacherNameToId: new Map(),
      colKeyToExamId: {},
      examKeyToCommittees: {},
      invigilatorsPerRoomForSubject: () => 1,
      persistEditedAssignments,
    });

    expect(markCellBlocked).toHaveBeenCalledWith("Ali", "2026-01-01__AM__Math", "غير متاح: إجازة");
    expect(persistEditedAssignments).not.toHaveBeenCalled();
  });

  it("adds a new invigilation assignment to an empty cell", () => {
    const persistEditedAssignments = vi.fn();

    addTaskToResultsEmptyCell({
      run: { assignments: [] },
      dstTeacher: "Ali",
      dstColKey: "2026-01-01__AM__Math",
      taskType: "INVIGILATION",
      normalizeSubject: (s) => s,
      getUnavailabilityReasonForCell: () => null,
      markCellBlocked: vi.fn(),
      teacherNameToId: new Map([["Ali", "t-1"]]),
      colKeyToExamId: { "2026-01-01__AM__Math": "exam-1" },
      examKeyToCommittees: { "2026-01-01__AM__Math": 2 },
      invigilatorsPerRoomForSubject: () => 2,
      persistEditedAssignments,
    });

    expect(persistEditedAssignments).toHaveBeenCalledTimes(1);
    const [nextAssignments, note] = persistEditedAssignments.mock.calls[0];
    expect(nextAssignments).toHaveLength(1);
    expect(nextAssignments[0]).toMatchObject({
      teacherId: "t-1",
      teacherName: "Ali",
      dateISO: "2026-01-01",
      period: "AM",
      subject: "Math",
      taskType: "INVIGILATION",
      examId: "exam-1",
      committeeNo: 1,
      invigilatorIndex: 1,
    });
    expect(note).toContain("إضافة");
  });
});
