import React from "react";
import type { SubCol } from "./TeacherRow";

type Props = {
  allSubCols: SubCol[];
  totalsDetailBySubCol: Record<
    string,
    { inv: number; res: number; corr: number; total: number; deficit: number; committees: number; required?: number }
  >;
  committeesCountBySubCol: Record<string, number>;
  styles: {
    tableFontSize: string;
    goldLine: string;
    goldLineSoft: string;
  };
  showTeacherSidebar?: boolean;
};

export function ResultsTotalsRow({ allSubCols, totalsDetailBySubCol, committeesCountBySubCol, styles, showTeacherSidebar = true }: Props) {
  return (
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
          الإجمالي (تفصيل لكل مادة)
        </td>
      ) : null}

      {allSubCols.map((sc, idx) => {
        const d = totalsDetailBySubCol[sc.key] || {
          inv: 0,
          res: 0,
          corr: 0,
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
              borderLeft: isDayStart ? `10px solid ${styles.goldLine}` : `3px solid ${styles.goldLine}`,
              borderTop: `1px solid ${styles.goldLineSoft}`,
              background: "rgba(251,191,36,0.10)",
              textAlign: "center",
              verticalAlign: "middle",
              color: "#fff",
              fontWeight: 900,
              boxShadow: isDayStart ? `inset 10px 0 0 rgba(212,175,55,0.14)` : undefined,
            }}
          >
            <div style={{ lineHeight: 1.65, fontSize: 13 }}>
              <div>مراقبة: {d.inv}</div>
              <div>احتياط: {d.res}</div>
              <div>تصحيح: {d.corr}</div>
              <div style={{ marginTop: 6, opacity: 0.95 }}>المجموع: {d.total}</div>
              <div style={{ marginTop: 4, color: d.deficit > 0 ? "#fecaca" : "#bbf7d0" }}>العجز: {d.deficit}</div>
            </div>
          </td>
        );
      })}

      <td
        style={{
          padding: "10px 10px",
          borderLeft: `3px solid ${styles.goldLine}`,
          borderTop: `1px solid ${styles.goldLineSoft}`,
          background: "rgba(251,191,36,0.18)",
          textAlign: "center",
          color: "#fff",
          fontWeight: 900,
          minWidth: 140,
        }}
      >
        —
      </td>
    </tr>
  );
}
