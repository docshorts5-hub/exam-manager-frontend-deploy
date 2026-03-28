import React from "react";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import { ResultsAssignmentBadge } from "./ResultsAssignmentBadge";
import { ResultsAssignmentDetails } from "./ResultsAssignmentDetails";

export type AssignmentCardProps = {
  teacher: string;
  subColKey: string;
  ass: Assignment & { __uid?: string; invigilatorIndex?: number | null };
  index: number;

  taskLabel: (t: any) => string;
  normalizeSubject: (s: string) => string;
  formatPeriod: (p?: string) => string;
  getCommitteeNo: (a: any) => string | undefined;

  // drag
  isDraggable: boolean;
  dragSrcUid: string | null;
  dragOverUid: string | null;
  setDragSrcUid: (v: string | null) => void;
  setDragOverUid: (v: string | null) => void;
  onSwap: (srcUid: string, dstUid: string) => void;

  // ✅ selection (for copy/paste)
  onSelect?: (payload: { uid: string; teacher: string; subColKey: string }) => void;
  isSelected?: boolean;

  // styles
  goldLineSoft: string;
  tableText: string;

  // ✅ conflict flashing
  isConflict?: boolean;

  // ✅ delete
  onDelete?: (uid: string) => void;
};

export function AssignmentCard(props: AssignmentCardProps) {
  const { ass } = props;
  const committeeNo = props.getCommitteeNo(ass);
  const invIdx = (ass as any).invigilatorIndex as number | undefined;

  const uid = String((ass as any)?.__uid || "");
  const isDrag = props.isDraggable;
  const isDragging = !!props.dragSrcUid && uid === props.dragSrcUid;
  const isOver = !!props.dragOverUid && uid === props.dragOverUid;
  const isConflict = !!props.isConflict;

  const canDelete = typeof props.onDelete === "function";

  return (
    <div
      style={{
        paddingTop: props.index === 0 ? 0 : 6,
        marginTop: props.index === 0 ? 0 : 6,
        borderTop: props.index === 0 ? "none" : `1px solid ${props.goldLineSoft}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <ResultsAssignmentBadge
        uid={uid}
        isDraggable={isDrag}
        isOver={isOver}
        isDragging={isDragging}
        isConflict={isConflict}
        isSelected={props.isSelected}
        label={props.taskLabel((ass as any).taskType)}
        teacher={props.teacher}
        subColKey={props.subColKey}
        dragOverUid={props.dragOverUid}
        setDragSrcUid={props.setDragSrcUid}
        setDragOverUid={props.setDragOverUid}
        onSwap={props.onSwap}
        onSelect={props.onSelect}
        goldLineSoft={props.goldLineSoft}
      />

        {canDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!uid) return;
              if (window.confirm("هل تريد حذف هذه المراقبة؟")) {
                props.onDelete?.(uid);
              }
            }}
            title="حذف المراقبة"
            style={{
              borderRadius: 10,
              border: `1px solid ${props.goldLineSoft}`,
              background: "linear-gradient(180deg, rgba(127,29,29,0.92), rgba(239,68,68,0.88))",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
              padding: "6px 10px",
              boxShadow: "0 8px 18px rgba(0,0,0,0.28)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            حذف المراقبة
          </button>
        ) : null}
      </div>

      <ResultsAssignmentDetails
        committeeNo={committeeNo}
        invigilatorIndex={invIdx}
        subject={(ass as any).subject}
        period={(ass as any).period}
        tableText={props.tableText}
        goldLineSoft={props.goldLineSoft}
        normalizeSubject={props.normalizeSubject}
        formatPeriod={props.formatPeriod}
      />
    </div>
  );
}
