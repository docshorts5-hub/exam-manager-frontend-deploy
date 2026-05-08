import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

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
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
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
          <div style={fairnessTitle}>{tr("ملخص عدالة التوزيع", "Distribution Fairness Summary")}</div>
          <div style={fairnessSub}>{tr("الإجمالي = مراقبة + احتياط + مراجعة فقط (التصحيح خارج النصاب)", "Total = invigilation + reserve + review only (correction is خارج النصاب)")}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={hBtn} onClick={navToResults} title={tr("الجدول الشامل", "Master Table")}>
            📋 {tr("الجدول الشامل", "Master Table")}
          </button>

          <button type="button" style={hBtn} onClick={onDeleteAllDistributionData} title={tr("حذف جميع بيانات التوزيع", "Delete All Distribution Data")}>
            ✖ {tr("حذف بيانات التوزيع", "Delete Distribution Data")}
          </button>

          <input
            style={fairnessSearchInput}
            placeholder={tr("بحث في الكادر التعليمي (اسم/ID)...", "Search teaching staff (name/ID)...")}
            value={fairnessQuery}
            onChange={(e) => setFairnessQuery(e.target.value)}
          />

          <button type="button" style={hBtn} onClick={() => setFairnessQuery("")} title={tr("مسح البحث", "Clear Search")}>
            ✕ {tr("مسح", "Clear")}
          </button>

          <span style={{ fontWeight: 900, color: "rgba(201,162,39,.82)" }}>{tr("الترتيب:", "Sort:")}</span>
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
            <option value="TOTAL_DESC">{tr("من الأعلى عبئًا إلى الأقل", "Highest load to lowest")}</option>
            <option value="TOTAL_ASC">{tr("من الأقل عبئًا إلى الأعلى", "Lowest load to highest")}</option>
            <option value="NAME_ASC">{tr("حسب الاسم (أ-ي)", "By name (A-Z)")}</option>
          </select>

          <span style={pill}>{tr("المعروض", "Shown")}: {fairnessRows.length}</span>
          <span style={pill}>{tr("الإجمالي", "Total")}: {teachersCount}</span>
        </div>
      </div>

      <div style={fairnessTableScroll}>
        <table style={table2}>
          <thead>
            <tr>
              <th style={{ ...th2, width: 60 }}>#</th>
              <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>{tr("اسم المعلم", "Teacher Name")}</th>
              <th style={th2}>{tr("مراقبة", "Invigilation")}</th>
              <th style={th2}>{tr("احتياط", "Reserve")}</th>
              <th style={th2}>{tr("مراجعة", "Review")}</th>
              <th style={th2}>{tr("تصحيح", "Correction")}</th>
              <th style={th2}>{tr("الإجمالي *", "Total *")}</th>
            </tr>
          </thead>

          <tbody>
            {fairnessRows.length === 0 ? (
              <tr>
                <td style={td2} colSpan={7}>
                  {tr("لا توجد نتائج مطابقة للبحث.", "No matching results found.")}
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
