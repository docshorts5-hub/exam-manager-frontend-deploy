import { describe, expect, it } from "vitest";
import { canAddTaskToEmptyCell } from "../services/resultsTeacherRowRules";

describe("canAddTaskToEmptyCell", () => {
  it("blocks add when teacher is unavailable", () => {
    expect(
      canAddTaskToEmptyCell({
        taskType: "INVIGILATION",
        required: 2,
        invigilationDeficit: 1,
        reserveCount: 0,
        unavailableReason: "غير متاح",
      }),
    ).toBe(false);
  });

  it("allows invigilation only when there is a deficit", () => {
    expect(
      canAddTaskToEmptyCell({
        taskType: "INVIGILATION",
        required: 2,
        invigilationDeficit: 1,
        reserveCount: 0,
      }),
    ).toBe(true);

    expect(
      canAddTaskToEmptyCell({
        taskType: "INVIGILATION",
        required: 2,
        invigilationDeficit: 0,
        reserveCount: 0,
      }),
    ).toBe(false);
  });

  it("allows one reserve only for exam columns", () => {
    expect(
      canAddTaskToEmptyCell({
        taskType: "RESERVE",
        required: 3,
        invigilationDeficit: 0,
        reserveCount: 0,
      }),
    ).toBe(true);

    expect(
      canAddTaskToEmptyCell({
        taskType: "RESERVE",
        required: 3,
        invigilationDeficit: 0,
        reserveCount: 1,
      }),
    ).toBe(false);

    expect(
      canAddTaskToEmptyCell({
        taskType: "RESERVE",
        required: 0,
        invigilationDeficit: 0,
        reserveCount: 0,
      }),
    ).toBe(false);
  });

  it("allows non exam helper tasks when available", () => {
    expect(
      canAddTaskToEmptyCell({
        taskType: "REVIEW_FREE",
        required: 0,
        invigilationDeficit: 0,
        reserveCount: 0,
      }),
    ).toBe(true);
  });
});
