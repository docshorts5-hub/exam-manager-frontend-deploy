import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

import {
  cardHeaderRow,
  cardTitleOnDark,
  cardSubOnDark,
  btn,
  btnDisabled,
} from "../../../styles/ui";
import { GOLD_LINE_SOFT, GOLD_TEXT } from "../constants";

type Props = {
  runId: string;
  createdAtISO?: string;
  importError?: string;
  tableFullScreen: boolean;
  undoDisabled: boolean;
  onGoHome: () => void;
  onPickImportFile: () => void;
  onExportPdf: () => void;
  onArchiveSnapshot: () => void;
  onToggleFullscreen: () => void;
  onUndo: () => void;
  onExportExcel: () => void;
  onPrintTableOnly: () => void;
  showTeacherSidebar: boolean;
  onToggleTeacherSidebar: () => void;
};

export function ResultsPageHeader({
  runId,
  createdAtISO,
  importError,
  tableFullScreen,
  undoDisabled,
  onGoHome,
  onPickImportFile,
  onExportPdf,
  onArchiveSnapshot,
  onToggleFullscreen,
  onUndo,
  onExportExcel,
  onPrintTableOnly,
  showTeacherSidebar,
  onToggleTeacherSidebar,
}: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <>
      <div style={{ ...cardHeaderRow, marginBottom: 0 }}>
        <div>
          <div style={{ ...cardTitleOnDark, color: GOLD_TEXT, letterSpacing: 0.2 }}>
            {tr("جدول التوزيع الشامل (اليوم ← امتحانات اليوم حسب الفترة)", "Master Distribution Table (Day ← Exams by Period)")}
          </div>
          <div style={{ ...cardSubOnDark, color: GOLD_LINE_SOFT }}>
            Run ID: {runId} • {String(createdAtISO || "").slice(0, 10) || "—"}
          </div>
          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.85)", fontWeight: 900, fontSize: 12 }}>
            {tr("✋ التعديل اليدوي: اسحب “مراقبة / احتياط / مراقب دور” وأسقطها فوق ", "✋ Manual edit: drag “Invigilation / Reserve / Duty Invigilator” and drop it onto ")}
            <b>{tr("نفس نوع المهمة", "the same task type")}</b>
            {tr(" للتبديل فورًا.", " to swap immediately.")}
            <div style={{ marginTop: 4, opacity: 0.95 }}>
              ❌ {tr("ممنوع التبديل إذا المعلم الهدف لديه مهمة مسبقًا في ", "Swap is not allowed if the target teacher already has a task in ")}
              <b>{tr("نفس العمود", "the same column")}</b>.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={btn("soft")} onClick={onGoHome}>
            {tr("الرئيسية", "Home")}
          </button>

          <button style={btn("soft")} onClick={onPickImportFile}>
            {tr("استيراد الجدول الشامل (Excel)", "Import Master Table (Excel)")}
          </button>

          <button style={btn("soft")} onClick={onExportPdf}>
            {tr("تصدير PDF (الجدول + الأسماء)", "Export PDF (Table + Names)")}
          </button>

          <button style={btn("soft")} onClick={onArchiveSnapshot} title={tr("حفظ نسخة من الجدول الشامل في صفحة الأرشيف", "Save a copy of the master table in the archive page")}>
            {tr("إرسال للأرشيف", "Send to Archive")}
          </button>

          <button
            style={btn(tableFullScreen ? "danger" : "soft")}
            onClick={onToggleFullscreen}
            title={tableFullScreen ? tr("عودة للحجم الطبيعي", "Return to normal size") : tr("تكبير الجدول الشامل ملء الشاشة", "Open the master table in fullscreen")}
          >
            {tableFullScreen ? tr("إغلاق ملء الشاشة", "Close Fullscreen") : tr("ملء الشاشة", "Fullscreen")}
          </button>

          <button style={btn(showTeacherSidebar ? "brand" : "soft")} onClick={onToggleTeacherSidebar}>
            {showTeacherSidebar ? tr("إخفاء قائمة المعلمين", "Hide Teachers List") : tr("إظهار قائمة المعلمين", "Show Teachers List")}
          </button>

          <button
            style={{ ...btn("soft"), ...(undoDisabled ? btnDisabled : {}) }}
            onClick={onUndo}
            disabled={undoDisabled}
            title={undoDisabled ? tr("لا يوجد تعديلات للتراجع", "There are no edits to undo") : tr("التراجع عن آخر تعديل", "Undo the last edit")}
          >
            {tr("تراجع", "Undo")}
          </button>

          <button style={btn("soft")} onClick={onExportExcel}>
            {tr("تصدير Excel (XLSX)", "Export Excel (XLSX)")}
          </button>

          <button style={btn("brand")} onClick={onPrintTableOnly}>
            {tr("طباعة (الجدول فقط)", "Print (Table Only)")}
          </button>
        </div>
      </div>

      {importError && <div style={{ marginTop: 10, color: "#fecaca", fontWeight: 800 }}>{importError}</div>}
    </>
  );
}
