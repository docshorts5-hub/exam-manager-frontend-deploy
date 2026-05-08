import React from "react";
import { AssignmentCard } from "./AssignmentCard";
import { ResultsAssignmentMeta } from "./ResultsAssignmentMeta";

export type ResultsAssignedTaskBlockProps = {
  teacher: string;
  subColKey: string;
  fallbackSubject?: string;
  fallbackPeriod?: string;
  ass: any;
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
  onSelect?: ({ uid }: { uid: string }) => void;
  isSelected: boolean;
  goldLineSoft: string;
  tableText: string;
  isConflict: boolean;
  onDelete?: (uid: string) => void;
};

export function ResultsAssignedTaskBlock(props: ResultsAssignedTaskBlockProps) {
  return (
    <div
      style={{
        paddingTop: props.index === 0 ? 0 : 10,
        marginTop: props.index === 0 ? 0 : 10,
        borderTop: props.index === 0 ? "none" : `1px solid ${props.goldLineSoft}`,
      }}
    >
      <AssignmentCard
        teacher={props.teacher}
        subColKey={props.subColKey}
        ass={props.ass}
        index={props.index}
        taskLabel={props.taskLabel}
        normalizeSubject={props.normalizeSubject}
        formatPeriod={props.formatPeriod}
        getCommitteeNo={props.getCommitteeNo}
        isDraggable={props.isDraggable}
        dragSrcUid={props.dragSrcUid}
        dragOverUid={props.dragOverUid}
        setDragSrcUid={props.setDragSrcUid}
        setDragOverUid={props.setDragOverUid}
        onSwap={props.onSwap}
        onSelect={props.onSelect}
        isSelected={props.isSelected}
        goldLineSoft={props.goldLineSoft}
        tableText={props.tableText}
        isConflict={props.isConflict}
        onDelete={props.onDelete}
      />

      <ResultsAssignmentMeta
        subject={(props.ass as any).subject}
        fallbackSubject={props.fallbackSubject}
        period={(props.ass as any).period}
        fallbackPeriod={props.fallbackPeriod}
        normalizeSubject={props.normalizeSubject}
        formatPeriod={props.formatPeriod}
      />
    </div>
  );
}
