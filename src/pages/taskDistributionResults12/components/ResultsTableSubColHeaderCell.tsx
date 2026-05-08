import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

type Props = {
  subject: string;
  periodLabel: string;
  committees: number;
  goldLine: string;
  background: string;
  shadow: string;
  isDayStart?: boolean;
  isDayEnd?: boolean;
  onDeleteAll?: () => void;
};

export function ResultsTableSubColHeaderCell({
  subject,
  periodLabel,
  committees,
  goldLine,
  background,
  shadow,
  isDayStart = false,
  isDayEnd = false,
  onDeleteAll,
}: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const heavyLine = `8px solid ${goldLine}`;
  const normalLine = `4px solid ${goldLine}`;

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
        borderInlineStart: isDayStart ? heavyLine : normalLine,
        borderInlineEnd: isDayEnd ? `3px solid #9b7e1b` : undefined,
        borderRadius: 14,
        boxShadow: `${shadow}, inset ${isDayStart ? "8px" : "4px"} 0 0 #8f7318`,
      }}
    >
      <div style={{ fontWeight: 900 }}>{subject}</div>
      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{periodLabel}</div>
      <div style={{ fontSize: 12, opacity: 0.95, marginTop: 4 }}>{tr("مجموع اللجان", "Total Committees")}: {committees}</div>

      {onDeleteAll ? (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(tr("حذف جميع المراقبات/التكليفات لهذا العمود؟", "Delete all invigilation/assignments for this column?"))) {
                onDeleteAll();
              }
            }}
            style={{
              borderRadius: 999,
              border: `1px solid rgba(255,255,255,0.16)`,
              background: "#9f3328",
              color: "#fff",
              fontWeight: 900,
              fontSize: 11,
              padding: "5px 10px",
              cursor: "pointer",
            }}
            title={tr("حذف كل تكليفات هذه المادة/الفترة", "Delete all assignments for this subject/period")}
          >
            {tr("حذف الكل", "Delete All")}
          </button>
        </div>
      ) : null}
    </th>
  );
}
