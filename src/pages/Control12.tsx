import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { db } from "../firebase/firebase";
import { tenantPath } from "../config/tenantRoutes";

type ControlMember = {
  id: string;
  name: string;
  employeeNo: string;
  specialization: string;
  assignment: string;
  phone: string;
  signature: string;
};

type ControlReportType =
  | "control_open"
  | "control_close"
  | "envelope_open"
  | "answer_sheets_receive"
  | "student_cheating"
  | "student_absence"
  | "teacher_absence";

type ControlReport = {
  id: string;
  type: ControlReportType;
  reportDate: string;
  dayName: string;
  reportTime: string;
  subject?: string;
  envelopesCount?: string;
  papersCount?: string;
  studentName?: string;
  studentSeatNo?: string;
  studentGrade?: string;
  teacherName?: string;
  notes?: string;
  members: Array<{
    memberId: string;
    name: string;
    employeeNo: string;
    specialization: string;
    signature: string;
  }>;
};

type SchoolConfig = {
  schoolNameAr?: string;
  schoolNameEn?: string;
  regionAr?: string;
  regionEn?: string;
  ministryAr?: string;
  ministryEn?: string;
  wilayatAr?: string;
  wilayatEn?: string;
  logoUrl?: string;
};

type Lang = "ar" | "en";

type OfficialControlHeaderData = {
  country: string;
  ministry: string;
  directorate: string;
  centerName: string;
  semester: string;
  academicYear: string;
  controlHeadName: string;
  logoUrl: string;
};

const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const APP_LOGO_KEY = "exam-manager:app-logo";
const CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";

const maskEmailForControlAccess = (email: string) => {
  const safe = String(email || "").trim();
  const [name, domain] = safe.split("@");
  if (!name || !domain) return safe ? "****" : "";
  if (name.length <= 2) return `${name.charAt(0)}***@${domain}`;
  return `${name.charAt(0)}${"*".repeat(Math.max(3, name.length - 2))}${name.charAt(name.length - 1)}@${domain}`;
};

const normalizeControlAccessCode = (value: string) => String(value || "").replace(/\D/g, "").slice(0, 6);
const normalizeControlAccessEmail = (value: string) => String(value || "").trim().toLowerCase();
const CONTROL12_ACCESS_LOCK_MINUTES = 5;
const CONTROL12_ACCESS_WORKER_URL = getAccessWorkerUrl();
const CONTROL12_ACCESS_SESSION_DURATION_MS = 10 * 60 * 1000;

const getControl12WorkerErrorMessage = (data: any, fallback: string) => {
  const error = String(data?.error || "");

  if (error === "UNAUTHORIZED") return "Session expired. Please sign in again.";
  if (error === "INVALID_CODE") return "Invalid access code.";
  if (error === "CODE_EXPIRED_OR_NOT_FOUND") return "The access code expired or was not found.";
  if (error === "TOO_MANY_ATTEMPTS") return "Too many failed attempts. Please request a new code.";
  if (error === "VALID_6_DIGIT_CODE_REQUIRED") return "Enter a valid 6-digit code.";
  if (error === "VALID_TO_EMAIL_REQUIRED") return "Invalid email address.";
  if (error === "TENANT_ID_REQUIRED") return "Tenant ID is missing.";
  if (error === "PAGE_NOT_ALLOWED") return "This page is not allowed to request an access code.";
  if (error === "RESEND_SEND_FAILED") return "Failed to send the access code email.";

  return String(data?.message || fallback);
};

const callControl12AccessWorker = async (
  endpoint: "/api/teachers12/request-code" | "/api/teachers12/verify-code",
  firebaseUser: any,
  payload: Record<string, unknown>,
) => {
  const token = await firebaseUser?.getIdToken?.();

  if (!token) {
    throw new Error("Unable to get the sign-in session. Please sign in again.");
  }

  const response = await fetch(`${CONTROL12_ACCESS_WORKER_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    const error: any = new Error(
      getControl12WorkerErrorMessage(
        data,
        endpoint.includes("verify-code")
          ? "Invalid or expired access code."
          : "Failed to send the access code email.",
      )
    );

    error.code = data?.error || `HTTP_${response.status}`;
    error.details = data;
    throw error;
  }

  return data;
};

const getControl12AccessLockStorageKey = (tenantId: string) =>
  `exam-manager:control12-email-code-lock-until:${tenantId || "default"}`;

const formatControl12AccessCountdown = (totalSeconds: number) => {
  const safe = Math.max(0, Math.ceil(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getControl12AccessLockFromError = (error: any) => {
  const details = error?.details || error?.customData?.details || {};
  const candidate =
    details?.lockedUntilISO ||
    details?.lockedUntil ||
    details?.retryAtISO ||
    details?.lockUntilISO ||
    error?.lockedUntilISO ||
    "";

  const directMs = candidate ? Date.parse(String(candidate)) : NaN;
  if (Number.isFinite(directMs) && directMs > Date.now()) return directMs;

  const retryAfterSecondsRaw =
    details?.retryAfterSeconds ??
    details?.retryAfter ??
    error?.retryAfterSeconds ??
    error?.retryAfter;

  const retryAfterSeconds = Number(retryAfterSecondsRaw);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Date.now() + retryAfterSeconds * 1000;
  }

  const message = String(error?.message || "");
  const code = String(error?.code || "");
  if (
    code.includes("resource-exhausted") ||
    message.includes("resource-exhausted") ||
    message.includes("تجاوز عدد محاولات") ||
    message.includes("too many") ||
    message.includes("Too many")
  ) {
    return Date.now() + CONTROL12_ACCESS_LOCK_MINUTES * 60 * 1000;
  }

  return 0;
};


const PAGE_BG =
  "radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%), linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%)";

const GOLD = "#d4af37";
const GOLD_DARK = "#8b6f12";
const BLACK = "#000000";

const REPORT_TYPE_BUTTON_STYLES = [
  { idle: "#fde68a", active: "#f59e0b", border: "#b45309" },
  { idle: "#bfdbfe", active: "#60a5fa", border: "#1d4ed8" },
  { idle: "#fecaca", active: "#f87171", border: "#b91c1c" },
  { idle: "#bbf7d0", active: "#4ade80", border: "#15803d" },
  { idle: "#e9d5ff", active: "#c084fc", border: "#7e22ce" },
  { idle: "#fed7aa", active: "#fb923c", border: "#c2410c" },
  { idle: "#c7d2fe", active: "#818cf8", border: "#3730a3" },
];
const GOLD_SHINE = "linear-gradient(135deg, #fff4b0 0%, #d4af37 35%, #fff8cf 55%, #b8860b 100%)";

const LIGHT_CARD_BACKGROUNDS = [
  "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
  "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
  "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
  "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
];

const reportTypeOptions: Array<{ value: ControlReportType; ar: string; en: string }> = [
  { value: "control_open", ar: "تقرير محضر فتح الكنترول", en: "Control opening minutes" },
  { value: "control_close", ar: "تقرير محضر غلق الكنترول", en: "Control closing minutes" },
  { value: "envelope_open", ar: "تقرير محضر فتح المظاريف الامتحانية", en: "Exam envelope opening minutes" },
  { value: "answer_sheets_receive", ar: "تقرير محضر استلام المظاريف وأوراق الإجابة", en: "Answer sheets receiving minutes" },
  { value: "student_cheating", ar: "محضر غش طالب", en: "Student cheating report" },
  { value: "student_absence", ar: "محضر غياب طالب", en: "Student absence report" },
  { value: "teacher_absence", ar: "محضر غياب معلم", en: "Teacher absence report" },
];

const toDayName = (dateValue: string, lang: "ar" | "en") => {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
  }).format(date);
};

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
};

const safeReadJson = <T,>(key: string): T | null => {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
};

const sortControlMembersByName = (list: ControlMember[]) =>
  [...list].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "ar", { sensitivity: "base" }),
  );

const getAcademicYearFromSystemDate = (now = new Date()) => {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear} / ${startYear + 1}`;
};

const normalizeDirectorate = (value: string, lang: Lang) => {
  const text = firstText(value);
  if (!text) return lang === "ar" ? "المديرية العامة للتعليم" : "Directorate General of Education";
  if (lang === "ar" && text.includes("المديرية")) return text;
  if (lang === "en" && /directorate/i.test(text)) return text;
  return lang === "ar" ? `المديرية العامة للتعليم بمحافظة ${text}` : `Directorate General of Education in ${text}`;
};

const buildOfficialControlHeaderData = (schoolConfig: SchoolConfig, lang: Lang): OfficialControlHeaderData => {
  const centerPayload = safeReadJson<Record<string, any>>(EXAM_CENTER_DATA_KEY) || {};
  const country = firstText(
    centerPayload.country,
    centerPayload.countryName,
    centerPayload.sultanate,
    lang === "ar" ? "سلطنة عمان" : "Sultanate of Oman",
  );
  const ministry = firstText(
    centerPayload.ministry,
    centerPayload.ministryName,
    centerPayload.educationMinistry,
    lang === "ar" ? schoolConfig.ministryAr : schoolConfig.ministryEn,
    schoolConfig.ministryAr,
    schoolConfig.ministryEn,
    lang === "ar" ? "وزارة التعليم" : "Ministry of Education",
  );
  const rawDirectorate = firstText(
    centerPayload.governorate,
    centerPayload.directorate,
    centerPayload.directorateName,
    centerPayload.educationDirectorate,
    centerPayload.generalDirectorate,
    lang === "ar" ? schoolConfig.regionAr : schoolConfig.regionEn,
    schoolConfig.regionAr,
    schoolConfig.regionEn,
  );
  const centerName = firstText(
    centerPayload.name,
    centerPayload.centerName,
    centerPayload.examCenterName,
    centerPayload.controlCenterName,
    centerPayload.schoolName,
    lang === "ar" ? schoolConfig.schoolNameAr : schoolConfig.schoolNameEn,
    schoolConfig.schoolNameAr,
    schoolConfig.schoolNameEn,
    lang === "ar" ? "مركز امتحان دبلوم التعليم العام" : "General Education Diploma Exam Center",
  );
  const semester = firstText(
    centerPayload.semester,
    centerPayload.term,
    centerPayload.studyTerm,
    (schoolConfig as any).termAr,
    (schoolConfig as any).semesterAr,
    (schoolConfig as any).studyTermAr,
    (schoolConfig as any).termEn,
    (schoolConfig as any).semesterEn,
    (schoolConfig as any).studyTermEn,
    lang === "ar" ? "الفصل الدراسي" : "Academic term",
  );
  const academicYear = firstText(
    centerPayload.academicYear,
    centerPayload.yearLabel,
    centerPayload.schoolYear,
    centerPayload.studyYear,
    centerPayload.academicYearLabel,
    getAcademicYearFromSystemDate(),
  );
  const controlHeadName = firstText(
    centerPayload.controlHeadName,
    centerPayload.controlHead,
    centerPayload.centerHead,
    centerPayload.centerHeadName,
    typeof window !== "undefined" ? window.localStorage.getItem(CONTROL_HEAD_NAME_KEY) : "",
  );
  const logoUrl = firstText(
    typeof window !== "undefined" ? window.localStorage.getItem(EXAM_CENTER_LOGO_KEY) : "",
    typeof window !== "undefined" ? window.localStorage.getItem(APP_LOGO_KEY) : "",
    schoolConfig.logoUrl,
    DEFAULT_LOGO_URL,
  );

  return {
    country,
    ministry,
    directorate: normalizeDirectorate(rawDirectorate, lang),
    centerName,
    semester,
    academicYear,
    controlHeadName,
    logoUrl,
  };
};

export default function SchoolControl() {
  const navigate = useNavigate();
  const authContext = useAuth() as any;
  const { effectiveTenantId, user, loading: authLoading } = authContext;
  const { tenantId: routeTenantId } = useParams();
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const tenantId = String(routeTenantId || effectiveTenantId || "").trim();

  const goToTenantRoute = (route: string) => {
    const safeTenantId = encodeURIComponent(String(tenantId || "").trim());
    const cleanRoute = String(route || "").replace(/^\/+/, "");
    if (!safeTenantId || !cleanRoute) return;

    const targetPath = `/t/${safeTenantId}/${cleanRoute}`;

    // يفتح النموذج داخل نفس صفحة البرنامج، وليس في تبويب خارجي.
    navigate(targetPath);
  };

  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>({});
  const [officialDataVersion, setOfficialDataVersion] = useState(0);
  const [members, setMembers] = useState<ControlMember[]>([]);
  const [reports, setReports] = useState<ControlReport[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [printingId, setPrintingId] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [memberForm, setMemberForm] = useState({
    id: "",
    name: "",
    employeeNo: "",
    specialization: "",
    assignment: "",
    phone: "",
    signature: "",
  });

  const [reportForm, setReportForm] = useState({
    type: "control_open" as ControlReportType,
    reportDate: "",
    dayName: "",
    reportTime: "",
    subject: "",
    envelopesCount: "",
    papersCount: "",
    studentName: "",
    studentSeatNo: "",
    studentGrade: "",
    teacherName: "",
    notes: "",
    memberIds: ["", "", ""],
  });

  const [controlAccessEmail, setControlAccessEmail] = useState("");
  const [controlAccessEmailConfirmed, setControlAccessEmailConfirmed] = useState(false);
  const [controlAccessCodeSent, setControlAccessCodeSent] = useState(false);
  const [controlAccessCode, setControlAccessCode] = useState("");
  const [controlAccessBusy, setControlAccessBusy] = useState(false);
  const [controlAccessMessage, setControlAccessMessage] = useState("");
  const [controlAccessError, setControlAccessError] = useState("");
  const [controlAccessVerified, setControlAccessVerified] = useState(false);
  const [controlAccessLockedUntilMs, setControlAccessLockedUntilMs] = useState(0);
  const [controlAccessLockRemainingSeconds, setControlAccessLockRemainingSeconds] = useState(0);

  const currentUserEmail = useMemo(
    () => String(user?.email || authContext?.profile?.email || authContext?.userProfile?.email || "").trim(),
    [user?.email, authContext?.profile?.email, authContext?.userProfile?.email]
  );
  const maskedCurrentUserEmail = useMemo(() => maskEmailForControlAccess(currentUserEmail), [currentUserEmail]);
  const controlAccessSessionKey = useMemo(() => "exam-manager:c12-email-code-access:" + tenantId, [tenantId]);
  const controlAccessLockStorageKey = useMemo(() => getControl12AccessLockStorageKey(tenantId), [tenantId]);

  useEffect(() => {
    let hasValidControlAccessSession = false;

    if (typeof window !== "undefined") {
      try {
        const rawAccessSession = window.localStorage.getItem(controlAccessSessionKey) || "";
        const nowMs = Date.now();

        if (rawAccessSession) {
          const parsedAccessSession = JSON.parse(rawAccessSession) as { expiresAt?: number };
          const expiresAt = Number(parsedAccessSession?.expiresAt || 0);

          if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
            hasValidControlAccessSession = true;
          } else {
            window.localStorage.removeItem(controlAccessSessionKey);
          }
        }
      } catch {
        window.localStorage.removeItem(controlAccessSessionKey);
      }
    }

    setControlAccessVerified(hasValidControlAccessSession);
    setControlAccessEmail("");
    setControlAccessEmailConfirmed(false);
    setControlAccessCodeSent(false);
    setControlAccessCode("");
    setControlAccessBusy(false);
    setControlAccessMessage("");
    setControlAccessError("");

    if (typeof window === "undefined") return;
    const storedLockMs = Number(window.localStorage.getItem(controlAccessLockStorageKey) || "0");
    if (Number.isFinite(storedLockMs) && storedLockMs > Date.now()) {
      setControlAccessLockedUntilMs(storedLockMs);
      setControlAccessLockRemainingSeconds(Math.ceil((storedLockMs - Date.now()) / 1000));
    } else {
      window.localStorage.removeItem(controlAccessLockStorageKey);
      setControlAccessLockedUntilMs(0);
      setControlAccessLockRemainingSeconds(0);
    }
  }, [controlAccessSessionKey, tenantId, controlAccessLockStorageKey]);

  useEffect(() => {
    if (!controlAccessLockedUntilMs) {
      setControlAccessLockRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.ceil((controlAccessLockedUntilMs - Date.now()) / 1000);
      if (remaining <= 0) {
        setControlAccessLockedUntilMs(0);
        setControlAccessLockRemainingSeconds(0);
        setControlAccessError("");
        setControlAccessMessage("");
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(controlAccessLockStorageKey);
        }
        return;
      }
      setControlAccessLockRemainingSeconds(remaining);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [controlAccessLockedUntilMs, controlAccessLockStorageKey]);

  const applyControlAccessLock = (lockedUntilMs: number) => {
    if (!lockedUntilMs || lockedUntilMs <= Date.now()) return;

    setControlAccessLockedUntilMs(lockedUntilMs);
    setControlAccessLockRemainingSeconds(Math.ceil((lockedUntilMs - Date.now()) / 1000));
    setControlAccessEmailConfirmed(false);
    setControlAccessCodeSent(false);
    setControlAccessCode("");
    setControlAccessBusy(false);
    setControlAccessMessage("");
    setControlAccessError(
      tr(
        "تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد انتهاء العد التنازلي.",
        "Too many failed verification attempts. You can request a new code after the countdown ends."
      )
    );

    if (typeof window !== "undefined") {
      window.localStorage.setItem(controlAccessLockStorageKey, String(lockedUntilMs));
    }
  };

  const sendControlAccessCode = async () => {
    if (controlAccessLockedUntilMs && controlAccessLockedUntilMs > Date.now()) {
      setControlAccessError(
        tr(
          "تم تجاوز عدد محاولات التحقق. لا يمكن طلب رمز جديد حتى انتهاء العد التنازلي.",
          "Too many failed verification attempts. You cannot request a new code until the countdown ends."
        )
      );
      return;
    }

    if (!tenantId) {
      setControlAccessError(tr("معرف المركز غير متوفر.", "Center ID is missing."));
      return;
    }

    const expectedEmail = normalizeControlAccessEmail(currentUserEmail);
    const enteredEmail = normalizeControlAccessEmail(controlAccessEmail);

    if (!expectedEmail) {
      setControlAccessEmailConfirmed(false);
      setControlAccessError(tr("البريد الإلكتروني المسجل للحساب غير متوفر.", "The account email is unavailable."));
      return;
    }

    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setControlAccessEmailConfirmed(false);
      setControlAccessCodeSent(false);
      setControlAccessCode("");
      setControlAccessError(tr("البريد الإلكتروني غير مطابق للحساب الحالي. لن يتم إرسال رمز الدخول.", "The email does not match the current account. The access code will not be sent."));
      return;
    }

    setControlAccessEmailConfirmed(true);
    setControlAccessBusy(true);
    setControlAccessError("");
    setControlAccessMessage("");

    try {      const data = await callControl12AccessWorker("/api/teachers12/request-code", user, {
        tenantId,
        page: "Control12",
        to: expectedEmail,
      });
      if (typeof window !== "undefined") window.localStorage.removeItem(controlAccessLockStorageKey);
      setControlAccessLockedUntilMs(0);
      setControlAccessLockRemainingSeconds(0);
      setControlAccessCodeSent(true);
      setControlAccessMessage(data?.message || tr("تم إرسال رمز الدخول إلى البريد الإلكتروني المسجل للحساب.", "The access code was sent to the account email."));
    } catch (error: any) {
      console.error("sendControlAccessCode failed:", error);
      const lockedUntilMs = getControl12AccessLockFromError(error);
      if (lockedUntilMs) applyControlAccessLock(lockedUntilMs);
      else setControlAccessError(error?.message || tr("تعذر إرسال رمز الدخول إلى البريد الإلكتروني.", "Failed to send the access code."));
    } finally {
      setControlAccessBusy(false);
    }
  };

  const verifyControlAccessCode = async () => {
    if (controlAccessLockedUntilMs && controlAccessLockedUntilMs > Date.now()) {
      setControlAccessError(tr("تم تجاوز عدد محاولات التحقق. انتظر انتهاء العد التنازلي.", "Too many failed verification attempts. Wait until the countdown ends."));
      return;
    }

    const code = normalizeControlAccessCode(controlAccessCode);
    if (code.length !== 6) {
      setControlAccessError(tr("أدخل رمزًا مكونًا من 6 أرقام.", "Enter a 6-digit code."));
      return;
    }

    setControlAccessBusy(true);
    setControlAccessError("");
    setControlAccessMessage("");

    try {      const expectedEmail = normalizeControlAccessEmail(currentUserEmail);
      if (!expectedEmail) {
        throw new Error("The account email is unavailable.");
      }

      await callControl12AccessWorker("/api/teachers12/verify-code", user, {
        tenantId,
        page: "Control12",
        to: expectedEmail,
        code,
      });
      if (typeof window !== "undefined") window.localStorage.removeItem(controlAccessLockStorageKey);
      setControlAccessLockedUntilMs(0);
      setControlAccessLockRemainingSeconds(0);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          controlAccessSessionKey,
          JSON.stringify({ expiresAt: Date.now() + CONTROL12_ACCESS_SESSION_DURATION_MS })
        );
      }

      setControlAccessVerified(true);
      setControlAccessCode("");
      setControlAccessMessage(tr("تم التحقق بنجاح.", "Verified successfully."));
    } catch (error: any) {
      console.error("verifyControlAccessCode failed:", error);
      const lockedUntilMs = getControl12AccessLockFromError(error);
      if (lockedUntilMs) applyControlAccessLock(lockedUntilMs);
      else setControlAccessError(error?.message || tr("رمز الدخول غير صحيح أو انتهت صلاحيته.", "The code is invalid or expired."));
    } finally {
      setControlAccessBusy(false);
    }
  };


  useEffect(() => {
    if (!tenantId) return;
    if (authLoading) return;
    if (!user?.uid) return;
    if (!controlAccessVerified) return;

    let mounted = true;

    async function loadControlData() {
      const safeLoad = async <T,>(label: string, loader: () => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await loader();
        } catch (error) {
          const code = String((error as any)?.code || "");
          const message = String((error as any)?.message || error || "");

          // لا نطبع Permission Denied كخطأ أحمر حتى لا تتوقف تجربة المستخدم.
          // السبب الحقيقي يعالج من firestore.rules، والصفحة تستخدم fallback آمن عند المنع.
          if (code !== "permission-denied" && !message.toLowerCase().includes("insufficient permissions")) {
            console.error(`Control12 ${label} load error:`, error);
          }

          return fallback;
        }
      };

      const configSnap = await safeLoad(
        "config",
        () => getDoc(doc(db, "tenants", tenantId, "meta", "config")),
        null
      );

      if (mounted && configSnap) {
        setSchoolConfig((configSnap.data() as SchoolConfig) || {});
      }

      const membersSnap = await safeLoad(
        "schoolControlMembers",
        () => getDocs(query(collection(db, "tenants", tenantId, "schoolControlMembers"), orderBy("name", "asc"))),
        null
      );

      if (mounted && membersSnap) {
        setMembers(
          membersSnap.docs.map((row) => ({
            id: row.id,
            ...(row.data() as Omit<ControlMember, "id">),
          })),
        );
      }

      const reportsSnap = await safeLoad(
        "schoolControlReports",
        () => getDocs(query(collection(db, "tenants", tenantId, "schoolControlReports"), orderBy("reportDate", "desc"))),
        null
      );

      if (mounted && reportsSnap) {
        setReports(
          reportsSnap.docs.map((row) => ({
            id: row.id,
            ...(row.data() as Omit<ControlReport, "id">),
          })),
        );
      }

      const examsSnap = await safeLoad(
        "exams",
        () => getDocs(query(collection(db, "tenants", tenantId, "exams"), orderBy("date", "asc"))),
        null
      );

      if (mounted && examsSnap) {
        setExams(examsSnap.docs.map((row) => ({ id: row.id, ...(row.data() as any) })));
      }
    }

    void loadControlData();

    return () => {
      mounted = false;
    };
  }, [tenantId, authLoading, user?.uid, controlAccessVerified]);

  useEffect(() => {
    const refreshOfficialData = () => setOfficialDataVersion((value) => value + 1);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || [EXAM_CENTER_DATA_KEY, EXAM_CENTER_LOGO_KEY, APP_LOGO_KEY, CONTROL_HEAD_NAME_KEY].includes(event.key)) {
        refreshOfficialData();
      }
    };

    window.addEventListener("focus", refreshOfficialData);
    window.addEventListener("storage", onStorage);
    window.addEventListener("exam-manager:changed", refreshOfficialData);
    window.addEventListener("exam-manager:control-head-changed", refreshOfficialData);

    return () => {
      window.removeEventListener("focus", refreshOfficialData);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("exam-manager:changed", refreshOfficialData);
      window.removeEventListener("exam-manager:control-head-changed", refreshOfficialData);
    };
  }, []);

  const officialHeaderData = useMemo(
    () => buildOfficialControlHeaderData(schoolConfig, lang === "ar" ? "ar" : "en"),
    [schoolConfig, lang, officialDataVersion],
  );

  const memberMap = useMemo(() => {
    const map = new Map<string, ControlMember>();
    members.forEach((item) => map.set(item.id, item));
    return map;
  }, [members]);

  const examSubjects = useMemo(() => {
    const values = exams
      .map((item) => String(item.subject || item.name || item.title || "").trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [exams]);

  const selectedReportTitle =
    reportTypeOptions.find((item) => item.value === reportForm.type)?.[lang === "ar" ? "ar" : "en"] || "";


  const groupedReports = useMemo(() => {
    const groups = new Map<ControlReportType, ControlReport[]>();
    reports.forEach((report) => {
      const current = groups.get(report.type) || [];
      current.push(report);
      groups.set(report.type, current);
    });
    return reportTypeOptions
      .map((option) => ({
        type: option.value,
        title: lang === "ar" ? option.ar : option.en,
        items: groups.get(option.value) || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [reports, lang]);

  const resetMemberForm = () => {
    setMemberForm({
      id: "",
      name: "",
      employeeNo: "",
      specialization: "",
      assignment: "",
      phone: "",
      signature: "",
    });
  };

  const resetReportForm = () => {
    setReportForm({
      type: "control_open",
      reportDate: "",
      dayName: "",
      reportTime: "",
      subject: "",
      envelopesCount: "",
      papersCount: "",
      studentName: "",
      studentSeatNo: "",
      studentGrade: "",
      teacherName: "",
      notes: "",
      memberIds: ["", "", ""],
    });
  };

  const setReportField = (key: string, value: string) => {
    if (key === "reportDate") {
      setReportForm((prev) => ({
        ...prev,
        reportDate: value,
        dayName: toDayName(value, lang === "ar" ? "ar" : "en"),
      }));
      return;
    }

    setReportForm((prev) => ({ ...prev, [key]: value }));
  };

  const setReportMember = (index: number, value: string) => {
    setReportForm((prev) => {
      const memberIds = [...prev.memberIds];
      memberIds[index] = value;
      return { ...prev, memberIds };
    });
  };

  const saveMember = async () => {
    if (!tenantId) {
      alert(tr("لا توجد مدرسة مرتبطة.", "No linked school found."));
      return;
    }

    if (!memberForm.name.trim() || !memberForm.employeeNo.trim()) {
      alert(tr("اسم المعلم والرقم الوظيفي مطلوبان.", "Teacher name and employee number are required."));
      return;
    }

    setBusy(true);
    try {
      const localMemberData = {
        name: memberForm.name.trim(),
        employeeNo: memberForm.employeeNo.trim(),
        specialization: memberForm.specialization.trim(),
        assignment: memberForm.assignment.trim(),
        phone: memberForm.phone.trim(),
        signature: memberForm.signature.trim(),
      };

      const payload = {
        ...localMemberData,
        updatedAt: serverTimestamp(),
      };

      if (memberForm.id) {
        await setDoc(doc(db, "tenants", tenantId, "schoolControlMembers", memberForm.id), payload, { merge: true });
        setMembers((prev) =>
          sortControlMembersByName(
            prev.map((item) => (item.id === memberForm.id ? { ...item, ...localMemberData } : item)),
          ),
        );
      } else {
        const memberRef = await addDoc(collection(db, "tenants", tenantId, "schoolControlMembers"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setMembers((prev) => sortControlMembersByName([...prev, { id: memberRef.id, ...localMemberData }]));
      }

      resetMemberForm();
    } catch (error) {
      console.error(error);
      alert(tr("تعذر حفظ العضو.", "Unable to save the member."));
    } finally {
      setBusy(false);
    }
  };

  const deleteMember = async (memberId: string) => {
    if (!tenantId || !memberId) return;
    if (!window.confirm(tr("هل تريد حذف العضو؟", "Delete this member?"))) return;

    setBusy(true);
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "schoolControlMembers", memberId));
      setMembers((prev) => prev.filter((item) => item.id !== memberId));
      if (memberForm.id === memberId) resetMemberForm();
    } finally {
      setBusy(false);
    }
  };

  const saveReport = async () => {
    if (!tenantId) {
      alert(tr("لا توجد مدرسة مرتبطة.", "No linked school found."));
      return;
    }

    if (!reportForm.reportDate || !reportForm.reportTime) {
      alert(tr("التاريخ والوقت مطلوبان.", "Date and time are required."));
      return;
    }

    const selectedIds = reportForm.memberIds.map((item) => item.trim()).filter(Boolean);
    if (selectedIds.length !== 3 || new Set(selectedIds).size !== 3) {
      alert(tr("يجب اختيار 3 أعضاء مختلفين.", "You must select 3 different members."));
      return;
    }

    if (reportForm.type === "envelope_open" && !reportForm.subject.trim()) {
      alert(tr("اختر المادة أولاً.", "Select the subject first."));
      return;
    }

    const membersPayload = selectedIds
      .map((id) => memberMap.get(id))
      .filter(Boolean)
      .map((item) => ({
        memberId: String(item!.id),
        name: String(item!.name || ""),
        employeeNo: String(item!.employeeNo || ""),
        specialization: String(item!.specialization || ""),
        signature: String(item!.signature || ""),
      }));

    const localReportData = {
      type: reportForm.type,
      reportDate: reportForm.reportDate,
      dayName: reportForm.dayName || toDayName(reportForm.reportDate, lang === "ar" ? "ar" : "en"),
      reportTime: reportForm.reportTime,
      subject: reportForm.subject.trim(),
      envelopesCount: reportForm.envelopesCount.trim(),
      papersCount: reportForm.papersCount.trim(),
      studentName: reportForm.studentName.trim(),
      studentSeatNo: reportForm.studentSeatNo.trim(),
      studentGrade: reportForm.studentGrade.trim(),
      teacherName: reportForm.teacherName.trim(),
      notes: reportForm.notes.trim(),
      members: membersPayload,
    };

    setBusy(true);
    try {
      const reportRef = await addDoc(collection(db, "tenants", tenantId, "schoolControlReports"), {
        ...localReportData,
        createdAt: serverTimestamp(),
      });
      setReports((prev) =>
        [{ id: reportRef.id, ...localReportData }, ...prev].sort((a, b) =>
          String(b.reportDate || "").localeCompare(String(a.reportDate || "")),
        ),
      );
      resetReportForm();
    } catch (error) {
      console.error(error);
      alert(tr("تعذر حفظ التقرير.", "Unable to save the report."));
    } finally {
      setBusy(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!tenantId || !reportId) return;
    if (!window.confirm(tr("هل تريد حذف التقرير؟", "Delete this report?"))) return;

    setBusy(true);
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "schoolControlReports", reportId));
      setReports((prev) => prev.filter((item) => item.id !== reportId));
    } finally {
      setBusy(false);
    }
  };

  const exportMembers = () => {
    const rows = [
      [
        tr("اسم المعلم", "Teacher name"),
        tr("الرقم الوظيفي", "Employee number"),
        tr("التخصص", "Specialization"),
        tr("المهمة الموكلة إليه", "Assigned task"),
        tr("رقم الهاتف", "Phone number"),
        tr("التوقيع", "Signature"),
      ],
      ...members.map((item) => [item.name, item.employeeNo, item.specialization, item.assignment, item.phone, item.signature]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "school-control-members.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importMembers = async (file: File) => {
    if (!tenantId) return;

    setBusy(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return;

      const rows = lines.map(parseCsvLine);
      const header = rows[0].map((item) => item.toLowerCase().trim());
      const findIndex = (...keys: string[]) => header.findIndex((item) => keys.some((key) => item.includes(key.toLowerCase())));

      const nameIndex = findIndex("اسم", "teacher name");
      const employeeNoIndex = findIndex("رقم وظيفي", "employee");
      const specializationIndex = findIndex("تخصص", "specialization");
      const assignmentIndex = findIndex("المهمة", "task", "assignment");
      const phoneIndex = findIndex("الهاتف", "phone");
      const signatureIndex = findIndex("التوقيع", "signature");
      const startAt = nameIndex >= 0 || employeeNoIndex >= 0 ? 1 : 0;

      const importedMembers: ControlMember[] = [];

      for (let i = startAt; i < rows.length; i += 1) {
        const row = rows[i];
        const name = String(row[nameIndex >= 0 ? nameIndex : 0] || "").trim();
        const employeeNo = String(row[employeeNoIndex >= 0 ? employeeNoIndex : 1] || "").trim();
        if (!name || !employeeNo) continue;

        const localMemberData = {
          name,
          employeeNo,
          specialization: String(row[specializationIndex >= 0 ? specializationIndex : 2] || "").trim(),
          assignment: String(row[assignmentIndex >= 0 ? assignmentIndex : 3] || "").trim(),
          phone: String(row[phoneIndex >= 0 ? phoneIndex : 4] || "").trim(),
          signature: String(row[signatureIndex >= 0 ? signatureIndex : 5] || "").trim(),
        };

        const memberRef = await addDoc(collection(db, "tenants", tenantId, "schoolControlMembers"), {
          ...localMemberData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        importedMembers.push({ id: memberRef.id, ...localMemberData });
      }

      if (importedMembers.length) {
        setMembers((prev) => sortControlMembersByName([...prev, ...importedMembers]));
      }

      alert(tr("تم الاستيراد بنجاح.", "Imported successfully."));
    } catch (error) {
      console.error(error);
      alert(tr("تعذر استيراد الملف.", "Unable to import the file."));
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
      setBusy(false);
    }
  };

  const titleForType = (type: ControlReportType) => {
    const item = reportTypeOptions.find((row) => row.value === type);
    return item ? (lang === "ar" ? item.ar : item.en) : "";
  };

  const reportMembersTableHtml = (report: ControlReport) => {
    if (!report.members?.length) return "";

    const nameHeader = tr("اسم المعلم", "Teacher name");
    const employeeHeader = tr("الرقم الوظيفي", "Employee number");
    const specializationHeader = tr("التخصص", "Specialization");
    const signatureHeader = tr("التوقيع", "Signature");

    const rows = report.members
      .map(
        (member) => `
          <tr>
            <td>${member.name || "-"}</td>
            <td>${member.employeeNo || "-"}</td>
            <td>${member.specialization || "-"}</td>
            <td>${member.signature || "-"}</td>
          </tr>`,
      )
      .join("");

    return `
      <div class="members-table-wrap">
        <table class="members-table">
          <thead>
            <tr>
              <th>${nameHeader}</th>
              <th>${employeeHeader}</th>
              <th>${specializationHeader}</th>
              <th>${signatureHeader}</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>`;
  };

  const reportNarrative = (report: ControlReport) => {
    switch (report.type) {
      case "control_open":
        return lang === "ar"
          ? `بحمد الله تم فتح مكتب الكنترول في المدرسة بتاريخ ${report.reportDate} وذلك في يوم ${report.dayName} وفي الساعة ${report.reportTime}، ووجدنا جميع محتويات الكنترول سليمة وكذلك أوراق الامتحانات لجميع الصفوف ولا يوجد ملاحظات وذلك بعد التأكد من سلامة الغلق والأختام وبحضور كلٍ من أعضاء الكنترول.`
          : `By the grace of God, the school control office was opened on ${report.reportDate}, ${report.dayName}, at ${report.reportTime}. All control contents and exam papers for all grades were found intact with no remarks after verifying the locks and seals, in the presence of the following control members.`;
      case "control_close":
        return lang === "ar"
          ? `بحمد الله تم غلق مكتب الكنترول في المدرسة بتاريخ ${report.reportDate} وذلك في يوم ${report.dayName} وفي الساعة ${report.reportTime}، مع التأكد أن جميع محتويات الكنترول سليمة وكذلك أوراق الامتحانات لجميع الصفوف ولا يوجد ملاحظات مع التأكد من سلامة الغلق وبحضور كلٍ من أعضاء الكنترول.`
          : `By the grace of God, the school control office was closed on ${report.reportDate}, ${report.dayName}, at ${report.reportTime}, after ensuring that all control contents and exam papers for all grades were intact with no remarks and that the office was properly secured, in the presence of the following control members.`;
      case "envelope_open":
        return lang === "ar"
          ? `بحمد الله تم فتح المظروف الامتحاني لمادة ${report.subject || "-"} بتاريخ ${report.reportDate} وذلك في يوم ${report.dayName} وفي الساعة ${report.reportTime} وعدد المظاريف ${report.envelopesCount || "-"} والأوراق ${report.papersCount || "-"} ووجدنا جميع محتويات المظروف سليمة وكذلك أوراق الامتحانات ولا يوجد ملاحظات وكان ذلك بحضور كلٍ من أعضاء الكنترول.`
          : `By the grace of God, the exam envelope for the subject ${report.subject || "-"} was opened on ${report.reportDate}, ${report.dayName}, at ${report.reportTime}. Number of envelopes: ${report.envelopesCount || "-"}; number of papers: ${report.papersCount || "-"}. All envelope contents and exam papers were found intact with no remarks in the presence of the following control members.`;
      case "answer_sheets_receive":
        return lang === "ar"
          ? `تم استلام مظاريف وأوراق الإجابة بتاريخ ${report.reportDate} وذلك في يوم ${report.dayName} وفي الساعة ${report.reportTime} وتمت مراجعتها ابتدائيًا ولا توجد ملاحظات.`
          : `Answer sheet envelopes were received on ${report.reportDate}, ${report.dayName}, at ${report.reportTime}. An initial review was completed and no remarks were recorded.`;
      case "student_cheating":
        return lang === "ar"
          ? `تم تحرير محضر غش للطالب ${report.studentName || "-"} الصف ${report.studentGrade || "-"} رقم الجلوس ${report.studentSeatNo || "-"} بتاريخ ${report.reportDate} في يوم ${report.dayName} الساعة ${report.reportTime}. الملاحظات: ${report.notes || "لا توجد"}.`
          : `A cheating report was issued for student ${report.studentName || "-"}, grade ${report.studentGrade || "-"}, seat number ${report.studentSeatNo || "-"}, on ${report.reportDate}, ${report.dayName}, at ${report.reportTime}. Notes: ${report.notes || "None"}.`;
      case "student_absence":
        return lang === "ar"
          ? `تم تحرير محضر غياب للطالب ${report.studentName || "-"} الصف ${report.studentGrade || "-"} رقم الجلوس ${report.studentSeatNo || "-"} بتاريخ ${report.reportDate} في يوم ${report.dayName} الساعة ${report.reportTime}. الملاحظات: ${report.notes || "لا توجد"}.`
          : `An absence report was issued for student ${report.studentName || "-"}, grade ${report.studentGrade || "-"}, seat number ${report.studentSeatNo || "-"}, on ${report.reportDate}, ${report.dayName}, at ${report.reportTime}. Notes: ${report.notes || "None"}.`;
      default:
        return lang === "ar"
          ? `تم تحرير محضر غياب للمعلم ${report.teacherName || "-"} بتاريخ ${report.reportDate} في يوم ${report.dayName} الساعة ${report.reportTime}. الملاحظات: ${report.notes || "لا توجد"}.`
          : `An absence report was issued for teacher ${report.teacherName || "-"} on ${report.reportDate}, ${report.dayName}, at ${report.reportTime}. Notes: ${report.notes || "None"}.`;
    }
  };

  const printReport = (report: ControlReport) => {
    const schoolName = officialHeaderData.centerName || tr("مركز الامتحانات", "Exam Center");
    const countryLine = officialHeaderData.country || (lang === "ar" ? "سلطنة عمان" : "Sultanate of Oman");
    const ministryLine = officialHeaderData.ministry || (lang === "ar" ? "وزارة التعليم" : "Ministry of Education");
    const directorateLine = officialHeaderData.directorate || (lang === "ar" ? "المديرية العامة للتعليم" : "Directorate General of Education");
    const termLine = officialHeaderData.semester || "";
    const logo = officialHeaderData.logoUrl
      ? `<img src="${officialHeaderData.logoUrl}" alt="logo" style="width:92px;height:92px;object-fit:contain;" />`
      : "";

    const title = titleForType(report.type);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const academicYearStart = currentMonth >= 8 ? currentYear : currentYear - 1;
    const academicYearEnd = academicYearStart + 1;
    const academicYearLine = officialHeaderData.academicYear
      ? lang === "ar"
        ? `العام الدراسي ${officialHeaderData.academicYear} م`
        : `Academic Year ${officialHeaderData.academicYear}`
      : lang === "ar"
        ? `العام الدراسي ${academicYearStart} - ${academicYearEnd} م`
        : `Academic Year ${academicYearStart} - ${academicYearEnd}`;
    const printedAt = `${now.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")} ${now.toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US")}`;
    const membersTable = reportMembersTableHtml(report);

    const html = `<!doctype html>
<html lang="${lang}" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
body{font-family:Tahoma,Arial,sans-serif;margin:18px 24px;color:#111827;background:#fff;font-weight:800}
.page-meta{font-size:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;color:#111827;font-weight:900}
.header{padding:12px 18px 16px 18px;margin-bottom:24px;border:3px solid #111827;border-radius:0 0 20px 20px;background:#fffdf2}
.header-row{display:grid;grid-template-columns:1fr 130px 1fr;align-items:center;gap:22px;border-bottom:2px solid #111827;padding-bottom:14px}
.header-right{text-align:right}
.header-center{display:flex;justify-content:center;align-items:center}
.header-left{text-align:left}
.line-main{margin:0 0 8px 0;font-size:22px;font-weight:900;line-height:1.25}
.line-sub{margin:0 0 6px 0;font-size:18px;font-weight:900;line-height:1.35}
.line-left{margin:0 0 6px 0;font-size:17px;font-weight:900;line-height:1.45}
.report-title{text-align:center;font-size:31px;font-weight:900;margin:18px 0 6px 0;line-height:1.35}
.report-academic-year{text-align:center;font-size:18px;font-weight:900;margin:0;line-height:1.5}
.info-strip{margin-top:14px;border:2px solid #111827;border-radius:16px;padding:10px 16px;display:flex;justify-content:space-between;gap:12px;font-weight:900;font-size:16px}
.content{line-height:2.1;font-size:18px;border:2px solid #111827;border-radius:18px;padding:18px;margin-top:16px}
.members-table-wrap{margin-top:18px}
.members-table{width:100%;border-collapse:collapse}
.members-table th,.members-table td{border:1.5px solid #111827;padding:10px 8px;text-align:center;font-size:16px;vertical-align:middle;font-weight:900}
.members-table th{background:#fff2b8;font-weight:900}
.footer{margin-top:54px;display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:stretch}
.stamp,.signature{border:2px dashed #111827;min-height:110px;display:grid;place-items:center;text-align:center;font-weight:900;border-radius:16px}
@media print{body{margin:10mm}.header{break-inside:avoid}.footer{break-inside:avoid}}
</style>
</head>
<body>
<div class="page-meta">
  <div>${printedAt}</div>
  <div>${title}</div>
</div>

<div class="header">
  <div class="header-row">
    <div class="header-right">
      <p class="line-main">${countryLine}</p>
      <p class="line-main">${ministryLine}</p>
    </div>
    <div class="header-center">${logo}</div>
    <div class="header-left">
      <p class="line-sub">${directorateLine}</p>
      <p class="line-sub">${schoolName}</p>
      ${termLine ? `<p class="line-left">${termLine}</p>` : ""}
    </div>
  </div>
  <div class="report-title">${title}</div>
  <div class="report-academic-year">${academicYearLine}</div>
  <div class="info-strip">
    <span>${tr("التاريخ", "Date")}: ${report.reportDate || "-"}</span>
    <span>${tr("اليوم", "Day")}: ${report.dayName || "-"}</span>
    <span>${tr("الوقت", "Time")}: ${report.reportTime || "-"}</span>
  </div>
</div>

<div class="content">${reportNarrative(report)}</div>
${membersTable}

<div class="footer">
  <div class="signature">
    <div>${tr("توقيع رئيس المركز", "Center head signature")}</div>
    <div style="margin-top:18px;">${officialHeaderData.controlHeadName || "..........................................."}</div>
  </div>
  <div class="stamp">${tr("ختم المركز", "Center stamp")}</div>
</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  if (!controlAccessVerified) {
    const isLocked = controlAccessLockedUntilMs > Date.now() && controlAccessLockRemainingSeconds > 0;

    return (
      <div style={{ direction: isRTL ? "rtl" : "ltr", minHeight: "100vh", background: PAGE_BG, color: "#000000", padding: 18, boxSizing: "border-box", display: "grid", placeItems: "center", fontWeight: 1000 }}>
        <div style={{ width: "min(980px, 96vw)", border: "4px solid #d4af37", borderRadius: 30, background: "linear-gradient(180deg, #fffdf7 0%, #f8f4e8 100%)", boxShadow: "0 18px 42px rgba(0,0,0,0.18)", padding: window.innerWidth < 700 ? 18 : 34, color: "#000000", fontWeight: 1000 }}>
          <style>{`
            .control12EmailCodeInput { color: #111827 !important; font-weight: 1000 !important; font-size: 20px !important; background: #fffef8 !important; -webkit-text-fill-color: #111827 !important; }
            .control12EmailCodeInput::placeholder { color: #111827 !important; font-weight: 1000 !important; opacity: 0.72 !important; }
          `}</style>

          <div style={{ fontSize: window.innerWidth < 700 ? 26 : 38, fontWeight: 1000, marginBottom: 12, color: "#000000", textAlign: "center", lineHeight: 1.4 }}>{tr("تحقق برمز البريد لفتح صفحة الكنترول", "Email-code verification required to open Control page")}</div>
          <div style={{ fontSize: 18, fontWeight: 1000, lineHeight: 1.9, color: "#000000", marginBottom: 20, textAlign: "center" }}>{tr(`أدخل البريد الإلكتروني الصحيح للحساب أولًا، ثم اطلب رمز الدخول المرسل إلى البريد${maskedCurrentUserEmail ? ` (${maskedCurrentUserEmail})` : ""}.`, `Enter the correct account email first, then request the access code sent to email${maskedCurrentUserEmail ? ` (${maskedCurrentUserEmail})` : ""}.`)}</div>

          {isLocked ? (
            <>
              <div style={{ marginTop: 18, border: "3px solid #dc2626", background: "#fff1f2", color: "#000000", borderRadius: 20, padding: "24px 18px", fontWeight: 1000, lineHeight: 1.9, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 1000, color: "#000000" }}>{tr("تم تجاوز عدد محاولات التحقق.", "Too many failed verification attempts.")}</div>
                <div style={{ fontSize: 18, fontWeight: 1000, color: "#000000", marginTop: 8 }}>{tr("يمكنك طلب رمز جديد بعد انتهاء العد التنازلي.", "You can request a new code after the countdown ends.")}</div>
                <div style={{ fontSize: 44, fontWeight: 1000, color: "#b91c1c", marginTop: 14 }}>{formatControl12AccessCountdown(controlAccessLockRemainingSeconds)}</div>
              </div>
              <div style={{ marginTop: 12, border: "2px solid #dc2626", background: "#fef2f2", color: "#000000", borderRadius: 14, padding: "10px 12px", fontWeight: 1000, lineHeight: 1.7, textAlign: "center" }}>{tr("تم إيقاف طلب الرمز والتحقق مؤقتًا حتى انتهاء العد التنازلي.", "Code requests and verification are temporarily disabled until the countdown ends.")}</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 22 }}>
                <button type="button" style={buttonStyle("linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)")} onClick={() => navigate(tenantPath(tenantId, "/dashboard12"))}>{tr("رجوع", "Back")}</button>
                <button type="button" style={{ ...buttonStyle("linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%)"), opacity: 0.75, cursor: "not-allowed" }} disabled>{tr(`انتظر ${formatControl12AccessCountdown(controlAccessLockRemainingSeconds)}`, `Wait ${formatControl12AccessCountdown(controlAccessLockRemainingSeconds)}`)}</button>
              </div>
            </>
          ) : (
            <>
              <input className="control12EmailCodeInput" value={controlAccessEmail} onChange={(event) => { setControlAccessEmail(event.target.value); setControlAccessEmailConfirmed(false); setControlAccessCodeSent(false); setControlAccessCode(""); setControlAccessError(""); setControlAccessMessage(""); }} onKeyDown={(event) => { if (event.key === "Enter") void sendControlAccessCode(); }} inputMode="email" autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="control12_email_gate_no_autofill"
              id="control12_email_gate_no_autofill" placeholder={tr("أدخل البريد الإلكتروني المرتبط بالحساب", "Enter the account email")} style={{ width: "100%", border: "3px solid #d4af37", borderRadius: 16, padding: "15px 18px", boxSizing: "border-box", outline: "none", marginTop: 14, textAlign: "center" }} />
              {controlAccessCodeSent && controlAccessEmailConfirmed && <input className="control12EmailCodeInput" value={controlAccessCode} onChange={(event) => setControlAccessCode(normalizeControlAccessCode(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter") void verifyControlAccessCode(); }} inputMode="numeric" maxLength={6} placeholder={tr("أدخل رمز التحقق المكون من 6 أرقام", "Enter the 6-digit verification code")} style={{ width: "100%", border: "3px solid #d4af37", borderRadius: 16, padding: "15px 18px", boxSizing: "border-box", outline: "none", marginTop: 12, textAlign: "center", letterSpacing: 2 }} />}
              {controlAccessMessage && <div style={{ marginTop: 12, color: "#065f46", background: "#ecfdf5", border: "2px solid #34d399", borderRadius: 14, padding: 12, fontWeight: 1000, textAlign: "center" }}>{controlAccessMessage}</div>}
              {controlAccessError && <div style={{ marginTop: 12, color: "#000000", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 14, padding: 12, fontWeight: 1000, textAlign: "center" }}>{controlAccessError}</div>}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 22 }}>
                <button type="button" style={buttonStyle("linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)")} onClick={() => navigate(tenantPath(tenantId, "/dashboard12"))}>{tr("رجوع", "Back")}</button>
                <button type="button" style={buttonStyle("linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%)")} disabled={controlAccessBusy} onClick={() => void sendControlAccessCode()}>{controlAccessBusy ? tr("جارٍ الإرسال...", "Sending...") : tr("إرسال رمز الدخول", "Send access code")}</button>
                <button type="button" style={buttonStyle("linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%)")} disabled={controlAccessBusy || !controlAccessCodeSent || !controlAccessEmailConfirmed} onClick={() => void verifyControlAccessCode()}>{controlAccessBusy ? tr("جارٍ التحقق...", "Verifying...") : tr("تحقق وفتح الصفحة", "Verify and open page")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        direction: isRTL ? "rtl" : "ltr",
        minHeight: "100vh",
        background: PAGE_BG,
        color: "#000000",
        padding: window.innerWidth < 992 ? 16 : 28,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1600, margin: "0 auto", display: "grid", gap: 20 }}>
        <OfficialControlHeader
          data={officialHeaderData}
          lang={lang === "ar" ? "ar" : "en"}
          title={tr("ملفات الكنترول الرسمية", "Official Control Files")}
          subtitle={tr("محاضر واعتمادات مركز الامتحانات", "Exam center minutes and approvals")}
        />

        <div style={{ ...officialToolbarStyle, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.95, color: GOLD_DARK, fontWeight: 900 }}>{tr("صفحة رسمية لمركز الامتحانات", "Official exam-center page")}</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: "#000000", textShadow: "0 0 12px rgba(212,175,55,0.22)" }}>{tr("إدارة ملفات الكنترول", "Control Files Management")}</div>
            <div style={{ marginTop: 8, opacity: 0.95, color: "#000000", fontWeight: 900 }}>
              {tr("إدارة أعضاء الكنترول والمحاضر الرسمية والطباعة والاستيراد والتصدير وفق ترويسة مركز الامتحانات.", "Manage control members, official minutes, printing, import, and export using the exam-center official header.")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => navigate(tenantPath(tenantId, "/dashboard12"))} style={buttonStyle("linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)")}>
              {tr("العودة للوحة الرئيسية", "Back to dashboard")}
            </button>
            <button
              onClick={() => navigate(tenantPath(tenantId, "/student-seat-register12"))}
              style={buttonStyle("linear-gradient(180deg, #fef3c7 0%, #f59e0b 100%)")}
            >
              {tr("سجل أرقام الجلوس", "Seat Numbers Register")}
            </button>
            <button
              type="button"
              onClick={() => goToTenantRoute("candidate-violation-report12")}
              style={buttonStyle("linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%)")}
            >
              {tr("محضر مخالفة ممتحن", "Candidate Violation Report")}
            </button>
            <button
              type="button"
              onClick={() => goToTenantRoute("candidate-written-warning12")}
              style={buttonStyle("linear-gradient(180deg, #fff7cc 0%, #facc15 100%)")}
            >
              {tr("إنذار كتابي لممتحن", "Candidate Written Warning")}
            </button>
            <button onClick={exportMembers} style={buttonStyle("linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%)")}>
              {tr("تصدير اكسل", "Export Excel")}
            </button>
            <button onClick={() => importInputRef.current?.click()} style={buttonStyle("linear-gradient(180deg, #fde68a 0%, #fcd34d 100%)")}>
              {tr("استيراد اكسل", "Import Excel")}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importMembers(file);
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.45fr", gap: 20 }}>
          <section style={{ ...cardStyle, background: LIGHT_CARD_BACKGROUNDS[0], display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={sectionTitleStyle}>{tr("إضافة أعضاء الكنترول", "Add control members")}</div>
            <div style={formGridStyle}>
              <Field label={tr("اسم المعلم", "Teacher name")} value={memberForm.name} onChange={(v) => setMemberForm((p) => ({ ...p, name: v }))} />
              <Field label={tr("الرقم الوظيفي", "Employee number")} value={memberForm.employeeNo} onChange={(v) => setMemberForm((p) => ({ ...p, employeeNo: v }))} />
              <Field label={tr("التخصص", "Specialization")} value={memberForm.specialization} onChange={(v) => setMemberForm((p) => ({ ...p, specialization: v }))} />
              <Field label={tr("المهمة الموكلة إليه", "Assigned task")} value={memberForm.assignment} onChange={(v) => setMemberForm((p) => ({ ...p, assignment: v }))} />
              <Field label={tr("رقم الهاتف", "Phone number")} value={memberForm.phone} onChange={(v) => setMemberForm((p) => ({ ...p, phone: v }))} />
              <Field label={tr("التوقيع", "Signature")} value={memberForm.signature} onChange={(v) => setMemberForm((p) => ({ ...p, signature: v }))} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button disabled={busy} onClick={saveMember} style={buttonStyle("linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%)")}>
                {memberForm.id ? tr("تعديل", "Update") : tr("إضافة", "Add")}
              </button>
              <button disabled={busy} onClick={resetMemberForm} style={buttonStyle("linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%)")}>
                {tr("جديد", "New")}
              </button>
              {memberForm.id ? (
                <button disabled={busy} onClick={() => deleteMember(memberForm.id)} style={buttonStyle("linear-gradient(180deg, #fecaca 0%, #fca5a5 100%)")}>
                  {tr("حذف", "Delete")}
                </button>
              ) : null}
            </div>
          </section>

          <section style={{ ...cardStyle, background: LIGHT_CARD_BACKGROUNDS[1] }}>
            <div style={sectionTitleStyle}>{tr("جدول أعضاء الكنترول", "Control members table")}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>{tr("اسم المعلم", "Teacher name")}</Th>
                    <Th>{tr("الرقم الوظيفي", "Employee number")}</Th>
                    <Th>{tr("التخصص", "Specialization")}</Th>
                    <Th>{tr("المهمة", "Task")}</Th>
                    <Th>{tr("الهاتف", "Phone")}</Th>
                    <Th>{tr("التوقيع", "Signature")}</Th>
                    <Th>{tr("إجراءات", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {members.length ? (
                    members.map((item) => (
                      <tr key={item.id}>
                        <Td>{item.name}</Td>
                        <Td>{item.employeeNo}</Td>
                        <Td>{item.specialization}</Td>
                        <Td>{item.assignment}</Td>
                        <Td>{item.phone}</Td>
                        <Td>{item.signature}</Td>
                        <Td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => setMemberForm({
                                id: item.id,
                                name: item.name || "",
                                employeeNo: item.employeeNo || "",
                                specialization: item.specialization || "",
                                assignment: item.assignment || "",
                                phone: item.phone || "",
                                signature: item.signature || "",
                              })}
                              style={miniButtonStyle("linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%)")}
                            >
                              {tr("تعديل", "Edit")}
                            </button>
                            <button onClick={() => deleteMember(item.id)} style={miniButtonStyle("linear-gradient(180deg, #fecaca 0%, #fca5a5 100%)")}>
                              {tr("حذف", "Delete")}
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td colSpan={7}>{tr("لا توجد بيانات حتى الآن.", "No data yet.")}</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section style={{ ...cardStyle, background: LIGHT_CARD_BACKGROUNDS[2] }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={sectionTitleStyle}>{tr("المحاضر والتقارير الرسمية", "Official minutes and reports")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {reportTypeOptions.map((item, index) => {
                const tone = REPORT_TYPE_BUTTON_STYLES[index % REPORT_TYPE_BUTTON_STYLES.length];
                const isActive = reportForm.type === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setReportField("type", item.value)}
                    style={{
                      ...miniButtonStyle(isActive ? tone.active : tone.idle),
                      color: "#000000",
                      fontWeight: 900,
                      border: `2px solid ${tone.border}`,
                      background: isActive ? tone.active : tone.idle,
                      boxShadow: isActive
                        ? `0 10px 24px ${tone.border}33, inset 0 1px 0 rgba(255,255,255,0.65)`
                        : `0 6px 16px ${tone.border}22, inset 0 1px 0 rgba(255,255,255,0.65)`,
                    }}
                  >
                    {lang === "ar" ? item.ar : item.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
            <Field type="date" label={tr("التاريخ", "Date")} value={reportForm.reportDate} onChange={(v) => setReportField("reportDate", v)} />
            <Field label={tr("اليوم", "Day")} value={reportForm.dayName} onChange={(v) => setReportField("dayName", v)} readOnly />
            <Field type="time" label={tr("الساعة", "Time")} value={reportForm.reportTime} onChange={(v) => setReportField("reportTime", v)} />
            <Field label={tr("ملاحظات", "Notes")} value={reportForm.notes} onChange={(v) => setReportField("notes", v)} />
          </div>

          {reportForm.type === "envelope_open" ? (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              <Field
                label={tr("المادة", "Subject")}
                value={reportForm.subject}
                onChange={(v) => setReportField("subject", v)}
              />
              <Field label={tr("عدد المظاريف", "Number of envelopes")} value={reportForm.envelopesCount} onChange={(v) => setReportField("envelopesCount", v)} />
              <Field label={tr("عدد الأوراق", "Number of papers")} value={reportForm.papersCount} onChange={(v) => setReportField("papersCount", v)} />
            </div>
          ) : null}

          {reportForm.type === "student_cheating" || reportForm.type === "student_absence" ? (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              <Field label={tr("اسم الطالب", "Student name")} value={reportForm.studentName} onChange={(v) => setReportField("studentName", v)} />
              <Field label={tr("الصف", "Grade")} value={reportForm.studentGrade} onChange={(v) => setReportField("studentGrade", v)} />
              <Field label={tr("رقم الجلوس", "Seat number")} value={reportForm.studentSeatNo} onChange={(v) => setReportField("studentSeatNo", v)} />
            </div>
          ) : null}

          {reportForm.type === "teacher_absence" ? (
            <div style={{ marginTop: 14 }}>
              <Field label={tr("اسم المعلم", "Teacher name")} value={reportForm.teacherName} onChange={(v) => setReportField("teacherName", v)} />
            </div>
          ) : null}

          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 900, marginBottom: 12 }}>{tr("اختيار 3 أعضاء من الكنترول", "Select 3 control members")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              {[0, 1, 2].map((index) => {
                const selected = memberMap.get(reportForm.memberIds[index]);
                return (
                  <div key={index} style={{ display: "grid", gap: 8 }}>
                    <SelectField
                      label={`${tr("العضو", "Member")} ${index + 1}`}
                      value={reportForm.memberIds[index]}
                      onChange={(v) => setReportMember(index, v)}
                      options={members.map((member) => ({ value: member.id, label: `${member.name} - ${member.employeeNo}` }))}
                    />
                    <div style={previewBoxStyle}>
                      <div>{selected?.employeeNo || "-"}</div>
                      <div>{selected?.specialization || "-"}</div>
                      <div>{selected?.signature || "-"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button disabled={busy} onClick={saveReport} style={buttonStyle("linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%)")}>
              {tr("حفظ التقرير", "Save report")}
            </button>
            <button disabled={busy} onClick={resetReportForm} style={buttonStyle("linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%)")}>
              {tr("مسح الحقول", "Clear fields")}
            </button>
            {reports.find((item) => item.id === printingId) ? (
              <button onClick={() => printReport(reports.find((item) => item.id === printingId)!)} style={buttonStyle("linear-gradient(180deg, #e9d5ff 0%, #d8b4fe 100%)")}>
                {tr("طباعة التقرير المحدد", "Print selected report")}
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: 16, padding: 16, borderRadius: 18, border: "1px solid rgba(212,175,55,0.35)", background: "#ffffff" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{selectedReportTitle}</div>
            <div style={{ color: "#000000", lineHeight: 1.95 }}>
              {reportForm.type === "control_open" && tr(
                `بحمد الله تم فتح مكتب الكنترول في المدرسة بتاريخ ${reportForm.reportDate || "...."} وذلك في يوم ${reportForm.dayName || "...."} وفي الساعة ${reportForm.reportTime || "...."} ووجدنا جميع محتويات الكنترول سليمة وكذلك أوراق الامتحانات لجميع الصفوف ولا يوجد ملاحظات وذلك بعد التأكد من سلامة الغلق والأختام وبحضور كلٍ من أعضاء الكنترول.`,
                `By the grace of God, the school control office was opened on ${reportForm.reportDate || "...."}, ${reportForm.dayName || "...."}, at ${reportForm.reportTime || "...."}. All control contents and exam papers for all grades were found intact with no remarks after verifying the locks and seals, in the presence of the control members.`,
              )}
              {reportForm.type === "control_close" && tr(
                `بحمد الله تم غلق مكتب الكنترول في المدرسة بتاريخ ${reportForm.reportDate || "...."} وذلك في يوم ${reportForm.dayName || "...."} وفي الساعة ${reportForm.reportTime || "...."} مع التأكد على أن جميع محتويات الكنترول سليمة وكذلك أوراق الامتحانات لجميع الصفوف ولا يوجد ملاحظات مع التأكد من سلامة الغلق وبحضور كلٍ من أعضاء الكنترول.`,
                `By the grace of God, the school control office was closed on ${reportForm.reportDate || "...."}, ${reportForm.dayName || "...."}, at ${reportForm.reportTime || "...."}, after ensuring that all control contents and exam papers for all grades were intact with no remarks and that the office was properly secured, in the presence of the control members.`,
              )}
              {reportForm.type === "envelope_open" && tr(
                `بحمد الله تم فتح المظروف الامتحاني لمادة ${reportForm.subject || "...."} بتاريخ ${reportForm.reportDate || "...."} وذلك في يوم ${reportForm.dayName || "...."} وفي الساعة ${reportForm.reportTime || "...."} وعدد المظاريف ${reportForm.envelopesCount || "...."} والأوراق ${reportForm.papersCount || "...."} ووجدنا جميع محتويات المظروف سليمة وكذلك أوراق الامتحانات ولا يوجد ملاحظات وكان ذلك بحضور كلٍ من أعضاء الكنترول.`,
                `By the grace of God, the exam envelope for ${reportForm.subject || "...."} was opened on ${reportForm.reportDate || "...."}, ${reportForm.dayName || "...."}, at ${reportForm.reportTime || "...."}. Number of envelopes: ${reportForm.envelopesCount || "...."}. Number of papers: ${reportForm.papersCount || "...."}. All envelope contents and exam papers were found intact with no remarks in the presence of the control members.`,
              )}
              {reportForm.type === "answer_sheets_receive" && tr(
                `تم استلام مظاريف وأوراق الإجابة بتاريخ ${reportForm.reportDate || "...."} وذلك في يوم ${reportForm.dayName || "...."} وفي الساعة ${reportForm.reportTime || "...."} وتمت مراجعتها ابتدائيًا ولا توجد ملاحظات.`,
                `Answer sheet envelopes were received on ${reportForm.reportDate || "...."}, ${reportForm.dayName || "...."}, at ${reportForm.reportTime || "...."}. An initial review was completed and no remarks were recorded.`,
              )}
              {reportForm.type === "student_cheating" && tr(
                `تم تحرير محضر غش للطالب ${reportForm.studentName || "...."} الصف ${reportForm.studentGrade || "...."} رقم الجلوس ${reportForm.studentSeatNo || "...."} بتاريخ ${reportForm.reportDate || "...."} في يوم ${reportForm.dayName || "...."} الساعة ${reportForm.reportTime || "...."}.`,
                `A cheating report was issued for student ${reportForm.studentName || "...."}, grade ${reportForm.studentGrade || "...."}, seat number ${reportForm.studentSeatNo || "...."}, on ${reportForm.reportDate || "...."}, ${reportForm.dayName || "...."}, at ${reportForm.reportTime || "...."}.`,
              )}
              {reportForm.type === "student_absence" && tr(
                `تم تحرير محضر غياب للطالب ${reportForm.studentName || "...."} الصف ${reportForm.studentGrade || "...."} رقم الجلوس ${reportForm.studentSeatNo || "...."} بتاريخ ${reportForm.reportDate || "...."} في يوم ${reportForm.dayName || "...."} الساعة ${reportForm.reportTime || "...."}.`,
                `An absence report was issued for student ${reportForm.studentName || "...."}, grade ${reportForm.studentGrade || "...."}, seat number ${reportForm.studentSeatNo || "...."}, on ${reportForm.reportDate || "...."}, ${reportForm.dayName || "...."}, at ${reportForm.reportTime || "...."}.`,
              )}
              {reportForm.type === "teacher_absence" && tr(
                `تم تحرير محضر غياب للمعلم ${reportForm.teacherName || "...."} بتاريخ ${reportForm.reportDate || "...."} في يوم ${reportForm.dayName || "...."} الساعة ${reportForm.reportTime || "...."}.`,
                `An absence report was issued for teacher ${reportForm.teacherName || "...."} on ${reportForm.reportDate || "...."}, ${reportForm.dayName || "...."}, at ${reportForm.reportTime || "...."}.`,
              )}
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, background: LIGHT_CARD_BACKGROUNDS[3] }}>
          <div style={sectionTitleStyle}>{tr("سجل التقارير المحفوظة", "Saved reports log")}</div>
          {groupedReports.length ? (
            <div style={{ display: "grid", gap: 16 }}>
              {groupedReports.map((group) => (
                <div
                  key={group.type}
                  style={{
                    overflowX: "auto",
                    border: "1px solid rgba(212,175,55,0.16)",
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.02)",
                    padding: 10,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 10, color: "#111111" }}>{group.title}</div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <Th>{tr("النوع", "Type")}</Th>
                        <Th>{tr("التاريخ", "Date")}</Th>
                        <Th>{tr("اليوم", "Day")}</Th>
                        <Th>{tr("الوقت", "Time")}</Th>
                        <Th>{tr("المادة / الاسم", "Subject / name")}</Th>
                        <Th>{tr("إجراءات", "Actions")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((report) => (
                        <tr key={report.id}>
                          <Td>{titleForType(report.type)}</Td>
                          <Td>{report.reportDate}</Td>
                          <Td>{report.dayName}</Td>
                          <Td>{report.reportTime}</Td>
                          <Td>{report.subject || report.studentName || report.teacherName || "-"}</Td>
                          <Td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button onClick={() => setPrintingId(report.id)} style={miniButtonStyle("linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%)")}>
                                {tr("تحديد للطباعة", "Select for print")}
                              </button>
                              <button onClick={() => printReport(report)} style={miniButtonStyle("linear-gradient(180deg, #f5d0fe 0%, #e9d5ff 100%)")}>
                                {tr("طباعة", "Print")}
                              </button>
                              <button onClick={() => deleteReport(report.id)} style={miniButtonStyle("linear-gradient(180deg, #fecaca 0%, #fca5a5 100%)")}>
                                {tr("حذف", "Delete")}
                              </button>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <tbody>
                  <tr>
                    <Td colSpan={6}>{tr("لا توجد تقارير محفوظة.", "No saved reports yet.")}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function OfficialControlHeader({
  data,
  lang,
  title,
  subtitle,
}: {
  data: OfficialControlHeaderData;
  lang: Lang;
  title: string;
  subtitle: string;
}) {
  return (
    <section style={officialHeaderStyle}>
      <div style={officialHeaderTopLineStyle} />
      <div style={officialHeaderGridStyle}>
        <div style={{ ...officialHeaderSideStyle, textAlign: lang === "ar" ? "right" : "left" }}>
          <div style={officialHeaderMainLineStyle}>{data.country}</div>
          <div style={officialHeaderMainLineStyle}>{data.ministry}</div>
          <div style={officialHeaderSubLineStyle}>{data.directorate}</div>
          <div style={officialHeaderSubLineStyle}>{data.centerName}</div>
        </div>

        <div style={officialLogoWrapStyle}>
          <img
            src={data.logoUrl || DEFAULT_LOGO_URL}
            alt="logo"
            style={officialLogoStyle}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).src = DEFAULT_LOGO_URL;
            }}
          />
        </div>

        <div style={{ ...officialHeaderSideStyle, textAlign: lang === "ar" ? "left" : "right" }}>
          <div style={officialDocumentTitleStyle}>{title}</div>
          <div style={officialHeaderSubLineStyle}>{subtitle}</div>
          <div style={officialHeaderSubLineStyle}>{data.semester}</div>
          <div style={officialHeaderSubLineStyle}>
            {lang === "ar" ? "العام الدراسي" : "Academic Year"} {data.academicYear}
          </div>
        </div>
      </div>

      <div style={officialInfoStripStyle}>
        <span>{lang === "ar" ? "رئيس المركز" : "Center Head"}: {data.controlHeadName || "—"}</span>
        <span>{lang === "ar" ? "الصفحة" : "Page"}: {title}</span>
        <span>{new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 900, color: "#000000", fontSize: 18 }}>{label}</span>
      <input type={type} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 900, color: "#000000", fontSize: 18 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="" style={{ color: "#000000", fontWeight: 900 }}></option>
        {options.map((item) => (
          <option key={item.value} value={item.value} style={{ color: "#000000", fontWeight: 900 }}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ ...cellStyle, fontWeight: 900, color: "#000000", textShadow: "0 0 8px rgba(212,175,55,0.16)" }}>{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} style={cellStyle}>
      {children}
    </td>
  );
}

const cardStyle: React.CSSProperties = {
  border: "4px solid #d6bd55",
  borderRadius: 28,
  padding: 22,
  background: "linear-gradient(180deg, #fffdf6 0%, #f7f0d8 100%)",
  boxShadow: "0 0 0 5px rgba(245,232,170,0.30) inset, 0 12px 34px rgba(126,98,18,0.12)",
};

const officialToolbarStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: "#111827",
  borderWidth: 3,
  background: "linear-gradient(180deg, #fff9df 0%, #f7edc5 100%)",
};

const officialHeaderStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  border: "4px solid #111827",
  borderRadius: 28,
  padding: 22,
  background: "linear-gradient(180deg, #fffdf2 0%, #f8efca 100%)",
  boxShadow: "0 18px 42px rgba(0,0,0,0.10), 0 0 0 6px rgba(230,210,122,0.35) inset",
};

const officialHeaderTopLineStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  left: 0,
  height: 8,
  background: GOLD_SHINE,
};

const officialHeaderGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) 150px minmax(280px, 1fr)",
  gap: 22,
  alignItems: "center",
  borderBottom: "3px solid #111827",
  paddingBottom: 18,
};

const officialHeaderSideStyle: React.CSSProperties = {
  color: BLACK,
  fontWeight: 900,
  lineHeight: 1.6,
};

const officialHeaderMainLineStyle: React.CSSProperties = {
  fontSize: 25,
  fontWeight: 900,
  color: BLACK,
};

const officialHeaderSubLineStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: BLACK,
};

const officialDocumentTitleStyle: React.CSSProperties = {
  fontSize: 29,
  fontWeight: 900,
  color: BLACK,
  textDecoration: "underline",
  textUnderlineOffset: 8,
};

const officialLogoWrapStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
};

const officialLogoStyle: React.CSSProperties = {
  width: 112,
  height: 112,
  objectFit: "contain",
};

const officialInfoStripStyle: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  border: "3px solid #111827",
  borderRadius: 18,
  padding: "10px 16px",
  background: "rgba(255,255,255,0.62)",
  color: BLACK,
  fontWeight: 900,
  fontSize: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 16,
  color: "#000000",
  textShadow: "0 0 10px rgba(212,175,55,0.18)",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  border: "2px solid #111827",
  direction: "rtl",
};

const cellStyle: React.CSSProperties = {
  border: "1.5px solid rgba(17,24,39,0.85)",
  padding: "12px 10px",
  textAlign: "center",
  color: "#000000",
  verticalAlign: "middle",
  fontWeight: 900,
  background: "rgba(255,253,246,0.82)",
};

const inputStyle: React.CSSProperties = {
  borderRadius: 22,
  border: "2px solid #111827",
  background: "linear-gradient(180deg, #ffffff 0%, #fff9df 100%)",
  color: "#000000",
  padding: "12px 14px",
  outline: "none",
  fontWeight: 900,
  fontSize: 18,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
};

const previewBoxStyle: React.CSSProperties = {
  border: "2px solid #ead98b",
  borderRadius: 18,
  padding: 12,
  color: "#000000",
  minHeight: 78,
  display: "grid",
  alignContent: "center",
  background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  fontWeight: 900,
};

const buttonStyle = (background: string): React.CSSProperties => ({
  background,
  color: "#000000",
  border: "2px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: "11px 16px",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.65)",
});

const miniButtonStyle = (background: string): React.CSSProperties => ({
  ...buttonStyle(background),
  background,
  borderRadius: 12,
  padding: "10px 16px",
  fontSize: 14,
  color: "#000000",
  fontWeight: 900,
});
