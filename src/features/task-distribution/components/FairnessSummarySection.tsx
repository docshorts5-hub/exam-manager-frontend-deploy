import React from "react";

type FairRow = {
  teacherId: string;
  teacherName: string;
  inv: number;
  res: number;
  rev: number;
  cor: number;
  total: number;
};

type Props = {
  fairnessRows: FairRow[];
  teachersCount: number;
  fairnessQuery: string;
  setFairnessQuery: (value: string) => void;
  sortMode: string;
  setSortMode: (value: any) => void;
  navToResults: () => void;
  onDeleteAllDistributionData: () => void;
  styles: {
    fairnessWrap: React.CSSProperties;
    fairnessHeader: React.CSSProperties;
    fairnessTitle: React.CSSProperties;
    fairnessSub: React.CSSProperties;
    hBtn: React.CSSProperties;
    fairnessSearchInput: React.CSSProperties;
    pill: React.CSSProperties;
    fairnessTableScroll: React.CSSProperties;
    table2: React.CSSProperties;
    th2: React.CSSProperties;
    td2: React.CSSProperties;
    totalBadge: React.CSSProperties;
    line: string;
    gold2: string;
  };
};

export default function FairnessSummarySection({
  fairnessRows,
  teachersCount,
  fairnessQuery,
  setFairnessQuery,
  sortMode,
  setSortMode,
  navToResults,
  onDeleteAllDistributionData,
  styles,
}: Props) {
  const {
    fairnessWrap,
    fairnessHeader,
    fairnessTitle,
    fairnessSub,
    hBtn,
    fairnessSearchInput,
    pill,
    fairnessTableScroll,
    table2,
    th2,
    td2,
    totalBadge,
    line,
    gold2,
  } = styles;

  return (
    <div style={fairnessWrap}>
      <div style={fairnessHeader}>
        <div>
          <div style={fairnessTitle}>ملخص عدالة التوزيع</div>
          <div style={fairnessSub}>الإجمالي = مراقبة + احتياط + مراجعة فقط (التصحيح خارج النصاب)</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={hBtn} onClick={navToResults} title="الجدول الشامل">
            📋 الجدول الشامل
          </button>

          <button type="button" style={hBtn} onClick={onDeleteAllDistributionData} title="حذف جميع بيانات التوزيع">
            ✖ حذف بيانات التوزيع
          </button>

          <input
            style={fairnessSearchInput}
            placeholder="بحث في الكادر التعليمي  (اسم/ID)..."
            value={fairnessQuery}
            onChange={(e) => setFairnessQuery(e.target.value)}
          />

          <button type="button" style={hBtn} onClick={() => setFairnessQuery("")} title="مسح البحث">
            ✕ مسح
          </button>

          <span style={{ fontWeight: 900, color: "rgba(201,162,39,.82)" }}>الترتيب:</span>
          <select
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: `1px solid ${line}`,
              background: "rgba(255,255,255,.06)",
              fontWeight: 950,
              outline: "none",
              color: gold2,
            }}
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
          >
            <option value="TOTAL_DESC">من الأعلى عبئًا إلى الأقل</option>
            <option value="TOTAL_ASC">من الأقل عبئًا إلى الأعلى</option>
            <option value="NAME_ASC">حسب الاسم (أ-ي)</option>
          </select>

          <span style={pill}>المعروض: {fairnessRows.length}</span>
          <span style={pill}>الإجمالي: {teachersCount}</span>
        </div>
      </div>

      <div style={fairnessTableScroll}>
        <table style={table2}>
          <thead>
            <tr>
              <th style={{ ...th2, width: 60 }}>#</th>
              <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>اسم المعلم</th>
              <th style={th2}>مراقبة</th>
              <th style={th2}>احتياط</th>
              <th style={th2}>مراجعة</th>
              <th style={th2}>تصحيح</th>
              <th style={th2}>الإجمالي *</th>
            </tr>
          </thead>

          <tbody>
            {fairnessRows.length === 0 ? (
              <tr>
                <td style={td2} colSpan={7}>
                  لا توجد نتائج مطابقة للبحث.
                </td>
              </tr>
            ) : (
              fairnessRows.map((r, idx) => (
                <tr key={r.teacherId}>
                  <td style={td2}>{idx + 1}</td>
                  <td style={{ ...td2, textAlign: "right", paddingRight: 16 }}>{r.teacherName || r.teacherId}</td>
                  <td style={td2}>{r.inv}</td>
                  <td style={td2}>{r.res}</td>
                  <td style={td2}>{r.rev}</td>
                  <td style={td2}>{r.cor}</td>
                  <td style={td2}>
                    <span style={totalBadge}>{r.total}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
