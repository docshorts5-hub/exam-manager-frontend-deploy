import React from "react";

type QuickSummaryDerived = {
  uniqueDates: number;
  totalRooms: number;
};

type QuickSummaryProps = {
  teachersCount: number;
  examsCount: number;
  derived: QuickSummaryDerived;
  pillStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
};

export default function TaskDistributionQuickSummarySection({
  teachersCount,
  examsCount,
  derived,
  pillStyle,
  cardStyle,
}: QuickSummaryProps) {
  return (
    <div style={{ ...cardStyle, marginTop: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span style={pillStyle}>الكادر التعليمي : {teachersCount}</span>
        <span style={pillStyle}>الامتحانات: {examsCount}</span>
        <span style={pillStyle}>الأيام: {derived.uniqueDates}</span>
        <span style={pillStyle}>إجمالي القاعات: {derived.totalRooms}</span>
      </div>
    </div>
  );
}
