import { describe, expect, it } from "vitest";
import { resolveResultsSameTypeDropTargetUid } from "../services/resultsDragDropResolvers";

describe("resolveResultsSameTypeDropTargetUid", () => {
  const isDraggableTaskType = (taskType: any) => ["INVIGILATION", "RESERVE", "CORRECTION_FREE"].includes(String(taskType || ""));

  it("returns null when source type is not draggable", () => {
    expect(
      resolveResultsSameTypeDropTargetUid([{ __uid: "a1", taskType: "INVIGILATION" }], "OTHER", isDraggableTaskType)
    ).toBeNull();
  });

  it("returns matching uid for same draggable task type", () => {
    expect(
      resolveResultsSameTypeDropTargetUid(
        [
          { __uid: "a1", taskType: "RESERVE" },
          { __uid: "a2", taskType: "INVIGILATION" },
        ],
        "INVIGILATION",
        isDraggableTaskType
      )
    ).toBe("a2");
  });

  it("ignores non-draggable items in destination cell", () => {
    expect(
      resolveResultsSameTypeDropTargetUid(
        [
          { __uid: "a1", taskType: "OTHER" },
          { __uid: "a2", taskType: "INVIGILATION" },
        ],
        "INVIGILATION",
        isDraggableTaskType
      )
    ).toBe("a2");
  });

  it("returns null when no same-type target exists", () => {
    expect(
      resolveResultsSameTypeDropTargetUid([{ __uid: "a1", taskType: "RESERVE" }], "INVIGILATION", isDraggableTaskType)
    ).toBeNull();
  });
});
