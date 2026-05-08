import React from "react";
import { btn, btnDisabled } from "../../../styles/ui";

type Props = {
  undoDisabled: boolean;
  onUndo: () => void;
  onClose: () => void;
  showTeacherSidebar: boolean;
  onToggleTeacherSidebar: () => void;
};

export function ResultsFullscreenToolbar({ undoDisabled, onUndo, onClose, showTeacherSidebar, onToggleTeacherSidebar }: Props) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <button
        style={{ ...btn("soft"), ...(undoDisabled ? btnDisabled : {}) }}
        onClick={onUndo}
        disabled={undoDisabled}
        title={undoDisabled ? "لا يوجد تعديلات للتراجع" : "التراجع عن آخر تعديل"}
      >
        تراجع
      </button>
      <button style={btn(showTeacherSidebar ? "brand" : "soft")} onClick={onToggleTeacherSidebar}>
        {showTeacherSidebar ? "إخفاء قائمة المعلمين" : "إظهار قائمة المعلمين"}
      </button>
      <button style={btn("danger")} onClick={onClose}>
        إغلاق ملء الشاشة
      </button>
    </div>
  );
}
