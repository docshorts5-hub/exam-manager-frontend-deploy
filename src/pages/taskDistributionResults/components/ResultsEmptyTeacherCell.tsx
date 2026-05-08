import React from "react";
import { ResultsEmptyCellStatusMessages } from "./ResultsEmptyCellStatusMessages";
import { ResultsEmptyCellAddMenu } from "./ResultsEmptyCellAddMenu";

export type AddChoice = { key: string; label: string };

export type ResultsEmptyTeacherCellProps = {
  teacher: string;
  subColKey: string;
  dragSrcUid: string | null;
  selected: boolean;
  blockedMsg?: string | null;
  unavailabilityMsg?: string | null;
  openAdd: boolean;
  addChoices: AddChoice[];
  addBtnStyle: React.CSSProperties;
  canAdd: (taskType: string) => boolean;
  getAddTitle?: (taskType: string) => string | undefined;
  onSelect?: () => void;
  onToggleAdd?: () => void;
  onDragOverEmpty?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDropToEmpty?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onAddChoice?: (taskType: string) => void;
  onCloseAdd?: () => void;
  onAddToEmptyEnabled: boolean;
  showInvigilationHint: boolean;
  invigilationHintText?: string;
  styles: {
    goldLine: string;
    goldLineSoft: string;
  };
  isDayStart?: boolean;
};

export function ResultsEmptyTeacherCell(props: ResultsEmptyTeacherCellProps) {
  const cellOuter: React.CSSProperties = {
    padding: "0px",
    border: "none",
    background: "transparent",
    textAlign: "center",
    verticalAlign: "middle",
  };

  return (
    <td
      style={cellOuter}
      onClick={() => {
        props.onSelect?.();
        if (!props.dragSrcUid) props.onToggleAdd?.();
      }}
      onDragOver={props.onDragOverEmpty}
      onDrop={props.onDropToEmpty}
    >
      <div
        style={{
          borderRadius: 14,
          padding: "8px 10px",
          border: `1px solid ${props.styles.goldLine}`,
          borderInlineStart: props.isDayStart ? `8px solid ${props.styles.goldLine}` : `4px solid ${props.styles.goldLine}`,
          outline: props.selected ? "2px solid rgba(96,165,250,0.95)" : "none",
          outlineOffset: 2,
          background: props.dragSrcUid
            ? "linear-gradient(180deg, rgba(212,175,55,0.16), rgba(2,6,23,0.92))"
            : "linear-gradient(180deg, rgba(8,12,24,0.92), rgba(2,6,23,0.92))",
          boxShadow: `0 10px 24px rgba(0,0,0,0.45), inset ${props.isDayStart ? "10px" : "6px"} 0 0 rgba(212,175,55,0.10), inset 0 1px 0 rgba(255,255,255,0.06)`,
          color: "rgba(255,255,255,0.75)",
          userSelect: "none",
          fontWeight: 900,
          position: "relative",
        }}
        title={props.dragSrcUid ? "إفلات هنا لنقل المهمة لهذا المعلم" : undefined}
      >
        <ResultsEmptyCellStatusMessages
          blockedMsg={props.blockedMsg}
          unavailabilityMsg={props.unavailabilityMsg}
          openAdd={props.openAdd}
        />

        {props.openAdd && props.onAddToEmptyEnabled ? (
          <ResultsEmptyCellAddMenu
            addChoices={props.addChoices}
            addBtnStyle={props.addBtnStyle}
            canAdd={props.canAdd}
            getAddTitle={props.getAddTitle}
            onAddChoice={props.onAddChoice}
            onCloseAdd={props.onCloseAdd}
            showInvigilationHint={props.showInvigilationHint}
            invigilationHintText={props.invigilationHintText}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ opacity: 0.85 }}>—</span>
            {props.onAddToEmptyEnabled ? (
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: `1px solid ${props.styles.goldLineSoft}`,
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.85)",
                  fontWeight: 900,
                }}
              >
                اضغط للإضافة
              </span>
            ) : null}
          </div>
        )}
      </div>
    </td>
  );
}
