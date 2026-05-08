// src/pages/taskDistributionResults/components/ResultsExamsLikeTable.tsx
import React, { useMemo } from "react";
import { Assignment, Exam } from "../../../engine/assignmentEngine";
import { buildResultsExamsLikeRows } from "../services/resultsExamsLikeHelpers";

type Props = {
  tenantId: string;
  exams: Exam[];
  assignments: Assignment[];
  users: any[];
  onArchive: () => Promise<void> | void;
};

// ✅ Exams-like design (black + gold) for results
export default function ResultsExamsLikeTable({ exams, assignments, users, onArchive }: Props) {
  const rows = useMemo(() => buildResultsExamsLikeRows({ exams, assignments, users }), [assignments, exams, users]);

  const headerChip: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: 18,
    background: "linear-gradient(180deg, rgba(212,175,55,0.38), rgba(212,175,55,0.18))",
    border: "1px solid rgba(212,175,55,0.45)",
    color: "#f5e6a8",
    fontWeight: 900,
    textAlign: "center",
    boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
    whiteSpace: "nowrap",
  };

  const cell: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 18,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(212,175,55,0.25)",
    color: "#e5e7eb",
    fontWeight: 700,
    textAlign: "center",
    boxShadow: "inset 0 0 22px rgba(0,0,0,0.55)",
  };

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 16,
        border: "1px solid rgba(212,175,55,0.25)",
        background: "rgba(2,6,23,0.55)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ color: "#d4af37", fontWeight: 900 }}>نتائج توزيع المهام</div>
        <button
          onClick={() => onArchive?.()}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(212,175,55,0.12)",
            border: "1px solid rgba(212,175,55,0.35)",
            color: "#d4af37",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          إرسال للأرشيف
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            minWidth: 980,
            display: "grid",
            gridTemplateColumns: "1.5fr 1.2fr 1fr 0.9fr 0.9fr 0.9fr 1fr 0.9fr 0.9fr",
            gap: 10,
            alignItems: "stretch",
          }}
        >
          <div style={headerChip}>المعلم</div>
          <div style={headerChip}>المادة</div>
          <div style={headerChip}>التاريخ</div>
          <div style={headerChip}>اليوم</div>
          <div style={headerChip}>الوقت</div>
          <div style={headerChip}>الفترة</div>
          <div style={headerChip}>المهمة</div>
          <div style={headerChip}>القاعة</div>
          <div style={headerChip}>المدة</div>

          {rows.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", ...cell, opacity: 0.8 }}>لا توجد بيانات نتائج</div>
          ) : (
            rows.map((r) => (
              <React.Fragment key={r.id}>
                <div style={{ ...cell, textAlign: "right" }}>{r.teacher}</div>
                <div style={{ ...cell, color: "#d4af37" }}>{r.subject}</div>
                <div style={cell}>{r.date}</div>
                <div style={cell}>{r.day}</div>
                <div style={cell}>{r.time}</div>
                <div style={cell}>{r.period}</div>
                <div style={{ ...cell, textAlign: "right" }}>{r.role}</div>
                <div style={cell}>{r.room}</div>
                <div style={cell}>{r.duration}</div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
}