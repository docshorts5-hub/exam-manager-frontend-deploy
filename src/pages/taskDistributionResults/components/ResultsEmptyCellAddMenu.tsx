import React from "react";
import type { AddChoice } from "./ResultsEmptyTeacherCell";

type Props = {
  addChoices: AddChoice[];
  addBtnStyle: React.CSSProperties;
  canAdd: (taskType: string) => boolean;
  getAddTitle?: (taskType: string) => string | undefined;
  onAddChoice?: (taskType: string) => void;
  onCloseAdd?: () => void;
  showInvigilationHint: boolean;
  invigilationHintText?: string;
};

export function ResultsEmptyCellAddMenu({
  addChoices,
  addBtnStyle,
  canAdd,
  getAddTitle,
  onAddChoice,
  onCloseAdd,
  showInvigilationHint,
  invigilationHintText,
}: Props) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {addChoices.map((c) => {
        const allowed = canAdd(c.key);
        return (
          <button
            key={c.key}
            type="button"
            disabled={!allowed}
            title={getAddTitle?.(c.key)}
            style={{
              ...addBtnStyle,
              opacity: allowed ? 1 : 0.45,
              cursor: allowed ? "pointer" : "not-allowed",
              border:
                !allowed && (c.key === "INVIGILATION" || c.key === "RESERVE")
                  ? "1px solid rgba(251,191,36,0.35)"
                  : addBtnStyle.border,
              background:
                !allowed && (c.key === "INVIGILATION" || c.key === "RESERVE")
                  ? "rgba(251,191,36,0.08)"
                  : addBtnStyle.background,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!allowed) return;
              onAddChoice?.(c.key);
            }}
          >
            + إضافة {c.label}
          </button>
        );
      })}

      {showInvigilationHint ? (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(251,191,36,0.25)",
            background: "rgba(251,191,36,0.08)",
            color: "rgba(255,255,255,0.90)",
            fontWeight: 900,
          }}
        >
          {invigilationHintText}
        </div>
      ) : null}

      <button
        type="button"
        style={{
          ...addBtnStyle,
          border: `1px solid rgba(239,68,68,0.45)`,
          background: "rgba(239,68,68,0.12)",
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCloseAdd?.();
        }}
      >
        إغلاق
      </button>
    </div>
  );
}
