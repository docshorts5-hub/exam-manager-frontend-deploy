import React from "react";

export type ResultsAssignmentMetaProps = {
  subject?: string;
  fallbackSubject?: string;
  period?: string;
  fallbackPeriod?: string;
  normalizeSubject: (s: string) => string;
  formatPeriod: (p?: string) => string;
};

export function ResultsAssignmentMeta(props: ResultsAssignmentMetaProps) {
  const subject = props.subject || props.fallbackSubject;
  const period = props.period || props.fallbackPeriod;

  return (
    <>
      {subject ? (
        <div style={{ fontSize: "13px", marginTop: 8, opacity: 0.98, fontWeight: 900 }}>
          {props.normalizeSubject(String(subject))}
        </div>
      ) : null}

      {period ? (
        <div style={{ fontSize: "12px", marginTop: 8, opacity: 0.92, fontStyle: "italic" }}>
          {props.formatPeriod(String(period))}
        </div>
      ) : null}
    </>
  );
}
