import React from "react";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import { ResultsAssignedTaskBlock } from "./ResultsAssignedTaskBlock";
import type { SubCol } from "./TeacherRow";

export type ResultsAssignedTeacherCellProps = {
  teacher: string;
  sc: SubCol;
  list: Assignment[];
  cellOuter: React.CSSProperties;
  getSubjectBackground: (subject?: string) => string;
  normalizeSubject: (s: string) => string;
  formatPeriod: (p?: string) => string;
  getCommitteeNo: (a: any) => string | undefined;
  taskLabel: (t: any) => string;
  isDraggableTaskType: (taskType: any) => boolean;
  dragSrcUid: string | null;
  dragOverUid: string | null;
  setDragSrcUid: (v: string | null) => void;
  setDragOverUid: (v: string | null) => void;
  onDropToCell?: (srcUid: string, dstTeacher: string, subColKey: string, dstCellList: any[]) => void;
  onSwap: (srcUid: string, dstUid: string) => void;
  onSelectCell?: (payload: { teacher: string; subColKey: string; uid?: string }) => void;
  selectedCell?: { teacher: string; subColKey: string; uid?: string } | null;
  onDeleteByUid?: (uid: string) => void;
  isConflictUid?: (uid: string) => boolean;
  styles: {
    goldLine: string;
    goldLineSoft: string;
    tableText: string;
  };
  isDayStart?: boolean;
};

export function ResultsAssignedTeacherCell(props: ResultsAssignedTeacherCellProps) {
  const bg = props.getSubjectBackground(props.sc.subject);

  return (
    <td
      style={props.cellOuter}
      onClick={() => {
        props.onSelectCell?.({ teacher: props.teacher, subColKey: props.sc.key });
      }}
      onDragOver={(e) => {
        if (!props.dragSrcUid) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (!props.onDropToCell) return;
        e.preventDefault();
        const srcUid = e.dataTransfer.getData("text/plain") || "";
        if (!srcUid) return;
        props.setDragOverUid(null);
        props.setDragSrcUid(null);
        props.onDropToCell(srcUid, props.teacher, props.sc.key, props.list as any[]);
      }}
    >
      <div
        style={{
          borderRadius: 14,
          padding: "8px 10px",
          background: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))",
          border: `1px solid ${props.styles.goldLineSoft}`,
          borderInlineStart: props.isDayStart ? `8px solid ${props.styles.goldLine}` : `4px solid ${props.styles.goldLine}`,
          boxShadow: `0 10px 18px rgba(0,0,0,0.45), inset ${props.isDayStart ? "10px" : "6px"} 0 0 rgba(212,175,55,0.10), inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
      >
        <div style={{ height: 7, borderRadius: 999, marginBottom: 10, background: bg }} />

        {props.list.map((ass: any, i: number) => (
          <ResultsAssignedTaskBlock
            key={`${props.teacher}_${props.sc.key}_${String(ass?.__uid || i)}_${i}`}
            teacher={props.teacher}
            subColKey={props.sc.key}
            fallbackSubject={props.sc.subject}
            fallbackPeriod={props.sc.period}
            ass={ass}
            index={i}
            taskLabel={props.taskLabel}
            normalizeSubject={props.normalizeSubject}
            formatPeriod={props.formatPeriod}
            getCommitteeNo={props.getCommitteeNo}
            isDraggable={props.isDraggableTaskType((ass as any).taskType)}
            dragSrcUid={props.dragSrcUid}
            dragOverUid={props.dragOverUid}
            setDragSrcUid={props.setDragSrcUid}
            setDragOverUid={props.setDragOverUid}
            onSwap={props.onSwap}
            onSelect={props.onSelectCell ? ({ uid }) => props.onSelectCell?.({ teacher: props.teacher, subColKey: props.sc.key, uid }) : undefined}
            isSelected={
              props.selectedCell?.teacher === props.teacher &&
              props.selectedCell?.subColKey === props.sc.key &&
              props.selectedCell?.uid === String((ass as any)?.__uid || "")
            }
            goldLineSoft={props.styles.goldLineSoft}
            tableText={props.styles.tableText}
            isConflict={props.isConflictUid ? props.isConflictUid(String((ass as any)?.__uid || "")) : false}
            onDelete={props.onDeleteByUid ? (uid) => props.onDeleteByUid?.(uid) : undefined}
          />
        ))}
      </div>
    </td>
  );
}
