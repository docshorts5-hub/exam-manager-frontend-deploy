import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { tableCard } from "../../../styles/ui";
import { GOLD_LINE_SOFT, GOLD_TEXT } from "../constants";

type Props = {
  assignmentsCount: number;
  daysCount: number;
  columnsCount: number;
  teachersCount: number;
};

export function ResultsSummaryStats({ assignmentsCount, daysCount, columnsCount, teachersCount }: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div style={{ ...tableCard, marginTop: 16, padding: 16, color: GOLD_TEXT, border: `1px solid ${GOLD_LINE_SOFT}` }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          {tr("عدد التكليفات", "Assignments Count")}: <strong>{assignmentsCount}</strong>
        </div>
        <div>
          {tr("عدد الأيام", "Days Count")}: <strong>{daysCount}</strong>
        </div>
        <div>
          {tr("عدد الأعمدة (امتحانات)", "Columns Count (Exams)")}: <strong>{columnsCount}</strong>
        </div>
        <div>
          {tr("عدد الكادر التعليمي", "Teaching Staff Count")}: <strong>{teachersCount}</strong>
        </div>
      </div>
    </div>
  );
}
