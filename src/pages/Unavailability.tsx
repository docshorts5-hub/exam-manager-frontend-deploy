import React, { useEffect, useMemo, useState } from "react";
import { newId } from "../api/db";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
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

type PeriodChoice = UnavailabilityPeriod | "FULL_DAY";

type DisplayRule = {
  id: string;
  teacherId: string;
  teacherName: string;
  dateISO: string;
  periodLabel: string;
  blocks: UnavailabilityBlock[];
  reason?: string;
  sourceIds: string[];
  sortPeriod: number;
};

const TEXT = {
  ar: {
    blocks: {
      ALL: "كل المهام",
      INVIGILATION: "مراقبة",
      RESERVE: "احتياط",
      REVIEW_FREE: "مراجعة",
      CORRECTION_FREE: "تصحيح",
    },
    title: "غياب الكادر التعليمي",
    subtitle: "يمنع المحرك من توزيع الكادر التعليمي في نفس التاريخ + الفترة للأنواع المحددة.",
    desc: "منصة تشغيلية فاخرة لضبط عدم التوفر قبل اعتماد التوزيع النهائي بدقة ووضوح.",
    teachersCount: "عدد المعلمين",
    currentRecords: "السجلات الحالية",
    selectedTeacher: "المعلم المحدد",
    addTitle: "إضافة سجل عدم توفر",
    addDesc: "سجّل الغياب أو عدم التوفر مع تحديد الفترة ونوع المنع قبل تشغيل محرك التوزيع ضمن واجهة أوضح وأكثر فخامة.",
    instantSave: "حفظ مباشر وربط فوري",
    teacher: "المعلم",
    date: "التاريخ",
    period: "الفترة",
    periodAM: "الفترة الأولى (AM)",
    periodPM: "الفترة الثانية (PM)",
    fullDay: "كامل اليوم",
    blockedOn: "المنع على:",
    reason: "سبب (اختياري)",
    reasonPlaceholder: "مثال: دورة تدريبية / إجازة",
    add: "إضافة",
    noRecords: "لا توجد سجلات.",
    delete: "حذف",
    deleteConfirm: "حذف هذا السجل؟",
    duplicate: "يوجد سجل عدم توفر لهذا المعلم في نفس التاريخ",
    saveError: "تعذر حفظ عدم التوفر في بيانات الجهة الحالية.",
    deleteError: "تعذر حذف سجل عدم التوفر من بيانات الجهة الحالية.",
    none: "—",
    comma: "، ",
  },
  en: {
    blocks: {
      ALL: "All Tasks",
      INVIGILATION: "Invigilation",
      RESERVE: "Reserve",
      REVIEW_FREE: "Review",
      CORRECTION_FREE: "Correction",
    },
    title: "Teaching Staff Unavailability",
    subtitle: "The engine prevents assigning teaching staff on the same date + period for the selected types.",
    desc: "A premium operational interface to manage unavailability accurately and clearly before finalizing distribution.",
    teachersCount: "Teachers Count",
    currentRecords: "Current Records",
    selectedTeacher: "Selected Teacher",
    addTitle: "Add Unavailability Record",
    addDesc: "Record absence or unavailability by selecting the period and restriction type before running the distribution engine in a clearer premium interface.",
    instantSave: "Instant Save & Sync",
    teacher: "Teacher",
    date: "Date",
    period: "Period",
    periodAM: "First Period (AM)",
    periodPM: "Second Period (PM)",
    fullDay: "Full Day",
    blockedOn: "Blocked On:",
    reason: "Reason (Optional)",
    reasonPlaceholder: "Example: Training course / Leave",
    add: "Add",
    noRecords: "No records found.",
    delete: "Delete",
    deleteConfirm: "Delete this record?",
    duplicate: "An unavailability record already exists for this teacher on the same date",
    saveError: "Failed to save unavailability to the current tenant data.",
    deleteError: "Failed to delete the unavailability record from the current tenant data.",
    none: "—",
    comma: ", ",
  },
} as const;

export default function Unavailability() {
  const { effectiveTenantId, user } = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tenantId = String(effectiveTenantId || "").trim();
  const t = TEXT[lang];

  const BLOCK_LABEL: Record<UnavailabilityBlock, string> = {
    ALL: t.blocks.ALL,
    INVIGILATION: t.blocks.INVIGILATION,
    RESERVE: t.blocks.RESERVE,
    REVIEW_FREE: t.blocks.REVIEW_FREE,
    CORRECTION_FREE: t.blocks.CORRECTION_FREE,
  };

  const [rules, setRules] = useState<UnavailabilityRule[]>(() => loadUnavailability(tenantId));
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [teacherId, setTeacherId] = useState<string>("");
  const [dateISO, setDateISO] = useState<string>(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<PeriodChoice>("AM");
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>(["INVIGILATION", "RESERVE"]);
  const [reason, setReason] = useState<string>("");

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
        .map((row: any) => {
          const id = String(row.id ?? "").trim();
          const name = String(row.fullName || row.name || row.employeeNo || "").trim();
          return { id, name };
        })
        .filter((row: any) => row.id && row.name)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, lang === "ar" ? "ar" : "en"));
      setTeachers(mapped);
    })();
  }, [tenantId, lang]);

  useEffect(() => {
    if (!teacherId && teachers[0]?.id) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);

  const teacherName = useMemo(
    () => teachers.find((teacher) => teacher.id === teacherId)?.name || "",
    [teachers, teacherId]
  );

  const displayRules = useMemo<DisplayRule[]>(() => {
    const normalizeBlocksKey = (arr: UnavailabilityBlock[]) => [...(arr || [])].sort().join("|");
    const grouped = new Map<string, UnavailabilityRule[]>();

    for (const rule of rules) {
      const blocksKey = normalizeBlocksKey((rule.blocks?.length ? rule.blocks : ["ALL"]) as UnavailabilityBlock[]);
      const reasonKey = String(rule.reason || "").trim();
      const key = [rule.teacherId, rule.teacherName, rule.dateISO, blocksKey, reasonKey].join("__");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(rule);
    }

    const out: DisplayRule[] = [];
    for (const group of grouped.values()) {
      const sorted = [...group].sort((a, b) => {
        const pa = a.period === "PM" ? 2 : 1;
        const pb = b.period === "PM" ? 2 : 1;
        return pa - pb || (a.createdAt || 0) - (b.createdAt || 0);
      });

      const first = sorted[0];
      const periods = new Set(sorted.map((x) => x.period));
      const hasAM = periods.has("AM");
      const hasPM = periods.has("PM");

      let periodLabel: string = t.periodAM;
      let sortPeriod = 1;
      if (hasAM && hasPM) {
        periodLabel = t.fullDay;
        sortPeriod = 0;
      } else if (hasPM) {
        periodLabel = t.periodPM;
        sortPeriod = 2;
      }

      out.push({
        id: first.id,
        teacherId: first.teacherId,
        teacherName: first.teacherName,
        dateISO: first.dateISO,
        periodLabel,
        blocks: (first.blocks?.length ? first.blocks : ["ALL"]) as UnavailabilityBlock[],
        reason: first.reason,
        sourceIds: sorted.map((x) => x.id),
        sortPeriod,
      });
    }

    return out.sort((a, b) => {
      const da = String(a.dateISO || "");
      const db = String(b.dateISO || "");
      if (da !== db) return da.localeCompare(db);
      if (a.sortPeriod !== b.sortPeriod) return a.sortPeriod - b.sortPeriod;
      return a.teacherName.localeCompare(b.teacherName, lang === "ar" ? "ar" : "en");
    });
  }, [rules, t, lang]);

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

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes goldGlow {
        0% { box-shadow: 0 0 14px rgba(184,134,11,0.38), 0 14px 28px rgba(0,0,0,0.55); }
        50% { box-shadow: 0 0 30px rgba(255,215,0,0.46), 0 16px 34px rgba(0,0,0,0.62); }
        100% { box-shadow: 0 0 14px rgba(184,134,11,0.38), 0 14px 28px rgba(0,0,0,0.55); }
      }
      @keyframes floatUp {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes shineSweep {
        0% { transform: translateX(-120%) skewX(-12deg); }
        100% { transform: translateX(220%) skewX(-12deg); }
      }
      .header3d {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        animation: goldGlow 4s infinite;
      }
      .shineOverlay {
        position: absolute;
        top: 0;
        left: -120%;
        width: 55%;
        height: 100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
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
        padding: 8px 14px;
        display: inline-flex;
        gap: 8px;
        align-items: center;
        background: rgba(0,0,0,0.18);
        transition: transform .16s ease, border-color .16s ease, background .16s ease;
      }
      .chip:hover {
        transform: translateY(-1px);
        border-color: rgba(212,175,55,0.34);
        background: rgba(212,175,55,0.08);
      }
      .statCard {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 22px;
        padding: 15px 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
        box-shadow: 0 16px 32px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .card {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02));
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }
      .card:hover {
        transform: translateY(-3px);
        box-shadow: 0 18px 34px rgba(0,0,0,0.24);
        border-color: rgba(212,175,55,0.24);
      }
      .softBorder {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.015));
        box-shadow: 0 18px 40px rgba(0,0,0,0.18);
      }
      .luxFade { animation: floatUp .5s ease; }
      @media (max-width: 980px) {
        .unavail-form-grid { grid-template-columns: 1fr !important; }
        .unavail-row-grid { grid-template-columns: 1fr !important; }
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

  function toggleBlock(block: UnavailabilityBlock) {
    setBlocks((prev) => {
      const set = new Set(prev);
      if (block === "ALL") {
        return set.has("ALL") ? ([] as UnavailabilityBlock[]) : (["ALL"] as UnavailabilityBlock[]);
      }
      set.delete("ALL");
      if (set.has(block)) set.delete(block);
      else set.add(block);
      const out = Array.from(set);
      return out.length ? (out as UnavailabilityBlock[]) : (["INVIGILATION", "RESERVE"] as UnavailabilityBlock[]);
    });
  }

  async function onAdd() {
    const tid = String(teacherId || "").trim();
    const tname = String(teacherName || "").trim();
    const d = String(dateISO || "").trim();
    if (!tid || !tname || !d) return;

    const targetPeriods: UnavailabilityPeriod[] =
      period === "FULL_DAY" ? (["AM", "PM"] as UnavailabilityPeriod[]) : ([period] as UnavailabilityPeriod[]);

    const duplicatePeriods = targetPeriods.filter((p) =>
      rules.some((r) => r.teacherId === tid && r.dateISO === d && r.period === p)
    );

    if (duplicatePeriods.length) {
      const duplicateLabel =
        duplicatePeriods.length === 2 ? t.fullDay : duplicatePeriods[0] === "PM" ? t.periodPM : t.periodAM;
      alert(`${t.duplicate} (${duplicateLabel}).`);
      return;
    }

    const createdAt = Date.now();
    const createdRules: UnavailabilityRule[] = targetPeriods.map((p, index) => ({
      id: newId(),
      teacherId: tid,
      teacherName: tname,
      dateISO: d,
      period: p,
      blocks: blocks.length ? blocks : ["INVIGILATION", "RESERVE"],
      reason: reason.trim() || undefined,
      createdAt: createdAt + index,
    }));

    const nextRules = [...createdRules, ...rules];
    saveUnavailability(nextRules, tenantId);
    setRules(nextRules);

    try {
      await persistUnavailabilityToTenant({
        tenantId,
        rules: nextRules,
        by: String(user?.uid || "").trim() || undefined,
      });
      setReason("");
      setPeriod("AM");
    } catch {
      await refreshRulesFromTenant(tenantId);
      alert(t.saveError);
    }
  }

  return (
    <div
      style={{
        padding: 20,
        direction: isRTL ? "rtl" : "ltr",
        background:
          "radial-gradient(circle at 12% 8%, rgba(212,175,55,0.16), transparent 20%), radial-gradient(circle at 88% 14%, rgba(59,130,246,0.10), transparent 22%), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.04), transparent 24%), linear-gradient(180deg, #070707 0%, #0d0d0d 52%, #111111 100%)",
        minHeight: "100vh",
        color: "#d4af37",
        fontFamily: "Cairo, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div
        className="header3d luxFade"
        style={{
          background: "linear-gradient(135deg, rgba(112,81,8,0.98), rgba(52,37,4,0.98), rgba(12,14,18,0.98))",
          border: "1px solid rgba(255, 215, 128, 0.22)",
          padding: "28px 28px",
          marginBottom: 20,
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 16px rgba(0,0,0,0.30), 0 0 30px rgba(212,175,55,0.10)",
        }}
      >
        <div className="shineOverlay" />
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2, color: "#fff1c4", textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>
              {t.title}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#ffffff", textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>
              {t.subtitle}
            </div>
            <div style={{ marginTop: 2, fontSize: 13, color: "#ffecbd", opacity: 0.96, textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>
              {t.desc}
            </div>
          </div>
        </div>
      </div>

      <div className="luxFade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: t.teachersCount, value: teachers.length || 0 },
          { label: t.currentRecords, value: rules.length || 0 },
          { label: t.selectedTeacher, value: teacherName || t.none },
        ].map((item) => (
          <div key={item.label} className="statCard">
            <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800 }}>{item.label}</div>
            <div style={{ marginTop: 8, fontSize: 18, color: "#fff8dc", fontWeight: 900 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="softBorder luxFade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 18, marginBottom: 20, boxShadow: "0 18px 38px rgba(0,0,0,0.20)" }}>
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff1c4", letterSpacing: "-0.02em" }}>{t.addTitle}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,241,196,0.70)", lineHeight: 1.8 }}>{t.addDesc}</div>
          </div>
          <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff1c4", fontWeight: 800, fontSize: 12 }}>
            {t.instantSave}
          </div>
        </div>

        <div className="unavail-form-grid" style={{ display: "contents" }} />

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.teacher}</span>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={dropdownStyle}>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id} style={dropdownOptionStyle}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.date}</span>
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} style={fieldStyle} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.period}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodChoice)} style={dropdownStyle}>
            <option value="AM" style={dropdownOptionStyle}>{t.periodAM}</option>
            <option value="PM" style={dropdownOptionStyle}>{t.periodPM}</option>
            <option value="FULL_DAY" style={dropdownOptionStyle}>{t.fullDay}</option>
          </select>
        </label>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ marginBottom: 8, fontWeight: 800 }}>{t.blockedOn}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {(Object.keys(BLOCK_LABEL) as UnavailabilityBlock[]).map((block) => {
              const checked = blocks.includes("ALL") ? block === "ALL" : blocks.includes(block);
              return (
                <label key={block} className="chip">
                  <input type="checkbox" checked={checked} onChange={() => toggleBlock(block)} />
                  <span>{BLOCK_LABEL[block]}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
          <span>{t.reason}</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} style={fieldStyle} />
        </label>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: isRTL ? "flex-end" : "flex-start" }}>
          <button onClick={onAdd} className="goldBtn">{t.add}</button>
        </div>
      </div>

      <h2 className="luxFade" style={{ margin: "4px 0 14px", color: "#fff1c4", fontSize: 28, fontWeight: 900, textShadow: "0 4px 18px rgba(212,175,55,0.16)", letterSpacing: "-0.02em" }}>
        {t.currentRecords}
      </h2>

      {rules.length === 0 ? (
        <div className="luxFade" style={{ opacity: 0.9, border: "1px dashed rgba(212,175,55,0.26)", borderRadius: 18, padding: 24, background: "rgba(255,255,255,0.02)" }}>
          {t.noRecords}
        </div>
      ) : (
        <div className="luxFade" style={{ display: "grid", gap: 12 }}>
          {displayRules.map((rule) => (
            <div key={rule.id} className="card unavail-row-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.7fr 1fr auto", gap: 14, alignItems: "center", padding: 16, boxShadow: "0 14px 28px rgba(0,0,0,0.18)" }}>
              <div style={{ fontWeight: 900 }}>{rule.teacherName}</div>
              <div>{rule.dateISO}</div>
              <div>{rule.periodLabel}</div>
              <div style={{ opacity: 0.95 }}>
                {(rule.blocks?.length ? rule.blocks : ["ALL"]).map((block) => BLOCK_LABEL[block as UnavailabilityBlock] || String(block)).join(t.comma)}
                {rule.reason ? <span style={{ opacity: 0.75 }}>{` — ${rule.reason}`}</span> : null}
              </div>
              <button
                onClick={async () => {
                  if (!confirm(t.deleteConfirm)) return;
                  const idsToDelete = new Set(rule.sourceIds);
                  const nextRules = rules.filter((x) => !idsToDelete.has(x.id));
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
                    alert(t.deleteError);
                  }
                }}
                className="goldBtn"
                style={{ padding: "8px 10px", background: "linear-gradient(135deg,#5c0b0b,#b8860b)" }}
              >
                {t.delete}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
