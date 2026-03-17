import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultsAssignmentDetails } from "../components/ResultsAssignmentDetails";
import { ResultsAssignmentBadge } from "../components/ResultsAssignmentBadge";

describe("results assignment card components", () => {
  it("renders committee, invigilator, subject and period details", () => {
    render(
      <ResultsAssignmentDetails
        committeeNo="12"
        invigilatorIndex={3}
        subject="رياضيات"
        period="صباحية"
        tableText="#fff"
        goldLineSoft="rgba(255,255,255,0.2)"
        normalizeSubject={(s) => `مادة: ${s}`}
        formatPeriod={(p) => `فترة: ${p}`}
      />,
    );

    expect(screen.getByText("رقم اللجنة:")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("• رقم المراقب:")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("مادة: رياضيات")).toBeTruthy();
    expect(screen.getByText("فترة: صباحية")).toBeTruthy();
  });

  it("selects assignment on click", () => {
    const onSelect = vi.fn();
    render(
      <ResultsAssignmentBadge
        uid="u1"
        isDraggable={false}
        isOver={false}
        isDragging={false}
        isConflict={false}
        label="مراقبة"
        teacher="أحمد"
        subColKey="2026-01-01|AM"
        dragOverUid={null}
        setDragSrcUid={() => {}}
        setDragOverUid={() => {}}
        onSwap={() => {}}
        onSelect={onSelect}
        goldLineSoft="rgba(255,255,255,0.2)"
      />,
    );

    fireEvent.click(screen.getByText("مراقبة"));
    expect(onSelect).toHaveBeenCalledWith({ uid: "u1", teacher: "أحمد", subColKey: "2026-01-01|AM" });
  });
});
