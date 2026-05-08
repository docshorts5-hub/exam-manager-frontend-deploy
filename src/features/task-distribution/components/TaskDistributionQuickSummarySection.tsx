import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

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
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div style={{ ...cardStyle, marginTop: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span style={pillStyle}>{tr("الكادر التعليمي", "Teaching Staff")}: {teachersCount}</span>
        <span style={pillStyle}>{tr("الامتحانات", "Exams")}: {examsCount}</span>
        <span style={pillStyle}>{tr("الأيام", "Days")}: {derived.uniqueDates}</span>
        <span style={pillStyle}>{tr("إجمالي القاعات", "Total Rooms")}: {derived.totalRooms}</span>
      </div>
    </div>
  );
}
