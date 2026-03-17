import React, { useEffect, useMemo, useState } from "react"; 
import { newId } from "../api/db";
import { useAuth } from "../auth/AuthContext";
import { loadTenantArray } from "../services/tenantData";

import {
  loadUnavailability,
  persistUnavailabilityToTenant,
  saveUnavailability,
  syncUnavailabilityFromTenant,
  type UnavailabilityBlock,
  type UnavailabilityPeriod,
  type UnavailabilityRule,
  UNAVAIL_UPDATED_EVENT,
} from "../utils/taskDistributionUnavailability";

const TEACHERS_SUB = "teachers";

const BLOCK_LABEL: Record<UnavailabilityBlock, string> = {
  ALL: "كل المهام",
  INVIGILATION: "مراقبة",
  RESERVE: "احتياط",
  REVIEW_FREE: "مراجعة",
  CORRECTION_FREE: "تصحيح",
};

export default function Unavailability() {
  const { effectiveTenantId, user } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const [rules, setRules] = useState<UnavailabilityRule[]>(() => loadUnavailability(tenantId));
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);

  async function refreshRulesFromTenant(targetTenantId = tenantId) {
    const rows = await syncUnavailabilityFromTenant(targetTenantId).catch(() => loadUnavailability(targetTenantId));
    setRules(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    (async () => {
      if (!tenantId) {
        setTeachers([]);
        return;
      }
      const arr = await loadTenantArray<any>(tenantId, TEACHERS_SUB).catch(() => []);
      const mapped = arr
        .map((t: any) => {
          const id = String(t.id ?? "").trim();
          const name = String(t.fullName || t.name || t.employeeNo || "").trim();
          return { id, name };
        })
        .filter((t: any) => t.id && t.name)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "ar"));
      setTeachers(mapped);
    })();
  }, [tenantId]);

  const [teacherId, setTeacherId] = useState<string>("");

  useEffect(() => {
    if (!teacherId && teachers[0]?.id) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);
  const teacherName = useMemo(
    () => teachers.find((t) => t.id === teacherId)?.name || "",
    [teachers, teacherId]
  );

  const [dateISO, setDateISO] = useState<string>(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<UnavailabilityPeriod>("AM");
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>(["INVIGILATION", "RESERVE"]);
  const [reason, setReason] = useState<string>("");

  // ✅ Gold input styles
  const fieldStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(212,175,55,0.40)",
    background: "rgba(0,0,0,0.42)",
    color: "#d4af37",
    outline: "none",
  };

  const dropdownStyle: React.CSSProperties = {
    ...fieldStyle,
    background: "#000000",
    color: "#FFD700",
    border: "1px solid rgba(255,215,0,0.62)",
    boxShadow: "0 0 0 1px rgba(255,215,0,0.08) inset",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  };

  const dropdownOptionStyle: React.CSSProperties = {
    background: "#000000",
    color: "#FFD700",
  };

  // ✅ Inject header animations once
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes goldGlow {
        0% { box-shadow: 0 0 14px rgba(184,134,11,0.55), 0 14px 28px rgba(0,0,0,0.55); }
        50% { box-shadow: 0 0 32px rgba(255,215,0,0.65), 0 16px 34px rgba(0,0,0,0.62); }
        100% { box-shadow: 0 0 14px rgba(184,134,11,0.55), 0 14px 28px rgba(0,0,0,0.55); }
      }

      @keyframes shineSweep {
        0% { transform: translateX(-120%) skewX(-12deg); }
        100% { transform: translateX(220%) skewX(-12deg); }
      }

      .header3d {
        position: relative;
        overflow: hidden;
        border-radius: 16px;
        animation: goldGlow 4s infinite;
      }

      .shineOverlay {
        position: absolute;
        top: 0;
        left: -120%;
        width: 55%;
        height: 100%;
        background: linear-gradient(
          120deg,
          transparent 0%,
          rgba(255,255,255,0.35) 50%,
          transparent 100%
        );
        animation: shineSweep 5.5s infinite;
        pointer-events: none;
        opacity: 0.9;
      }

      .goldBtn {
        background: linear-gradient(135deg,#6b5200,#b8860b);
        border: 1px solid rgba(255,255,255,0.14);
        color: #fff;
        cursor: pointer;
        border-radius: 10px;
        padding: 10px 14px;
        transition: transform .12s ease, filter .12s ease;
      }
      .goldBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .goldBtn:active { transform: translateY(0px); filter: brightness(0.98); }

      .chip {
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 999px;
        padding: 6px 10px;
        display: inline-flex;
        gap: 6px;
        align-items: center;
        background: rgba(0,0,0,0.18);
      }

      .card {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        background: rgba(0,0,0,0.18);
      }

      .softBorder {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        background: rgba(0,0,0,0.14);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    void refreshRulesFromTenant(tenantId);
    const on = (event?: any) => {
      const eventTenantId = String(event?.detail?.tenantId ?? "").trim();
      if (eventTenantId && eventTenantId !== tenantId) return;
      setRules(loadUnavailability(tenantId));
    };
    window.addEventListener(UNAVAIL_UPDATED_EVENT, on as any);
    return () => window.removeEventListener(UNAVAIL_UPDATED_EVENT, on as any);
  }, [tenantId]);

  useEffect(() => {
    if (!teacherId && teachers[0]?.id) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);

  function toggleBlock(b: UnavailabilityBlock) {
    setBlocks((prev) => {
      const s = new Set(prev);
      if (b === "ALL") {
        return s.has("ALL") ? ([] as UnavailabilityBlock[]) : (["ALL"] as UnavailabilityBlock[]);
      }
      s.delete("ALL");
      if (s.has(b)) s.delete(b);
      else s.add(b);
      const out = Array.from(s);
      return out.length ? (out as UnavailabilityBlock[]) : (["INVIGILATION", "RESERVE"] as UnavailabilityBlock[]);
    });
  }

  async function onAdd() {
    const tid = String(teacherId || "").trim();
    const tname = String(teacherName || "").trim();
    const d = String(dateISO || "").trim();
    if (!tid || !tname || !d) return;

    const exists = rules.some((r) => r.teacherId === tid && r.dateISO === d && r.period === period);
    if (exists) {
      alert("يوجد سجل عدم توفر لهذا المعلم في نفس التاريخ والفترة.");
      return;
    }

    const rule: UnavailabilityRule = {
      id: newId(),
      teacherId: tid,
      teacherName: tname,
      dateISO: d,
      period,
      blocks: blocks.length ? blocks : ["INVIGILATION", "RESERVE"],
      reason: reason.trim() || undefined,
      createdAt: Date.now(),
    };

    const nextRules = [rule, ...rules];
    saveUnavailability(nextRules, tenantId);
    setRules(nextRules);

    try {
      await persistUnavailabilityToTenant({
        tenantId,
        rules: nextRules,
        by: String(user?.uid || "").trim() || undefined,
      });
    } catch {
      await refreshRulesFromTenant(tenantId);
      alert("تعذر حفظ عدم التوفر في بيانات الجهة الحالية.");
    }
  }

  return (
    <div
      style={{
        padding: 20,
        direction: "rtl",
        background: "#0f0f0f",
        minHeight: "100vh",
        color: "#d4af37", // ✅ gold text across the page
        fontFamily: "Cairo, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      {/* ✅ 3D branded header without logo */}
      <div
        className="header3d"
        style={{
          background: "linear-gradient(180deg, #6e5200 0%, #7a5c00 35%, #4a3600 100%)",
          border: "1px solid rgba(255, 215, 128, 0.35)",
          borderBottom: "3px solid rgba(0,0,0,0.35)",
          padding: "18px 18px",
          marginBottom: 16,
          boxShadow:
            "0 10px 18px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -6px 10px rgba(0,0,0,0.35)",
        }}
      >
        <div className="shineOverlay" />
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 0.2,
                color: "#fff1c4",
                textShadow: "0 2px 0 rgba(0,0,0,0.35)",
              }}
            >
             غياب الكادر التعليمي 
            </div>

            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#ffffff",
                textShadow: "0 2px 0 rgba(0,0,0,0.35)",
              }}
            >
              يمنع المحرك من توزيع الكادر التعليمي في نفس <b>التاريخ + الفترة</b> للأنواع المحددة.
            </div>

            <div
              style={{
                marginTop: 2,
                fontSize: 13,
                color: "#ffecbd",
                opacity: 0.96,
                textShadow: "0 2px 0 rgba(0,0,0,0.35)",
              }}
            >
              .
            </div>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div
        className="softBorder"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>المعلم</span>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={dropdownStyle}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id} style={dropdownOptionStyle}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>التاريخ</span>
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} style={fieldStyle} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>الفترة</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as any)} style={dropdownStyle}>
            <option value="AM" style={dropdownOptionStyle}>الفترة الأولى (AM)</option>
            <option value="PM" style={dropdownOptionStyle}>الفترة الثانية (PM)</option>
          </select>
        </label>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ marginBottom: 8, fontWeight: 800 }}>المنع على:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {(Object.keys(BLOCK_LABEL) as UnavailabilityBlock[]).map((b) => {
              const checked = blocks.includes("ALL") ? b === "ALL" : blocks.includes(b);
              return (
                <label key={b} className="chip">
                  <input type="checkbox" checked={checked} onChange={() => toggleBlock(b)} />
                  <span>{BLOCK_LABEL[b]}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
          <span>سبب (اختياري)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: دورة تدريبية / إجازة"
            style={fieldStyle}
          />
        </label>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onAdd} className="goldBtn">
            إضافة
          </button>
        </div>
      </div>

      {/* Current rules */}
      <h2 style={{ margin: "0 0 10px", color: "#d4af37" }}>السجلات الحالية</h2>

      {rules.length === 0 ? (
        <div style={{ opacity: 0.85 }}>لا توجد سجلات.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rules
            .slice()
            .sort((a, b) => (a.dateISO + a.period).localeCompare(b.dateISO + b.period))
            .map((r) => (
              <div
                key={r.id}
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.7fr 0.7fr 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900 }}>{r.teacherName}</div>
                <div>{r.dateISO}</div>
                <div>{r.period === "PM" ? "PM" : "AM"}</div>

                <div style={{ opacity: 0.95 }}>
                  {(r.blocks?.length ? r.blocks : ["ALL"])
                    .map((b) => BLOCK_LABEL[b as UnavailabilityBlock] || String(b))
                    .join("، ")}
                  {r.reason ? <span style={{ opacity: 0.75 }}> — {r.reason}</span> : null}
                </div>

                <button
                  onClick={async () => {
                    if (!confirm("حذف هذا السجل؟")) return;
                    const nextRules = rules.filter((x) => x.id !== r.id);
                    saveUnavailability(nextRules, tenantId);
                    setRules(nextRules);
                    try {
                      await persistUnavailabilityToTenant({
                        tenantId,
                        rules: nextRules,
                        by: String(user?.uid || "").trim() || undefined,
                      });
                    } catch {
                      await refreshRulesFromTenant(tenantId);
                      alert("تعذر حذف سجل عدم التوفر من بيانات الجهة الحالية.");
                    }
                  }}
                  className="goldBtn"
                  style={{
                    padding: "8px 10px",
                    background: "linear-gradient(135deg,#5c0b0b,#b8860b)", // subtle danger/gold blend
                  }}
                >
                  حذف
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}