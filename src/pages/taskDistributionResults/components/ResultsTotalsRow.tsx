import React from "react";

type TotalsDetail = {
  inv?: number;
  res?: number;
  corr?: number;
  total?: number;
  deficit?: number;
  committees?: number;
  required?: number;
};

type Props = {
  allSubCols: Array<{ key: string }>;
  totalsDetailBySubCol: Record<string, TotalsDetail>;
  committeesCountBySubCol?: Record<string, number>;
  styles: {
    tableFontSize: string;
    goldLine: string;
    goldLineSoft: string;
  };
  showTeacherSidebar?: boolean;
};

const metricRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 12,
  lineHeight: 1.9,
};

function Metric({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={className} style={metricRowStyle}>
      <span className="results-total-metric-label">{label}</span>
      <span className="results-total-metric-value">{Number(value || 0)}</span>
    </div>
  );
}

export function ResultsTotalsRow({ allSubCols, totalsDetailBySubCol, styles, showTeacherSidebar = true }: Props) {
  return (
    <tr className="results-table-total-row">
      {showTeacherSidebar ? (
        <td
          style={{
            position: "sticky",
            right: 0,
            zIndex: 4,
            borderRadius: 16,
            padding: "14px 18px",
            textAlign: "center",
            fontSize: "20px",
            fontWeight: 1000,
            color: "#7c2d12",
            background: "linear-gradient(135deg, rgba(255,237,213,.98), rgba(251,146,60,.50))",
            border: "6px solid #9a5310",
            boxShadow: "0 0 24px rgba(154,83,15,.65)",
            whiteSpace: "nowrap",
          }}
        >
          الإجمالي
        </td>
      ) : null}

      {allSubCols.map((sc) => {
        const d = totalsDetailBySubCol?.[sc.key] || {};
        const inv = Number(d.inv || 0);
        const res = Number(d.res || 0);
        const corr = Number(d.corr || 0);
        const total = Number(d.total ?? inv + res + corr);
        const deficit = Number(d.deficit || 0);

        return (
          <td
            key={sc.key}
            style={{
              borderRadius: 16,
              padding: "14px 18px",
              fontSize: "18px",
              fontWeight: 1000,
              background: "linear-gradient(135deg, rgba(255,237,213,.98), rgba(251,146,60,.42))",
              border: "6px solid #9a5310",
              boxShadow: "0 0 24px rgba(154,83,15,.65)",
              minWidth: 260,
            }}
          >
            <Metric label="مراقبة" value={inv} className="results-total-metric-inv" />
            <Metric label="احتياط" value={res} className="results-total-metric-res" />
            <Metric label="تصحيح" value={corr} className="results-total-metric-corr" />
            <Metric label="المجموع" value={total} className="results-total-metric-total" />
            <Metric label="العجز" value={deficit} className="results-total-metric-deficit" />
          </td>
        );
      })}

      <td
        style={{
          borderRadius: 16,
          padding: "14px 18px",
          textAlign: "center",
          fontSize: "20px",
          fontWeight: 1000,
          color: "#7c2d12",
          background: "linear-gradient(135deg, rgba(255,237,213,.98), rgba(251,146,60,.50))",
          border: "6px solid #9a5310",
          boxShadow: "0 0 24px rgba(154,83,15,.65)",
          whiteSpace: "nowrap",
        }}
      >
        —
      </td>
    </tr>
  );
}
