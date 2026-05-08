import React from "react";

type Props = {
  dateISO: string;
  colSpan: number;
  line: string;
  goldLine: string;
  tableFontSize: string;
  background: string;
  shadow: string;
  isCollapsed?: boolean;
};

export function ResultsTableDateHeaderCell({
  dateISO,
  colSpan,
  line,
  goldLine,
  tableFontSize,
  background,
  shadow,
}: Props) {
  return (
    <th
      key={dateISO}
      colSpan={colSpan}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 80,
        padding: "8px 8px",
        textAlign: "center",
        color: "#ffffff",
        fontWeight: 900,
        fontSize: "13px",
        background,
        border: `1px solid ${goldLine}`,
        borderInlineStart: `10px solid ${goldLine}`,
        borderRadius: 14,
        boxShadow: `${shadow}, inset 10px 0 0 #8f7318`,
        whiteSpace: "nowrap",
      }}
    >
      {line}
    </th>
  );
}
