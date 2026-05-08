import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsAssignmentMeta } from "../components/ResultsAssignmentMeta";
import { ResultsAssignedTaskBlock } from "../components/ResultsAssignedTaskBlock";

vi.mock("../components/AssignmentCard", () => ({
  AssignmentCard: ({ ass }: any) => <div data-testid="assignment-card">{String(ass?.taskType || "card")}</div>,
}));

describe("results assigned cell components", () => {
  it("shows fallback subject and period when assignment values are missing", () => {
    render(
      <ResultsAssignmentMeta
        fallbackSubject="math"
        fallbackPeriod="P1"
        normalizeSubject={(s) => s.toUpperCase()}
        formatPeriod={(p) => `PERIOD:${p || ""}`}
      />,
    );

    expect(screen.getByText("MATH")).toBeTruthy();
    expect(screen.getByText("PERIOD:P1")).toBeTruthy();
  });

  it("renders assignment card and explicit assignment meta when present", () => {
    render(
      <ResultsAssignedTaskBlock
        teacher="A"
        subColKey="col-1"
        fallbackSubject="fallback"
        fallbackPeriod="P1"
        ass={{ __uid: "u1", taskType: "INVIGILATION", subject: "physics", period: "P2" }}
        index={0}
        taskLabel={() => "x"}
        normalizeSubject={(s) => s.toUpperCase()}
        formatPeriod={(p) => `PERIOD:${p || ""}`}
        getCommitteeNo={() => undefined}
        isDraggable={true}
        dragSrcUid={null}
        dragOverUid={null}
        setDragSrcUid={() => undefined}
        setDragOverUid={() => undefined}
        onSwap={() => undefined}
        isSelected={false}
        goldLineSoft="rgba(0,0,0,0.1)"
        tableText="#fff"
        isConflict={false}
      />,
    );

    expect(screen.getByTestId("assignment-card").textContent).toContain("INVIGILATION");
    expect(screen.getByText("PHYSICS")).toBeTruthy();
    expect(screen.getByText("PERIOD:P2")).toBeTruthy();
  });
});
