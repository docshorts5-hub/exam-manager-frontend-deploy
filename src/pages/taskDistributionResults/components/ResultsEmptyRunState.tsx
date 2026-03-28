import React from "react";
import { btn, cardDark, cardHeaderRow, cardSubOnDark, cardTitleOnDark } from "../../../styles/ui";
import { GOLD_LINE_SOFT, GOLD_TEXT } from "../constants";

type Props = {
  importError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onPickImportFile: () => void;
  onImportFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ResultsEmptyRunState({
  importError,
  fileInputRef,
  onBack,
  onPickImportFile,
  onImportFileSelected,
}: Props) {
  return (
    <div style={cardDark}>
      <div style={cardHeaderRow}>
        <div>
          <div style={{ ...cardTitleOnDark, color: GOLD_TEXT }}>النتائج</div>
          <div style={{ ...cardSubOnDark, color: GOLD_LINE_SOFT }}>لا يوجد تشغيل محفوظ بعد</div>
        </div>

        <button style={btn("soft")} onClick={onBack}>
          رجوع
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button style={btn("soft")} onClick={onPickImportFile}>
          استيراد الجدول الشامل (Excel)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          style={{ display: "none" }}
          onChange={onImportFileSelected}
        />
      </div>

      {importError && <div style={{ marginTop: 10, color: "#fecaca", fontWeight: 800 }}>{importError}</div>}
    </div>
  );
}
