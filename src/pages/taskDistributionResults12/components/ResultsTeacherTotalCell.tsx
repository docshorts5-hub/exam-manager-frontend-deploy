import React from "react";

export type ResultsTeacherTotalCellProps = {
  total: number;
  tableText: string;
  goldLine: string;
  goldLineSoft: string;
};

export function ResultsTeacherTotalCell(props: ResultsTeacherTotalCellProps) {
  return (
    <>
      <style>{`@keyframes resultsTeacherTotalBlueBlink { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.28); } }`}</style>
      <td
        style={{
          padding: "10px 10px",
          borderLeft: "4px solid #2563eb",
          borderTop: "3px solid #2563eb",
          background: "rgba(37,99,235,0.16)",
          textAlign: "center",
          verticalAlign: "middle",
          color: props.tableText,
          fontWeight: 950,
          boxShadow: "0 0 0 2px rgba(37,99,235,0.65), 0 0 18px rgba(37,99,235,0.45)",
          animation: "resultsTeacherTotalBlueBlink 1.25s ease-in-out infinite",
        }}
      >
        <div style={{ fontSize: 16 }}>{props.total}</div>
      </td>
    </>
  );
}
