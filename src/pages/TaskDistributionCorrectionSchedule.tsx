import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { loadRun } from "../utils/taskDistributionStorage";
import type { Assignment } from "../contracts/taskDistributionContract";

type Entry = {
  dateISO: string;
  correction: { teacherName: string; subject?: string }[];
  review: { teacherName: string; subject?: string }[];
};

const GOLD = "#c9a227";
const GOLD_SUB = "rgba(201,162,39,0.75)";

function formatDate(dateISO: string) {
  return dateISO;
}

export default function TaskDistributionCorrectionSchedule() {
  const nav = useNavigate();
  const { tenantId } = useAuth();

  // ✅ loadRun يحتاج tenantId
  const run = loadRun(tenantId || "default");

  const entries: Entry[] = useMemo(() => {
    const assignments: Assignment[] = run?.assignments ?? [];
    const byDate = new Map<string, Entry>();

    for (const a of assignments) {
      // ✅ Assignment عندك يستخدم taskType بدل type
      if (a.taskType !== "CORRECTION_FREE" && a.taskType !== "REVIEW_FREE") continue;

      const dateISO = a.dateISO;
      const teacherName = a.teacherName ?? a.teacherId;

      // ✅ subject بدل subjectName
      const subject = a.subject;

      if (!byDate.has(dateISO)) {
        byDate.set(dateISO, { dateISO, correction: [], review: [] });
      }

      const e = byDate.get(dateISO)!;
      if (a.taskType === "CORRECTION_FREE") e.correction.push({ teacherName, subject });
      else e.review.push({ teacherName, subject });
    }

    const arr = Array.from(byDate.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    return arr;
  }, [run]);

  const page: React.CSSProperties = {
    minHeight: "100vh",
    padding: 18,
    background:
      "radial-gradient(1200px 700px at 80% -10%, rgba(212,175,55,0.14), transparent 55%), linear-gradient(180deg, #060913 0%, #060813 35%, #04050b 100%)",
    color: GOLD,
  };

  const topBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  };

  const title: React.CSSProperties = { fontSize: 18, fontWeight: 900 };
  const sub: React.CSSProperties = { fontSize: 13, color: GOLD_SUB, marginTop: 2 };

  const btn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(212,175,55,0.22)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
    color: GOLD,
    cursor: "pointer",
    fontWeight: 800,
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
    alignItems: "stretch",
  };

  const card: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const pillRow: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
  const pill: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(212,175,55,0.18)",
    background: "rgba(0,0,0,0.25)",
    color: GOLD,
    fontWeight: 800,
    fontSize: 12,
  };

  const list: React.CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 };
  const item: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(0,0,0,0.25)",
  };
  const itemLeft: React.CSSProperties = { fontWeight: 800 };
  const itemRight: React.CSSProperties = { fontSize: 12, color: GOLD_SUB, textAlign: "left" };

  return (
    <div style={page}>
      <div style={topBar}>
        <div>
          <div style={title}>📌 جدول التفريغ للتصحيح</div>
          <div style={sub}>تم تجميعه من نتائج آخر تشغيل للتوزيع (تفريغ تصحيح/مراجعة)</div>
        </div>

        {/* ✅ تصحيح مسار الرجوع */}
        <button style={btn} onClick={() => nav("/task-distribution/run")}>
          ← رجوع
        </button>
      </div>

      {!run ? (
        <div style={{ ...card, maxWidth: 720 }}>
          لا يوجد تشغيل محفوظ. شغّل التوزيع أولًا من صفحة /task-distribution/run.
        </div>
      ) : entries.length === 0 ? (
        <div style={{ ...card, maxWidth: 720 }}>
          لا يوجد تفريغ للتصحيح/المراجعة في نتائج هذا التشغيل.
        </div>
      ) : (
        <div style={grid}>
          {entries.map((e) => (
            <div key={e.dateISO} style={card}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{formatDate(e.dateISO)}</div>
                <div style={pillRow}>
                  <span style={pill}>تصحيح: {e.correction.length}</span>
                  <span style={pill}>مراجعة: {e.review.length}</span>
                </div>
              </div>

              {e.correction.length > 0 && (
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>تفريغ للتصحيح</div>
                  <ul style={list}>
                    {e.correction.map((x, i) => (
                      <li key={i} style={item}>
                        <div style={itemLeft}>{x.teacherName}</div>
                        <div style={itemRight}>{x.subject ? x.subject : ""}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {e.review.length > 0 && (
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>تفريغ للمراجعة</div>
                  <ul style={list}>
                    {e.review.map((x, i) => (
                      <li key={i} style={item}>
                        <div style={itemLeft}>{x.teacherName}</div>
                        <div style={itemRight}>{x.subject ? x.subject : ""}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
