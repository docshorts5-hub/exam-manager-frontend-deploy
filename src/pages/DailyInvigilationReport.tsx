// src/pages/DailyInvigilationReport.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
type Assignment = {
  teacherName: string;
  date: string;
  day?: string;
  time?: string;
  period?: string;
  subject?: string;
  type?: string;
  roomIndex?: number;
};

type Run = { assignments?: Assignment[] };

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const LEGACY_KEY = "exam-manager:distribution:v1";

export default function DailyInvigilationReport() {
  const nav = useNavigate();
  const { tenantId, user } = useSession();
  const [date, setDate] = useState("");

  const run = useMemo<Run | null>(() => safeParse<Run | null>(localStorage.getItem(LEGACY_KEY), null), []);
  const all = useMemo(() => (run?.assignments ?? []).filter(Boolean), [run]);

  const dates = useMemo(() => Array.from(new Set(all.map((a) => a.date))).sort(), [all]);

  const chosenDate = date || dates[0] || "";
  const rows = useMemo(() => {
    if (!chosenDate) return [];
    return all
      .filter((a) => a.date === chosenDate && (a.type === "مراقبة" || a.type === "احتياط"))
      .sort((x, y) => {
        const rx = (x.roomIndex ?? 999) - (y.roomIndex ?? 999);
        if (rx !== 0) return rx;
        return String(x.teacherName ?? "").localeCompare(String(y.teacherName ?? ""), "ar");
      });
  }, [all, chosenDate]);

  const print = async () => {
    try {
      if (tenantId) {
      }
    } catch {
      // ignore audit failure
    }
    window.print();
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", padding: 18, background: "#0b1220", color: "#111" }}>
      <div style={topCard}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 22, color: "#111827" }}>تقرير المراقبة اليومية</div>
          <div style={{ opacity: 0.8, fontWeight: 900, marginTop: 6 }}>اختر التاريخ ثم اطبع التقرير</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btnSoft} onClick={() => nav("/reports/full")}>الجدول الشامل</button>
          <button style={btnSoft} onClick={() => nav("/distribution")}>رجوع</button>
          <button style={btnGold} onClick={print}>طباعة</button>
        </div>
      </div>

      <div style={filterCard}>
        <label style={{ fontWeight: 900, color: "#111827" }}>التاريخ</label>
        <select value={chosenDate} onChange={(e) => setDate(e.target.value)} style={select}>
          {dates.length === 0 ? <option value="">— لا يوجد —</option> : null}
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#111827" }}>
          عدد المراقبين/الاحتياط: {rows.length}
        </div>
      </div>

      <div style={paper}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 900 }}>سلطنة عمان</div>
          <div style={{ fontWeight: 900 }}>وزارة التربية والتعليم</div>
          <div style={{ fontWeight: 900 }}>كشف مراقبة امتحان</div>
          <div style={{ marginTop: 10, fontWeight: 900 }}>التاريخ: {chosenDate || "—"}</div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["م", "اسم المراقب", "رقم اللجنة", "النوع", "المادة", "الوقت", "الفترة", "التوقيع", "ملاحظات"].map((h) => (
                <th key={h} style={pth}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 14, textAlign: "center" }}>لا توجد بيانات لهذا التاريخ.</td></tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx}>
                  <td style={ptdCenter}>{idx + 1}</td>
                  <td style={ptd}>{r.teacherName}</td>
                  <td style={ptdCenter}>{r.roomIndex != null ? (r.roomIndex + 1) : ""}</td>
                  <td style={ptdCenter}>{r.type ?? ""}</td>
                  <td style={ptd}>{r.subject ?? ""}</td>
                  <td style={ptdCenter}>{r.time ?? ""}</td>
                  <td style={ptdCenter}>{r.period ?? ""}</td>
                  <td style={ptdCenter}></td>
                  <td style={ptdCenter}></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @media print{
          body{background:#fff!important}
          button,select{display:none!important}
          #root{padding:0!important}
        }
      `}</style>
    </div>
  );
}

const topCard: React.CSSProperties = {
  background: "linear-gradient(135deg,#f1d27a,#d4af37,#b8962e)",
  borderRadius: 18,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const filterCard: React.CSSProperties = {
  marginTop: 14,
  background: "#ffffff",
  borderRadius: 16,
  padding: 12,
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const paper: React.CSSProperties = {
  marginTop: 14,
  background: "#ffffff",
  borderRadius: 12,
  padding: 16,
};

const btnSoft: React.CSSProperties = {
  background: "#1f2937",
  color: "#d4af37",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 14,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGold: React.CSSProperties = {
  background: "#f59e0b",
  color: "#111827",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 14,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const select: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  fontWeight: 900,
  minWidth: 220,
};

const pth: React.CSSProperties = {
  border: "1px solid #111",
  padding: 8,
  background: "#f3f4f6",
  fontWeight: 900,
  fontSize: 12,
  textAlign: "center",
};

const ptd: React.CSSProperties = {
  border: "1px solid #111",
  padding: 8,
  fontSize: 12,
  textAlign: "right",
};

const ptdCenter: React.CSSProperties = { ...ptd, textAlign: "center" };
