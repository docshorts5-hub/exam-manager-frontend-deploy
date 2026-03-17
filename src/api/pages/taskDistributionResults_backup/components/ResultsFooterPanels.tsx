import React from "react";
import { ResultsWarningsPanel } from "./ResultsWarningsPanel";
import { ResultsSummaryStats } from "./ResultsSummaryStats";

export function ResultsFooterPanels({
  warnings,
  assignmentsCount,
  daysCount,
  columnsCount,
  teachersCount,
}: {
  warnings: string[];
  assignmentsCount: number;
  daysCount: number;
  columnsCount: number;
  teachersCount: number;
}) {
  return (
    <>
      <ResultsWarningsPanel warnings={warnings} />
      <ResultsSummaryStats
        assignmentsCount={assignmentsCount}
        daysCount={daysCount}
        columnsCount={columnsCount}
        teachersCount={teachersCount}
      />
    </>
  );
}
