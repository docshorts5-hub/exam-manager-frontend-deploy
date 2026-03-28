import React from "react";

export type ResultsAssignmentDetailsProps = {
  committeeNo?: string;
  invigilatorIndex?: number | null;
  subject?: string;
  period?: string;
  tableText: string;
  goldLineSoft: string;
  normalizeSubject: (s: string) => string;
  formatPeriod: (p?: string) => string;
};

export function ResultsAssignmentDetails(props: ResultsAssignmentDetailsProps) {
  const { committeeNo, invigilatorIndex, subject, period, tableText, goldLineSoft, normalizeSubject, formatPeriod } = props;

  return (
    <>
      {(committeeNo || invigilatorIndex !== undefined) && (
        <div
          style={{
            marginTop: 8,
            fontSize: "12px",
            color: tableText,
            opacity: 0.98,
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "4px 8px",
            borderRadius: 999,
            border: `1px solid ${goldLineSoft}`,
            background: "rgba(2,6,23,0.40)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            fontWeight: 900,
          }}
        >
          {committeeNo && (
            <>
              <span style={{ opacity: 0.9 }}>رقم اللجنة:</span>
              <strong style={{ color: tableText }}>{committeeNo}</strong>
            </>
          )}

          {invigilatorIndex !== undefined && invigilatorIndex !== null && (
            <>
              <span style={{ opacity: 0.9 }}>• رقم المراقب:</span>
              <strong style={{ color: tableText }}>{invigilatorIndex}</strong>
            </>
          )}
        </div>
      )}

      {subject && (
        <div style={{ fontSize: "13px", marginTop: 8, opacity: 0.98, fontWeight: 900 }}>
          {normalizeSubject(String(subject || ""))}
        </div>
      )}

      {period && (
        <div style={{ fontSize: "12px", marginTop: 8, opacity: 0.92, fontStyle: "italic" }}>
          {formatPeriod(String(period || ""))}
        </div>
      )}
    </>
  );
}
