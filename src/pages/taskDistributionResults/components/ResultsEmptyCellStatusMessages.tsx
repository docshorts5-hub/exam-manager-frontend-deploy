import React from "react";

type Props = {
  blockedMsg?: string | null;
  unavailabilityMsg?: string | null;
  openAdd: boolean;
};

export function ResultsEmptyCellStatusMessages({ blockedMsg, unavailabilityMsg, openAdd }: Props) {
  if (blockedMsg) {
    return (
      <div
        style={{
          marginBottom: 8,
          padding: "6px 8px",
          borderRadius: 10,
          background: "rgba(220,38,38,0.18)",
          border: "1px solid rgba(220,38,38,0.55)",
          color: "rgba(255,255,255,0.92)",
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1.3,
        }}
        title={blockedMsg}
      >
        {blockedMsg}
      </div>
    );
  }

  if (!openAdd && unavailabilityMsg) {
    return (
      <div
        style={{
          marginBottom: 6,
          padding: "5px 8px",
          borderRadius: 10,
          background: "rgba(239,68,68,0.10)",
          border: "1px dashed rgba(239,68,68,0.35)",
          color: "rgba(255,255,255,0.75)",
          fontSize: 11,
          fontWeight: 900,
        }}
        title={unavailabilityMsg}
      >
        غير متاح
      </div>
    );
  }

  return null;
}
