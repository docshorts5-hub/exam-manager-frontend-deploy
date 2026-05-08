import React from "react";

export type ResultsAssignmentBadgeProps = {
  uid: string;
  isDraggable: boolean;
  isOver: boolean;
  isDragging: boolean;
  isConflict: boolean;
  isSelected?: boolean;
  label: string;
  teacher: string;
  subColKey: string;
  dragOverUid: string | null;
  setDragSrcUid: (v: string | null) => void;
  setDragOverUid: (v: string | null) => void;
  onSwap: (srcUid: string, dstUid: string) => void;
  onSelect?: (payload: { uid: string; teacher: string; subColKey: string }) => void;
  goldLineSoft: string;
};

export function ResultsAssignmentBadge(props: ResultsAssignmentBadgeProps) {
  const {
    uid,
    isDraggable,
    isOver,
    isDragging,
    isConflict,
    isSelected,
    label,
    teacher,
    subColKey,
    dragOverUid,
    setDragSrcUid,
    setDragOverUid,
    onSwap,
    onSelect,
  } = props;

  return (
    <div
      draggable={isDraggable}
      onClick={() => {
        onSelect?.({ uid, teacher, subColKey });
      }}
      onDragStart={(e) => {
        if (!isDraggable) return;
        setDragSrcUid(uid);
        e.dataTransfer.setData("text/plain", uid);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        setDragSrcUid(null);
        setDragOverUid(null);
      }}
      onDragOver={(e) => {
        if (!isDraggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverUid(uid);
      }}
      onDragLeave={() => {
        if (dragOverUid === uid) setDragOverUid(null);
      }}
      onDrop={(e) => {
        if (!isDraggable) return;
        e.preventDefault();
        const srcUid = e.dataTransfer.getData("text/plain") || "";
        setDragOverUid(null);
        setDragSrcUid(null);
        if (!srcUid || !uid) return;
        onSwap(srcUid, uid);
      }}
      title={isDraggable ? "اسحب وأسقط فوق نفس نوع المهمة للتبديل" : undefined}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 12,
        outline: isSelected ? "2px solid rgba(96,165,250,0.95)" : "none",
        outlineOffset: 2,
        border: isConflict
          ? "1px solid rgba(239,68,68,0.95)"
          : isDraggable
          ? `1px solid ${isOver ? "rgba(34,197,94,0.85)" : "rgba(251,191,36,0.35)"}`
          : "none",
        background: isConflict
          ? "linear-gradient(180deg, rgba(239,68,68,0.22), rgba(2,6,23,0.55))"
          : isDraggable
          ? isOver
            ? "linear-gradient(180deg, rgba(34,197,94,0.18), rgba(2,6,23,0.55))"
            : isDragging
            ? "linear-gradient(180deg, rgba(251,191,36,0.18), rgba(2,6,23,0.55))"
            : "rgba(2,6,23,0.35)"
          : "transparent",
        boxShadow: isConflict
          ? "0 0 0 1px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
          : isDraggable
          ? "inset 0 1px 0 rgba(255,255,255,0.06)"
          : "none",
        animation: isConflict ? "conflictPulse 0.85s ease-in-out 0s infinite" : undefined,
        cursor: isDraggable ? "grab" : "default",
        fontWeight: 900,
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: 900 }}>{label}</div>
      {isDraggable && <span style={{ fontSize: 11, opacity: 0.85 }}>(سحب/إفلات)</span>}
    </div>
  );
}
