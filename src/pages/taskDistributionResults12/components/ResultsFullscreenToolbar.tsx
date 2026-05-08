import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { btn, btnDisabled } from "../../../styles/ui";

type Props = {
  undoDisabled: boolean;
  onUndo: () => void;
  onClose: () => void;
  showTeacherSidebar: boolean;
  onToggleTeacherSidebar: () => void;
};

export function ResultsFullscreenToolbar({ undoDisabled, onUndo, onClose, showTeacherSidebar, onToggleTeacherSidebar }: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <button
        style={{ ...btn("soft"), ...(undoDisabled ? btnDisabled : {}) }}
        onClick={onUndo}
        disabled={undoDisabled}
        title={undoDisabled ? tr("لا يوجد تعديلات للتراجع", "There are no edits to undo") : tr("التراجع عن آخر تعديل", "Undo the last edit")}
      >
        {tr("تراجع", "Undo")}
      </button>
      <button style={btn(showTeacherSidebar ? "brand" : "soft")} onClick={onToggleTeacherSidebar}>
        {showTeacherSidebar ? tr("إخفاء قائمة المعلمين", "Hide Teachers List") : tr("إظهار قائمة المعلمين", "Show Teachers List")}
      </button>
      <button style={btn("danger")} onClick={onClose}>
        {tr("إغلاق ملء الشاشة", "Close Fullscreen")}
      </button>
    </div>
  );
}
