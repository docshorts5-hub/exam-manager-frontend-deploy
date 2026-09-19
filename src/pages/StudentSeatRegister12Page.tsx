import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../auth/AuthContext";
import { loadTenantArray, loadTenantSettings, replaceTenantArray, subscribeTenantArray } from "../services/tenantData";

type AttendanceStatus = "حاضر" | "غائب";

type SubjectSlot = {
  label: string;
  subjectKey: SubjectKey;
  serialKey: SerialKey;
  roomKey: RoomKey;
  statusKey: StatusKey;
};

type SubjectKey =
  | "subject1" | "subject2" | "subject3" | "subject4"
  | "subject5" | "subject6" | "subject7" | "subject8";

type SerialKey =
  | "serialNo1" | "serialNo2" | "serialNo3" | "serialNo4"
  | "serialNo5" | "serialNo6" | "serialNo7" | "serialNo8";

type RoomKey =
  | "roomNo1" | "roomNo2" | "roomNo3" | "roomNo4"
  | "roomNo5" | "roomNo6" | "roomNo7" | "roomNo8";

type StatusKey =
  | "status1" | "status2" | "status3" | "status4"
  | "status5" | "status6" | "status7" | "status8";

type StudentRecord = {
  id: string;
  studentNo: string;
  cardNo: string;
  seatNo: string;
  studentName: string;
  governorate: string;
  schoolCode: string;
  schoolName: string;
  examCenterCode: string;
  examCenterName: string;

  subject1: string;
  subject2: string;
  subject3: string;
  subject4: string;
  subject5: string;
  subject6: string;
  subject7: string;
  subject8: string;

  serialNo1: string;
  serialNo2: string;
  serialNo3: string;
  serialNo4: string;
  serialNo5: string;
  serialNo6: string;
  serialNo7: string;
  serialNo8: string;

  roomNo1: string;
  roomNo2: string;
  roomNo3: string;
  roomNo4: string;
  roomNo5: string;
  roomNo6: string;
  roomNo7: string;
  roomNo8: string;

  status1: AttendanceStatus;
  status2: AttendanceStatus;
  status3: AttendanceStatus;
  status4: AttendanceStatus;
  status5: AttendanceStatus;
  status6: AttendanceStatus;
  status7: AttendanceStatus;
  status8: AttendanceStatus;
};

type ExamCenterData = {
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

type ExamItem = {
  subject: string;
  dateISO: string;
  dayLabel: string;
  period?: string;
  time?: string;
};

const STORAGE_KEY = "exam-manager:student-seat-register12:v4";
const LEGACY_KEYS = [
  "exam-manager:student-seat-register12:v3",
  "exam-manager:student-seat-register12:v2",
  "exam-manager:student-seat-register12:v1",
];
const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const EXAMS_SUB = "exams";
const STUDENT_SEAT_REGISTER12_SUB = "studentSeatRegister12";
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";

const SUBJECT_SLOTS: SubjectSlot[] = [
  { label: "المادة 1", subjectKey: "subject1", serialKey: "serialNo1", roomKey: "roomNo1", statusKey: "status1" },
  { label: "المادة 2", subjectKey: "subject2", serialKey: "serialNo2", roomKey: "roomNo2", statusKey: "status2" },
  { label: "المادة 3", subjectKey: "subject3", serialKey: "serialNo3", roomKey: "roomNo3", statusKey: "status3" },
  { label: "المادة 4", subjectKey: "subject4", serialKey: "serialNo4", roomKey: "roomNo4", statusKey: "status4" },
  { label: "المادة 5", subjectKey: "subject5", serialKey: "serialNo5", roomKey: "roomNo5", statusKey: "status5" },
  { label: "المادة 6", subjectKey: "subject6", serialKey: "serialNo6", roomKey: "roomNo6", statusKey: "status6" },
  { label: "المادة 7", subjectKey: "subject7", serialKey: "serialNo7", roomKey: "roomNo7", statusKey: "status7" },
  { label: "المادة 8", subjectKey: "subject8", serialKey: "serialNo8", roomKey: "roomNo8", statusKey: "status8" },
];

const DEFAULT_SUBJECT_VALUES = [
  { subject: "الرياضيات المتقدمة", serialNo: "952" },
  { subject: "التربية الإسلامية", serialNo: "1953" },
  { subject: "اللغة العربية", serialNo: "1953" },
  { subject: "اللغة الإنجليزية", serialNo: "1953" },
  { subject: "الدراسات الاجتماعية", serialNo: "1953" },
  { subject: "الكيمياء", serialNo: "892" },
  { subject: "الفيزياء", serialNo: "664" },
  { subject: "", serialNo: "" },
];

function makeId() {
  const c: any = globalThis as any;
  if (c?.crypto?.randomUUID) return c.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emptyStudent(): StudentRecord {
  const base: StudentRecord = {
    id: makeId(),
    studentNo: "",
    cardNo: "",
    seatNo: "",
    studentName: "",
    governorate: "",
    schoolCode: "",
    schoolName: "",
    examCenterCode: "",
    examCenterName: "",

    subject1: "", subject2: "", subject3: "", subject4: "",
    subject5: "", subject6: "", subject7: "", subject8: "",

    serialNo1: "", serialNo2: "", serialNo3: "", serialNo4: "",
    serialNo5: "", serialNo6: "", serialNo7: "", serialNo8: "",

    roomNo1: "", roomNo2: "", roomNo3: "", roomNo4: "",
    roomNo5: "", roomNo6: "", roomNo7: "", roomNo8: "",

    status1: "حاضر", status2: "حاضر", status3: "حاضر", status4: "حاضر",
    status5: "حاضر", status6: "حاضر", status7: "حاضر", status8: "حاضر",
  };

  SUBJECT_SLOTS.forEach((slot, index) => {
    const defaults = DEFAULT_SUBJECT_VALUES[index];
    base[slot.subjectKey] = defaults?.subject || "";
    base[slot.serialKey] = defaults?.serialNo || "";
    base[slot.roomKey] = "";
    base[slot.statusKey] = "حاضر";
  });

  return base;
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStudentSeatEmailCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function maskEmailForStudentSeatAccess(value: unknown) {
  const email = String(value || "").trim();
  const [local, domain] = email.split("@");
  if (!local || !domain) return email ? "***" : "";
  if (local.length <= 2) return `${local.slice(0, 1)}***@${domain}`;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 2, 3))}${local.slice(-1)}@${domain}`;
}

function normalizeStudentSeatEmailForCheck(value: unknown) {
  return String(value || "").trim().toLowerCase();
}


const STUDENT_SEAT_REGISTER12_ACCESS_WORKER_URL = getAccessWorkerUrl();
const STUDENT_SEAT_REGISTER12_ACCESS_SESSION_DURATION_MS = 10 * 60 * 1000;

async function callStudentSeatRegister12AccessWorker(path: string, firebaseUser: any, payload: Record<string, unknown>) {
  const token = await firebaseUser?.getIdToken?.();

  if (!token) {
    throw new Error("تعذر الحصول على صلاحية المستخدم الحالية. سجّل الدخول مرة أخرى.");
  }

  const response = await fetch(STUDENT_SEAT_REGISTER12_ACCESS_WORKER_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({} as any));

  if (!response.ok || data?.ok === false) {
    const message =
      data?.message ||
      data?.details?.message ||
      data?.error ||
      "تعذر تنفيذ طلب رمز الدخول.";
    const error: any = new Error(message);
    error.status = response.status;
    error.details = data;
    error.data = data;
    throw error;
  }

  return data;
}

function getStudentSeatEmailGateErrorDetails(error: any): any {
  return error?.details || error?.customData?.details || error?.data || {};
}

function getStudentSeatLockedUntilISOFromError(error: any, fallbackSeconds = 5 * 60) {
  const details = getStudentSeatEmailGateErrorDetails(error);
  const explicit = String(details?.lockedUntilISO || details?.lockedUntil || "").trim();
  if (explicit && !Number.isNaN(new Date(explicit).getTime())) return explicit;

  const retryAfterSeconds = Number(details?.retryAfterSeconds || details?.retryAfter || 0);
  const seconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds : fallbackSeconds;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function formatStudentSeatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function normalizeStatus(value: unknown): AttendanceStatus {
  return clean(value).includes("غائب") ? "غائب" : "حاضر";
}

function normalizeHeader(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9]/g, "");
}

function getCell(row: any, keys: string[]) {
  const normalized: Record<string, any> = {};
  Object.keys(row || {}).forEach((key) => {
    normalized[normalizeHeader(key)] = row[key];
  });

  for (const key of keys) {
    const direct = row?.[key];
    if (direct !== undefined && direct !== null && clean(direct) !== "") return clean(direct);
    const normalizedValue = normalized[normalizeHeader(key)];
    if (normalizedValue !== undefined && normalizedValue !== null && clean(normalizedValue) !== "") return clean(normalizedValue);
  }
  return "";
}

function readExamCenterData(): ExamCenterData {
  const saved = safeJson<ExamCenterData>(localStorage.getItem(EXAM_CENTER_DATA_KEY), {});
  return {
    ...saved,
    controlHeadName: clean(saved?.controlHeadName || localStorage.getItem(CONTROL_HEAD_NAME_KEY) || ""),
  };
}

function mapCloudExamCenterData(raw: any): ExamCenterData {
  const examCenterCode = clean(raw?.examCenterCode || raw?.centerCode || "");
  return {
    name: clean(raw?.name || raw?.centerName || raw?.examCenterName || ""),
    examCenterCode,
    centerCode: examCenterCode,
    governorate: clean(raw?.governorate || raw?.directorate || raw?.directorateName || ""),
    semester: clean(raw?.semester || raw?.term || raw?.semesterLabel || ""),
    phone: clean(raw?.phone || raw?.phoneNumber || ""),
    address: clean(raw?.address || raw?.location || ""),
    controlHeadName: clean(raw?.controlHeadName || raw?.centerHeadName || raw?.centerHead || ""),
    academicYear: clean(raw?.academicYear || raw?.yearLabel || ""),
    logo: clean(raw?.logo || raw?.logoUrl || ""),
  };
}

function hasExamCenterData(value: ExamCenterData) {
  return Boolean(
    clean(value.name) ||
      clean(value.examCenterCode) ||
      clean(value.centerCode) ||
      clean(value.governorate) ||
      clean(value.semester) ||
      clean(value.phone) ||
      clean(value.address) ||
      clean(value.controlHeadName) ||
      clean(value.academicYear) ||
      clean(value.logo)
  );
}

function normalizeRecordsList(rows: any[]): StudentRecord[] {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeRecord)
    .filter((record) => record.seatNo || record.studentNo || record.studentName);
}

function buildRecordsSignature(rows: StudentRecord[]) {
  return JSON.stringify(
    normalizeRecordsList(rows).map((record) => {
      const item: any = {
        id: record.id,
        studentNo: record.studentNo,
        cardNo: record.cardNo,
        seatNo: record.seatNo,
        studentName: record.studentName,
        governorate: record.governorate,
        schoolCode: record.schoolCode,
        schoolName: record.schoolName,
        examCenterCode: record.examCenterCode,
        examCenterName: record.examCenterName,
      };

      SUBJECT_SLOTS.forEach((slot) => {
        item[slot.subjectKey] = record[slot.subjectKey];
        item[slot.serialKey] = record[slot.serialKey];
        item[slot.roomKey] = record[slot.roomKey];
        item[slot.statusKey] = record[slot.statusKey];
      });

      return item;
    })
  );
}

function currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 9 ? year : year - 1;
  return `${start}/${start + 1}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getOfficialLogoUrl() {
  return clean(localStorage.getItem(EXAM_CENTER_LOGO_KEY)) || DEFAULT_LOGO_URL;
}

function getOfficialDirectorate(centerData: ExamCenterData) {
  const value = clean(centerData.governorate);
  if (!value) return "المديرية العامة للتعليم";
  return value.includes("المديرية") ? value : `المديرية العامة للتعليم بمحافظة ${value}`;
}

function getOfficialCenterName(centerData: ExamCenterData, fallback?: string) {
  return clean(centerData.name) || clean(fallback) || "مركز الامتحانات";
}

function getOfficialCenterCode(centerData: ExamCenterData, fallback?: string) {
  return clean(centerData.examCenterCode) || clean(centerData.centerCode) || clean(fallback) || "";
}

function normalizeCompareText(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9]/g, "");
}

function subjectsMatch(a: string, b: string) {
  const aa = normalizeCompareText(a);
  const bb = normalizeCompareText(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function formatDateDMY(value: string) {
  const raw = clean(value);
  if (!raw) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const y = String(dt.getFullYear());
    return `${d}/${m}/${y}`;
  }
  return raw;
}

function getArabicWeekday(value: string) {
  const raw = clean(value);
  if (!raw) return "";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return "";
  const map = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return map[dt.getDay()] || "";
}

function normalizeExamRow(row: any): ExamItem {
  return {
    subject: clean(row?.subject ?? row?.examSubject ?? row?.subjectName ?? row?.examName ?? row?.name),
    dateISO: clean(row?.dateISO ?? row?.date ?? row?.examDateISO ?? row?.examDate),
    dayLabel: clean(row?.dayLabel ?? row?.day ?? row?.weekday ?? row?.weekDay),
    period: clean(row?.period ?? row?.periodKey ?? row?.session),
    time: clean(row?.time ?? row?.startTime),
  };
}

function getStudentScheduledRows(record: StudentRecord, examsRows: ExamItem[]) {
  const rows = SUBJECT_SLOTS
    .map((slot) => ({
      subject: clean(record[slot.subjectKey]),
      status: record[slot.statusKey],
    }))
    .filter((item) => item.subject);

  const mapped = rows.map((item, index) => {
    const exam = examsRows.find((row) => subjectsMatch(row.subject, item.subject));
    const dateRaw = clean(exam?.dateISO);
    const dateText = formatDateDMY(dateRaw);
    const dayText = clean(exam?.dayLabel) || getArabicWeekday(dateRaw);
    return {
      index: index + 1,
      subject: item.subject,
      status: item.status,
      dateRaw,
      dateText,
      dayText,
    };
  });

  const withDates = mapped.filter((item) => item.dateRaw).sort((a, b) => a.dateRaw.localeCompare(b.dateRaw));
  const withoutDates = mapped.filter((item) => !item.dateRaw);

  return [...withDates, ...withoutDates];
}

function normalizeRecord(raw: any): StudentRecord {
  const base = emptyStudent();

  const normalized: StudentRecord = {
    ...base,
    id: clean(raw?.id) || makeId(),
    studentNo: clean(raw?.studentNo),
    cardNo: clean(raw?.cardNo),
    seatNo: clean(raw?.seatNo),
    studentName: clean(raw?.studentName),
    governorate: clean(raw?.governorate),
    schoolCode: clean(raw?.schoolCode),
    schoolName: clean(raw?.schoolName),
    examCenterCode: clean(raw?.examCenterCode),
    examCenterName: clean(raw?.examCenterName),
  };

  SUBJECT_SLOTS.forEach((slot, index) => {
    const defaults = DEFAULT_SUBJECT_VALUES[index];
    normalized[slot.subjectKey] = clean(raw?.[slot.subjectKey] ?? defaults?.subject ?? "");
    normalized[slot.serialKey] = clean(raw?.[slot.serialKey] ?? defaults?.serialNo ?? "");
    normalized[slot.roomKey] = clean(raw?.[slot.roomKey] ?? "");
    normalized[slot.statusKey] = normalizeStatus(raw?.[slot.statusKey] ?? raw?.status ?? "حاضر");
  });

  if (Array.isArray(raw?.subjects)) {
    SUBJECT_SLOTS.forEach((slot, index) => {
      const item = raw.subjects[index] || {};
      normalized[slot.subjectKey] = clean(item?.subject ?? normalized[slot.subjectKey]);
      normalized[slot.serialKey] = clean(item?.serialNo ?? normalized[slot.serialKey]);
      normalized[slot.roomKey] = clean(item?.roomNo ?? normalized[slot.roomKey]);
      normalized[slot.statusKey] = normalizeStatus(item?.status);
    });
  }

  return normalized;
}

function loadInitialRecords(): StudentRecord[] {
  const current = safeJson<any[]>(localStorage.getItem(STORAGE_KEY), []);
  if (Array.isArray(current) && current.length) return current.map(normalizeRecord);

  for (const key of LEGACY_KEYS) {
    const legacy = safeJson<any[]>(localStorage.getItem(key), []);
    if (Array.isArray(legacy) && legacy.length) return legacy.map(normalizeRecord);
  }

  return [];
}

function importRows(rows: any[]): StudentRecord[] {
  return rows.map((row) => {
    const record = emptyStudent();

    record.studentNo = getCell(row, ["رقم الطالب", "رقمالطالب", "studentNo", "student number"]);
    record.cardNo = getCell(row, ["رقم البطاقة", "رقمالبطاقة", "cardNo", "card number"]);
    record.seatNo = getCell(row, ["رقم الجلوس", "رقمالجلوس", "seatNo", "seat number"]);
    record.studentName = getCell(row, ["الاسم", "اسم الطالب", "اسمالطالب", "studentName", "student name"]);
    record.governorate = getCell(row, ["المحافظة", "governorate"]);
    record.schoolCode = getCell(row, ["رمز المدرسة", "رمزالمدرسة", "schoolCode"]);
    record.schoolName = getCell(row, ["المدرسة", "اسم المدرسة", "schoolName"]);
    record.examCenterCode = getCell(row, ["رمز مركز الامتحان", "رمزمركزالامتحان", "examCenterCode"]);
    record.examCenterName = getCell(row, ["مركز الامتحان", "مركزالامتحان", "examCenterName"]);

    SUBJECT_SLOTS.forEach((slot, index) => {
      const number = index + 1;
      record[slot.subjectKey] = getCell(row, [
        `المادة ${number}`,
        `المادة${number}`,
        `subject ${number}`,
        `subject${number}`,
      ]) || record[slot.subjectKey];

      record[slot.serialKey] = getCell(row, [
        `رقم المسلسل ${number}`,
        `رقمالمسلسل${number}`,
        `serialNo${number}`,
        `serial ${number}`,
      ]) || record[slot.serialKey];

      record[slot.roomKey] = getCell(row, [
        `رقم القاعة ${number}`,
        `رقمالقاعة${number}`,
        `roomNo${number}`,
        `room ${number}`,
      ]);

      record[slot.statusKey] = normalizeStatus(getCell(row, [
        `حاضر/غائب ${number}`,
        `الحالة ${number}`,
        `status${number}`,
        `attendance${number}`,
      ]));
    });

    return record;
  }).filter((record) => record.seatNo || record.studentNo || record.studentName);
}

export default function StudentSeatRegister12Page() {
  const { lang } = useI18n();
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || user?.tenantId || "").trim() || "default";
  const currentUserId = String(user?.email || user?.uid || "").trim();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [records, setRecords] = useState<StudentRecord[]>(() => loadInitialRecords());
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<StudentRecord>(() => emptyStudent());
  const [searchSeatNo, setSearchSeatNo] = useState("");
  const [centerData, setCenterData] = useState<ExamCenterData>(() => readExamCenterData());
  const [officialLogo, setOfficialLogo] = useState(() => getOfficialLogoUrl());
  const [examsRows, setExamsRows] = useState<ExamItem[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("");
  const [cloudError, setCloudError] = useState("");
  const cloudHydratedRef = useRef(false);
  const cloudRecordsSignatureRef = useRef("");

  const [emailGateCode, setEmailGateCode] = useState("");
  const [emailGateCodeSent, setEmailGateCodeSent] = useState(false);
  const [emailGateSending, setEmailGateSending] = useState(false);
  const [emailGateVerifying, setEmailGateVerifying] = useState(false);
  const [emailGateMessage, setEmailGateMessage] = useState("");
  const [emailGateError, setEmailGateError] = useState("");
  const [emailGateConfirmEmail, setEmailGateConfirmEmail] = useState("");
  const [emailGateEmailConfirmed, setEmailGateEmailConfirmed] = useState(false);
  const [emailGateVerified, setEmailGateVerified] = useState(false);
  const [emailGateLockedUntilISO, setEmailGateLockedUntilISO] = useState("");
  const [emailGateClockNow, setEmailGateClockNow] = useState(() => Date.now());

  const emailGateSessionKey = useMemo(() => `exam-manager:ssr12-email-code-access:${tenantId}`, [tenantId]);
  const emailGateLockStorageKey = useMemo(() => `exam-manager:student-seat-register12-email-code-lock:${tenantId}`, [tenantId]);
  const currentUserEmail = useMemo(
    () => String(user?.email || user?.profile?.email || user?.userProfile?.email || "").trim(),
    [user?.email, user?.profile?.email, user?.userProfile?.email]
  );
  const maskedCurrentUserEmail = useMemo(() => maskEmailForStudentSeatAccess(currentUserEmail), [currentUserEmail]);
  const emailGateLockedUntilMillis = useMemo(() => {
    if (!emailGateLockedUntilISO) return 0;
    const millis = new Date(emailGateLockedUntilISO).getTime();
    return Number.isFinite(millis) ? millis : 0;
  }, [emailGateLockedUntilISO]);
  const emailGateLockRemainingSeconds = Math.max(0, Math.ceil((emailGateLockedUntilMillis - emailGateClockNow) / 1000));
  const emailGateIsLocked = emailGateLockRemainingSeconds > 0;
  const emailGateCountdownText = formatStudentSeatCountdown(emailGateLockRemainingSeconds);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let hasValidEmailGateSession = false;

    try {
      const rawAccessSession = window.localStorage.getItem(emailGateSessionKey) || "";
      const nowMs = Date.now();

      if (rawAccessSession === "1") {
        window.localStorage.setItem(
          emailGateSessionKey,
          JSON.stringify({ expiresAt: nowMs + STUDENT_SEAT_REGISTER12_ACCESS_SESSION_DURATION_MS })
        );
        hasValidEmailGateSession = true;
      } else if (rawAccessSession) {
        const parsedAccessSession = JSON.parse(rawAccessSession) as { expiresAt?: number };
        const expiresAt = Number(parsedAccessSession?.expiresAt || 0);

        if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
          hasValidEmailGateSession = true;
        } else {
          window.localStorage.removeItem(emailGateSessionKey);
        }
      }
    } catch {
      window.localStorage.removeItem(emailGateSessionKey);
    }

    setEmailGateVerified(hasValidEmailGateSession);
    setEmailGateCode("");
    setEmailGateCodeSent(false);
    setEmailGateSending(false);
    setEmailGateVerifying(false);
    setEmailGateMessage("");
    setEmailGateError("");
    setEmailGateConfirmEmail("");
    setEmailGateEmailConfirmed(false);
    setEmailGateClockNow(Date.now());

    const savedLockedUntilISO = String(window.localStorage.getItem(emailGateLockStorageKey) || "").trim();
    const savedLockedUntilMillis = savedLockedUntilISO ? new Date(savedLockedUntilISO).getTime() : 0;
    if (savedLockedUntilMillis > Date.now()) {
      setEmailGateLockedUntilISO(savedLockedUntilISO);
      setEmailGateError("تم تجاوز عدد محاولات التحقق. انتظر انتهاء العد التنازلي قبل طلب رمز جديد.");
    } else {
      setEmailGateLockedUntilISO("");
      window.localStorage.removeItem(emailGateLockStorageKey);
    }
  }, [emailGateSessionKey, emailGateLockStorageKey]);

  useEffect(() => {
    if (!emailGateIsLocked) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setEmailGateClockNow(now);
      if (emailGateLockedUntilMillis > 0 && emailGateLockedUntilMillis <= now) {
        setEmailGateLockedUntilISO("");
        setEmailGateError("");
        try {
          window.localStorage.removeItem(emailGateLockStorageKey);
        } catch {
          // Ignore storage cleanup failures.
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailGateIsLocked, emailGateLockedUntilMillis, emailGateLockStorageKey]);

  const applyEmailGateLock = useCallback((error: any) => {
    const lockedUntilISO = getStudentSeatLockedUntilISOFromError(error);
    setEmailGateLockedUntilISO(lockedUntilISO);
    setEmailGateClockNow(Date.now());
    setEmailGateCode("");
    setEmailGateCodeSent(false);
    setEmailGateEmailConfirmed(false);
    setEmailGateMessage("");
    setEmailGateError("تم تجاوز عدد محاولات التحقق. لا يمكن طلب رمز جديد حتى انتهاء العد التنازلي.");
    try {
      window.localStorage.setItem(emailGateLockStorageKey, lockedUntilISO);
    } catch {
      // Ignore storage failures; state still enforces the lock for this mount.
    }
  }, [emailGateLockStorageKey]);

  const sendEmailGateCode = useCallback(async () => {
    if (!tenantId) {
      setEmailGateError("معرف المركز غير متوفر.");
      return;
    }

    if (emailGateIsLocked) {
      setEmailGateError(`تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد ${emailGateCountdownText}.`);
      return;
    }

    const expectedEmail = normalizeStudentSeatEmailForCheck(currentUserEmail);
    const enteredEmail = normalizeStudentSeatEmailForCheck(emailGateConfirmEmail);

    if (!expectedEmail) {
      setEmailGateEmailConfirmed(false);
      setEmailGateError("البريد الإلكتروني المسجل للحساب غير متوفر.");
      return;
    }

    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setEmailGateEmailConfirmed(false);
      setEmailGateCodeSent(false);
      setEmailGateCode("");
      setEmailGateError("البريد الإلكتروني غير مطابق للحساب الحالي. لن يتم إرسال رمز الدخول.");
      return;
    }

    setEmailGateEmailConfirmed(true);
    setEmailGateSending(true);
    setEmailGateError("");
    setEmailGateMessage("");

    try {
      const data = await callStudentSeatRegister12AccessWorker("/api/teachers12/request-code", user, {
        tenantId,
        page: "StudentSeatRegister12",
        to: expectedEmail,
      });

      setEmailGateCodeSent(true);
      setEmailGateMessage(data?.message || "تم إرسال رمز الدخول إلى البريد الإلكتروني المسجل للحساب.");
    } catch (error: any) {
      console.error("sendStudentSeatRegister12AccessCode failed:", error);
      const code = String(error?.code || "");
      const reason = String(getStudentSeatEmailGateErrorDetails(error)?.reason || "");
      if (code.includes("resource-exhausted") || reason === "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS") {
        applyEmailGateLock(error);
        return;
      }
      setEmailGateError(error?.message || "تعذر إرسال رمز الدخول إلى البريد الإلكتروني.");
    } finally {
      setEmailGateSending(false);
    }
  }, [tenantId, user, currentUserEmail, emailGateConfirmEmail, emailGateIsLocked, emailGateCountdownText, applyEmailGateLock]);

  const verifyEmailGateCode = useCallback(async () => {
    if (emailGateIsLocked) {
      setEmailGateError(`تم تجاوز عدد محاولات التحقق. يمكنك المحاولة بعد ${emailGateCountdownText}.`);
      return;
    }

    const code = normalizeStudentSeatEmailCode(emailGateCode);
    if (code.length !== 6) {
      setEmailGateError("أدخل رمزًا مكونًا من 6 أرقام.");
      return;
    }

    setEmailGateVerifying(true);
    setEmailGateError("");
    setEmailGateMessage("");

    try {
      const expectedEmail = normalizeStudentSeatEmailForCheck(currentUserEmail);

      await callStudentSeatRegister12AccessWorker("/api/teachers12/verify-code", user, {
        tenantId,
        page: "StudentSeatRegister12",
        to: expectedEmail,
        code,
      });

      try {
        window.localStorage.setItem(
          emailGateSessionKey,
          JSON.stringify({ expiresAt: Date.now() + STUDENT_SEAT_REGISTER12_ACCESS_SESSION_DURATION_MS })
        );
      } catch {
        // Ignore storage failures; current state still unlocks the page.
      }
      setEmailGateVerified(true);
      setEmailGateCode("");
      setEmailGateMessage("تم التحقق بنجاح.");
    } catch (error: any) {
      console.error("verifyStudentSeatRegister12AccessCode failed:", error);
      const code = String(error?.code || "");
      const reason = String(getStudentSeatEmailGateErrorDetails(error)?.reason || "");
      if (code.includes("resource-exhausted") || reason === "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS") {
        applyEmailGateLock(error);
        return;
      }
      setEmailGateError(error?.message || "رمز الدخول غير صحيح أو انتهت صلاحيته.");
    } finally {
      setEmailGateVerifying(false);
    }
  }, [emailGateCode, emailGateSessionKey, tenantId, user, currentUserEmail, emailGateIsLocked, emailGateCountdownText, applyEmailGateLock]);

  useEffect(() => {
    const normalized = normalizeRecordsList(records);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

    if (!cloudHydratedRef.current) return;

    const signature = buildRecordsSignature(normalized);
    if (signature === cloudRecordsSignatureRef.current) return;

    const timeout = window.setTimeout(() => {
      cloudRecordsSignatureRef.current = signature;
      setCloudStatus("جاري حفظ بيانات الطلاب في السحابة...");

      void replaceTenantArray(tenantId, STUDENT_SEAT_REGISTER12_SUB, normalized as any[], {
        by: currentUserId || undefined,
        audit: {
          entity: STUDENT_SEAT_REGISTER12_SUB,
          meta: {
            summary: "saved student seat register records",
            count: normalized.length,
          },
        },
      })
        .then(() => {
          setCloudStatus("تم حفظ بيانات الطلاب في السحابة.");
        })
        .catch(() => {
          setCloudError("تم الحفظ مؤقتًا على هذا الجهاز، لكن تعذر الحفظ في السحابة.");
        });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [records, tenantId, currentUserId]);

  useEffect(() => {
    const applyCenterData = (nextCenterData: ExamCenterData) => {
      setCenterData(nextCenterData);
      if (nextCenterData.logo) {
        setOfficialLogo(nextCenterData.logo);
        localStorage.setItem(EXAM_CENTER_LOGO_KEY, nextCenterData.logo);
      }

      setForm((prev) => ({
        ...prev,
        examCenterName: getOfficialCenterName(nextCenterData),
        examCenterCode: getOfficialCenterCode(nextCenterData),
      }));
    };

    const refresh = () => {
      const nextCenterData = readExamCenterData();
      applyCenterData(nextCenterData);
      setOfficialLogo(getOfficialLogoUrl());
    };

    async function refreshCenterFromCloud() {
      try {
        const cloud = await loadTenantSettings<any>(tenantId, DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID, {});
        const nextCenterData = mapCloudExamCenterData(cloud);
        if (!hasExamCenterData(nextCenterData)) return;

        localStorage.setItem(EXAM_CENTER_DATA_KEY, JSON.stringify(nextCenterData));
        if (nextCenterData.logo) localStorage.setItem(EXAM_CENTER_LOGO_KEY, nextCenterData.logo);
        if (nextCenterData.controlHeadName) localStorage.setItem(CONTROL_HEAD_NAME_KEY, nextCenterData.controlHeadName);

        applyCenterData(nextCenterData);
      } catch {
        refresh();
      }
    }

    refresh();
    if (emailGateVerified) void refreshCenterFromCloud();

    window.addEventListener("storage", refresh);
    window.addEventListener("exam-manager:changed", refresh);
    window.addEventListener("exam-manager:control-head-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("exam-manager:changed", refresh);
      window.removeEventListener("exam-manager:control-head-changed", refresh);
    };
  }, [tenantId, emailGateVerified]);

  useEffect(() => {
    if (!emailGateVerified) {
      cloudHydratedRef.current = false;
      setCloudLoading(false);
      setCloudStatus("");
      setCloudError("");
      return;
    }

    let mounted = true;
    let unsubscribeStudents: (() => void) | undefined;
    let unsubscribeExams: (() => void) | undefined;

    const normalizeExams = (rows: any[]) =>
      (Array.isArray(rows) ? rows : [])
        .map((row) => normalizeExamRow(row))
        .filter((row) => row.subject || row.dateISO);

    async function loadCloudData() {
      setCloudLoading(true);
      setCloudError("");
      setCloudStatus("جاري تحميل بيانات الطلاب من السحابة...");

      try {
        const [studentRows, examRows] = await Promise.all([
          loadTenantArray<any>(tenantId, STUDENT_SEAT_REGISTER12_SUB, { cacheFallback: true }).catch(() => []),
          loadTenantArray<any>(tenantId, EXAMS_SUB, { cacheFallback: true }).catch(() => []),
        ]);

        if (!mounted) return;

        const cloudRecords = normalizeRecordsList(studentRows);
        const localRecords = normalizeRecordsList(loadInitialRecords());

        if (cloudRecords.length) {
          cloudRecordsSignatureRef.current = buildRecordsSignature(cloudRecords);
          setRecords(cloudRecords);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudRecords));
          setCloudStatus("تم تحميل بيانات الطلاب من السحابة.");
        } else if (localRecords.length) {
          cloudRecordsSignatureRef.current = buildRecordsSignature(localRecords);
          setRecords(localRecords);

          await replaceTenantArray(tenantId, STUDENT_SEAT_REGISTER12_SUB, localRecords as any[], {
            by: currentUserId || undefined,
            audit: {
              entity: STUDENT_SEAT_REGISTER12_SUB,
              meta: {
                summary: "migrated student seat register records from localStorage to cloud",
                count: localRecords.length,
              },
            },
          });

          setCloudStatus("تم ترحيل بيانات الطلاب من هذا الجهاز إلى السحابة.");
        } else {
          cloudRecordsSignatureRef.current = buildRecordsSignature([]);
          setCloudStatus("لا توجد بيانات طلاب محفوظة بعد.");
        }

        setExamsRows(normalizeExams(examRows));
        cloudHydratedRef.current = true;

        unsubscribeStudents = subscribeTenantArray<any>(
          tenantId,
          STUDENT_SEAT_REGISTER12_SUB,
          (items) => {
            const normalized = normalizeRecordsList(items);
            cloudRecordsSignatureRef.current = buildRecordsSignature(normalized);
            setRecords(normalized);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          },
          () => {
            setCloudError("تعذر الاتصال اللحظي ببيانات الطلاب.");
          }
        );

        unsubscribeExams = subscribeTenantArray<any>(
          tenantId,
          EXAMS_SUB,
          (items) => {
            setExamsRows(normalizeExams(items));
          }
        );
      } catch {
        if (!mounted) return;
        cloudHydratedRef.current = true;
        setExamsRows([]);
        setCloudError("تعذر تحميل بيانات الطلاب من السحابة؛ يتم عرض آخر نسخة محفوظة على الجهاز.");
      } finally {
        if (mounted) setCloudLoading(false);
      }
    }

    void loadCloudData();

    return () => {
      mounted = false;
      unsubscribeStudents?.();
      unsubscribeExams?.();
    };
  }, [tenantId, currentUserId, emailGateVerified]);

  const currentIndex = useMemo(() => records.findIndex((record) => record.id === selectedId), [records, selectedId]);
  const academicYear = centerData.academicYear || currentAcademicYear();
  const semester = centerData.semester || "الفصل الدراسي الأول";
  const centerHeadName = centerData.controlHeadName || "رئيس المركز";

  useEffect(() => {
    const officialCenterName = getOfficialCenterName(centerData);
    const officialCenterCode = getOfficialCenterCode(centerData);

    setForm((prev) =>
      prev.examCenterName === officialCenterName && prev.examCenterCode === officialCenterCode
        ? prev
        : { ...prev, examCenterName: officialCenterName, examCenterCode: officialCenterCode }
    );
  }, [centerData.name, centerData.examCenterCode, centerData.centerCode, centerData.governorate]);

  const getBoundExamCenterName = () => getOfficialCenterName(centerData);
  const getBoundExamCenterCode = () => getOfficialCenterCode(centerData);

  const bindExamCenterData = (record: StudentRecord): StudentRecord => ({
    ...record,
    examCenterName: getBoundExamCenterName(),
    examCenterCode: getBoundExamCenterCode(),
  });

  const selectRecord = (record: StudentRecord) => {
    const normalized = bindExamCenterData(normalizeRecord(record));
    setSelectedId(normalized.id);
    setForm(normalized);
  };

  const updateField = <K extends keyof StudentRecord>(key: K, value: StudentRecord[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveCurrent = () => {
    if (!form.seatNo.trim() && !form.studentNo.trim() && !form.studentName.trim()) {
      alert("أدخل بيانات الطالب أولًا.");
      return;
    }

    const normalized = bindExamCenterData(normalizeRecord(form));
    if (selectedId) {
      setRecords((prev) => prev.map((record) => (record.id === selectedId ? { ...normalized, id: selectedId } : record)));
    } else {
      const next = { ...normalized, id: normalized.id || makeId() };
      setRecords((prev) => [next, ...prev]);
      setSelectedId(next.id);
    }
    setCloudStatus("تم تحديث السجل وسيتم حفظه في السحابة.");
    alert("تم حفظ البيانات.");
  };

  const newRecord = () => {
    setSelectedId("");
    setForm(bindExamCenterData(emptyStudent()));
  };

  const deleteCurrent = () => {
    if (!selectedId) return;
    if (!window.confirm("هل تريد حذف السجل الحالي؟")) return;
    setRecords((prev) => prev.filter((record) => record.id !== selectedId));
    newRecord();
  };

  const doSearch = () => {
    const target = searchSeatNo.trim();
    if (!target) return;
    const found = records.find((record) => clean(record.seatNo) === target || clean(record.seatNo).includes(target));
    if (!found) {
      alert("لا يوجد طالب بهذا رقم الجلوس.");
      return;
    }
    selectRecord(found);
  };

  const goPrev = () => {
    if (!records.length) return;
    const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    selectRecord(records[nextIndex]);
  };

  const goNext = () => {
    if (!records.length) return;
    const nextIndex = currentIndex < 0 ? 0 : Math.min(records.length - 1, currentIndex + 1);
    selectRecord(records[nextIndex]);
  };

  const importExcel = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
      const imported = importRows(jsonRows).map((record) => ({
        ...record,
        examCenterName: getBoundExamCenterName(),
        examCenterCode: getBoundExamCenterCode(),
      }));

      if (!imported.length) {
        alert("لم يتم العثور على بيانات صالحة.");
        return;
      }

      setRecords((prev) => [...imported, ...prev]);
      selectRecord(imported[0]);
      setCloudStatus(`تم استيراد ${imported.length} طالب/سجل وسيتم حفظها في السحابة.`);
      alert(`تم استيراد ${imported.length} طالب/سجل.`);
    } catch (error) {
      console.error(error);
      alert("تعذر استيراد ملف Excel. تأكد من وجود مكتبة xlsx.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = records.map((record) => {
        const exportRow: Record<string, string> = {
          "رقم الطالب": record.studentNo,
          "رقم البطاقة": record.cardNo,
          "رقم الجلوس": record.seatNo,
          "الاسم": record.studentName,
          "المحافظة": record.governorate,
          "رمز المدرسة": record.schoolCode,
          "المدرسة": record.schoolName,
          "رمز مركز الامتحان": getBoundExamCenterCode(),
          "مركز الامتحان": getBoundExamCenterName(),
        };

        SUBJECT_SLOTS.forEach((slot, index) => {
          const number = index + 1;
          exportRow[`المادة ${number}`] = record[slot.subjectKey];
          exportRow[`رقم المسلسل ${number}`] = record[slot.serialKey];
          exportRow[`رقم القاعة ${number}`] = record[slot.roomKey];
          exportRow[`حاضر/غائب ${number}`] = record[slot.statusKey];
        });

        return exportRow;
      });

      const sheet = XLSX.utils.json_to_sheet(rows);
      (sheet as any)["!rtl"] = true;
      sheet["!cols"] = [
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 34 }, { wch: 18 },
        { wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 34 },
        ...Array.from({ length: 8 }, () => ({ wch: 24 })),
        ...Array.from({ length: 8 }, () => ({ wch: 18 })),
        ...Array.from({ length: 8 }, () => ({ wch: 16 })),
        ...Array.from({ length: 8 }, () => ({ wch: 14 })),
      ];

      const workbook = XLSX.utils.book_new();
      workbook.Workbook = { Views: [{ RTL: true }] } as any;
      XLSX.utils.book_append_sheet(workbook, sheet, "بيانات المتقدمين");
      XLSX.writeFile(workbook, "student-seat-register.xlsx");
    } catch (error) {
      console.error(error);
      alert("تعذر تصدير Excel. تأكد من وجود مكتبة xlsx.");
    }
  };

  const buildPrintHtml = (record: StudentRecord) => {
    const reportTitle = "إثبات تقدم دارس لامتحانات دبلوم التعليم العام";
    const directorateLine = getOfficialDirectorate(centerData);
    const centerNameLine = getOfficialCenterName(centerData, record.examCenterName);
    const semesterLine = centerData.semester || semester;
    const academicYearLine = centerData.academicYear || academicYear;
    const logoUrl = officialLogo || getOfficialLogoUrl();
    const scheduledRows = getStudentScheduledRows(record, examsRows);

    const fromDate = scheduledRows.find((row) => row.dateText)?.dateText || "";
    const toDate = [...scheduledRows].reverse().find((row) => row.dateText)?.dateText || "";

    const subjectRows = scheduledRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.subject)}</td>
        <td>${escapeHtml(row.dateText)}</td>
        <td>${escapeHtml(row.dayText)}</td>
        <td>${row.index}</td>
      </tr>
    `).join("");

    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${reportTitle}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Times New Roman", Tahoma, Arial, sans-serif;
    color: #000;
    background: #fff;
    font-weight: 700;
    direction: rtl;
  }
  .page {
    width: 100%;
    min-height: 100%;
  }
  .header {
    text-align: center;
    margin-bottom: 10px;
  }
  .logo {
    width: 82px;
    height: 82px;
    object-fit: contain;
    display: block;
    margin: 0 auto 6px;
  }
  .ministry {
    font-size: 24px;
    line-height: 1.3;
    font-weight: 700;
  }
  .directorate {
    font-size: 16px;
    line-height: 1.45;
    margin-top: 4px;
  }
  .title {
    text-align: center;
    font-size: 22px;
    margin: 24px 0 12px;
    text-decoration: underline;
    font-weight: 700;
  }
  .paragraph {
    font-size: 17px;
    line-height: 1.9;
    text-align: center;
    margin: 6px 0;
  }
  .student-info {
    width: 82%;
    margin: 4px auto 10px;
    font-size: 17px;
    line-height: 1.9;
  }
  .student-info .row {
    display: flex;
    justify-content: flex-start;
    gap: 12px;
    margin: 2px 0;
  }
  .student-info .label {
    min-width: 120px;
  }
  .period-line {
    font-size: 17px;
    line-height: 1.9;
    text-align: center;
    margin: 8px 0 10px;
  }
  table {
    width: 82%;
    margin: 0 auto;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 16px;
  }
  th, td {
    border: 1.4px solid #111;
    padding: 5px 6px;
    text-align: center;
    vertical-align: middle;
  }
  th {
    background: #efefef;
  }
  .footer-note {
    text-align: center;
    margin-top: 130px;
    font-size: 18px;
    font-weight: 700;
  }
  .footer {
    width: 82%;
    margin: 18px auto 0;
    display: grid;
    grid-template-columns: 1fr 180px;
    align-items: end;
    gap: 30px;
  }
  .signature {
    text-align: center;
    font-size: 16px;
    line-height: 2;
  }
  .signature-name {
    margin-top: 10px;
    font-size: 15px;
  }
  .stamp {
    width: 120px;
    height: 90px;
    border: 1.6px solid #555;
    display: grid;
    place-items: center;
    justify-self: end;
    font-size: 14px;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img class="logo" src="${escapeHtml(logoUrl)}" />
      <div class="ministry">وزارة التربية والتعليم</div>
      <div class="directorate">${escapeHtml(directorateLine)}</div>
    </div>

    <div class="title">${escapeHtml(reportTitle)}</div>

    <div class="paragraph">يشهد ${escapeHtml(centerNameLine)} بأن الدارس:</div>

    <div class="student-info">
      <div class="row"><span>${escapeHtml(record.studentName)}</span></div>
      <div class="row"><span class="label">الرقم المدني:</span><span>${escapeHtml(record.cardNo)}</span></div>
      <div class="row"><span class="label">رقم الجلوس:</span><span>${escapeHtml(record.seatNo)}</span></div>
    </div>

    <div class="period-line">
      تقدم لامتحانات دبلوم التعليم العام ${escapeHtml(semesterLine)} - العام الدراسي ${escapeHtml(academicYearLine)} م
      <br/>
      خلال الفترة من <strong>${escapeHtml(fromDate || "................")}</strong>
      إلى <strong>${escapeHtml(toDate || "................")}</strong>
      وكانت مواعيد الامتحانات على النحو الآتي:
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:16%">حاضر/غائب</th>
          <th style="width:38%">المادة</th>
          <th style="width:21%">التاريخ</th>
          <th style="width:15%">اليوم</th>
          <th style="width:10%">م</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows || `<tr><td></td><td></td><td></td><td></td><td>1</td></tr>`}
      </tbody>
    </table>

    <div class="footer-note">والله ولي التوفيق</div>

    <div class="footer">
      <div class="signature">
        <div>رئيس مركز الامتحان</div>
        <div class="signature-name">${escapeHtml(centerHeadName)}</div>
      </div>
      <div class="stamp">الختم</div>
    </div>
  </div>
</body>
</html>`;
  };

  const printCurrent = () => {
    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) return;
    win.document.open();
    win.document.write(buildPrintHtml(bindExamCenterData(form)));
    win.document.close();
    win.focus();
    win.print();
  };

  const printAll = () => {
    if (!records.length) {
      alert("لا توجد بيانات للطباعة.");
      return;
    }
    const html = records.map((record) => buildPrintHtml(bindExamCenterData(record))).join('<div style="page-break-after:always;"></div>');
    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) return;
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const displayRecordNo = records.length ? `${currentIndex >= 0 ? currentIndex + 1 : 0} / ${records.length}` : "0 / 0";
  const emailGateBusy = emailGateSending || emailGateVerifying;
  const emailGateActionsDisabled = emailGateBusy || emailGateIsLocked;

  if (!emailGateVerified) {
    return (
      <div dir="rtl" style={pageStyle}>
        <style>{`
          html, body, #root {
            margin: 0 !important;
            min-height: 100% !important;
            background: #f7f3e7 !important;
          }
          .studentSeatEmailCodeInput::placeholder {
            color: #111827 !important;
            font-weight: 1000 !important;
            opacity: 0.75 !important;
          }
        `}</style>
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.42)",
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(720px, 96vw)",
              background: "linear-gradient(180deg, #fffdf7 0%, #f7f3e7 100%)",
              border: "5px solid #d4af37",
              borderRadius: 30,
              boxShadow: "0 0 0 7px rgba(212,175,55,0.20) inset, 0 24px 80px rgba(0,0,0,0.22)",
              padding: 24,
              color: "#000",
              fontWeight: 1000,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 1000, color: "#000", marginBottom: 10 }}>
              تحقق برمز البريد لفتح سجل أرقام جلوس الطلبة
            </div>
            <div style={{ fontSize: 16, fontWeight: 1000, color: "#000", lineHeight: 1.9, marginBottom: 14 }}>
              أدخل البريد الإلكتروني الصحيح للحساب أولًا، ثم اطلب رمز الدخول المرسل إلى البريد
              {maskedCurrentUserEmail ? ` (${maskedCurrentUserEmail})` : ""}.
            </div>

            {emailGateIsLocked ? (
              <div style={{ border: "3px solid #dc2626", background: "#fef2f2", color: "#000", borderRadius: 18, padding: "16px 18px", fontWeight: 1000, lineHeight: 1.9, textAlign: "center", marginTop: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 1000, color: "#000" }}>
                  تم تجاوز عدد محاولات التحقق.
                </div>
                <div style={{ fontSize: 18, fontWeight: 1000, color: "#000", marginTop: 8 }}>
                  يمكنك طلب رمز جديد بعد انتهاء العد التنازلي.
                </div>
                <div style={{ marginTop: 14, fontSize: 34, fontWeight: 1000, color: "#991b1b", direction: "ltr" }}>
                  {emailGateCountdownText}
                </div>
              </div>
            ) : (
              <>
            <input
              className="studentSeatEmailCodeInput"
              value={emailGateConfirmEmail}
              onChange={(event) => {
                setEmailGateConfirmEmail(event.target.value);
                setEmailGateEmailConfirmed(false);
                setEmailGateCodeSent(false);
                setEmailGateCode("");
                setEmailGateError("");
                setEmailGateMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendEmailGateCode();
              }}
              inputMode="email"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="student_seat12_email_gate_no_autofill"
              id="student_seat12_email_gate_no_autofill"
              placeholder="أدخل البريد الإلكتروني المرتبط بالحساب"
              disabled={emailGateActionsDisabled}
              style={{
                width: "100%",
                minHeight: 58,
                border: "3px solid #d4af37",
                borderRadius: 18,
                background: "#fffaf0",
                color: "#000",
                WebkitTextFillColor: "#000",
                fontWeight: 1000,
                fontSize: 20,
                textAlign: "center",
                outline: "none",
                boxSizing: "border-box",
                padding: "10px 14px",
                marginBottom: 12,
                direction: "ltr",
              }}
            />

            {emailGateEmailConfirmed && emailGateCodeSent ? (
              <input
                className="studentSeatEmailCodeInput"
                value={emailGateCode}
                onChange={(event) => {
                  setEmailGateCode(normalizeStudentSeatEmailCode(event.target.value));
                  setEmailGateError("");
                  setEmailGateMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void verifyEmailGateCode();
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="أدخل رمز التحقق المرسل إلى البريد"
                disabled={!emailGateCodeSent || emailGateActionsDisabled}
                style={{
                  width: "100%",
                  minHeight: 58,
                  border: "3px solid #d4af37",
                  borderRadius: 18,
                  background: "#fffaf0",
                  color: "#000",
                  WebkitTextFillColor: "#000",
                  fontWeight: 1000,
                  fontSize: 20,
                  textAlign: "center",
                  outline: "none",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                }}
              />
            ) : null}
              </>
            )}

            {emailGateMessage ? (
              <div style={{ marginTop: 12, border: "2px solid #16a34a", background: "#f0fdf4", color: "#000", borderRadius: 14, padding: "10px 12px", fontWeight: 1000, lineHeight: 1.7 }}>
                {emailGateMessage}
              </div>
            ) : null}

            {emailGateError ? (
              <div style={{ marginTop: 12, border: "2px solid #dc2626", background: "#fef2f2", color: "#000", borderRadius: 14, padding: "10px 12px", fontWeight: 1000, lineHeight: 1.7 }}>
                {emailGateError}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" onClick={() => history.back()} disabled={emailGateBusy} style={{ minHeight: 48, border: "3px solid #d4af37", borderRadius: 16, background: "#fffdf7", color: "#000", fontWeight: 1000, cursor: "pointer", padding: "10px 16px" }}>
                رجوع
              </button>
              <button type="button" onClick={() => void sendEmailGateCode()} disabled={emailGateActionsDisabled} style={{ minHeight: 48, border: "3px solid #1d4ed8", borderRadius: 16, background: emailGateIsLocked ? "#e5e7eb" : "#bfdbfe", color: "#000", fontWeight: 1000, cursor: emailGateActionsDisabled ? "not-allowed" : "pointer", padding: "10px 16px" }}>
                {emailGateIsLocked ? `انتظر ${emailGateCountdownText}` : emailGateSending ? "جاري الإرسال..." : emailGateCodeSent ? "إعادة إرسال الرمز" : "تأكيد البريد وإرسال رمز الدخول"}
              </button>
              <button type="button" onClick={() => void verifyEmailGateCode()} disabled={!emailGateEmailConfirmed || !emailGateCodeSent || emailGateActionsDisabled} style={{ minHeight: 48, border: "3px solid #14532d", borderRadius: 16, background: emailGateEmailConfirmed && emailGateCodeSent && !emailGateIsLocked ? "#bbf7d0" : "#e5e7eb", color: "#000", fontWeight: 1000, cursor: emailGateEmailConfirmed && emailGateCodeSent && !emailGateActionsDisabled ? "pointer" : "not-allowed", padding: "10px 16px" }}>
                {emailGateVerifying ? "جاري التحقق..." : "تحقق وفتح الصفحة"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={pageStyle}>
      <style>{`
        html, body, #root {
          margin: 0 !important;
          min-height: 100% !important;
          background: #f2f2f2 !important;
        }
        .studentAccessScope, .studentAccessScope * {
          color: #000 !important;
          font-weight: 900 !important;
          box-sizing: border-box;
        }
        .studentAccessScope input,
        .studentAccessScope select,
        .studentAccessScope option,
        .studentAccessScope textarea {
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          font-weight: 1000 !important;
          text-shadow: none !important;
        }

        .studentAccessScope input::placeholder {
          color: #000 !important;
          opacity: 0.75 !important;
          font-weight: 1000 !important;
        }

        @media (max-width: 1100px) {
          .studentAccessScope .responsiveHint {
            display: block;
          }
        }
      `}</style>

      <div className="studentAccessScope" style={windowStyle}>
        <OfficialPageHeader
          centerData={centerData}
          logoUrl={officialLogo || getOfficialLogoUrl()}
          semester={semester}
          academicYear={academicYear}
          centerHeadName={centerHeadName}
          examCenterCode={getBoundExamCenterCode()}
        />

        <Header semester={semester} academicYear={academicYear} />

        <div style={cloudStatusStyle}>
          {cloudLoading
            ? "جاري تحميل البيانات من السحابة..."
            : cloudError || cloudStatus || "جاهز للعمل المتزامن من أي جهاز."}
        </div>

        <div style={importToolbarStyle}>
          <button
            type="button"
            style={importStudentExcelButtonStyle}
            onClick={() => fileInputRef.current?.click()}
          >
            📥 استيراد بيانات الطالب Excel
          </button>
          <span style={importToolbarHintStyle}>
            يدعم أعمدة رقم الطالب، رقم الجلوس، الاسم، المدرسة، المواد، أرقام المسلسل، القاعات، وحالة الحضور.
          </span>
        </div>

        <div style={studentGridStyle}>
          <LabeledInput label="رقم الطالب" value={form.studentNo} onChange={(v) => updateField("studentNo", v)} />
          <LabeledInput label="رقم البطاقة" value={form.cardNo} onChange={(v) => updateField("cardNo", v)} />
          <LabeledInput label="رقم الجلوس" value={form.seatNo} onChange={(v) => updateField("seatNo", v)} />

          <LabeledInput label="الاسم" value={form.studentName} onChange={(v) => updateField("studentName", v)} wide />
          <LabeledInput label="المحافظة" value={form.governorate} onChange={(v) => updateField("governorate", v)} />

          <LabeledInput label="رمز المدرسة" value={form.schoolCode} onChange={(v) => updateField("schoolCode", v)} />
          <LabeledInput label="المدرسة" value={form.schoolName} onChange={(v) => updateField("schoolName", v)} wide />

          <ReadOnlyLabeledInput label="رمز مركز الامتحان" value={getBoundExamCenterCode()} />
          <ReadOnlyLabeledInput label="مركز الامتحان" value={getBoundExamCenterName()} wide />
        </div>

        <div style={noticeStyle}>* ملاحظة: في خانة (حاضر/غائب) يتم اختيار حاضر أو غائب فقط لكل مادة</div>

        <div style={contentGridStyle}>
          <aside style={sidePanelStyle}>
            <div style={searchNavStyle}>
              <button type="button" style={arrowButtonStyle} onClick={goPrev}>‹</button>
              <input
                value={searchSeatNo}
                onChange={(e) => setSearchSeatNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doSearch();
                }}
                placeholder="بحث"
                style={searchInputStyle}
              />
              <button type="button" style={arrowButtonStyle} onClick={goNext}>›</button>
            </div>

            <button type="button" style={sideButtonStyle} onClick={doSearch}>إخطار رقم الجلوس</button>
            <button type="button" style={sideButtonStyle} onClick={printCurrent}>إثبات تقدم دارس</button>
            <button type="button" style={{ ...sideButtonStyle, color: "#0000ff" }} onClick={printAll}>إثبات تقدم دارس - الكل</button>

            <div style={{ display: "grid", gap: 12, marginTop: 28, width: "100%", justifyItems: "center" }}>
              <button type="button" style={actionButton("#22c55e")} onClick={saveCurrent}>حفظ</button>
              <button type="button" style={actionButton("#60a5fa")} onClick={newRecord}>جديد</button>
              <button type="button" style={actionButton("#ef4444")} onClick={deleteCurrent}>حذف</button>
              <button type="button" style={actionButton("#f59e0b")} onClick={() => fileInputRef.current?.click()}>استيراد بيانات الطالب Excel</button>
              <button type="button" style={actionButton("#16a34a")} onClick={exportExcel}>تصدير Excel</button>
              <button type="button" style={actionButton("#f97316")} onClick={printCurrent}>طباعة</button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importExcel(file);
                }}
              />
            </div>

            <button type="button" style={exitButtonStyle} onClick={() => history.back()}>خروج</button>
          </aside>

          <main style={tablePanelStyle}>
            <div style={subjectTitleStyle}>المواد</div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={getTableHeaderStyle(0)}>حاضر/غائب</th>
                  <th style={getTableHeaderStyle(1)}>رقم القاعة</th>
                  <th style={getTableHeaderStyle(2)}>رقم المسلسل</th>
                  <th style={getTableHeaderStyle(3)}>المادة</th>
                </tr>
              </thead>
              <tbody>
                {SUBJECT_SLOTS.map((slot) => (
                  <tr key={slot.subjectKey}>
                    <td style={tdStyle}>
                      <select
                        value={form[slot.statusKey]}
                        onChange={(e) => updateField(slot.statusKey, normalizeStatus(e.target.value))}
                        style={selectStyle}
                      >
                        <option value="حاضر">حاضر</option>
                        <option value="غائب">غائب</option>
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={form[slot.roomKey]}
                        onChange={(e) => updateField(slot.roomKey, e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={form[slot.serialKey]}
                        onChange={(e) => updateField(slot.serialKey, e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={form[slot.subjectKey]}
                        onChange={(e) => updateField(slot.subjectKey, e.target.value)}
                        style={{ ...cellInputStyle, textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={recordBarStyle}>
              <span>السجل:</span>
              <button type="button" style={recordArrowStyle} onClick={goPrev}>|‹</button>
              <button type="button" style={recordArrowStyle} onClick={goPrev}>‹</button>
              <span>{displayRecordNo}</span>
              <button type="button" style={recordArrowStyle} onClick={goNext}>›</button>
              <button type="button" style={recordArrowStyle} onClick={goNext}>›|</button>
              <span style={{ marginInlineStart: "auto" }}>بحث</span>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function OfficialPageHeader({
  centerData,
  logoUrl,
  semester,
  academicYear,
  centerHeadName,
  examCenterCode,
}: {
  centerData: ExamCenterData;
  logoUrl: string;
  semester: string;
  academicYear: string;
  centerHeadName: string;
  examCenterCode: string;
}) {
  const directorate = getOfficialDirectorate(centerData);
  const centerName = getOfficialCenterName(centerData);

  return (
    <section style={officialPageHeaderStyle}>
      <div style={officialPageHeaderGridStyle}>
        <div style={officialHeaderSideUiStyle}>
          <div style={officialHeaderMainUiStyle}>سلطنة عمان</div>
          <div style={officialHeaderMainUiStyle}>وزارة التعليم</div>
          <div style={officialHeaderSubUiStyle}>{directorate}</div>
          <div style={officialHeaderCenterUiStyle}>{centerName}</div>
        </div>

        <div style={officialLogoUiWrapStyle}>
          <img src={logoUrl || DEFAULT_LOGO_URL} alt="official logo" style={officialLogoUiStyle} />
        </div>

        <div style={{ ...officialHeaderSideUiStyle, textAlign: "left" }}>
          <div style={officialHeaderTitleUiStyle}>بيانات المتقدمين لامتحانات دبلوم التعليم العام</div>
          <div style={officialHeaderSubUiStyle}>{semester}</div>
          <div style={officialHeaderSubUiStyle}>العام الدراسي {academicYear} م</div>
          <div style={officialHeaderSubUiStyle}>رمز مركز الامتحان: {examCenterCode || "—"}</div>
          <div style={officialHeaderSubUiStyle}>رئيس المركز: {centerHeadName || "—"}</div>
        </div>
      </div>

      <div style={officialPageInfoStripStyle}>
        <span>اسم المركز: {centerName}</span>
        <span>رمز المركز: {examCenterCode || "—"}</span>
        <span>الترويسة مستمدة من بيانات مركز الامتحان</span>
      </div>
    </section>
  );
}

function Header({ semester, academicYear }: { semester: string; academicYear: string }) {
  return (
    <div style={headerStyle}>
      <div>واجهة بيانات الطالب والمواد</div>
      <div>{semester} - العام الدراسي {academicYear} م</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <div style={{ ...fieldBoxStyle, gridColumn: wide ? "span 2" : undefined }}>
      <div style={fieldLabelStyle}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={fieldInputStyle} />
    </div>
  );
}

function ReadOnlyLabeledInput({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div style={{ ...fieldBoxStyle, gridColumn: wide ? "span 2" : undefined }}>
      <div style={fieldLabelStyle}>{label}</div>
      <input value={value} readOnly style={{ ...fieldInputStyle, background: "#eef3e4", cursor: "not-allowed" }} />
    </div>
  );
}

const officialPageHeaderStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fffaf0 0%, #f4ead0 100%)",
  border: "5px solid #111827",
  borderRadius: 30,
  padding: "22px 26px",
  boxShadow: "0 0 0 6px rgba(212,175,55,0.26) inset, 0 18px 38px rgba(150,120,20,0.16)",
};

const officialPageHeaderGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr) 150px minmax(260px, 1fr)",
  gap: 22,
  alignItems: "center",
  borderBottom: "3px solid #111827",
  paddingBottom: 18,
};

const officialHeaderSideUiStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#000",
  fontWeight: 1000,
  lineHeight: 1.45,
  textAlign: "right",
};

const officialHeaderMainUiStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 24,
};

const officialHeaderSubUiStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 17,
};

const officialHeaderCenterUiStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 21,
};

const officialHeaderTitleUiStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 27,
  textDecoration: "underline",
  textUnderlineOffset: 8,
};

const officialLogoUiWrapStyle: React.CSSProperties = {
  width: 132,
  height: 132,
  margin: "0 auto",
  borderRadius: 28,
  border: "4px solid #d4af37",
  background: "#ffffff",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 14px 28px rgba(150,120,20,0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
};

const officialLogoUiStyle: React.CSSProperties = {
  width: "82%",
  height: "82%",
  objectFit: "contain",
};

const officialPageInfoStripStyle: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  border: "3px solid #111827",
  borderRadius: 18,
  padding: "10px 16px",
  background: "rgba(255,255,255,0.62)",
  color: "#000",
  fontWeight: 1000,
  fontSize: 16,
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 520px at 50% -10%, rgba(212,175,55,0.20), transparent 62%), linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%)",
  padding: 18,
  boxSizing: "border-box",
};

const windowStyle: React.CSSProperties = {
  width: "min(1680px, 100%)",
  minHeight: 900,
  margin: "0 auto",
  background: "linear-gradient(180deg, #fffdf7 0%, #f7f3e7 100%)",
  border: "5px solid #d4af37",
  borderRadius: 36,
  boxShadow: "0 0 0 8px rgba(212,175,55,0.18) inset, 0 18px 44px rgba(126,98,18,0.16)",
  padding: "22px 22px 24px",
  display: "grid",
  gap: 18,
};

const headerStyle: React.CSSProperties = {
  width: "100%",
  margin: "0",
  background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
  border: "4px solid #d4af37",
  borderRadius: 28,
  textAlign: "center",
  fontSize: 26,
  lineHeight: 1.55,
  padding: "14px 18px",
  boxShadow: "0 10px 24px rgba(150,120,20,0.10)",
  color: "#000",
};

const studentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "14px 16px",
  marginBottom: 0,
  background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
  border: "4px solid #d4af37",
  borderRadius: 30,
  padding: 18,
  boxShadow: "0 0 0 5px rgba(212,175,55,0.14) inset",
};

const fieldBoxStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "170px 1fr",
  minHeight: 52,
  border: "2px solid #d4af37",
  borderRadius: 18,
  overflow: "hidden",
  background: "#fffaf0",
};

const fieldLabelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
  borderLeft: "2px solid #d4af37",
  display: "grid",
  placeItems: "center",
  fontSize: 20,
  color: "#000",
  fontWeight: 1000,
  padding: "6px 8px",
};

const fieldInputStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
  border: 0,
  padding: "8px 12px",
  fontSize: 22,
  textAlign: "center",
  width: "100%",
  color: "#000",
  fontWeight: 1000,
  outline: "none",
  WebkitTextFillColor: "#000",
};

const noticeStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)",
  color: "#000",
  padding: "12px 18px",
  margin: 0,
  textAlign: "center",
  fontSize: 20,
  border: "3px solid #7f1d1d",
  borderRadius: 18,
  boxShadow: "0 10px 22px rgba(127,29,29,0.16)",
};

const cloudStatusStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
  color: "#000",
  padding: "12px 18px",
  margin: 0,
  textAlign: "center",
  fontSize: 17,
  border: "3px solid #d4af37",
  borderRadius: 18,
  boxShadow: "0 10px 22px rgba(150,120,20,0.12)",
  fontWeight: 1000,
};

const importToolbarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 360px) 1fr",
  alignItems: "center",
  gap: 14,
  background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
  border: "3px solid #d4af37",
  borderRadius: 22,
  padding: "12px 16px",
  boxShadow: "0 10px 22px rgba(150,120,20,0.12)",
};

const importStudentExcelButtonStyle: React.CSSProperties = {
  minHeight: 58,
  border: "3px solid #14532d",
  borderRadius: 18,
  background: "linear-gradient(180deg, #bbf7d0 0%, #22c55e 100%)",
  color: "#000",
  fontSize: 18,
  fontWeight: 1000,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(20,83,45,0.16), inset 0 1px 0 rgba(255,255,255,0.65)",
};

const importToolbarHintStyle: React.CSSProperties = {
  color: "#000",
  fontSize: 15,
  fontWeight: 900,
  lineHeight: 1.8,
  textAlign: "right",
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "360px 1fr",
  gap: 18,
  alignItems: "start",
};

const sidePanelStyle: React.CSSProperties = {
  border: "4px solid #d4af37",
  borderRadius: 28,
  minHeight: 560,
  padding: "18px 20px",
  display: "grid",
  justifyItems: "center",
  justifyContent: "center",
  alignItems: "start",
  alignContent: "start",
  textAlign: "center",
  gap: 14,
  background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
  boxShadow: "0 0 0 5px rgba(212,175,55,0.14) inset",
  overflow: "hidden",
};

const searchNavStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px minmax(180px, 1fr) 64px",
  gap: 8,
  width: "min(330px, 100%)",
  margin: "0 auto",
  justifyContent: "center",
  alignItems: "center",
};

const arrowButtonStyle: React.CSSProperties = {
  minHeight: 48,
  border: "3px solid #2563eb",
  borderRadius: 14,
  background: "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)",
  color: "#0000ff",
  fontSize: 22,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(37,99,235,0.12)",
};

const searchInputStyle: React.CSSProperties = {
  minHeight: 52,
  width: "100%",
  textAlign: "center",
  fontSize: 22,
  background: "#fffaf0",
  border: "3px solid #d4af37",
  borderRadius: 16,
  color: "#000",
  fontWeight: 1000,
  outline: "none",
  margin: "0 auto",
  display: "block",
};

const sideButtonStyle: React.CSSProperties = {
  width: "min(330px, 100%)",
  minHeight: 58,
  border: "3px solid #d4af37",
  background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
  fontSize: 19,
  cursor: "pointer",
  borderRadius: 18,
  color: "#000",
  fontWeight: 1000,
  boxShadow: "0 8px 18px rgba(150,120,20,0.10)",
  margin: "0 auto",
  display: "block",
  textAlign: "center",
};

const exitButtonStyle: React.CSSProperties = {
  ...sideButtonStyle,
  marginTop: 16,
  width: "min(180px, 100%)",
  minHeight: 64,
  fontSize: 22,
  background: "linear-gradient(180deg, #fecaca 0%, #f87171 100%)",
  border: "3px solid #b91c1c",
};

const actionButton = (bg: string): React.CSSProperties => ({
  width: "min(300px, 100%)",
  minHeight: 56,
  background: bg,
  border: "3px solid #111827",
  borderRadius: 18,
  cursor: "pointer",
  fontSize: 17,
  color: "#000",
  fontWeight: 1000,
  boxShadow: "0 10px 20px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
  margin: "0 auto",
  display: "block",
  textAlign: "center",
});

const tablePanelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
  border: "4px solid #d4af37",
  borderRadius: 28,
  minHeight: 560,
  padding: "18px 18px 44px",
  position: "relative",
  boxShadow: "0 0 0 5px rgba(212,175,55,0.14) inset",
};

const subjectTitleStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
  border: "3px solid #111827",
  borderRadius: 18,
  padding: "12px 22px",
  minWidth: 140,
  width: "fit-content",
  textAlign: "center",
  fontSize: 22,
  marginBottom: 14,
  color: "#000",
  fontWeight: 1000,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "8px 6px",
  marginTop: 0,
  direction: "rtl",
};

const coloredHeaderStyles: React.CSSProperties[] = [
  {
    background: "linear-gradient(180deg, #0f766e 0%, #115e59 100%)",
    color: "#ffffff",
    border: "2px solid #99f6e4",
  },
  {
    background: "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)",
    color: "#ffffff",
    border: "2px solid #c4b5fd",
  },
  {
    background: "linear-gradient(180deg, #ea580c 0%, #c2410c 100%)",
    color: "#ffffff",
    border: "2px solid #fdba74",
  },
  {
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#ffffff",
    border: "2px solid #93c5fd",
  },
];

const baseThStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 18,
  textAlign: "center",
  borderRadius: 10,
  fontWeight: 1000,
  boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
};

const getTableHeaderStyle = (index: number): React.CSSProperties => ({
  ...baseThStyle,
  ...coloredHeaderStyles[index],
});

const tdStyle: React.CSSProperties = {
  background: "#fffaf0",
  border: "2px solid #d4af37",
  borderRadius: 12,
  minHeight: 46,
  padding: 0,
  textAlign: "center",
  fontSize: 18,
  overflow: "hidden",
};

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: 0,
  background: "#fffaf0",
  textAlign: "center",
  fontSize: 17,
  padding: "6px 10px",
  color: "#000",
  fontWeight: 1000,
  outline: "none",
  WebkitTextFillColor: "#000",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: 0,
  background: "#fffaf0",
  textAlign: "center",
  fontSize: 18,
  color: "#000",
  fontWeight: 1000,
  outline: "none",
  WebkitTextFillColor: "#000",
};

const recordBarStyle: React.CSSProperties = {
  position: "absolute",
  left: 18,
  right: 18,
  bottom: 10,
  minHeight: 30,
  background: "#fffaf0",
  border: "2px solid #d4af37",
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 10px",
  fontSize: 14,
  color: "#000",
  fontWeight: 1000,
};

const recordArrowStyle: React.CSSProperties = {
  border: "1px solid #d4af37",
  borderRadius: 8,
  background: "#f8f4e8",
  cursor: "pointer",
  fontSize: 14,
  color: "#000",
  fontWeight: 1000,
};