import React, { useEffect, useMemo, useState } from "react";
import { newId } from "../api/db";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadTenantArray, loadTenantSettings, subscribeTenantArray } from "../services/tenantData";

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
const EXAMS_SUB = "exams";
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";

const UNAVAIL12_EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const UNAVAIL12_EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const UNAVAIL12_CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const UNAVAIL12_DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type Unavail12ExamCenterData = {
  name?: string;
  examCenterCode?: string;
  centerCode?: string;
  governorate?: string;
  semester?: string;
  phone?: string;
  address?: string;
  controlHeadName?: string;
  academicYear?: string;
  logo?: string;
};

function unavail12Clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unavail12TenantIdFromAuth(auth: any) {
  return (
    String(
      auth?.effectiveTenantId ||
        auth?.profile?.tenantId ||
        auth?.userProfile?.tenantId ||
        auth?.user?.tenantId ||
        "default"
    ).trim() || "default"
  );
}

function unavail12SafeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function unavail12AcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear} / ${startYear + 1}`;
}

function unavail12ReadExamCenterData(): Unavail12ExamCenterData {
  const saved = unavail12SafeJson<Unavail12ExamCenterData>(
    localStorage.getItem(UNAVAIL12_EXAM_CENTER_DATA_KEY),
    {}
  );

  return {
    ...saved,
    examCenterCode: unavail12Clean(saved.examCenterCode || saved.centerCode || ""),
    controlHeadName: unavail12Clean(
      saved.controlHeadName || localStorage.getItem(UNAVAIL12_CONTROL_HEAD_NAME_KEY) || ""
    ),
  };
}

function unavail12ReadOfficialLogo() {
  return unavail12Clean(localStorage.getItem(UNAVAIL12_EXAM_CENTER_LOGO_KEY)) || UNAVAIL12_DEFAULT_LOGO_URL;
}

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

type ExamDateOption = {
  id: string;
  subject: string;
  dateISO: string;
  period: string;
  label: string;
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
  const auth = useAuth() as any;
  const { user } = auth;
  const { lang, isRTL } = useI18n();
  const tenantId = unavail12TenantIdFromAuth(auth);
  const currentUserId = String(user?.email || user?.uid || "").trim();
  const t = TEXT[lang];

  const [officialCenterData, setOfficialCenterData] = useState<Unavail12ExamCenterData>(() =>
    unavail12ReadExamCenterData()
  );
  const [officialLogo, setOfficialLogo] = useState<string>(() => unavail12ReadOfficialLogo());

  const BLOCK_LABEL: Record<UnavailabilityBlock, string> = {
    ALL: t.blocks.ALL,
    INVIGILATION: t.blocks.INVIGILATION,
    RESERVE: t.blocks.RESERVE,
    REVIEW_FREE: t.blocks.REVIEW_FREE,
    CORRECTION_FREE: t.blocks.CORRECTION_FREE,
  };

  const [rules, setRules] = useState<UnavailabilityRule[]>(() => loadUnavailability(tenantId));
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [examDates, setExamDates] = useState<ExamDateOption[]>([]);
  const [syncMessage, setSyncMessage] = useState("");
  const [cloudLoading, setCloudLoading] = useState(false);
  const [teacherId, setTeacherId] = useState<string>("");
  const [dateISO, setDateISO] = useState<string>(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<PeriodChoice>("AM");
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>(["INVIGILATION", "RESERVE"]);
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    const refreshOfficialHeader = () => {
      setOfficialCenterData(unavail12ReadExamCenterData());
      setOfficialLogo(unavail12ReadOfficialLogo());
    };

    async function refreshOfficialHeaderFromCloud() {
      try {
        const cloud = await loadTenantSettings<Unavail12ExamCenterData>(
          tenantId,
          DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
          {}
        );

        const hasCloudData = Boolean(
          cloud?.name ||
            cloud?.examCenterCode ||
            cloud?.centerCode ||
            cloud?.governorate ||
            cloud?.semester ||
            cloud?.phone ||
            cloud?.address ||
            cloud?.controlHeadName ||
            cloud?.academicYear ||
            cloud?.logo
        );

        if (!hasCloudData) return;

        const nextData: Unavail12ExamCenterData = {
          ...cloud,
          examCenterCode: unavail12Clean(cloud.examCenterCode || cloud.centerCode || ""),
          centerCode: unavail12Clean(cloud.examCenterCode || cloud.centerCode || ""),
          controlHeadName: unavail12Clean(cloud.controlHeadName || ""),
        };

        const nextLogo = unavail12Clean(cloud.logo || unavail12ReadOfficialLogo()) || UNAVAIL12_DEFAULT_LOGO_URL;

        setOfficialCenterData(nextData);
        setOfficialLogo(nextLogo);

        localStorage.setItem(UNAVAIL12_EXAM_CENTER_DATA_KEY, JSON.stringify(nextData));
        localStorage.setItem(UNAVAIL12_EXAM_CENTER_LOGO_KEY, nextLogo);
        localStorage.setItem(UNAVAIL12_CONTROL_HEAD_NAME_KEY, nextData.controlHeadName || "");
      } catch {
        refreshOfficialHeader();
      }
    }

    refreshOfficialHeader();
    void refreshOfficialHeaderFromCloud();

    window.addEventListener("storage", refreshOfficialHeader);
    window.addEventListener("exam-manager:changed", refreshOfficialHeader);
    window.addEventListener("exam-manager:control-head-changed", refreshOfficialHeader);

    return () => {
      window.removeEventListener("storage", refreshOfficialHeader);
      window.removeEventListener("exam-manager:changed", refreshOfficialHeader);
      window.removeEventListener("exam-manager:control-head-changed", refreshOfficialHeader);
    };
  }, [tenantId]);

  const officialAcademicYear =
    officialCenterData.academicYear || unavail12AcademicYearFromSystemDate(new Date());
  const officialGovernorate =
    officialCenterData.governorate || (lang === "ar" ? "المديرية العامة للتعليم" : "Directorate General of Education");
  const officialCenterName =
    officialCenterData.name || (lang === "ar" ? "مركز الامتحانات" : "Exam Center");
  const officialCenterCode =
    officialCenterData.examCenterCode || officialCenterData.centerCode || "—";
  const officialSemester =
    officialCenterData.semester || (lang === "ar" ? "الفصل الدراسي" : "Semester");
  const officialCenterHead =
    officialCenterData.controlHeadName || (lang === "ar" ? "رئيس المركز" : "Center Head");

  async function refreshRulesFromTenant(targetTenantId = tenantId) {
    setCloudLoading(true);
    setSyncMessage(lang === "ar" ? "جاري تحميل سجلات عدم التوفر من السحابة..." : "Loading unavailability records from cloud...");
    const rows = await syncUnavailabilityFromTenant(targetTenantId).catch(() => loadUnavailability(targetTenantId));
    setRules(Array.isArray(rows) ? rows : []);
    setSyncMessage(lang === "ar" ? "تم تحميل سجلات عدم التوفر من السحابة." : "Unavailability records loaded from cloud.");
    setCloudLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    let unsubscribeTeachers: (() => void) | undefined;
    let unsubscribeExams: (() => void) | undefined;

    const mapTeachers = (arr: any[]) =>
      arr
        .map((row: any) => {
          const id = String(row.id ?? "").trim();
          const name = String(row.fullName || row.name || row.employeeNo || "").trim();
          return { id, name };
        })
        .filter((row: any) => row.id && row.name)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, lang === "ar" ? "ar" : "en"));

    const mapExamDates = (arr: any[]) =>
      arr
        .map((row: any) => {
          const id = String(row.id ?? "").trim();
          const subject = String(row.subject || "").trim();
          const dateISO = String(row.dateISO || "").trim();
          const period = String(row.period || "").trim();
          const label = [dateISO, period, subject].filter(Boolean).join(" — ");
          return { id, subject, dateISO, period, label };
        })
        .filter((row) => row.id && row.dateISO)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.period.localeCompare(b.period));

    async function loadCloudLookups() {
      if (!tenantId) {
        setTeachers([]);
        setExamDates([]);
        return;
      }

      setCloudLoading(true);
      setSyncMessage(lang === "ar" ? "جاري تحميل المعلمين وجدول الامتحانات من السحابة..." : "Loading teachers and exams from cloud...");

      try {
        const [teacherRows, examRows] = await Promise.all([
          loadTenantArray<any>(tenantId, TEACHERS_SUB).catch(() => []),
          loadTenantArray<any>(tenantId, EXAMS_SUB).catch(() => []),
        ]);

        if (!mounted) return;

        setTeachers(mapTeachers(teacherRows));
        setExamDates(mapExamDates(examRows));
        setSyncMessage(lang === "ar" ? "تم تحميل البيانات المساندة من السحابة." : "Lookup data loaded from cloud.");

        unsubscribeTeachers = subscribeTenantArray<any>(
          tenantId,
          TEACHERS_SUB,
          (items) => setTeachers(mapTeachers(items))
        );

        unsubscribeExams = subscribeTenantArray<any>(
          tenantId,
          EXAMS_SUB,
          (items) => setExamDates(mapExamDates(items))
        );
      } catch {
        if (!mounted) return;
        setSyncMessage(lang === "ar" ? "تعذر تحميل البيانات المساندة من السحابة." : "Could not load lookup data from cloud.");
      } finally {
        if (mounted) setCloudLoading(false);
      }
    }

    void loadCloudLookups();

    return () => {
      mounted = false;
      unsubscribeTeachers?.();
      unsubscribeExams?.();
    };
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
    padding: 12,
    borderRadius: 16,
    border: "3px solid #d4af37",
    background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    outline: "none",
    fontWeight: 1000,
  };

  const dropdownStyle: React.CSSProperties = {
    ...fieldStyle,
    appearance: "auto",
  };

  const dropdownOptionStyle: React.CSSProperties = {
    background: "#fffaf0",
    color: "#000000",
    fontWeight: 1000,
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes floatUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .unavailability12OfficialRoot,
      .unavailability12OfficialRoot * {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        text-shadow: none !important;
        font-weight: 900 !important;
        font-family: Tahoma, Arial, sans-serif !important;
      }

      .unavailability12OfficialRoot input,
      .unavailability12OfficialRoot select,
      .unavailability12OfficialRoot textarea,
      .unavailability12OfficialRoot option {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        background: #fffaf0 !important;
        font-weight: 1000 !important;
      }

      .goldBtn {
        background: linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%) !important;
        border: 3px solid #111827 !important;
        color: #000000 !important;
        cursor: pointer;
        border-radius: 16px;
        padding: 11px 16px;
        transition: transform .12s ease, filter .12s ease;
        box-shadow: 0 10px 22px rgba(126,98,18,0.13);
      }

      .goldBtn:hover { transform: translateY(-1px); filter: brightness(1.03); }
      .goldBtn:active { transform: translateY(0px); filter: brightness(0.98); }

      .chip {
        border: 3px solid #d4af37 !important;
        border-radius: 999px;
        padding: 9px 15px;
        display: inline-flex;
        gap: 8px;
        align-items: center;
        background: #fffaf0 !important;
        transition: transform .16s ease, border-color .16s ease, background .16s ease;
        box-shadow: 0 8px 18px rgba(150,120,20,0.10);
      }

      .chip:hover {
        transform: translateY(-1px);
        background: #f3e8c5 !important;
      }

      .statCard {
        border: 4px solid #d4af37 !important;
        border-radius: 24px;
        padding: 16px 18px;
        background: linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%) !important;
        box-shadow: 0 0 0 5px rgba(212,175,55,0.12) inset, 0 14px 28px rgba(126,98,18,0.10);
      }

      .card,
      .softBorder {
        border: 4px solid #d4af37 !important;
        border-radius: 28px;
        background: linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%) !important;
        box-shadow: 0 0 0 5px rgba(212,175,55,0.12) inset, 0 14px 28px rgba(126,98,18,0.10);
      }

      .card:hover {
        transform: translateY(-2px);
      }

      .luxFade { animation: floatUp .35s ease; }

      @media (max-width: 980px) {
        .unavail-form-grid { grid-template-columns: 1fr !important; }
        .unavail-row-grid { grid-template-columns: 1fr !important; }
        .unavailOfficialHeaderGrid { grid-template-columns: 1fr !important; text-align: center !important; }
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
        by: currentUserId || undefined,
      });
      setReason("");
      setPeriod("AM");
      setSyncMessage(lang === "ar" ? "تم حفظ سجل عدم التوفر في السحابة." : "Unavailability record saved to cloud.");
    } catch {
      await refreshRulesFromTenant(tenantId);
      alert(t.saveError);
    }
  }

  return (
    <div
      className="unavailability12OfficialRoot"
      style={{
        padding: 20,
        direction: isRTL ? "rtl" : "ltr",
        background:
          "radial-gradient(1200px 520px at 50% -10%, rgba(212,175,55,0.18), transparent 62%), linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%)",
        minHeight: "100vh",
        color: "#000000",
        fontFamily: "Tahoma, Arial, sans-serif",
      }}
    >
      <section
        className="luxFade"
        style={{
          background: "linear-gradient(180deg, #fffaf0 0%, #f4ead0 100%)",
          border: "5px solid #111827",
          borderRadius: 30,
          padding: "22px 26px",
          boxShadow:
            "0 0 0 6px rgba(212,175,55,0.26) inset, 0 18px 38px rgba(150,120,20,0.16)",
          marginBottom: 20,
        }}
      >
        <div
          className="unavailOfficialHeaderGrid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1fr) 150px minmax(260px, 1fr)",
            gap: 22,
            alignItems: "center",
            borderBottom: "3px solid #111827",
            paddingBottom: 18,
          }}
        >
          <div style={{ display: "grid", gap: 6, textAlign: "right", lineHeight: 1.45 }}>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>سلطنة عمان</div>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>وزارة التعليم</div>
            <div style={{ fontSize: 17, fontWeight: 1000 }}>{officialGovernorate}</div>
            <div style={{ fontSize: 21, fontWeight: 1000 }}>{officialCenterName}</div>
          </div>

          <div
            style={{
              width: 132,
              height: 132,
              margin: "0 auto",
              borderRadius: 28,
              border: "4px solid #d4af37",
              background: "#ffffff",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 14px 28px rgba(150,120,20,0.14)",
            }}
          >
            <img
              src={officialLogo || UNAVAIL12_DEFAULT_LOGO_URL}
              alt="official logo"
              style={{ width: "82%", height: "82%", objectFit: "contain" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6, textAlign: "left", lineHeight: 1.45 }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 1000,
                textDecoration: "underline",
                textUnderlineOffset: 8,
              }}
            >
              {t.title}
            </div>
            <div style={{ fontSize: 17, fontWeight: 1000 }}>{officialSemester}</div>
            <div style={{ fontSize: 17, fontWeight: 1000 }}>
              العام الدراسي {officialAcademicYear} م
            </div>
            <div style={{ fontSize: 17, fontWeight: 1000 }}>
              رمز مركز الامتحان: {officialCenterCode}
            </div>
            <div style={{ fontSize: 17, fontWeight: 1000 }}>
              رئيس المركز: {officialCenterHead}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            border: "3px solid #111827",
            borderRadius: 18,
            padding: "10px 16px",
            background: "rgba(255,255,255,0.62)",
            fontWeight: 1000,
            fontSize: 16,
          }}
        >
          <span>عدد المعلمين: {teachers.length || 0}</span>
          <span>السجلات الحالية: {rules.length || 0}</span>
          <span>المعلم المحدد: {teacherName || t.none}</span>
          <span>اسم المركز: {officialCenterName}</span>
        </div>

        <div
          style={{
            marginTop: 12,
            border: "3px solid #d4af37",
            borderRadius: 18,
            padding: "10px 16px",
            background: "#fffaf0",
            fontWeight: 1000,
            fontSize: 15,
          }}
        >
          {cloudLoading
            ? lang === "ar"
              ? "تحميل من السحابة..."
              : "Loading from cloud..."
            : syncMessage || (lang === "ar" ? "جاهز للعمل المتزامن." : "Ready for cloud sync.")}
        </div>
      </section>

      <div className="luxFade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: t.teachersCount, value: teachers.length || 0 },
          { label: t.currentRecords, value: rules.length || 0 },
          { label: t.selectedTeacher, value: teacherName || t.none },
        ].map((item) => (
          <div key={item.label} className="statCard">
            <div style={{ fontSize: 12, color: "#000000", fontWeight: 800 }}>{item.label}</div>
            <div style={{ marginTop: 8, fontSize: 18, color: "#000000", fontWeight: 900 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="softBorder luxFade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 18, marginBottom: 20, boxShadow: "0 0 0 5px rgba(212,175,55,0.12) inset, 0 14px 28px rgba(126,98,18,0.10)" }}>
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#000000", letterSpacing: "-0.02em" }}>{t.addTitle}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#000000", lineHeight: 1.8 }}>{t.addDesc}</div>
          </div>
          <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "#fffaf0", border: "3px solid #d4af37", color: "#000000", fontWeight: 800, fontSize: 12 }}>
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
          <span>{lang === "ar" ? "اختيار من جدول الامتحانات" : "Select from Exams Schedule"}</span>
          <select
            value=""
            onChange={(e) => {
              const selected = examDates.find((item) => item.id === e.target.value);
              if (!selected) return;
              setDateISO(selected.dateISO);
              if (selected.period.includes("الثانية")) setPeriod("PM");
              else if (selected.period.includes("الأولى")) setPeriod("AM");
            }}
            style={dropdownStyle}
          >
            <option value="" style={dropdownOptionStyle}>
              {lang === "ar" ? "— اختر امتحانًا —" : "— Select Exam —"}
            </option>
            {examDates.map((exam) => (
              <option key={exam.id} value={exam.id} style={dropdownOptionStyle}>
                {exam.label}
              </option>
            ))}
          </select>
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

      <h2 className="luxFade" style={{ margin: "4px 0 14px", color: "#000000", fontSize: 28, fontWeight: 900, textShadow: "0 4px 18px rgba(212,175,55,0.16)", letterSpacing: "-0.02em" }}>
        {t.currentRecords}
      </h2>

      {rules.length === 0 ? (
        <div className="luxFade" style={{ opacity: 0.9, border: "3px dashed #d4af37", borderRadius: 18, padding: 24, background: "#fffaf0" }}>
          {t.noRecords}
        </div>
      ) : (
        <div className="luxFade" style={{ display: "grid", gap: 12 }}>
          {displayRules.map((rule) => (
            <div key={rule.id} className="card unavail-row-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.7fr 1fr auto", gap: 14, alignItems: "center", padding: 16, boxShadow: "0 12px 24px rgba(126,98,18,0.10)" }}>
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
                      by: currentUserId || undefined,
                    });
                  } catch {
                    await refreshRulesFromTenant(tenantId);
                    alert(t.deleteError);
                  }
                }}
                className="goldBtn"
                style={{ padding: "8px 10px", background: "linear-gradient(180deg,#fecaca,#ef4444)" }}
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
