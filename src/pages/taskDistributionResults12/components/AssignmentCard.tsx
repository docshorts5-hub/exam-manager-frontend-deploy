import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import { ResultsAssignmentBadge } from "./ResultsAssignmentBadge";
import { ResultsAssignmentDetails } from "./ResultsAssignmentDetails";

function getTaskTypeBorder(taskType: any, fallbackBorder: string) {
  switch (String(taskType || "")) {
    case "INVIGILATION":
      return { border: "3px solid gold", boxShadow: "0 0 0 1px rgba(212,175,55,0.22), inset 0 1px 0 rgba(255,255,255,0.06)" };
    case "RESERVE":
      return { border: "4px solid #16a34a", boxShadow: "0 0 0 2px rgba(22,163,74,0.45), 0 0 18px rgba(22,163,74,0.55), inset 0 1px 0 rgba(255,255,255,0.06)", animation: "resultsReserveGreenBlink 1.15s ease-in-out infinite" };
    case "DUTY_INVIGILATOR":
      return { border: "4px solid #dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,0.45), 0 0 18px rgba(220,38,38,0.55), inset 0 1px 0 rgba(255,255,255,0.06)", animation: "resultsDutyRedBlink 1.15s ease-in-out infinite" };
    default:
      return { border: `1px solid ${fallbackBorder}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" };
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
  isDraggable: boolean;
  dragSrcUid: string | null;
  dragOverUid: string | null;
  setDragSrcUid: (v: string | null) => void;
  setDragOverUid: (v: string | null) => void;
  onSwap: (srcUid: string, dstUid: string) => void;
  onSelect?: (payload: { uid: string; teacher: string; subColKey: string }) => void;
  isSelected?: boolean;
  goldLineSoft: string;
  tableText: string;
  isConflict?: boolean;
  onDelete?: (uid: string) => void;
};

export function AssignmentCard(props: AssignmentCardProps) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
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
    <>
      <style>{`@keyframes resultsReserveGreenBlink { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.32); } } @keyframes resultsDutyRedBlink { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.32); } }`}</style>
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
              if (window.confirm(tr("هل تريد حذف هذه المراقبة؟", "Do you want to delete this assignment?"))) {
                props.onDelete?.(uid);
              }
            }}
            title={`${tr("حذف", "Delete")} ${props.taskLabel((ass as any).taskType)}`}
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
            {tr("حذف التكليف", "Delete Assignment")}
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
    </>
  );
}
