import React from "react";

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
  return (
    <>
      <div style={{ ...cardHeaderRow, marginBottom: 0 }}>
        <div>
          <div style={{ ...cardTitleOnDark, color: GOLD_TEXT, letterSpacing: 0.2 }}>
            جدول التوزيع الشامل (اليوم ← امتحانات اليوم حسب الفترة)
          </div>
          <div style={{ ...cardSubOnDark, color: GOLD_LINE_SOFT }}>
            Run ID: {runId} • {String(createdAtISO || "").slice(0, 10) || "—"}
          </div>
          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.85)", fontWeight: 900, fontSize: 12 }}>
            ✋ التعديل اليدوي: اسحب “مراقبة / احتياط / تصحيح” وأسقطها فوق <b>نفس نوع المهمة</b> للتبديل فورًا.
            <div style={{ marginTop: 4, opacity: 0.95 }}>
              ❌ ممنوع التبديل إذا المعلم الهدف لديه مهمة مسبقًا في <b>نفس العمود</b>.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={btn("soft")} onClick={onGoHome}>
            الرئيسية
          </button>

          <button style={btn("soft")} onClick={onPickImportFile}>
            استيراد الجدول الشامل (Excel)
          </button>

          <button style={btn("soft")} onClick={onExportPdf}>
            تصدير PDF (الجدول + الأسماء)
          </button>

          <button style={btn("soft")} onClick={onArchiveSnapshot} title="حفظ نسخة من الجدول الشامل في صفحة الأرشيف">
            إرسال للأرشيف
          </button>

          <button
            style={btn(tableFullScreen ? "danger" : "soft")}
            onClick={onToggleFullscreen}
            title={tableFullScreen ? "عودة للحجم الطبيعي" : "تكبير الجدول الشامل ملء الشاشة"}
          >
            {tableFullScreen ? "إغلاق ملء الشاشة" : "ملء الشاشة"}
          </button>

          <button style={btn(showTeacherSidebar ? "brand" : "soft")} onClick={onToggleTeacherSidebar}>
            {showTeacherSidebar ? "إخفاء قائمة المعلمين" : "إظهار قائمة المعلمين"}
          </button>

          <button
            style={{ ...btn("soft"), ...(undoDisabled ? btnDisabled : {}) }}
            onClick={onUndo}
            disabled={undoDisabled}
            title={undoDisabled ? "لا يوجد تعديلات للتراجع" : "التراجع عن آخر تعديل"}
          >
            تراجع
          </button>

          <button style={btn("soft")} onClick={onExportExcel}>
            تصدير Excel (XLSX)
          </button>

          <button style={btn("brand")} onClick={onPrintTableOnly}>
            طباعة (الجدول فقط)
          </button>
        </div>
      </div>

      {importError && <div style={{ marginTop: 10, color: "#fecaca", fontWeight: 800 }}>{importError}</div>}
    </>
  );
}
