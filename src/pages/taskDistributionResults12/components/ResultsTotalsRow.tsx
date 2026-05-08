import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import type { SubCol } from "./TeacherRow";

type Props = {
  allSubCols: SubCol[];
  totalsDetailBySubCol: Record<string, { inv: number; res: number; duty: number; total: number; deficit: number; committees: number; required?: number }>;
  committeesCountBySubCol: Record<string, number>;
  styles: { tableFontSize: string; goldLine: string; goldLineSoft: string };
  showTeacherSidebar?: boolean;
};

export function ResultsTotalsRow({ allSubCols, totalsDetailBySubCol, committeesCountBySubCol, styles, showTeacherSidebar = true }: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <>
      <style>{`@keyframes resultsTotalBlueBlink { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.28); } }`}</style>
      <tr>
        {showTeacherSidebar ? (
          <td
            style={{
              position: "sticky",
              right: 0,
              zIndex: 50,
              padding: "10px 12px",
              color: "#111827",
              fontWeight: 900,
              fontSize: styles.tableFontSize,
              background: `linear-gradient(180deg, rgba(251,191,36,0.95), rgba(184,134,11,0.95))`,
              borderTop: `1px solid ${styles.goldLineSoft}`,
              borderLeft: `10px solid ${styles.goldLine}`,
              boxShadow: "-14px 0 28px rgba(0,0,0,0.55)",
              whiteSpace: "nowrap",
            }}
          >
            {tr("الإجمالي (تفصيل لكل مادة)", "Total (details per subject)")}
          </td>
        ) : null}

        {allSubCols.map((sc, idx) => {
          const d = totalsDetailBySubCol[sc.key] || {
            inv: 0,
            res: 0,
            duty: 0,
            total: 0,
            deficit: 0,
            committees: committeesCountBySubCol[sc.key] ?? 0,
          };
          const isDayStart = idx === 0 || allSubCols[idx - 1]?.dateISO !== sc.dateISO;

          return (
            <td
              key={`${sc.key}__total`}
              style={{
                padding: "10px 10px",
                borderLeft: isDayStart ? `10px solid #2563eb` : `4px solid #2563eb`,
                borderTop: "3px solid #2563eb",
                background: "rgba(37,99,235,0.14)",
                textAlign: "center",
                verticalAlign: "middle",
                color: "#fff",
                fontWeight: 950,
                boxShadow: "0 0 0 2px rgba(37,99,235,0.72), 0 0 18px rgba(37,99,235,0.45)",
                animation: "resultsTotalBlueBlink 1.25s ease-in-out infinite",
              }}
            >
              <div style={{ lineHeight: 1.65, fontSize: 13 }}>
                <div>{tr("مراقبة", "Invigilation")}: {d.inv}</div>
                <div>{tr("احتياط", "Reserve")}: {d.res}</div>
                <div>{tr("مراقب الدور", "Duty Invigilator")}: {d.duty}</div>
                <div style={{ marginTop: 6, opacity: 0.95 }}>{tr("المجموع", "Total")}: {d.total}</div>
                <div style={{ marginTop: 4, color: d.deficit > 0 ? "#fecaca" : "#bbf7d0" }}>{tr("العجز", "Deficit")}: {d.deficit}</div>
              </div>
            </td>
          );
        })}

        <td
          style={{
            padding: "10px 10px",
            borderLeft: "4px solid #2563eb",
            borderTop: "3px solid #2563eb",
            background: "rgba(37,99,235,0.18)",
            textAlign: "center",
            color: "#fff",
            fontWeight: 950,
            minWidth: 140,
            animation: "resultsTotalBlueBlink 1.25s ease-in-out infinite",
          }}
        >
          —
        </td>
      </tr>
    </>
  );
}
