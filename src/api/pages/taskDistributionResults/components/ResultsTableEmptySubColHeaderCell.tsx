import React from "react";

type Props = {
  goldLine: string;
  background: string;
  shadow: string;
  isDayStart?: boolean;
  isDayEnd?: boolean;
};

export function ResultsTableEmptySubColHeaderCell({ goldLine, background, shadow, isDayStart = false, isDayEnd = false }: Props) {
  return (
    <th
      style={{
        position: "sticky",
        top: 38,
        zIndex: 70,
        padding: "8px 8px",
        textAlign: "center",
        color: "#ffffff",
        fontWeight: 900,
        fontSize: "13px",
        background,
        border: `1px solid ${goldLine}`,
        borderInlineStart: isDayStart ? `10px solid ${goldLine}` : `6px solid ${goldLine}`,
        borderInlineEnd: isDayEnd ? `3px solid #9b7e1b` : undefined,
        borderRadius: 14,
        boxShadow: `${shadow}, inset ${isDayStart ? "8px" : "4px"} 0 0 #8f7318`,
      }}
    >
      —
    </th>
  );
}
