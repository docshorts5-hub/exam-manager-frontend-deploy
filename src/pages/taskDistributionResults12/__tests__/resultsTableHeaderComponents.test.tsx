import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsTableDateHeaderCell } from "../components/ResultsTableDateHeaderCell";
import { ResultsTableSubColHeaderCell } from "../components/ResultsTableSubColHeaderCell";
import { ResultsTableEmptySubColHeaderCell } from "../components/ResultsTableEmptySubColHeaderCell";
import { ResultsTableHeader } from "../components/ResultsTableHeader";

describe("results table header components", () => {
  it("renders date header line", () => {
    render(
      <table>
        <thead>
          <tr>
            <ResultsTableDateHeaderCell
              dateISO="2026-01-01"
              colSpan={2}
              line="الأحد 2026-01-01"
              goldLine="#d4af37"
              tableFontSize="14px"
              background="#111"
              shadow="none"
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByText("الأحد 2026-01-01")).toBeTruthy();
  });

  it("renders subject, period, and committees count", () => {
    render(
      <table>
        <thead>
          <tr>
            <ResultsTableSubColHeaderCell
              subject="رياضيات"
              periodLabel="الفترة الأولى"
              committees={4}
              goldLine="#d4af37"
              background="#111"
              shadow="none"
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByText("رياضيات")).toBeTruthy();
    expect(screen.getByText("الفترة الأولى")).toBeTruthy();
    expect(screen.getByText(/مجموع اللجان: 4/)).toBeTruthy();
  });

  it("renders empty sub-column header placeholder", () => {
    render(
      <table>
        <thead>
          <tr>
            <ResultsTableEmptySubColHeaderCell goldLine="#d4af37" background="#111" shadow="none" />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("uses empty placeholder when a date has no sub-columns", () => {
    render(
      <table>
        <ResultsTableHeader
          displayDates={["2026-01-01"]}
          dateToSubCols={new Map([["2026-01-01", []]])}
          allSubCols={[]}
          committeesCountBySubCol={{}}
          styles={{
            tableText: "#fff",
            tableFontSize: "14px",
            goldLine: "#d4af37",
            goldLineSoft: "rgba(212,175,55,0.5)",
            teacherHeaderStyle: {},
            teacherTotalHeaderStyle: {},
          }}
          formatDateWithDayAr={() => ({ day: "الأحد", full: "الأحد 2026-01-01", line: "الأحد 2026-01-01" })}
          formatPeriod={(p) => p || ""}
        />
      </table>,
    );

    expect(screen.getByText("المعلم")).toBeTruthy();
    expect(screen.getByText("إجمالي المعلم")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
