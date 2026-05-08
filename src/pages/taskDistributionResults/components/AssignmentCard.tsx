import React from "react";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import { ResultsAssignmentBadge } from "./ResultsAssignmentBadge";
import { ResultsAssignmentDetails } from "./ResultsAssignmentDetails";

const getAssignmentStyle = (taskType: string) => {
  switch (taskType) {
    case 'INVIGILATION':
      return {
        border: '3px solid gold',
        background: 'rgba(255,215,0,0.08)',
        boxShadow: '0 0 0 1px rgba(255,215,0,0.18) inset',
        borderRadius: '6px',
      };
    case 'REVIEW_FREE':
      return {
        border: '3px solid green',
        background: 'rgba(34,197,94,0.08)',
        boxShadow: '0 0 0 1px rgba(34,197,94,0.18) inset',
        borderRadius: '6px',
      };
    case 'CORRECTION_FREE':
      return {
        border: '3px solid white',
        background: 'rgba(255,255,255,0.08)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.18) inset',
        borderRadius: '6px',
      };
    default:
      return {
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'transparent',
        borderRadius: '6px',
      };
  }
};


function getTaskTypeBorder(taskType: any, fallbackBorder: string) {
  switch (String(taskType || "")) {
    case "INVIGILATION":
      return {
        border: "3px solid gold",
        boxShadow: "0 0 0 1px rgba(212,175,55,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
      };
    case "REVIEW_FREE":
      return {
        border: "3px solid green",
        boxShadow: "0 0 0 1px rgba(22,163,74,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
      };
    case "CORRECTION_FREE":
      return {
        border: "3px solid white",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
      };
    default:
      return {
        border: `1px solid ${fallbackBorder}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      };
  }
}


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
  const taskBorderStyle = getTaskTypeBorder((ass as any).taskType, props.goldLineSoft);

  const canDelete = typeof props.onDelete === "function";

  return (
    <div
      style={{
        paddingTop: props.index === 0 ? 0 : 6,
        marginTop: props.index === 0 ? 0 : 6,
        borderTop: props.index === 0 ? "none" : `1px solid ${props.goldLineSoft}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(2,6,23,0.28)",
          ...taskBorderStyle,
        }}
      >
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
            title={`حذف ${props.taskLabel((ass as any).taskType)}`}
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


// NEXT_STAGE_VISUAL_REFINEMENT: added subtle task-type backgrounds and inset highlights.


// FIXED_ALL_DAYS_AND_MATERIALS: task visuals now depend only on task type, not on day or subject.
