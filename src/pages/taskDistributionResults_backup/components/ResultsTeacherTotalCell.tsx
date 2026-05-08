import React from "react";

export type ResultsTeacherTotalCellProps = {
  total: number;
  tableText: string;
  goldLine: string;
  goldLineSoft: string;
};

export function ResultsTeacherTotalCell(props: ResultsTeacherTotalCellProps) {
  const bg =
    props.total < 5
      ? "rgba(34,197,94,0.18)"
      : props.total > 7
      ? "rgba(239,68,68,0.18)"
      : "rgba(255,255,255,0.06)";

  return (
    <td
      style={{
        padding: "10px 10px",
        borderLeft: `2px solid ${props.goldLine}`,
        borderTop: `1px solid ${props.goldLineSoft}`,
        background: bg,
        textAlign: "center",
        verticalAlign: "middle",
        color: props.tableText,
        fontWeight: 900,
      }}
    >
      <div style={{ fontSize: 16 }}>{props.total}</div>
    </td>
  );
}
