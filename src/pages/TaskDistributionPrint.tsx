// ✅ src/pages/TaskDistributionPrint.tsx  (الملف كامل بعد التعديل)
// ✅ FIX 1: الطباعة الآن تطبع "التقرير فقط" (بدون القوائم/الواجهة) عبر نافذة طباعة مستقلة
// ✅ FIX 2: تقرير المعلم (فردي) يتم Auto-Fit ليصبح "صفحة واحدة" A4 قدر الإمكان
// ✅ FIX 3: حل مشكلة "صفحة بيضاء" في بعض المتصفحات (لم نعد نعتمد على visibility/fixed داخل نفس الصفحة)
// ✅ FIX 4: زر واتساب: فتح مباشر + Fallbacks متعددة (wa.me / api.whatsapp.com / web.whatsapp.com / whatsapp://)
// ✅ FIX 5: عمود "المادة" في تقرير المعلم أصبح بنفس عرض عمود "الفترة" لتجنب تكسير النص
// ✅ NEW: إظهار الرقم الوظيفي للمعلم في تقرير المعلم (فردي) عبر صفحة الكادر التعليمي employeeNo
// ✅ تحديث تلقائي لصفحة التقرير عند تغيّر: Run + master/all/results + الشعار + بيانات المدرسة + الامتحانات + الكادر التعليمي
// عبر: RUN_UPDATED_EVENT + focus + storage + interval (لنفس التبويب)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { loadTenantArray, writeTenantAudit } from "../services/tenantData";
import { loadRun, RUN_UPDATED_EVENT, taskDistributionKey } from "../utils/taskDistributionStorage";
import type { TaskType } from "../contracts/taskDistributionContract";

/** -------------------------------------------
 * ✅ Keys
 * ------------------------------------------ */
const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const EXAMS_SUB = "exams";
const TEACHERS_SUB = "teachers";

/** -------------------------------------------
 * Helpers: safe localStorage JSON read
 * ------------------------------------------ */
function readJson<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeText(s: string) {
  return (s || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeISODate(d: string) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(d);
}

/** ✅ convert AM/BM/PM to Arabic periods */
function formatPeriod(p: string) {
  const raw = (p || "").toString().trim();
  if (!raw) return "—";

  if (raw.includes("الأولى")) return "الفترة الأولى";
  if (raw.includes("الثانية")) return "الفترة الثانية";

  const n = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

  if (n === "am" || n.startsWith("am") || n.includes(" am") || n === "a m" || n === "a") return "الفترة الأولى";

  if (
    n === "pm" ||
    n.startsWith("pm") ||
    n.includes(" pm") ||
    n === "p m" ||
    n === "p" ||
    n === "bm" ||
    n.startsWith("bm") ||
    n.includes(" bm") ||
    n === "b m" ||
    n === "b"
  )
    return "الفترة الثانية";

  return raw;
}

/** ✅ period key for exam matching */
function normalizePeriodKey(p: string) {
  const fp = formatPeriod(p || "");
  if (fp.includes("الأولى")) return "p1";
  if (fp.includes("الثانية")) return "p2";
  return normalizeText(fp);
}

function taskLabel(t: TaskType | string) {
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
      return typeof t === "string" && t.trim() ? t : "فارغ";
  }
}

/** -------------------------------------------
 * Shapes
 * ------------------------------------------ */
type SchoolData = {
  name: string;
  governorate: string;
  semester: string;
  phone: string;
  address: string;
};

type Exam = {
  subject: string;
  dateISO: string; // YYYY-MM-DD
  dayLabel: string; // الأحد..الخ
  time: string; // 08:00
  durationMinutes?: number;
  period: string; // الفترة الأولى/الثانية أو AM/PM/BM...
  roomsCount?: number;
};

type Teacher = {
  id: string;
  employeeNo: string; // ✅ الرقم الوظيفي
  fullName: string;
  phone: string;
};

type AnyAssignment = any;

function getTeacherName(a: AnyAssignment): string {
  return a?.teacherName || a?.teacher?.name || a?.teacher || a?.name || a?.teacherLabel || "";
}

function getTaskType(a: AnyAssignment): TaskType | string {
  return (a?.taskType || a?.type || a?.assignmentType || a?.dutyType || "INVIGILATION") as any;
}

/** ✅ FIX: Strong committee/room number extraction */
function getRoomNumber(a: AnyAssignment): string {
  const direct =
    a?.committeeNumber ??
    a?.committeeNo ??
    a?.committee ??
    a?.committeeId ??
    a?.roomNumber ??
    a?.roomNo ??
    a?.room ??
    a?.roomId ??
    a?.roomLabel ??
    a?.roomName ??
    a?.hallNumber ??
    a?.hallNo ??
    a?.committeeLabel ??
    "";

  if (direct !== null && direct !== undefined && String(direct).trim() !== "") {
    return String(direct).trim();
  }

  const nested =
    a?.assignment?.committeeNumber ??
    a?.assignment?.committeeNo ??
    a?.assignment?.roomNumber ??
    a?.assignment?.roomNo ??
    a?.duty?.committeeNumber ??
    a?.duty?.committeeNo ??
    a?.duty?.roomNumber ??
    a?.duty?.roomNo ??
    "";

  if (nested !== null && nested !== undefined && String(nested).trim() !== "") {
    return String(nested).trim();
  }

  const examNested =
    a?.exam?.committeeNumber ??
    a?.exam?.committeeNo ??
    a?.exam?.roomNumber ??
    a?.exam?.roomNo ??
    a?.slot?.committeeNumber ??
    a?.slot?.committeeNo ??
    a?.slot?.roomNumber ??
    a?.slot?.roomNo ??
    a?.room?.number ??
    a?.room?.no ??
    a?.room?.name ??
    "";

  if (examNested !== null && examNested !== undefined && String(examNested).trim() !== "") {
    return String(examNested).trim();
  }

  const roomIndex = a?.roomIndex ?? a?.committeeIndex ?? a?.roomIdx ?? a?.committeeIdx ?? null;
  const rooms = a?.exam?.rooms || a?.rooms || a?.examRooms || null;

  if (roomIndex !== null && Array.isArray(rooms) && rooms[roomIndex]) {
    const rr = rooms[roomIndex];
    const v =
      rr?.committeeNumber ??
      rr?.committeeNo ??
      rr?.roomNumber ??
      rr?.roomNo ??
      rr?.name ??
      rr?.label ??
      rr?.roomName ??
      "";
    if (String(v).trim()) return String(v).trim();
  }

  return "";
}

/** ✅ NEW: تحويل رقم اللجنة لرقم للمقارنة والترتيب */
function parseCommitteeNumber(v: any): { num: number; raw: string } {
  const raw = (v ?? "").toString().trim();
  if (!raw) return { num: Number.POSITIVE_INFINITY, raw: "" };
  const m = raw.match(/\d+/);
  const num = m ? Number(m[0]) : Number.POSITIVE_INFINITY;
  return { num: Number.isFinite(num) ? num : Number.POSITIVE_INFINITY, raw };
}

function getExamSubject(a: AnyAssignment): string {
  return a?.subject || a?.examSubject || a?.exam?.subject || "";
}
function getExamDateISO(a: AnyAssignment): string {
  return a?.dateISO || a?.examDateISO || a?.exam?.dateISO || a?.date || "";
}
function getExamDayLabel(a: AnyAssignment): string {
  return a?.dayLabel || a?.examDayLabel || a?.exam?.dayLabel || "";
}
function getExamPeriod(a: AnyAssignment): string {
  return a?.period || a?.examPeriod || a?.exam?.period || "";
}
function getExamTime(a: AnyAssignment): string {
  return a?.time || a?.examTime || a?.exam?.time || "";
}

/** -------------------------------------------
 * ✅ Print helpers (تقرير فقط + صفحة واحدة للمعلم الفردي)
 * ------------------------------------------ */

const printWindowCss = `
@page { size: A4 portrait; margin: 8mm; }

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  direction: rtl;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
}

/* ✅ صفحة ثابتة بقياس A4 (مع margin في @page) */
#print-page {
  width: 194mm;          /* 210 - (8*2) */
  height: 281mm;         /* 297 - (8*2) */
  overflow: hidden;
  margin: 0 auto;
  position: relative;
}

/* ✅ محتوى التقرير سيتم تصغيره تلقائياً */
#fit-target {
  transform-origin: top right;  /* RTL */
}

/* تنظيف */
.no-print { display: none !important; }

/* تنسيق الطباعة داخل النافذة */
.print-root .print-sheet {
  box-shadow: none !important;
  border-radius: 0 !important;
  width: auto !important;
  min-height: auto !important;
  margin: 0 !important;
  background: #fff !important;
  padding: 0 !important;
}

/* ضغط بسيط لزيادة فرصة صفحة واحدة */
.print-root table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
.print-root th { padding: 6px 6px !important; font-size: 12px !important; }
.print-root td { padding: 6px 6px !important; font-size: 12px !important; height: 26px !important; }
.print-root th, .print-root td { word-break: break-word; overflow-wrap: anywhere; }

/* منع فواصل غريبة */
.print-root * { box-shadow: none !important; }
`;

/** ✅ اطبع عنصر فقط (بدون القوائم/الواجهة) + اجعله صفحة واحدة إذا كانت صفحة واحدة فقط */
async function printOnlyElement(el: HTMLElement, title = "report") {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${String(title).replace(/</g, "&lt;")}</title>
  <style>${printWindowCss}</style>
</head>
<body>
  <div id="print-page">
    <div id="fit-target" class="print-root">${clone.outerHTML}</div>
  </div>

  <script>
    (function () {
      var pxPerMm = 96 / 25.4; // px per mm at 96dpi
      var maxW = 194 * pxPerMm; // printable area
      var maxH = 281 * pxPerMm;

      function fitToOnePage() {
        var target = document.getElementById('fit-target');
        if (!target) return;

        // لو فيه أكثر من صفحة (طباعة الكل) لا نضغطها بصفحة واحدة
        var sheets = target.querySelectorAll('.print-sheet');
        if (sheets && sheets.length > 1) return;

        var rect = target.getBoundingClientRect();
        var contentW = Math.max(rect.width, target.scrollWidth || 0);
        var contentH = Math.max(rect.height, target.scrollHeight || 0);
        if (!contentW || !contentH) return;

        var scaleW = maxW / contentW;
        var scaleH = maxH / contentH;
        var scale = Math.min(scaleW, scaleH, 1);

        target.style.transform = 'scale(' + scale + ')';
      }

      function whenImagesReady(cb) {
        var imgs = Array.prototype.slice.call(document.images || []);
        if (!imgs.length) return cb();

        var left = imgs.length;
        function done() { left--; if (left <= 0) cb(); }

        imgs.forEach(function (img) {
          if (img.complete) return done();
          img.onload = done;
          img.onerror = done;
        });
      }

      window.addEventListener('load', function () {
        whenImagesReady(function () {
          fitToOnePage();
          setTimeout(function () {
            window.focus();
            window.print();
          }, 60);
        });
      });
    })();
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=950,height=720,top=80,left=120,resizable=yes,scrollbars=yes");
  if (!w) {
    // fallback أخير
    window.print();
    return;
  }

  w.opener = null;
  w.document.open();
  w.document.write(html);
  w.document.close();

  // اغلاق بعد الطباعة (اختياري)
  setTimeout(() => {
    try {
      w.close();
    } catch {}
  }, 1800);
}

/** -------------------------------------------
 * WhatsApp helpers (FIX: فتح مباشر + فوالباك)
 * ------------------------------------------ */
function sanitizePhoneToWhatsApp(phoneRaw: string): string {
  let p = String(phoneRaw || "").trim();
  if (!p) return "";
  p = p.replace(/[^\d]/g, "");

  // ✅ عمان غالباً 8 أرقام → نضيف 968
  if (p.length === 8) p = `968${p}`;
  if (p.startsWith("0") && p.length >= 9) p = `968${p.slice(1)}`;

  return p;
}

function openWhatsAppWindow({ text, phone }: { text: string; phone?: string }) {
  const cleanPhone = (phone || "").replace(/[^\d]/g, "");
  const encoded = encodeURIComponent(text || "");

  const urls = [
    // 1) محاولة فتح التطبيق مباشرة (قد يعمل على بعض الأنظمة)
    `whatsapp://send?${cleanPhone ? `phone=${cleanPhone}&` : ""}text=${encoded}`,

    // 2) wa.me
    cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`,

    // 3) api.whatsapp.com
    cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`,

    // 4) web.whatsapp.com (مفيد على الكمبيوتر)
    cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`,
  ];

  const features = "noopener,noreferrer,width=980,height=760,top=70,left=120,resizable=yes,scrollbars=yes";

  // ✅ نفتح الرابط مباشرة (بدون about:blank ثم location) لتفادي مشاكل/حظر/ERR_CONNECTION_RESET أحيانًا
  for (const url of urls) {
    try {
      const w = window.open(url, "_blank", features);
      if (w) return true;
    } catch {
      // نكمل للفallback التالي
    }
  }

  // ✅ آخر حل: افتح في نفس الصفحة (إذا المتصفح منع الـpopup)
  window.location.href = urls[1];
  return false;
}

/** -------------------------------------------
 * PNG export (بدون مكتبات)
 * ------------------------------------------ */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportElementToPng(el: HTMLElement, filename: string) {
  const rect = el.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());

  const serializer = new XMLSerializer();
  const xhtml = serializer.serializeToString(clone);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>
    </foreignObject>
  </svg>`.trim();

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("PNG_EXPORT_FAILED"));
    img.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("NO_CTX");

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(svgUrl);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) throw new Error("NO_BLOB");

  downloadBlob(blob, filename);
}

/** -------------------------------------------
 * Main
 * ------------------------------------------ */
export default function TaskDistributionPrint() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || user?.tenantId || "").trim() || "default";

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const [run, setRun] = useState(() => loadRun(tenantId));
  const [schoolData, setSchoolData] = useState<SchoolData>(() => {
    const saved = readJson<SchoolData>(SCHOOL_DATA_KEY);
    return (
      saved || {
        name: "",
        governorate: "",
        semester: "",
        phone: "",
        address: "",
      }
    );
  });
  const [logoUrl, setLogoUrl] = useState(() => {
    const savedLogo = (localStorage.getItem(LOGO_KEY) || "").trim();
    return savedLogo || DEFAULT_LOGO_URL;
  });
  const [examsList, setExamsList] = useState<Exam[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  async function refreshRosterFromFirestore() {
    const [exRows, tRows] = await Promise.all([
      loadTenantArray<any>(tenantId, EXAMS_SUB).catch(() => []),
      loadTenantArray<any>(tenantId, TEACHERS_SUB).catch(() => []),
    ]);
    setExamsList(Array.isArray(exRows) ? (exRows as Exam[]) : []);
    setTeachers(
      (Array.isArray(tRows) ? tRows : [])
        .map((t: any) => ({
          id: String(t.id ?? "").trim(),
          employeeNo: String(t.employeeNo ?? t.employeeNumber ?? t.jobNo ?? t.jobNumber ?? "").trim(),
          fullName: String(t.fullName ?? t.name ?? t.teacherName ?? "").trim(),
          phone: String(t.phone ?? t.mobile ?? "").trim(),
        }))
        .filter((t: Teacher) => t.fullName || t.employeeNo || t.phone)
    );
  }

  const [storageTick, setStorageTick] = useState(0);
  const lastRawRef = useRef<{ [k: string]: string }>({});

  function getRaw(key: string) {
    return localStorage.getItem(key) || "";
  }

  function refreshFromStorage() {
    let changed = false;

    const keysToWatch = [
      taskDistributionKey(tenantId),
      SCHOOL_DATA_KEY,
      LOGO_KEY,
      "exam-manager:task-distribution:master-table:v1",
      "exam-manager:task-distribution:all-table:v1",
      "exam-manager:task-distribution:results-table:v1",
    ];

    for (const k of keysToWatch) {
      const raw = getRaw(k);
      if (lastRawRef.current[k] !== raw) {
        lastRawRef.current[k] = raw;
        changed = true;
      }
    }

    if (changed) {
      setRun(loadRun(tenantId));

      const sd = readJson<SchoolData>(SCHOOL_DATA_KEY);
      setSchoolData(
        sd || {
          name: "",
          governorate: "",
          semester: "",
          phone: "",
          address: "",
        }
      );

      const nextLogo = (localStorage.getItem(LOGO_KEY) || "").trim() || DEFAULT_LOGO_URL;
      setLogoUrl(nextLogo);

      // teachers/exams أصبحت من Firestore
      refreshRosterFromFirestore();

      setStorageTick((x) => x + 1);
    }
  }

  useEffect(() => {
    refreshFromStorage();
    refreshRosterFromFirestore();

    const onRunUpdated = (e: any) => {
      const tid = String(e?.detail?.tenantId || "").trim();
      if (!tid || tid === String(tenantId)) refreshFromStorage();
    };

    const onStorage = (e: StorageEvent) => {
      if (!e?.key) return;
      if (
        e.key === taskDistributionKey(tenantId) ||
        e.key === SCHOOL_DATA_KEY ||
        e.key === LOGO_KEY ||
        e.key === "exam-manager:task-distribution:master-table:v1" ||
        e.key === "exam-manager:task-distribution:all-table:v1" ||
        e.key === "exam-manager:task-distribution:results-table:v1"
      ) {
        refreshFromStorage();
      }
    };

    window.addEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshFromStorage);

    const iv = window.setInterval(() => {
      refreshFromStorage();
      // تحديث دوري خفيف لضمان تزامن الطباعة
      refreshRosterFromFirestore();
    }, 2500);

    return () => {
      window.removeEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshFromStorage);
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);

  const reportType = (qs.get("reportType") || (qs.get("teacher") ? "teacher" : "daily")) as "daily" | "teacher";
  const dateISO = normalizeISODate(qs.get("dateISO") || "");
  const teacherNameFilter = (qs.get("teacher") || "").trim();
  const subjectFilter = (qs.get("subject") || "").trim();

  const schoolHeader = useMemo(() => {
    const countryName = "سلطنة عمان";
    const ministryName = "وزارة التعليم";
    const directorateName = schoolData.governorate?.trim() || "المديرية العامة للتعليم";
    const schoolName = schoolData.name?.trim() || "المدرسة";
    const semesterLabel = schoolData.semester?.trim() || "الفصل الدراسي الأول";
    const yearLabel = "2026/2025";
    return { countryName, ministryName, directorateName, schoolName, semesterLabel, yearLabel };
  }, [schoolData]);

  /** -------------------------------------------
   * Exams index
   * ------------------------------------------ */
  const examsIndex = useMemo(() => {
    const map = new Map<string, { dayLabel: string; time: string }>();
    for (const ex of examsList || []) {
      const s = normalizeText(ex?.subject || "");
      const d = normalizeISODate(ex?.dateISO || "");
      const p = normalizePeriodKey(ex?.period || "");
      if (!s || !d || !p) continue;
      const key = `${s}|${d}|${p}`;
      if (!map.has(key)) map.set(key, { dayLabel: (ex?.dayLabel || "").trim(), time: (ex?.time || "").trim() });
    }
    return map;
  }, [examsList]);

  function lookupExamMeta(subject: string, dISO: string, period: string) {
    const key = `${normalizeText(subject)}|${normalizeISODate(dISO)}|${normalizePeriodKey(period)}`;
    return examsIndex.get(key) || null;
  }

  /** -------------------------------------------
   * Teachers index (name -> phone / employeeNo)
   * ------------------------------------------ */
  const teacherPhoneIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers || []) {
      const nameKey = normalizeText(t.fullName || "");
      if (!nameKey) continue;
      const phone = sanitizePhoneToWhatsApp(t.phone || "");
      if (phone) map.set(nameKey, phone);
    }
    return map;
  }, [teachers]);

  const teacherEmployeeIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers || []) {
      const nameKey = normalizeText(t.fullName || "");
      if (!nameKey) continue;
      const emp = String(t.employeeNo || "").trim();
      if (emp) map.set(nameKey, emp);
    }
    return map;
  }, [teachers]);

  function getTeacherWhatsAppPhoneByName(name: string) {
    const key = normalizeText(name || "");
    if (!key) return "";
    return teacherPhoneIndex.get(key) || "";
  }

  function getTeacherEmployeeNoByName(name: string) {
    const key = normalizeText(name || "");
    if (!key) return "";
    return teacherEmployeeIndex.get(key) || "";
  }

  /** -------------------------------------------
   * Load master table
   * ------------------------------------------ */
  const masterTableRows = useMemo<AnyAssignment[]>(() => {
    const m1 = readJson<any>("exam-manager:task-distribution:master-table:v1");
    const m2 = readJson<any>("exam-manager:task-distribution:all-table:v1");
    const m3 = readJson<any>("exam-manager:task-distribution:results-table:v1");

    const payload = m1 || m2 || m3 || null;
    const rows = payload?.rows || payload?.data || null;

    // ✅ مهم: إذا كان "الجدول الشامل" من Run قديم، لا نسمح له أن يطغى على Run الحالي
    const meta = payload?.meta || {};
    const matchesCurrentRun = !run || meta?.runId === run.runId || meta?.runCreatedAtISO === run.createdAtISO;

    if (Array.isArray(rows) && rows.length && matchesCurrentRun) return rows;
    return Array.isArray(run?.assignments) ? (run!.assignments as any[]) : [];
  }, [run, storageTick]);

  /** -------------------------------------------
   * Options
   * ------------------------------------------ */
  const teacherOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of masterTableRows || []) {
      const n = (getTeacherName(r) || "").trim();
      if (!n) continue;
      const k = normalizeText(n);
      if (!set.has(k)) set.set(k, n);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "ar"));
  }, [masterTableRows]);

  const subjectOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of masterTableRows || []) {
      const s = (getExamSubject(r) || "").trim();
      if (!s) continue;
      const n = normalizeText(s);
      if (!set.has(n)) set.set(n, s);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "ar"));
  }, [masterTableRows]);

  /** -------------------------------------------
   * Apply filters
   * ------------------------------------------ */
  const filteredRows = useMemo(() => {
    let rows = [...(masterTableRows || [])];

    if (reportType === "daily" && dateISO) {
      rows = rows.filter((r) => normalizeISODate(getExamDateISO(r)) === dateISO);
    }

    if (reportType === "teacher" && teacherNameFilter) {
      rows = rows.filter((r) => getTeacherName(r).trim() === teacherNameFilter);
    }

    if (subjectFilter) {
      const nSub = normalizeText(subjectFilter);
      rows = rows.filter((r) => normalizeText(getExamSubject(r)) === nSub);
    }

    return rows;
  }, [masterTableRows, reportType, dateISO, teacherNameFilter, subjectFilter]);

  /** -------------------------------------------
   * Header exam info
   * ------------------------------------------ */
  const headerExamInfo = useMemo(() => {
    const r = filteredRows[0] || masterTableRows[0] || null;

    const subject = subjectFilter || (r ? getExamSubject(r) : "");
    const dISO = r ? normalizeISODate(getExamDateISO(r)) : dateISO;
    const period = r ? getExamPeriod(r) : "";

    let dayLabel = r ? getExamDayLabel(r) : "";
    let time = r ? getExamTime(r) : "";

    const meta = lookupExamMeta(subject, dISO, period);
    if (meta) {
      dayLabel = meta.dayLabel || dayLabel;
      time = meta.time || time;
    }

    return { subject, dISO, dayLabel, period, time };
  }, [filteredRows, masterTableRows, dateISO, subjectFilter, examsIndex]);

  /** -------------------------------------------
   * Query helper
   * ------------------------------------------ */
  function setQueryParam(key: string, value: string) {
    const sp = new URLSearchParams(loc.search);
    if (!value) sp.delete(key);
    else sp.set(key, value);
    nav(`${loc.pathname}?${sp.toString()}`, { replace: true });
  }

  function setTeacherSelection(v: string) {
    setQueryParam("reportType", "teacher");
    setQueryParam("teacher", v || "");
  }
  function setReportDaily() {
    setQueryParam("reportType", "daily");
    setQueryParam("teacher", "");
  }
  function setReportTeacher() {
    setQueryParam("reportType", "teacher");
  }

  // ✅ طباعة "التقرير فقط" عبر نافذة مستقلة
  async function openPrintDialog() {
    const el = printAreaRef.current;
    if (!el) return;

    // ✅ Audit: طباعة تقرير التوزيع
    void writeTenantAudit(tenantId, {
      action: "distribution_print_report",
      entity: "task_distribution",
      by: user?.uid || undefined,
      meta: { reportType, teacherNameFilter: teacherNameFilter || null, atISO: new Date().toISOString() },
    }).catch(() => {});
    const safeTitle = (teacherNameFilter || (reportType === "daily" ? "daily" : "report")).trim() || "report";
    await printOnlyElement(el, safeTitle);
  }

  if (!run) {
    return (
      <div style={styles.pageWrapDark}>
        <div style={styles.darkCard}>
          <div style={styles.darkRow}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>طباعة التقرير</div>
              <div style={{ color: "rgba(255,255,255,.75)", marginTop: 4 }}>لا يوجد تشغيل محفوظ بعد</div>
            </div>
            <button style={styles.btnSoft} onClick={() => nav("/task-distribution")}>
              رجوع
            </button>
          </div>
        </div>
      </div>
    );
  }

  const safeRun = run;

  const title =
    reportType === "teacher"
      ? teacherNameFilter
        ? "تقرير معلم (فردي)"
        : "تقرير الكادر التعليمي (الكل)"
      : "كشف يومي (امتحانات)";

  /** -------------------------------------------
   * DAILY groups
   * ------------------------------------------ */
  const dailyInvigilators = useMemo(() => {
    if (reportType !== "daily") return [];
    const rows = filteredRows.filter((r) => getTaskType(r) === "INVIGILATION");
    rows.sort((a, b) => {
      const ra = parseCommitteeNumber(getRoomNumber(a));
      const rb = parseCommitteeNumber(getRoomNumber(b));
      if (ra.num !== rb.num) return ra.num - rb.num;
      if (ra.raw !== rb.raw) return ra.raw.localeCompare(rb.raw, "ar");
      return (getTeacherName(a) || "").localeCompare(getTeacherName(b) || "", "ar");
    });
    return rows;
  }, [filteredRows, reportType]);

  const dailyReserves = useMemo(() => {
    if (reportType !== "daily") return [];
    return filteredRows.filter((r) => getTaskType(r) === "RESERVE");
  }, [filteredRows, reportType]);

  const dailyReviewFree = useMemo(() => {
    if (reportType !== "daily") return [];
    return filteredRows.filter((r) => getTaskType(r) === "REVIEW_FREE");
  }, [filteredRows, reportType]);

  /** -------------------------------------------
   * WhatsApp text
   * ------------------------------------------ */
  const shareText = useMemo(() => {
    const base = `تقرير توزيع المهام - ${schoolHeader.schoolName}\n`;
    const typeLine = `نوع التقرير: ${title}\n`;
    const teacherLine = teacherNameFilter ? `المعلم: ${teacherNameFilter}\n` : "";
    const empLine = teacherNameFilter ? `الرقم الوظيفي: ${getTeacherEmployeeNoByName(teacherNameFilter) || "—"}\n` : "";
    const subjectLine = subjectFilter ? `المادة: ${subjectFilter}\n` : "";
    const dateLine = dateISO ? `التاريخ: ${dateISO}\n` : "";
    return `${base}${typeLine}${teacherLine}${empLine}${subjectLine}${dateLine}تم الإنشاء من النظام.`;
  }, [schoolHeader.schoolName, title, teacherNameFilter, subjectFilter, dateISO, teacherEmployeeIndex]);

  /** -------------------------------------------
   * Teacher pages (all teachers)
   * ------------------------------------------ */
  const allTeachersPages = useMemo(() => {
    if (reportType !== "teacher" || teacherNameFilter) return [];
    const pages = teacherOptions.map((tName) => {
      let rows = masterTableRows.filter((r) => getTeacherName(r).trim() === tName);

      if (subjectFilter) {
        const nSub = normalizeText(subjectFilter);
        rows = rows.filter((r) => normalizeText(getExamSubject(r)) === nSub);
      }

      rows.sort((a, b) => {
        const da = normalizeISODate(getExamDateISO(a));
        const db = normalizeISODate(getExamDateISO(b));
        if (da !== db) return da.localeCompare(db);

        const pa = formatPeriod(getExamPeriod(a));
        const pb = formatPeriod(getExamPeriod(b));
        if (pa !== pb) return pa.localeCompare(pb, "ar");

        return (getExamSubject(a) || "").toString().localeCompare((getExamSubject(b) || "").toString(), "ar");
      });

      return { teacherName: tName, rows };
    });

    return pages.filter((p) => p.rows.length > 0);
  }, [reportType, teacherNameFilter, teacherOptions, masterTableRows, subjectFilter]);

  /** -------------------------------------------
   * Teacher sheet
   * ------------------------------------------ */
  function TeacherSheet(props: { teacherName: string; rows: AnyAssignment[]; pageBreak?: boolean; createdAtISO: string }) {
    const employeeNo = getTeacherEmployeeNoByName(props.teacherName);

    return (
      <div className="print-sheet" style={{ ...styles.sheet, ...(props.pageBreak ? styles.pageBreak : {}) }}>
        <div style={styles.headerGrid}>
          <div style={styles.headerRight}>
            <div style={styles.headerRightLine}>{schoolHeader.countryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.ministryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.directorateName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.schoolName}</div>
          </div>

          <div style={styles.headerCenter}>
            <img src={logoUrl} alt="شعار" style={{ width: 80, height: 80, objectFit: "contain" }} />
          </div>

          <div style={styles.headerLeft}>
            <div style={styles.headerLeftTitle}>تقرير معلم (فردي)</div>
            <div style={styles.headerLeftSub}>{schoolHeader.semesterLabel}</div>
            <div style={styles.headerLeftSub}>العام الدراسي {schoolHeader.yearLabel}</div>
          </div>
        </div>

        <div style={styles.hr} />

        <div style={styles.teacherInfoBox}>
          <div style={styles.teacherInfoRow}>
            <span style={styles.teacherInfoLabel}>اسم المعلم:</span>
            <span style={styles.teacherInfoValue}>{props.teacherName || "—"}</span>
          </div>

          <div style={styles.teacherInfoRow}>
            <span style={styles.teacherInfoLabel}>الرقم الوظيفي:</span>
            <span style={styles.teacherInfoValue}>{employeeNo || "—"}</span>
          </div>
        </div>

        <div style={styles.tableTitleWrap}>
          <div style={styles.tableTitle}>جدول مهام المراقبة والمراجعة والتصحيح</div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 56 }}>م</th>
              <th style={{ ...styles.th, width: 170 }}>اليوم والتاريخ</th>
              <th style={{ ...styles.th, width: 120 }}>الفترة</th>

              {/* ✅ تركنا طبيعة العمل ثابتة */}
              <th style={{ ...styles.th, width: 140 }}>طبيعة العمل</th>

              {/* ✅ FIX: عمود المادة بنفس عرض الفترة */}
              <th style={{ ...styles.th, width: 120 }}>المادة</th>

              <th style={{ ...styles.th, width: 140 }}>رقم اللجنة</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length ? (
              props.rows.map((r, idx) => {
                const sub = getExamSubject(r) || "";
                const dISO = normalizeISODate(getExamDateISO(r)) || "";
                const per = getExamPeriod(r) || "";
                const meta = lookupExamMeta(sub, dISO, per);
                const day = meta?.dayLabel || getExamDayLabel(r) || "—";

                return (
                  <tr key={idx}>
                    <td style={styles.tdNum}>{idx + 1}</td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 900 }}>{day}</div>
                      <div style={{ fontWeight: 800, color: "#334155" }}>{dISO || "—"}</div>
                    </td>
                    <td style={styles.td}>{formatPeriod(per)}</td>
                    <td style={styles.td}>{taskLabel(getTaskType(r))}</td>

                    {/* ✅ المادة بعرض ثابت + لفّ واضح */}
                    <td style={{ ...styles.td, wordBreak: "break-word", overflowWrap: "anywhere" }}>{sub || "—"}</td>

                    <td style={styles.td}>{getRoomNumber(r) || "—"}</td>
                  </tr>
                );
              })
            ) : (
              Array.from({ length: 10 }).map((_, idx) => (
                <tr key={idx}>
                  <td style={styles.tdNum}>{idx + 1}</td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={styles.importantSection}>
          <div style={styles.importantTitle}>تنبيهات هامة:</div>
          <ul style={styles.importantList}>
            <li style={styles.importantLi}>يجب الحضور إلى مقر اللجنة قبل بدء الامتحان بـ 20 دقيقة على الأقل.</li>
            <li style={styles.importantLi}>يرجى الالتزام التام بالتعليمات الواردة في لائحة إدارة الامتحانات.</li>
            <li style={styles.importantLi}>يمنع استخدام الهاتف النقال داخل قاعات الامتحان.</li>
            <li style={styles.importantLi}>في حال وجود عذر طارئ يمنعك من الحضور، يرجى إبلاغ إدارة المدرسة فوراً لتوفير البديل.</li>
          </ul>

          <div style={styles.importantSigRow}>
            <div style={styles.importantSigCol}>
              <div style={styles.importantSigLabel}>توقيع المعلم بالعلم</div>
              <div style={styles.importantSigLine} />
            </div>

            <div style={styles.importantSigCol}>
              <div style={styles.importantSigLabel}>مدير المدرسة</div>
              <div style={styles.importantSigLine} />
            </div>
          </div>
        </div>

        <div style={styles.footerNote}>تم إنشاء التقرير من نظام توزيع مهام المراقبة — {props.createdAtISO}</div>
      </div>
    );
  }

  async function handleWhatsAppClick() {
    const phone = teacherNameFilter ? getTeacherWhatsAppPhoneByName(teacherNameFilter) : "";
    openWhatsAppWindow({ text: shareText, phone: phone || undefined });

    // محاولة تنزيل PNG للتقرير
    window.setTimeout(async () => {
      try {
        const el = printAreaRef.current;
        if (!el) return;
        const safeName = (teacherNameFilter || title || "report").replace(/[\\/:*?"<>|]/g, "_");
        await exportElementToPng(el, `report_${safeName}_${dateISO || "all"}.png`);
      } catch {
        alert("تعذر إنشاء صورة للتقرير (قد يكون بسبب الشعار الخارجي). يمكنك استخدام حفظ PDF من زر الطباعة.");
      }
    }, 250);

    // فتح نافذة الطباعة (تقرير فقط + صفحة واحدة قدر الإمكان)
    window.setTimeout(() => {
      openPrintDialog();
    }, 650);
  }

  return (
    <div style={styles.outer}>
      <style>{printCss}</style>

      {/* TOP ACTION BAR */}
      <div className="no-print" style={styles.topActionBar}>
        <div style={styles.topActionTitle}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>خيارات العرض والطباعة</div>
        </div>

        <div style={styles.topActionBtns}>
          <button
            style={{ ...styles.pillBtn, ...styles.pillAll }}
            onClick={() => {
              setReportTeacher();
              setTeacherSelection("");
            }}
            title="طباعة الكل (كل معلم صفحة)"
          >
            طباعة الكل
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillPrint }} onClick={openPrintDialog} title="طباعة (تقرير فقط)">
            طباعة
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillPdf }} onClick={openPrintDialog} title="PDF (Save as PDF) تقرير فقط">
            PDF
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillWa }} onClick={handleWhatsAppClick} title="واتساب + PNG + PDF">
            واتساب
          </button>
        </div>

        <div style={styles.topActionRight}>
          <select className="td-print-select" value={reportType} onChange={(e) => setQueryParam("reportType", e.target.value)} style={styles.topSelect}>
            <option value="teacher" style={blackGoldDropdownOptionStyle}>تقرير معلم (فردي)</option>
            <option value="daily" style={blackGoldDropdownOptionStyle}>كشف يومي (امتحانات)</option>
          </select>
        </div>
      </div>

      {/* Filters row */}
      <div className="no-print" style={styles.filtersRow1to1}>
        <div style={styles.filtersGrid}>
          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>المعلم</div>
            <select className="td-print-select" value={teacherNameFilter} onChange={(e) => setTeacherSelection(e.target.value)} style={styles.filterSelect}>
              <option value="" style={blackGoldDropdownOptionStyle}>— اختر المعلم — (فارغ = طباعة الكل)</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t} style={blackGoldDropdownOptionStyle}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>المادة</div>
            <select className="td-print-select" value={subjectFilter} onChange={(e) => setQueryParam("subject", e.target.value)} style={styles.filterSelect}>
              <option value="" style={blackGoldDropdownOptionStyle}>— كل المواد —</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s} style={blackGoldDropdownOptionStyle}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>سريع</div>
            <button style={styles.quickBtn} onClick={setReportDaily}>
              عرض الكشف اليومي
            </button>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>تنقل</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button style={styles.quickBtnSoft} onClick={() => nav("/task-distribution/results")}>
                النتائج
              </button>
              <button style={styles.quickBtnSoft} onClick={() => nav("/task-distribution")}>
                الرئيسية
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ PRINT AREA: هذا هو التقرير */}
      <div id="print-area" ref={printAreaRef}>
        {/* DAILY REPORT */}
        {reportType === "daily" && (
          <div className="print-sheet print-daily" style={styles.sheet}>
            <div style={styles.headerGrid}>
              <div style={styles.headerRight}>
                <div style={styles.headerRightLine}>{schoolHeader.countryName}</div>
                <div style={styles.headerRightLine}>{schoolHeader.ministryName}</div>
                <div style={styles.headerRightLine}>{schoolHeader.directorateName}</div>
                <div style={styles.headerRightLine}>{schoolHeader.schoolName}</div>
              </div>

              <div style={styles.headerCenter}>
                <img src={logoUrl} alt="شعار" style={{ width: 80, height: 80, objectFit: "contain" }} />
              </div>

              <div style={styles.headerLeft}>
                <div style={styles.headerLeftTitle}>كشف مراقبة امتحان</div>
                <div style={styles.headerLeftSub}>{schoolHeader.semesterLabel}</div>
                <div style={styles.headerLeftSub}>العام الدراسي {schoolHeader.yearLabel}</div>
              </div>
            </div>

            <div style={styles.hr} />

            <div style={styles.examBarWide}>
              <div style={styles.examBarWideInner}>
                <div style={styles.examBarWideItem}>
                  <span style={styles.examLabel}>الفترة:</span> <span style={styles.examValue}>{formatPeriod(headerExamInfo.period)}</span>
                </div>
                <div style={styles.examBarWideSep}>|</div>

                <div style={styles.examBarWideItem}>
                  <span style={styles.examLabel}>اليوم:</span> <span style={styles.examValue}>{headerExamInfo.dayLabel || "—"}</span>
                </div>
                <div style={styles.examBarWideSep}>|</div>

                <div style={styles.examBarWideItem}>
                  <span style={styles.examLabel}>الوقت:</span> <span style={styles.examValue}>{headerExamInfo.time || "—"}</span>
                </div>

                <div style={styles.examBarWideItem}>
                  <span style={styles.examLabel}>المادة:</span> <span style={styles.examValue}>{headerExamInfo.subject || "—"}</span>
                </div>

                <div style={styles.examBarWideItem}>
                  <span style={styles.examLabel}>التاريخ:</span> <span style={styles.examValue}>{headerExamInfo.dISO || "—"}</span>
                </div>
              </div>
            </div>

            <div style={styles.chipRow}>
              <div style={styles.chip}>كشف بأسماء المراقبين</div>
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 56, textAlign: "center" }}>م</th>
                  <th style={{ ...styles.th }}>اسم المراقب</th>
                  <th style={{ ...styles.th, width: 140 }}>رقم اللجنة</th>
                  <th style={{ ...styles.th, width: 140 }}>التوقيع</th>
                </tr>
              </thead>
              <tbody>
                {dailyInvigilators.length ? (
                  dailyInvigilators.map((r, idx) => (
                    <tr key={idx}>
                      <td style={styles.tdNum}>{idx + 1}</td>
                      <td style={styles.td}>{getTeacherName(r) || "—"}</td>
                      <td style={styles.td}>{getRoomNumber(r) || "—"}</td>
                      <td style={styles.td}></td>
                    </tr>
                  ))
                ) : (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i}>
                      <td style={styles.tdNum}>{i + 1}</td>
                      <td style={styles.td}></td>
                      <td style={styles.td}></td>
                      <td style={styles.td}></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={styles.reserveBlock}>
              <div style={styles.reserveTitle}>المراقبون الاحتياط</div>
              <table style={styles.reserveTable}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 56, textAlign: "center" }}>م</th>
                    <th style={{ ...styles.th }}>اسم المراقب الاحتياط</th>
                    <th style={{ ...styles.th, width: 200 }}>التوقيع</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReserves.length ? (
                    dailyReserves.map((r, idx) => (
                      <tr key={idx}>
                        <td style={styles.tdNum}>{idx + 1}</td>
                        <td style={{ ...styles.td, fontWeight: 900 }}>{getTeacherName(r) || "—"}</td>
                        <td style={styles.td}></td>
                      </tr>
                    ))
                  ) : (
                    Array.from({ length: 2 }).map((_, i) => (
                      <tr key={i}>
                        <td style={styles.tdNum}>{i + 1}</td>
                        <td style={styles.td}></td>
                        <td style={styles.td}></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={{ marginTop: 14 }}>
                <div style={styles.reserveTitle}>المعلمون الفارغون للمراجعة</div>
                <table style={styles.reserveTable}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: 56, textAlign: "center" }}>م</th>
                      <th style={{ ...styles.th }}>اسم المعلم</th>
                      <th style={{ ...styles.th, width: 200 }}>التوقيع</th>
                      <th style={{ ...styles.th, width: 220 }}>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyReviewFree.length ? (
                      dailyReviewFree.map((r, idx) => (
                        <tr key={idx}>
                          <td style={styles.tdNum}>{idx + 1}</td>
                          <td style={{ ...styles.td, fontWeight: 900 }}>{getTeacherName(r) || "—"}</td>
                          <td style={styles.td}></td>
                          <td style={styles.td}>فارغ للمراجعة</td>
                        </tr>
                      ))
                    ) : (
                      Array.from({ length: 1 }).map((_, i) => (
                        <tr key={i}>
                          <td style={styles.tdNum}>{i + 1}</td>
                          <td style={styles.td}></td>
                          <td style={styles.td}></td>
                          <td style={styles.td}>فارغ للمراجعة</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={styles.bottomSigRow}>
              <div style={styles.bottomSigCell}>رئيس الكنترول</div>
              <div style={styles.bottomSigCell}>مدير المدرسة</div>
            </div>

            <div style={styles.footerNote}>تم إنشاء التقرير من نظام توزيع مهام المراقبة — {safeRun.createdAtISO || ""}</div>
          </div>
        )}

        {/* TEACHER REPORT */}
        {reportType === "teacher" && (
          <>
            {!teacherNameFilter &&
              (allTeachersPages.length ? (
                allTeachersPages.map((p, i) => (
                  <TeacherSheet
                    key={p.teacherName}
                    teacherName={p.teacherName}
                    rows={p.rows}
                    pageBreak={i < allTeachersPages.length - 1}
                    createdAtISO={safeRun.createdAtISO || ""}
                  />
                ))
              ) : (
                <div className="print-sheet" style={styles.sheet}>
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>لا توجد بيانات لتقرير الكادر التعليمي.</div>
                </div>
              ))}

            {teacherNameFilter && (
              <TeacherSheet
                teacherName={teacherNameFilter}
                rows={[...filteredRows].sort((a, b) =>
                  normalizeISODate(getExamDateISO(a)).localeCompare(normalizeISODate(getExamDateISO(b)))
                )}
                createdAtISO={safeRun.createdAtISO || ""}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** -------------------------------------------
 * Styles
 * ------------------------------------------ */
const styles: Record<string, React.CSSProperties> = {
  outer: {
    minHeight: "100vh",
    background: "#0b1220",
    padding: 18,
    direction: "rtl",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif',
  },

  topActionBar: {
    maxWidth: 1180,
    margin: "0 auto 12px auto",
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,.22)",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  topActionTitle: { display: "flex", alignItems: "center", gap: 10 },
  topActionBtns: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  topActionRight: { display: "flex", alignItems: "center", gap: 10 },
  topSelect: {
    borderRadius: 14,
    border: "1px solid rgba(255,215,0,0.58)",
    padding: "10px 12px",
    fontWeight: 900,
    background: "#000000",
    backgroundColor: "#000000",
    color: "#FFD700",
    WebkitTextFillColor: "#FFD700",
    caretColor: "#FFD700",
    colorScheme: "dark",
    outline: "none",
    minWidth: 190,
    boxShadow: "0 0 0 1px rgba(255,215,0,0.08) inset",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },

  pillBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, .10)",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(0,0,0,.10)",
  },
  pillAll: { background: "#f3e8ff", color: "#6b21a8" },
  pillPrint: { background: "#2563eb", color: "#fff" },
  pillPdf: { background: "#ef4444", color: "#fff" },
  pillWa: { background: "#22c55e", color: "#fff" },

  filtersRow1to1: { maxWidth: 1180, margin: "0 auto 14px auto" },
  filtersGrid: {
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,.22)",
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr .8fr 1fr",
    gap: 12,
    alignItems: "end",
  },
  filterBox: { border: "1px solid #e5e7eb", borderRadius: 16, padding: "10px 10px", background: "#f8fafc" },
  filterBoxLabel: { fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 },
  filterSelect: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,215,0,0.58)",
    background: "#000000",
    backgroundColor: "#000000",
    color: "#FFD700",
    WebkitTextFillColor: "#FFD700",
    caretColor: "#FFD700",
    colorScheme: "dark",
    fontWeight: 900,
    outline: "none",
    boxShadow: "0 0 0 1px rgba(255,215,0,0.08) inset",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  quickBtn: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#0f172a",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  quickBtnSoft: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  // شاشة البرنامج (عادي)
  sheet: {
    width: "210mm",
    minHeight: "297mm",
    background: "white",
    margin: "0 auto",
    borderRadius: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,.35)",
    padding: "14mm 12mm",
    color: "#111",
    position: "relative",
  },
  pageBreak: { pageBreakAfter: "always", breakAfter: "page" },

  headerGrid: { display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 10, alignItems: "center" },
  headerLeft: { textAlign: "left", lineHeight: 1.25 },
  headerLeftTitle: {
    fontSize: 18,
    fontWeight: 900,
    borderBottom: "2px solid #111",
    display: "inline-block",
    paddingBottom: 4,
    marginBottom: 6,
  },
  headerLeftSub: { fontSize: 14, fontWeight: 800, marginTop: 2 },
  headerCenter: { display: "flex", justifyContent: "center", alignItems: "center" },
  headerRight: { textAlign: "right", lineHeight: 1.3 },
  headerRightLine: { fontSize: 14, fontWeight: 800 },

  hr: { height: 2, background: "#111", opacity: 0.85, margin: "10px 0 12px 0" },

  // شريط بيانات الامتحان (نموذج 1)
  examBarWide: { border: "3px solid #111", borderRadius: 12, padding: "10px 12px", marginBottom: 10 },
  examBarWideInner: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    fontSize: 14,
    fontWeight: 900,
  },
  examBarWideItem: { whiteSpace: "nowrap" },
  examBarWideSep: { color: "#111", opacity: 0.9, fontWeight: 900 },

  examLabel: { fontWeight: 900 },
  examValue: { fontWeight: 900 },

  chipRow: { display: "flex", justifyContent: "flex-end", marginBottom: 6 },
  chip: {
    border: "2px solid #111",
    borderBottom: "0",
    padding: "8px 14px",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    background: "#f3f4f6",
    fontWeight: 900,
    fontSize: 18,
  },

  teacherInfoBox: { border: "2px solid #111", borderRadius: 10, padding: "10px 12px", marginBottom: 12 },
  teacherInfoRow: { display: "flex", gap: 10, justifyContent: "flex-start", alignItems: "center", padding: "4px 0" },
  teacherInfoLabel: { fontWeight: 900 },
  teacherInfoValue: { fontWeight: 800 },

  tableTitleWrap: { marginTop: 8, display: "flex", justifyContent: "flex-end" },
  tableTitle: {
    border: "2px solid #111",
    borderBottom: "0",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    background: "#f3f4f6",
  },

  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "2px solid #111" },
  th: { background: "#f3f4f6", border: "1px solid #111", padding: "10px 8px", fontSize: 14, fontWeight: 900, textAlign: "right" },
  td: { border: "1px solid #111", padding: "10px 8px", fontSize: 14, verticalAlign: "middle", height: 38 },
  tdNum: {
    border: "1px solid #111",
    padding: "10px 8px",
    fontSize: 14,
    verticalAlign: "middle",
    textAlign: "center",
    height: 38,
    color: "#475569",
    fontWeight: 900,
  },

  reserveBlock: { marginTop: 18 },
  reserveTitle: { display: "inline-block", border: "1px solid #111", background: "#f3f4f6", padding: "8px 12px", fontWeight: 900, marginBottom: 0 },
  reserveTable: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "2px solid #111" },

  bottomSigRow: { marginTop: 26, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 20 },
  bottomSigCell: { width: "45%", textAlign: "center" },

  importantSection: { marginTop: 18, paddingTop: 6 },
  importantTitle: { fontSize: 14, fontWeight: 900, marginBottom: 8, textAlign: "right" },
  importantList: { margin: 0, paddingRight: 18, paddingLeft: 0, fontSize: 12.5, lineHeight: 1.85 },
  importantLi: { marginBottom: 4 },
  importantSigRow: { marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 },
  importantSigCol: { width: "45%", textAlign: "center" },
  importantSigLabel: { fontSize: 13, fontWeight: 900, marginBottom: 10 },
  importantSigLine: { height: 0, borderBottom: "2px dotted #111", width: "100%" },

  footerNote: { marginTop: 10, fontSize: 11, color: "#64748b", fontWeight: 700, textAlign: "center" },

  pageWrapDark: { minHeight: "100vh", background: "#0b1220", padding: 18, direction: "rtl", fontFamily: 'system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif' },
  darkCard: { maxWidth: 900, margin: "0 auto", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 16 },
  darkRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  btnSoft: { background: "rgba(255,255,255,.10)", color: "white", border: "1px solid rgba(255,255,255,.18)", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 800 },
};

/** ✅ إبقاء CSS داخل الصفحة فقط — الطباعة الفعلية تتم عبر نافذة جديدة */
const blackGoldDropdownOptionStyle = { background: "#000000", color: "#FFD700" } as const;

const printCss = `
.td-print-select,
.td-print-select:focus,
.td-print-select:active,
.td-print-select:hover {
  background: #000000 !important;
  background-color: #000000 !important;
  color: #FFD700 !important;
  -webkit-text-fill-color: #FFD700 !important;
  border: 1px solid rgba(255,215,0,0.58) !important;
  caret-color: #FFD700 !important;
  color-scheme: dark;
  opacity: 1 !important;
}

.td-print-select option,
.td-print-select optgroup {
  background: #000000 !important;
  background-color: #000000 !important;
  color: #FFD700 !important;
  -webkit-text-fill-color: #FFD700 !important;
}

@media print {
  /* لا نعتمد على إخفاء القوائم هنا */
}
`;
