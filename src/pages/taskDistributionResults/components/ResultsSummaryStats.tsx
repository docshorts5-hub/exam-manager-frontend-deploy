import React from "react";

import { tableCard } from "../../../styles/ui";
import { GOLD_LINE_SOFT, GOLD_TEXT } from "../constants";

type Props = {
  assignmentsCount: number;
  daysCount: number;
  columnsCount: number;
  teachersCount: number;
};

export function ResultsSummaryStats({ assignmentsCount, daysCount, columnsCount, teachersCount }: Props) {
  return (
    <div style={{ ...tableCard, marginTop: 16, padding: 16, color: GOLD_TEXT, border: `1px solid ${GOLD_LINE_SOFT}` }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          عدد التكليفات: <strong>{assignmentsCount}</strong>
        </div>
        <div>
          عدد الأيام: <strong>{daysCount}</strong>
        </div>
        <div>
          عدد الأعمدة (امتحانات): <strong>{columnsCount}</strong>
        </div>
        <div>
          عدد الكادر التعلمي : <strong>{teachersCount}</strong>
        </div>
      </div>
    </div>
  );
}
