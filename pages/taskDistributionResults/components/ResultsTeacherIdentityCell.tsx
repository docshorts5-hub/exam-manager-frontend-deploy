import React from "react";

export type ResultsTeacherIdentityCellProps = {
  teacher: string;
  stripeColor: string;
  tableText: string;
  tableFontSize: string;
  goldLine: string;
  goldLineSoft: string;
};

export function ResultsTeacherIdentityCell(props: ResultsTeacherIdentityCellProps) {
  return (
    <td
      style={{
        position: "sticky",
        right: 0,
        zIndex: 40,
        padding: "10px 12px",
        color: props.tableText,
        fontWeight: 900,
        fontSize: props.tableFontSize,
        background: "linear-gradient(180deg, #020617, #0b1224)",
        borderTop: `1px solid ${props.goldLineSoft}`,
        borderLeft: `6px solid ${props.goldLine}`,
        boxShadow: "-14px 0 28px rgba(0,0,0,0.60)",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 14,
          padding: "12px 12px",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          fontWeight: 900,
        }}
      >
        <span style={{ width: 10, height: 32, borderRadius: 999, background: props.stripeColor, flexShrink: 0 }} />
        <span>{props.teacher}</span>
      </div>
    </td>
  );
}
