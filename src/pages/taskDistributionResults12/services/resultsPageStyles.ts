import type React from "react";

export function getResultsHeader3DStyles(goldLine: string): {
  outer: React.CSSProperties;
  inner: React.CSSProperties;
  rim: React.CSSProperties;
  shine: React.CSSProperties;
} {
  return {
    outer: {
      marginTop: 12,
      borderRadius: 20,
      border: `1px solid ${goldLine}`,
      background:
        "radial-gradient(1200px 480px at 18% 0%, rgba(184,134,11,0.28), rgba(2,6,23,0.0) 62%), linear-gradient(180deg,#0b1224,#020617)",
      boxShadow:
        "0 34px 70px rgba(0,0,0,0.78), 0 10px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 0 rgba(0,0,0,0.65)",
      perspective: "900px",
      overflow: "hidden",
      position: "relative",
    },
    inner: {
      transform: "translateY(-2px) rotateX(11deg)",
      transformOrigin: "top",
      padding: 18,
      filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.55))",
    },
    rim: {
      position: "absolute",
      inset: 0,
      borderRadius: 20,
      boxShadow: "inset 0 0 0 1px rgba(184,134,11,0.35), inset 0 0 40px rgba(184,134,11,0.10)",
      pointerEvents: "none",
    },
    shine: {
      position: "absolute",
      top: -170,
      right: -260,
      width: 620,
      height: 620,
      background: "radial-gradient(circle, rgba(255,255,255,0.16), rgba(255,255,255,0) 60%)",
      transform: "rotate(18deg)",
      pointerEvents: "none",
    },
  };
}

export function getResultsTableHeaderStyles(args: {
  tableText: string;
  tableFontSize: string;
  goldLine: string;
  goldLineSoft: string;
}): {
  teacherHeaderStyle: React.CSSProperties;
  teacherTotalHeaderStyle: React.CSSProperties;
} {
  const { tableText, tableFontSize, goldLine, goldLineSoft } = args;
  return {
    teacherHeaderStyle: {
      position: "sticky",
      top: 0,
      right: 0,
      zIndex: 90,
      padding: "12px 14px",
      textAlign: "right",
      color: tableText,
      fontWeight: 900,
      fontSize: tableFontSize,
      background: "linear-gradient(180deg, #020617, #0b1224)",
      borderLeft: `6px solid ${goldLine}`,
      borderBottom: `2px solid ${goldLine}`,
      boxShadow: "-16px 0 34px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.08)",
      whiteSpace: "nowrap",
    },
    teacherTotalHeaderStyle: {
      position: "sticky",
      top: 0,
      zIndex: 90,
      padding: "12px 10px",
      textAlign: "center",
      color: tableText,
      fontWeight: 900,
      fontSize: "13px",
      background: "linear-gradient(180deg, rgba(34,197,94,0.22), rgba(2,6,23,0.92))",
      borderLeft: `1px solid ${goldLineSoft}`,
      borderBottom: `1px solid ${goldLineSoft}`,
      whiteSpace: "nowrap",
    },
  };
}
