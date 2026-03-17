import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { loadRun, RUN_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import type { Assignment, DistributionRun, TaskType } from "../contracts/taskDistributionContract";

import {
  pageDark,
  container,
  cardDark,
  cardHeaderRow,
  cardTitleOnDark,
  cardSubOnDark,
  btn,
  inputDark,
  tableCard,
  table,
  tdBase,
  thColored,
  chip,
} from "../styles/ui";

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const row3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 };

type ResultsData = {
  assignments: Assignment[];
  runId?: string;
  createdAtISO?: string;
  warnings?: string[];
  source: "run" | "master-table";
};

function taskLabel(t: TaskType) {
  switch (t) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "REVIEW_FREE":
      return "فاضي للمراجعة";
    case "CORRECTION_FREE":
      return "فاضي للتصحيح";
    default:
      return "فارغ";
  }
}

function safeReadMasterTable(): ResultsData | null {
  try {
    const raw = localStorage.getItem(MASTER_TABLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows)
      ? parsed.rows
      : Array.isArray(parsed?.data)
        ? parsed.data
        : [];
    if (!rows.length) return null;
    return {
      assignments: rows,
      runId: parsed?.meta?.runId,
      createdAtISO: parsed?.meta?.runCreatedAtISO || parsed?.meta?.createdAtISO,
      warnings: [],
      source: "master-table",
    };
  } catch {
    return null;
  }
}

function buildResultsData(tenantId: string): ResultsData | null {
  const run = loadRun(tenantId) as DistributionRun | null;
  if (run?.assignments?.length) {
    return {
      assignments: run.assignments,
      runId: run.runId,
      createdAtISO: run.createdAtISO,
      warnings: run.warnings || [],
      source: "run",
    };
  }
  return safeReadMasterTable();
}

export default function TaskDistributionResults() {
  const nav = useNavigate();
  const { user, profile, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || profile?.tenantId || user?.tenantId || "").trim() || "default";

  const [results, setResults] = useState<ResultsData | null>(() => buildResultsData(tenantId));
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [teacherFilter, setTeacherFilter] = useState<string>("");

  useEffect(() => {
    const refresh = () => setResults(buildResultsData(tenantId));
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(RUN_UPDATED_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(RUN_UPDATED_EVENT, refresh as EventListener);
    };
  }, [tenantId]);

  const assignments = useMemo(() => results?.assignments || [], [results]);

  const dates = useMemo(() => {
    const s = new Set<string>();
    assignments.forEach((a) => s.add(String(a.dateISO || "")));
    return ["ALL", ...Array.from(s).filter(Boolean).sort()];
  }, [assignments]);

  const types = useMemo(() => {
    const s = new Set<string>();
    assignments.forEach((a) => s.add(String(a.taskType || "")));
    return ["ALL", ...Array.from(s).filter(Boolean).sort()];
  }, [assignments]);

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (dateFilter !== "ALL" && a.dateISO !== dateFilter) return false;
      if (typeFilter !== "ALL" && a.taskType !== typeFilter) return false;
      if (teacherFilter.trim()) {
        const q = teacherFilter.trim().toLowerCase();
        if (!String(a.teacherName || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [assignments, dateFilter, typeFilter, teacherFilter]);

  if (!results) {
    return (
      <div style={pageDark}>
        <div style={container}>
          <div style={cardDark}>
            <div style={cardHeaderRow}>
              <div>
                <div style={cardTitleOnDark}>النتائج</div>
                <div style={cardSubOnDark}>لا توجد بيانات محفوظة بعد</div>
              </div>
              <button style={btn("soft")} onClick={() => nav("/task-distribution/run")}>
                رجوع
              </button>
            </div>
            <div style={{ marginTop: 12, opacity: 0.85 }}>
              تم فحص بيانات التشغيل المحفوظة والجدول الشامل ولم يتم العثور على بيانات. شغّل الخوارزمية ثم اضغط تحديث.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageDark}>
      <div style={container}>
        <div style={cardDark}>
          <div style={cardHeaderRow}>
            <div>
              <div style={cardTitleOnDark}>الجدول الشامل</div>
              <div style={cardSubOnDark}>
                المصدر: {results.source === "run" ? "آخر تشغيل" : "الجدول المحفوظ"}
                {results.runId ? ` — Run: ${results.runId}` : ""}
                {results.createdAtISO ? ` — ${results.createdAtISO}` : ""}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btn("soft")} onClick={() => nav("/task-distribution/run")}>رجوع للتوزيع</button>
              <button style={btn("soft")} onClick={() => setResults(buildResultsData(tenantId))}>تحديث</button>
              <button style={btn("brand")} onClick={() => nav("/task-distribution/print")}>طباعة التقرير</button>
            </div>
          </div>
        </div>

        <div style={{ ...tableCard, marginTop: 14, padding: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={chip("rgba(212,175,55,.18)", "#fbbf24")}>Assignments: {assignments.length}</span>
            <span style={chip("rgba(2,132,199,.14)", "#7dd3fc")}>Warnings: {results.warnings?.length || 0}</span>
          </div>

          {(results.warnings || []).length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {results.warnings!.map((w, i) => (
                <div key={i} style={chip("rgba(255,255,255,.08)", "rgba(255,255,255,.85)")}>{w}</div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.8 }}>لا يوجد تحذيرات.</div>
          )}
        </div>

        <div style={{ ...tableCard, marginTop: 14, padding: 16 }}>
          <div style={row3}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6, fontWeight: 900 }}>اليوم</div>
              <select style={inputDark} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                {dates.map((d) => (
                  <option key={d} value={d}>{d === "ALL" ? "الكل" : d}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6, fontWeight: 900 }}>نوع المهمة</div>
              <select style={inputDark} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {types.map((t) => (
                  <option key={t} value={t}>{t === "ALL" ? "الكل" : taskLabel(t as TaskType)}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6, fontWeight: 900 }}>بحث بالمعلم</div>
              <input
                style={inputDark}
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                placeholder="اكتب اسم المعلم..."
              />
            </div>
          </div>
        </div>

        <div style={{ ...tableCard, marginTop: 14 }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={thColored("rgba(212,175,55,.14)", "#fbbf24")}>التاريخ</th>
                <th style={thColored("rgba(2,132,199,.12)", "#7dd3fc")}>الفترة</th>
                <th style={thColored("rgba(34,197,94,.12)", "#86efac")}>المعلم</th>
                <th style={thColored("rgba(99,102,241,.12)", "#c7d2fe")}>نوع المهمة</th>
                <th style={thColored("rgba(255,255,255,.08)", "rgba(255,255,255,.9)")}>المادة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr key={String(a.id || `${a.dateISO}-${a.period}-${a.teacherId}-${a.taskType}-${a.subject || ""}-${idx}`)}>
                  <td style={tdBase}>{a.dateISO}</td>
                  <td style={tdBase}>{a.period === "AM" ? "الفترة الأولى" : a.period === "PM" ? "الفترة الثانية" : a.period || "-"}</td>
                  <td style={tdBase}>{a.teacherName}</td>
                  <td style={tdBase}>{taskLabel(a.taskType)}</td>
                  <td style={tdBase}>{a.subject || "-"}</td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td style={tdBase} colSpan={5}>لا توجد نتائج مطابقة للفلاتر الحالية.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
