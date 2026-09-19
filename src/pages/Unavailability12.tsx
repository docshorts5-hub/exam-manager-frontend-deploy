import React, { useEffect, useMemo, useRef, useState } from "react";
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

function unavailabilityPad2(value: number) {
  return String(value).padStart(2, "0");
}

function unavailabilityLocalISODate(date = new Date()) {
  return `${date.getFullYear()}-${unavailabilityPad2(date.getMonth() + 1)}-${unavailabilityPad2(date.getDate())}`;
}

function unavailabilityNormalizeISODate(value: unknown) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${unavailabilityPad2(month)}-${unavailabilityPad2(day)}`;
    }
  }

  return "";
}

function unavailabilityAddDaysISO(isoDate: string, days: number) {
  const normalized = unavailabilityNormalizeISODate(isoDate);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return unavailabilityLocalISODate(date);
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
  subject?: string;
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
    dateFrom: "التاريخ من",
    dateTo: "التاريخ إلى",
    subject: "مادة الامتحان",
    subjectPlaceholder: "— اختر مادة الامتحان —",
    noExamSubjects: "لا توجد مواد مستوردة من جدول الاختبارات.",
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
    deleteTitle: "تأكيد حذف سجل عدم التوفر",
    deleteMessage: "سيتم حذف هذا السجل من الصفحة ومن التخزين السحابي المرتبط بالجهة الحالية.",
    deleteWarning: "يرجى التأكد قبل التأكيد، لأن العملية لا يمكن التراجع عنها بعد الحذف.",
    confirmDelete: "تأكيد الحذف",
    cancel: "إلغاء",
    deleteSuccess: "تم حذف سجل عدم التوفر بنجاح.",
    printAddedNames: "طباعة الأسماء المضافة",
    exportExcel: "تصدير Excel",
    printTitle: "كشف الأسماء المضافة في غياب الكادر التعليمي",
    excelFileName: "سجل-غياب-الكادر-التعليمي",
    serial: "م",
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
    dateFrom: "Date From",
    dateTo: "Date To",
    subject: "Exam Subject",
    subjectPlaceholder: "— Select Exam Subject —",
    noExamSubjects: "No subjects imported from the exams table.",
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
    deleteTitle: "Confirm unavailability record deletion",
    deleteMessage: "This record will be removed from the page and from the linked cloud storage for this tenant.",
    deleteWarning: "Please confirm carefully. This action cannot be undone after deletion.",
    confirmDelete: "Confirm delete",
    cancel: "Cancel",
    deleteSuccess: "Unavailability record deleted successfully.",
    printAddedNames: "Print Added Names",
    exportExcel: "Export Excel",
    printTitle: "Added Names - Teaching Staff Unavailability",
    excelFileName: "teaching-staff-unavailability",
    serial: "No.",
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
  const [dateISO, setDateISO] = useState<string>(() => unavailabilityLocalISODate());
  const [dateToISO, setDateToISO] = useState<string>(() => unavailabilityLocalISODate());
  const [examSubject, setExamSubject] = useState<string>("");
  const [period, setPeriod] = useState<PeriodChoice>("AM");
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>(["INVIGILATION", "RESERVE"]);
  const [reason, setReason] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<DisplayRule | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");

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
          const subject = String(
            row.subject ||
              row.subjectName ||
              row.subjectAr ||
              row.material ||
              row.materialName ||
              row.examSubject ||
              row.paperName ||
              row.courseName ||
              ""
          ).trim();
          const dateISO = unavailabilityNormalizeISODate(row.dateISO || row.date || row.examDate);
          const period = String(row.period || row.session || row.examPeriod || "").trim();
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

  const examSubjects = useMemo(
    () =>
      Array.from(new Set(examDates.map((exam) => exam.subject).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, lang === "ar" ? "ar" : "en")
      ),
    [examDates, lang]
  );

  const displayRules = useMemo<DisplayRule[]>(() => {
    const normalizeBlocksKey = (arr: UnavailabilityBlock[]) => [...(arr || [])].sort().join("|");
    const grouped = new Map<string, UnavailabilityRule[]>();

    for (const rule of rules) {
      const blocksKey = normalizeBlocksKey((rule.blocks?.length ? rule.blocks : ["ALL"]) as UnavailabilityBlock[]);
      const reasonKey = String(rule.reason || "").trim();
      const subjectKey = String((rule as any).examSubject || (rule as any).subject || "").trim();
      const key = [rule.teacherId, rule.teacherName, rule.dateISO, blocksKey, reasonKey, subjectKey].join("__");
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
        subject: getRuleSubjectText(first),
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

  const visibleRecordCount = displayRules.length;

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


  function importNormalizeText(value: unknown) {
    return String(value ?? "")
      .replace(/[\u200e\u200f]/g, "")
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/\s+/g, " ")
      .trim();
  }

  function importNormalizeDate(value: unknown) {
    const raw = importNormalizeText(value);
    if (!raw) return "";

    if (/^\d+(\.\d+)?$/.test(raw)) {
      const serial = Number(raw);
      if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
        const base = new Date(1899, 11, 30);
        base.setDate(base.getDate() + Math.floor(serial));
        return unavailabilityLocalISODate(base);
      }
    }

    const iso = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    }

    const local = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (local) {
      const day = local[1].padStart(2, "0");
      const month = local[2].padStart(2, "0");
      const year = local[3].length === 2 ? `20${local[3]}` : local[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return unavailabilityLocalISODate(parsed);
    }

    return "";
  }

  function importPeriodValue(value: unknown): UnavailabilityPeriod[] {
    const text = importNormalizeText(value).toLowerCase();
    if (!text || text.includes("كامل") || text.includes("full") || (text.includes("am") && text.includes("pm"))) {
      return ["AM", "PM"];
    }
    if (text.includes("pm") || text.includes("الثانية") || text.includes("مساء") || text.includes("2")) {
      return ["PM"];
    }
    return ["AM"];
  }

  function importBlocksValue(value: unknown): UnavailabilityBlock[] {
    const text = importNormalizeText(value).toLowerCase();
    if (!text || text.includes("كل") || text.includes("all")) return ["ALL"];

    const next = new Set<UnavailabilityBlock>();
    if (text.includes("مراق") || text.includes("invig")) next.add("INVIGILATION");
    if (text.includes("احتياط") || text.includes("reserve")) next.add("RESERVE");
    if (text.includes("مراجع") || text.includes("مراجعة") || text.includes("review")) next.add("REVIEW_FREE");
    if (text.includes("تصحيح") || text.includes("correct")) next.add("CORRECTION_FREE");

    return next.size ? Array.from(next) : ["ALL"];
  }

  function importRowsFromExcelText(text: string) {
    const source = String(text || "");
    if (/<table[\s>]/i.test(source)) {
      const doc = new DOMParser().parseFromString(source, "text/html");
      const table = doc.querySelector("table");
      if (!table) return [] as string[][];
      return Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((cell) => importNormalizeText(cell.textContent || ""))
      );
    }

    return source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
        return line.split(delimiter).map((cell) => importNormalizeText(cell.replace(/^"|"$/g, "")));
      });
  }

  function importColumnIndex(header: string[], names: string[], fallback: number) {
    const normalized = header.map((item) => importNormalizeText(item).toLowerCase());
    const index = normalized.findIndex((item) => names.some((name) => item.includes(name.toLowerCase())));
    return index >= 0 ? index : fallback;
  }

  function readImportedFileAsText(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("File read failed"));
      reader.readAsText(file, "utf-8");
    });
  }

  async function onImportExcelFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportBusy(true);
    setImportMessage(lang === "ar" ? "جاري استيراد ملف Excel..." : "Importing Excel file...");

    try {
      const text = await readImportedFileAsText(file);
      const matrix = importRowsFromExcelText(text).filter((row) => row.some(Boolean));
      const headerRowIndex = matrix.findIndex((row) =>
        row.some((cell) => importNormalizeText(cell).includes("المعلم")) &&
        row.some((cell) => importNormalizeText(cell).includes("التاريخ"))
      );
      const header = headerRowIndex >= 0 ? matrix[headerRowIndex] : ["م", "المعلم", "التاريخ", "الفترة", "المنع على", "سبب"];
      const body = matrix.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 1);

      const teacherCol = importColumnIndex(header, ["المعلم", "teacher"], 1);
      const dateCol = importColumnIndex(header, ["التاريخ", "date"], 2);
      const periodCol = importColumnIndex(header, ["الفترة", "period"], 3);
      const blocksCol = importColumnIndex(header, ["المنع", "blocked", "block"], 4);
      const reasonCol = importColumnIndex(header, ["سبب", "reason"], 5);

      const teacherByName = new Map<string, { id: string; name: string }>();
      teachers.forEach((teacher) => {
        teacherByName.set(importNormalizeText(teacher.name).toLowerCase(), teacher);
      });

      const occupied = new Set<string>();
      rules.forEach((rule) => occupied.add(`${rule.teacherId}__${rule.dateISO}__${rule.period}`));

      const createdAt = Date.now();
      const createdRules: UnavailabilityRule[] = [];
      let skipped = 0;
      let unmatched = 0;

      for (const row of body) {
        const importedTeacherName = importNormalizeText(row[teacherCol]);
        const importedDate = importNormalizeDate(row[dateCol]);
        if (!importedTeacherName || !importedDate) continue;

        const matchedTeacher = teacherByName.get(importedTeacherName.toLowerCase());
        if (!matchedTeacher) {
          unmatched += 1;
          continue;
        }

        const targetPeriods = importPeriodValue(row[periodCol]);
        const importedBlocks = importBlocksValue(row[blocksCol]);
        const importedReason = importNormalizeText(row[reasonCol]) || undefined;

        for (const p of targetPeriods) {
          const key = `${matchedTeacher.id}__${importedDate}__${p}`;
          if (occupied.has(key)) {
            skipped += 1;
            continue;
          }
          occupied.add(key);
          createdRules.push({
            id: newId(),
            teacherId: matchedTeacher.id,
            teacherName: matchedTeacher.name,
            dateISO: importedDate,
            period: p,
            blocks: importedBlocks,
            reason: importedReason,
            createdAt: createdAt + createdRules.length,
          });
        }
      }

      if (!createdRules.length) {
        setImportMessage(lang === "ar"
          ? `لم يتم استيراد سجلات جديدة. تم تخطي ${skipped} تكرار، ولم يتم العثور على ${unmatched} اسم في قائمة المعلمين.`
          : `No new records imported. Skipped ${skipped} duplicates and ${unmatched} unmatched names.`);
        return;
      }

      const nextRules = [...createdRules, ...rules];
      saveUnavailability(nextRules, tenantId);
      setRules(nextRules);

      await persistUnavailabilityToTenant({
        tenantId,
        rules: nextRules,
        by: currentUserId || undefined,
      });

      window.dispatchEvent(new CustomEvent(UNAVAIL_UPDATED_EVENT, { detail: { tenantId } }));
      setImportMessage(lang === "ar"
        ? `تم استيراد ${createdRules.length} سجل بنجاح. تم تخطي ${skipped} تكرار، وعدد الأسماء غير المطابقة ${unmatched}.`
        : `Imported ${createdRules.length} records successfully. Skipped ${skipped} duplicates and ${unmatched} unmatched names.`);
    } catch {
      setImportMessage(lang === "ar" ? "تعذر استيراد ملف Excel. تأكد من ترتيب الأعمدة وصيغة الملف." : "Could not import the Excel file. Please check the column order and file format.");
    } finally {
      setImportBusy(false);
      event.target.value = "";
    }
  }

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

  function buildDateRange(fromISO: string, toISO: string) {
    const from = unavailabilityNormalizeISODate(fromISO);
    const to = unavailabilityNormalizeISODate(toISO || fromISO);
    if (!from || !to || to < from) return [];

    const out: string[] = [];
    let cursor = from;
    while (cursor && cursor <= to && out.length < 120) {
      out.push(cursor);
      cursor = unavailabilityAddDaysISO(cursor, 1);
    }
    return out;
  }

  async function onAdd() {
    const tid = String(teacherId || "").trim();
    const tname = String(teacherName || "").trim();
    const from = unavailabilityNormalizeISODate(dateISO);
    const to = unavailabilityNormalizeISODate(dateToISO || dateISO);
    const selectedSubject = String(examSubject || "").trim();
    const targetDates = buildDateRange(from, to);
    if (!tid || !tname || !from || !targetDates.length) return;

    const targetPeriods: UnavailabilityPeriod[] =
      period === "FULL_DAY" ? (["AM", "PM"] as UnavailabilityPeriod[]) : ([period] as UnavailabilityPeriod[]);

    const duplicates = targetDates.flatMap((targetDate) =>
      targetPeriods
        .filter((p) => rules.some((r) => r.teacherId === tid && r.dateISO === targetDate && r.period === p))
        .map((p) => `${targetDate} / ${p === "PM" ? t.periodPM : t.periodAM}`)
    );

    if (duplicates.length) {
      alert(`${t.duplicate}: ${duplicates.slice(0, 5).join("، ")}${duplicates.length > 5 ? " ..." : ""}.`);
      return;
    }

    const createdAt = Date.now();
    const createdRules: UnavailabilityRule[] = targetDates.flatMap((targetDate, dateIndex) =>
      targetPeriods.map((p, periodIndex) =>
        ({
          id: newId(),
          teacherId: tid,
          teacherName: tname,
          dateISO: targetDate,
          dateFromISO: from,
          dateToISO: to,
          period: p,
          examSubject: selectedSubject || undefined,
          subject: selectedSubject || undefined,
          blocks: blocks.length ? blocks : ["INVIGILATION", "RESERVE"],
          reason: reason.trim() || undefined,
          createdAt: createdAt + dateIndex * targetPeriods.length + periodIndex,
        } as UnavailabilityRule)
      )
    );

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
      setExamSubject("");
      setDateToISO(dateISO);
      setSyncMessage(lang === "ar" ? "تم حفظ سجل عدم التوفر في السحابة." : "Unavailability record saved to cloud.");
    } catch {
      await refreshRulesFromTenant(tenantId);
      alert(t.saveError);
    }
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget || deleteBusy) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    const idsToDelete = new Set(target.sourceIds || []);
    const nextRules = rules.filter((x) => !idsToDelete.has(x.id));

    saveUnavailability(nextRules, tenantId);
    setRules(nextRules);

    try {
      await persistUnavailabilityToTenant({
        tenantId,
        rules: nextRules,
        by: currentUserId || undefined,
      });
      setDeleteNotice({ kind: "success", message: t.deleteSuccess });
      setDeleteTarget(null);
    } catch {
      await refreshRulesFromTenant(tenantId);
      setDeleteNotice({ kind: "error", message: t.deleteError });
    } finally {
      setDeleteBusy(false);
    }
  }



  function unavailabilityEscapeHtml(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getRuleSubjectText(rule: any) {
    return String(
      rule?.subject ||
        rule?.examSubject ||
        rule?.subjectName ||
        rule?.subjectAr ||
        rule?.material ||
        rule?.materialName ||
        rule?.examSubjectName ||
        rule?.paperName ||
        rule?.courseName ||
        ""
    ).trim();
  }

  function buildAddedNamesRows() {
    return displayRules.map((rule, index) => ({
      index: index + 1,
      teacherName: rule.teacherName || t.none,
      dateISO: rule.dateISO || t.none,
      periodLabel: rule.periodLabel || t.none,
      subject: getRuleSubjectText(rule) || t.none,
      blocks: (rule.blocks?.length ? rule.blocks : ["ALL"])
        .map((block) => BLOCK_LABEL[block as UnavailabilityBlock] || String(block))
        .join(t.comma),
      reason: rule.reason || t.none,
    }));
  }

  function buildAddedNamesTableHtml() {
    const rows = buildAddedNamesRows();
    const headers = [t.serial, t.teacher, t.date, t.period, t.blockedOn.replace(":", ""), t.reason.replace(" (اختياري)", "").replace(" (Optional)", "")];
    const body = rows.length
      ? rows
          .map(
            (row) => `
              <tr>
                <td>${row.index}</td>
                <td>${unavailabilityEscapeHtml(row.teacherName)}</td>
                <td>${unavailabilityEscapeHtml(row.dateISO)}</td>
                <td>${unavailabilityEscapeHtml(row.periodLabel)}</td>
                <td>${unavailabilityEscapeHtml(row.blocks)}</td>
                <td>${unavailabilityEscapeHtml(row.reason)}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="6">${unavailabilityEscapeHtml(t.noRecords)}</td></tr>`;

    return `
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${unavailabilityEscapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  function buildOfficialPrintHeaderHtml(title: string, printedAt: string) {
    return `
      <section class="officialHeader">
        <div class="officialSide officialAuthority">
          <div class="officialLine officialCountry">${unavailabilityEscapeHtml(lang === "ar" ? "سلطنة عمان" : "Sultanate of Oman")}</div>
          <div class="officialLine officialMinistry">${unavailabilityEscapeHtml(lang === "ar" ? "وزارة التعليم" : "Ministry of Education")}</div>
          <div class="officialLine">${unavailabilityEscapeHtml(officialGovernorate)}</div>
          <div class="officialLine officialEntity">${unavailabilityEscapeHtml(officialCenterName)}</div>
        </div>
        <div class="officialLogoBox"><img src="${unavailabilityEscapeHtml(officialLogo || UNAVAIL12_DEFAULT_LOGO_URL)}" alt="logo" /></div>
        <div class="officialSide officialReport">
          <h1>${unavailabilityEscapeHtml(title)}</h1>
          <div class="officialLine">${unavailabilityEscapeHtml(officialSemester)}</div>
          <div class="officialLine">${unavailabilityEscapeHtml(lang === "ar" ? `العام الدراسي ${officialAcademicYear} م` : `Academic Year ${officialAcademicYear}`)}</div>
          <div class="officialLine">${unavailabilityEscapeHtml(lang === "ar" ? `رمز مركز الامتحان: ${officialCenterCode}` : `Exam Center Code: ${officialCenterCode}`)}</div>
          <div class="officialLine">${unavailabilityEscapeHtml(lang === "ar" ? `رئيس المركز: ${officialCenterHead}` : `Center Head: ${officialCenterHead}`)}</div>
          <div class="officialLine">${unavailabilityEscapeHtml(printedAt)}</div>
        </div>
      </section>`;
  }

  function onPrintAddedNames() {
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    const title = t.printTitle;
    const now = new Date().toLocaleString(lang === "ar" ? "ar-OM" : "en-GB");
    const tableHtml = buildAddedNamesTableHtml();
    const headerHtml = buildOfficialPrintHeaderHtml(title, now);

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="${lang}" dir="${isRTL ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${unavailabilityEscapeHtml(title)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: Tahoma, Arial, sans-serif; color: #111827; margin: 0; background: #fff; }
            .officialHeader { border: 3px solid #d6b35a; border-radius: 18px; padding: 14px 18px; margin-bottom: 14px; display: grid; grid-template-columns: minmax(260px, 1fr) 92px minmax(260px, 1fr); gap: 16px; align-items: center; background: #fffaf0; box-shadow: 0 0 0 1px #111827 inset; }
            .officialSide { display: grid; gap: 4px; line-height: 1.55; }
            .officialAuthority { text-align: ${isRTL ? "right" : "left"}; }
            .officialReport { text-align: ${isRTL ? "left" : "right"}; }
            .officialReport h1 { margin: 0 0 6px; font-size: 24px; font-weight: 950; text-decoration: underline; text-underline-offset: 6px; }
            .officialLine { font-size: 13px; font-weight: 900; color: #111827; }
            .officialCountry, .officialMinistry, .officialEntity { font-size: 15px; font-weight: 950; }
            .officialLogoBox { width: 86px; height: 86px; margin: 0 auto; border: 3px solid #d6b35a; border-radius: 18px; display: grid; place-items: center; background: #fff; }
            .officialLogoBox img { width: 76px; height: 76px; object-fit: contain; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #d6b35a; padding: 9px 8px; font-size: 12px; font-weight: 800; vertical-align: top; word-break: break-word; }
            th { background: #f7e7b2; color: #111827; font-weight: 950; }
            tr:nth-child(even) td { background: #fffaf0; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${tableHtml}
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  function onExportAddedNamesExcel() {
    const title = t.printTitle;
    const now = new Date().toLocaleString(lang === "ar" ? "ar-OM" : "en-GB");
    const tableHtml = buildAddedNamesTableHtml();
    const headerHtml = buildOfficialPrintHeaderHtml(title, now);
    const html = `<!doctype html>
      <html lang="${lang}" dir="${isRTL ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Tahoma, Arial, sans-serif; color: #111827; }
            .officialHeader { border: 2px solid #d6b35a; background: #fffaf0; padding: 12px; margin-bottom: 12px; }
            .officialSide, .officialLine { font-weight: 900; line-height: 1.7; }
            .officialReport h1 { font-size: 20px; font-weight: 950; margin: 0 0 8px; }
            .officialLogoBox img { width: 64px; height: 64px; object-fit: contain; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #b68a13; padding: 8px; font-weight: 700; mso-number-format:"\@"; }
            th { background: #f7e7b2; font-weight: 900; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${tableHtml}
        </body>
      </html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${t.excelFileName}-${unavailabilityLocalISODate()}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          <span>السجلات الحالية: {visibleRecordCount || 0}</span>
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
          { label: t.currentRecords, value: visibleRecordCount || 0 },
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
          <span>{t.dateFrom}</span>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => {
              setDateISO(e.target.value);
              if (!dateToISO || dateToISO < e.target.value) setDateToISO(e.target.value);
            }}
            style={fieldStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.dateTo}</span>
          <input type="date" value={dateToISO} min={dateISO} onChange={(e) => setDateToISO(e.target.value)} style={fieldStyle} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.subject}</span>
          <select
            value={examSubject}
            onChange={(e) => {
              const value = e.target.value;
              setExamSubject(value);
              const dates = examDates
                .filter((item) => item.subject === value && item.dateISO)
                .map((item) => item.dateISO)
                .sort();
              if (dates[0]) setDateISO(dates[0]);
              if (dates[dates.length - 1]) setDateToISO(dates[dates.length - 1]);
            }}
            style={dropdownStyle}
          >
            <option value="" style={dropdownOptionStyle}>{t.subjectPlaceholder}</option>
            {examSubjects.map((subject) => (
              <option key={subject} value={subject} style={dropdownOptionStyle}>{subject}</option>
            ))}
          </select>
          {!examSubjects.length ? <small style={{ color: "#92400e", fontWeight: 900 }}>{t.noExamSubjects}</small> : null}
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

      {deleteNotice ? (
        <div
          className="luxFade"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            margin: "0 0 18px",
            padding: "16px 18px",
            borderRadius: 18,
            border: deleteNotice.kind === "success" ? "2px solid #16a34a" : "2px solid #dc2626",
            background:
              deleteNotice.kind === "success"
                ? "linear-gradient(135deg, #ecfdf5, #dcfce7)"
                : "linear-gradient(135deg, #fff1f2, #fee2e2)",
            color: deleteNotice.kind === "success" ? "#064e3b" : "#7f1d1d",
            fontWeight: 900,
            boxShadow: "0 16px 30px rgba(15,23,42,0.12)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: deleteNotice.kind === "success" ? "#16a34a" : "#dc2626",
                color: "#fff",
                boxShadow: "0 10px 18px rgba(15,23,42,0.18)",
              }}
            >
              {deleteNotice.kind === "success" ? "✓" : "!"}
            </span>
            {deleteNotice.message}
          </span>
          <button
            type="button"
            onClick={() => setDeleteNotice(null)}
            style={{
              border: "0",
              borderRadius: 12,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 900,
              background: "rgba(255,255,255,0.75)",
              color: "#111827",
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 18,
            background: "rgba(15,23,42,0.50)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              borderRadius: 26,
              border: "2px solid #fecaca",
              background: "linear-gradient(180deg, #fff7ed, #fff1f2)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
              padding: 24,
              color: "#111827",
              direction: isRTL ? "rtl" : "ltr",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(180deg, #ef4444, #991b1b)",
                  color: "#fff",
                  fontSize: 26,
                  boxShadow: "0 16px 30px rgba(153,27,27,0.28)",
                }}
              >
                🗑️
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 950, color: "#7f1d1d" }}>{t.deleteTitle}</div>
                <div style={{ marginTop: 4, color: "#374151", fontWeight: 800 }}>{t.deleteMessage}</div>
              </div>
            </div>

            <div
              style={{
                margin: "16px 0",
                padding: 14,
                borderRadius: 18,
                border: "1px solid #fca5a5",
                background: "rgba(255,255,255,0.72)",
                fontWeight: 900,
                lineHeight: 1.8,
              }}
            >
              <div>{deleteTarget.teacherName}</div>
              <div style={{ color: "#4b5563" }}>
                {deleteTarget.dateISO} — {deleteTarget.periodLabel}
              </div>
            </div>

            <div style={{ color: "#92400e", fontWeight: 900, marginBottom: 18 }}>
              {t.deleteWarning}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: isRTL ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                style={{
                  border: "1px solid #d6b35a",
                  borderRadius: 14,
                  padding: "11px 18px",
                  cursor: deleteBusy ? "not-allowed" : "pointer",
                  fontWeight: 950,
                  background: "#fffaf0",
                  color: "#111827",
                }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={confirmDeleteTarget}
                disabled={deleteBusy}
                style={{
                  border: "0",
                  borderRadius: 14,
                  padding: "11px 18px",
                  cursor: deleteBusy ? "not-allowed" : "pointer",
                  fontWeight: 950,
                  background: deleteBusy ? "#9ca3af" : "linear-gradient(180deg, #ef4444, #b91c1c)",
                  color: "#fff",
                  boxShadow: "0 14px 26px rgba(185,28,28,0.28)",
                }}
              >
                {deleteBusy ? "..." : t.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="luxFade" style={{ margin: "4px 0 14px", color: "#000000", fontSize: 28, fontWeight: 900, textShadow: "0 4px 18px rgba(212,175,55,0.16)", letterSpacing: "-0.02em" }}>
        {t.currentRecords}
      </h2>


      <input
        ref={importInputRef}
        type="file"
        accept=".xls,.html,.htm,.csv,.txt"
        onChange={onImportExcelFile}
        style={{ display: "none" }}
      />


      <div
        className="luxFade"
        style={{
          display: "flex",
          justifyContent: isRTL ? "flex-start" : "flex-end",
          gap: 10,
          flexWrap: "wrap",
          margin: "0 0 16px",
        }}
      >        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          disabled={importBusy}
          className="goldBtn"
          style={{ padding: "10px 14px", opacity: importBusy ? 0.68 : 1, cursor: importBusy ? "wait" : "pointer" }}
        >
          {importBusy
            ? lang === "ar" ? "جاري الاستيراد..." : "Importing..."
            : lang === "ar" ? "استيراد Excel" : "Import Excel"}
        </button>

        <button
          type="button"
          onClick={onPrintAddedNames}
          disabled={!displayRules.length}
          className="goldBtn"
          style={{ opacity: displayRules.length ? 1 : 0.55, cursor: displayRules.length ? "pointer" : "not-allowed" }}
        >
          🖨️ {t.printAddedNames}
        </button>
        <button
          type="button"
          onClick={onExportAddedNamesExcel}
          disabled={!displayRules.length}
          className="goldBtn"
          style={{ opacity: displayRules.length ? 1 : 0.55, cursor: displayRules.length ? "pointer" : "not-allowed" }}
        >
          📊 {t.exportExcel}
        </button>
      </div>

      
      {importMessage ? (
        <div
          className="luxFade"
          style={{
            border: "2px solid #2563eb",
            borderRadius: 16,
            background: "#eff6ff",
            color: "#111827",
            fontWeight: 1000,
            padding: "12px 16px",
            marginBottom: 14,
          }}
        >
          {importMessage}
        </div>
      ) : null}

{displayRules.length === 0 ? (
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
                {rule.subject ? <span style={{ opacity: 0.85 }}>{` — ${rule.subject}`}</span> : null}
                {rule.reason ? <span style={{ opacity: 0.75 }}>{` — ${rule.reason}`}</span> : null}
              </div>
              <button
                onClick={() => {
                  setDeleteNotice(null);
                  setDeleteTarget(rule);
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
