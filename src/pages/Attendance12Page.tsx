import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadTenantArray, loadTenantSettings, saveTenantSettings, subscribeTenantArray } from "../services/tenantData";
import {
  loadRun,
  RUN_UPDATED_EVENT,
  MASTER_TABLE_UPDATED_EVENT,
  taskDistributionKey,
} from "../utils/taskDistributionStorage";

type Lang = "ar" | "en";
type Period = "AM" | "PM";
type PeriodFilter = "ALL" | Period;
type TaskType = "INVIGILATION" | "RESERVE" | "DUTY_INVIGILATOR";
type AttendanceStatus = "PRESENT" | "ABSENT";

type TeacherLike = {
  id?: string;
  name?: string;
  fullName?: string;
  teacherName?: string;
  displayName?: string;
  employeeNo?: string;
  employeeNumber?: string;
  jobNo?: string;
  jobNumber?: string;
};

type AssignmentLike = {
  id?: string;
  __uid?: string;
  uid?: string;
  teacherId?: string;
  teacherName?: string;
  teacherFullName?: string;
  employeeName?: string;
  employeeNo?: string;
  employeeNumber?: string;
  jobNo?: string;
  jobNumber?: string;
  teacher?: TeacherLike | string;
  name?: string;
  fullName?: string;
  taskType?: string;
  type?: string;
  task?: string;
  role?: string;
  dutyType?: string;
  assignmentType?: string;
  category?: string;
  dutyInvigilator?: boolean;
  floorMonitor?: boolean | number | string;
  hallMonitor?: boolean | number | string;
  corridorMonitor?: boolean | number | string;
  dateISO?: string;
  examDateISO?: string;
  date?: string;
  day?: string;
  period?: string;
  examPeriod?: string;
  session?: string;
  time?: string;
  subject?: string;
  examSubject?: string;
  course?: string;
  exam?: {
    dateISO?: string;
    date?: string;
    period?: string;
    subject?: string;
    time?: string;
  };
  [key: string]: unknown;
};

type TeacherRecord = {
  id: string;
  name: string;
  employeeNo: string;
};

type DutyRow = {
  key: string;
  teacherId: string;
  teacherName: string;
  employeeNo: string;
  dateISO: string;
  period: Period;
  taskType: TaskType;
  subject: string;
  sourceUid: string;
};

type AttendanceRecord = {
  status: AttendanceStatus;
  updatedAtISO: string;
};

type AttendanceRecords = Record<string, AttendanceRecord>;
type BankAccounts = Record<string, string>;

type CenterData = {
  name: string;
  governorate: string;
  semester: string;
  controlHeadName: string;
  logoUrl: string;
  country: string;
  ministry: string;
  academicYear: string;
  officialTitle: string;
};

type TeacherSummaryRow = {
  teacherId: string;
  teacherName: string;
  employeeNo: string;
  presentDays: number;
  absentDays: number;
  totalAttendance: number;
  totalDutyDays: number;
  totalTasks: number;
  totalAssignmentValueOMR: number;
  bankAccount: string;
};

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";
const ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";
const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const APP_LOGO_KEY = "exam-manager:app-logo";
const CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const TEACHERS_SUB = "teachers";
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";
const ATTENDANCE12_ASSIGNMENTS_SUBCOLLECTION = "taskDistributionAssignments12";
const ATTENDANCE12_LATEST_RUN_SETTINGS_DOC_ID = "latestTaskDistributionRun12";
const ATTENDANCE12_RECORDS_SETTINGS_DOC_ID = "attendance12Records";
const ATTENDANCE12_BANK_ACCOUNTS_SETTINGS_DOC_ID = "attendance12BankAccounts";

const STATIC_DISTRIBUTION_KEYS = [
  MASTER_TABLE_KEY,
  RESULTS_TABLE_KEY,
  ALL_TABLE_KEY,
  "exam-manager:task-distribution-results12:v1",
  "exam-manager:task-distribution-results12:current-run:v1",
  "exam-manager:task-distribution-results12:last-run:v1",
  "exam-manager:task-distribution-results12:results:v1",
  "exam-manager:task-distribution-results12:all-data:v1",
  "exam-manager:task-distribution-results:v1",
  "exam-manager:task-distribution:results:v1",
  "exam-manager:task-distribution:current-run:v1",
  "exam-manager:task-distribution:run:v1",
];

const CENTER_DATA_KEYS = [
  EXAM_CENTER_DATA_KEY,
  "exam-manager:school-data:v1",
  "exam-manager:center-data:v1",
  "exam-manager:control-center-data:v1",
  "exam-manager:school-control:center-data:v1",
  "exam-manager:schoolControl:center-data:v1",
  "exam-manager:settings12:center-data:v1",
  "exam-manager:center-control-data:v1",
  "exam-manager:control-data:v1",
];

const DATA_EVENTS = [
  RUN_UPDATED_EVENT,
  MASTER_TABLE_UPDATED_EVENT,
  "exam-manager:task-distribution-results12:updated",
  "exam-manager:task-distribution:updated",
  "exam-manager:distribution-updated",
  "exam-manager:changed",
  "exam-manager:control-head-changed",
];

const TASK_COLORS: Record<TaskType, string> = {
  INVIGILATION: "#facc15",
  RESERVE: "#fb923c",
  DUTY_INVIGILATOR: "#60a5fa",
};

function tr(lang: Lang, ar: string, en: string) {
  return lang === "ar" ? ar : en;
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه");
}

function normalizeName(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeISODate(value: unknown): string {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
}

function normalizePeriod(value: unknown): Period {
  const raw = String(value || "AM").trim();
  const normalized = raw.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (
    normalized === "PM" ||
    normalized === "BM" ||
    normalized === "P" ||
    normalized === "B" ||
    raw.includes("الثانية") ||
    /second period/i.test(raw)
  ) {
    return "PM";
  }
  return "AM";
}

function periodLabel(period: Period | PeriodFilter, lang: Lang) {
  if (period === "ALL") return tr(lang, "كل الفترات", "All periods");
  return period === "PM" ? tr(lang, "الفترة الثانية", "Second Period") : tr(lang, "الفترة الأولى", "First Period");
}

function labelTaskType(taskType: TaskType, lang: Lang) {
  switch (taskType) {
    case "INVIGILATION":
      return tr(lang, "مراقبة", "Invigilation");
    case "RESERVE":
      return tr(lang, "احتياط", "Reserve");
    case "DUTY_INVIGILATOR":
      return tr(lang, "مراقب دور", "Duty Invigilator");
    default:
      return tr(lang, "مهمة", "Task");
  }
}


function getTaskPillStatusStyle(taskType: TaskType, status: AttendanceStatus): React.CSSProperties {
  if (status === "ABSENT") {
    return {
      borderColor: "#111827",
      color: "#111827",
      background: "#ffffff",
    };
  }

  if (taskType === "RESERVE") {
    return {
      borderColor: "#2563eb",
      color: "#2563eb",
      background: "#eff6ff",
    };
  }

  if (taskType === "DUTY_INVIGILATOR") {
    return {
      borderColor: "#dc2626",
      color: "#dc2626",
      background: "#fef2f2",
    };
  }

  return {
    borderColor: "#16a34a",
    color: "#16a34a",
    background: "#f0fdf4",
  };
}

function getTenantIdFromAuth(auth: any): string {
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

function getStorageKeySafe(tenantId: string): string {
  try {
    return taskDistributionKey(tenantId);
  } catch {
    return `exam-manager:task-distribution:${tenantId}:v1`;
  }
}

function getAttendanceStorageKey(tenantId: string) {
  return `exam-manager:attendance12:records:${String(tenantId || "default").trim() || "default"}:v1`;
}

function getBankStorageKey(tenantId: string) {
  return `exam-manager:attendance12:bank-accounts:${String(tenantId || "default").trim() || "default"}:v1`;
}

function readLocalJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  return safeParseJson<T>(window.localStorage.getItem(key));
}

function unwrapCenterPayload(raw: any): any {
  if (!raw || typeof raw !== "object") return {};
  return raw.data || raw.centerData || raw.examCenterData || raw.controlData || raw.schoolData || raw.settings || raw.config || raw;
}

function readCenterData(): CenterData {
  let payload: any = {};
  if (typeof window !== "undefined") {
    for (const key of CENTER_DATA_KEYS) {
      const parsed = readLocalJson<any>(key);
      const current = unwrapCenterPayload(parsed);
      if (current && typeof current === "object" && Object.keys(current).length) {
        payload = current;
        break;
      }
    }
  }

  const logoUrl = firstNonEmpty(
    typeof window !== "undefined" ? window.localStorage.getItem(EXAM_CENTER_LOGO_KEY) : "",
    typeof window !== "undefined" ? window.localStorage.getItem(APP_LOGO_KEY) : "",
    DEFAULT_LOGO_URL
  );

  return {
    name: firstNonEmpty(
      payload.centerName,
      payload.examCenterName,
      payload.examCentreName,
      payload.controlCenterName,
      payload.officialCenterName,
      payload.schoolName,
      payload.name
    ),
    governorate: firstNonEmpty(
      payload.directorate,
      payload.directorateName,
      payload.educationDirectorate,
      payload.generalDirectorate,
      payload.governorate,
      payload.governorateName,
      payload.region,
      payload.adminRegion,
      payload.educationRegion
    ),
    semester: firstNonEmpty(payload.semester, payload.semesterLabel, payload.term, payload.termLabel, payload.studySemester, payload.studyTerm),
    controlHeadName: firstNonEmpty(
      payload.controlHeadName,
      payload.controlHead,
      payload.centerHead,
      payload.centerHeadName,
      payload.headOfCenter,
      typeof window !== "undefined" ? window.localStorage.getItem(CONTROL_HEAD_NAME_KEY) : ""
    ),
    logoUrl,
    country: firstNonEmpty(payload.country, payload.countryName, payload.sultanate),
    ministry: firstNonEmpty(payload.ministry, payload.ministryName, payload.educationMinistry),
    academicYear: firstNonEmpty(payload.academicYear, payload.yearLabel, payload.schoolYear, payload.studyYear, payload.academicYearLabel),
    officialTitle: firstNonEmpty(payload.officialTitle, payload.officialName, payload.title, payload.centerOfficialTitle),
  };
}

function mapCloudCenterData(raw: any): CenterData {
  return {
    name: firstNonEmpty(raw?.name, raw?.centerName, raw?.examCenterName, raw?.schoolName),
    governorate: firstNonEmpty(raw?.governorate, raw?.directorate, raw?.directorateName, raw?.educationDirectorate),
    semester: firstNonEmpty(raw?.semester, raw?.semesterLabel, raw?.term, raw?.studySemester),
    controlHeadName: firstNonEmpty(raw?.controlHeadName, raw?.controlHead, raw?.centerHead, raw?.centerHeadName, raw?.headOfCenter),
    logoUrl: firstNonEmpty(raw?.logo, raw?.logoUrl, typeof window !== "undefined" ? window.localStorage.getItem(EXAM_CENTER_LOGO_KEY) : "", DEFAULT_LOGO_URL),
    country: firstNonEmpty(raw?.country, raw?.countryName, "سلطنة عمان"),
    ministry: firstNonEmpty(raw?.ministry, raw?.ministryName, "وزارة التعليم"),
    academicYear: firstNonEmpty(raw?.academicYear, raw?.yearLabel, raw?.schoolYear, raw?.studyYear),
    officialTitle: firstNonEmpty(raw?.officialTitle, raw?.officialName, raw?.title),
  };
}

function hasCenterData(value: CenterData): boolean {
  return Boolean(
    value.name ||
      value.governorate ||
      value.semester ||
      value.controlHeadName ||
      value.logoUrl ||
      value.academicYear ||
      value.officialTitle
  );
}

function writeCenterCache(value: CenterData) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(EXAM_CENTER_DATA_KEY, JSON.stringify(value));
    window.localStorage.setItem(EXAM_CENTER_LOGO_KEY, value.logoUrl || DEFAULT_LOGO_URL);
    window.localStorage.setItem(CONTROL_HEAD_NAME_KEY, value.controlHeadName || "");
  } catch {
    // cache failure must not break the page
  }
}

function normalizeTeacherRoster(rows: any[]): TeacherRecord[] {
  return (Array.isArray(rows) ? rows : [])
    .map((teacher: any) => {
      const id = firstNonEmpty(
        teacher.id,
        teacher.teacherId,
        teacher.employeeNo,
        teacher.employeeNumber,
        teacher.jobNo,
        teacher.jobNumber,
        teacher.fullName,
        teacher.name
      );

      return {
        id,
        name: firstNonEmpty(teacher.fullName, teacher.name, teacher.teacherName, teacher.displayName, teacher.employeeName),
        employeeNo: firstNonEmpty(teacher.employeeNo, teacher.employeeNumber, teacher.jobNo, teacher.jobNumber),
      };
    })
    .filter((teacher) => teacher.id || teacher.name || teacher.employeeNo);
}

function normalizeCloudAssignments(rows: any[]): AssignmentLike[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row: any, index) => {
      const id = firstNonEmpty(row?.__uid, row?.uid, row?.id, `assignment_${index + 1}`);
      return {
        ...row,
        id,
        __uid: firstNonEmpty(row?.__uid, id),
      } as AssignmentLike;
    })
    .filter((row) => !!getTeacherName(row) && !!getTaskType(row) && !!getDateISO(row));
}

function buildAssignmentsFromCloud(latestRunSettings: any, assignmentRows: any[]): AssignmentLike[] {
  const rowsFromCollection = normalizeCloudAssignments(assignmentRows);
  if (rowsFromCollection.length) return rowsFromCollection;

  const runAssignments = normalizeCloudAssignments(latestRunSettings?.run?.assignments || []);
  if (runAssignments.length) return runAssignments;

  return normalizeCloudAssignments(latestRunSettings?.assignments || []);
}

function buildAttendanceRecordsSignature(value: AttendanceRecords) {
  return JSON.stringify(
    Object.entries(value || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, record]) => [key, record?.status || "PRESENT", record?.updatedAtISO || ""])
  );
}

function buildBankAccountsSignature(value: BankAccounts) {
  return JSON.stringify(
    Object.entries(value || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, account]) => [key, String(account || "")])
  );
}

function getTeacherName(item: AssignmentLike): string {
  const teacher = item.teacher;
  if (typeof teacher === "string") return normalizeName(teacher);

  return normalizeName(
    item.teacherName ||
      item.teacherFullName ||
      item.employeeName ||
      teacher?.name ||
      teacher?.fullName ||
      teacher?.teacherName ||
      teacher?.displayName ||
      item.name ||
      item.fullName ||
      ""
  );
}

function getEmployeeNo(item: AssignmentLike): string {
  const teacher = item.teacher;
  if (teacher && typeof teacher === "object") {
    return firstNonEmpty(teacher.employeeNo, teacher.employeeNumber, teacher.jobNo, teacher.jobNumber);
  }
  return firstNonEmpty(item.employeeNo, item.employeeNumber, item.jobNo, item.jobNumber);
}

function getTeacherId(item: AssignmentLike): string {
  const teacher = item.teacher;
  const teacherObjectId = teacher && typeof teacher === "object" ? teacher.id : "";
  return firstNonEmpty(item.teacherId, teacherObjectId, getEmployeeNo(item), getTeacherName(item));
}

function getTaskType(item: AssignmentLike): TaskType | "" {
  const raw = normalizeText(
    item.taskType || item.type || item.task || item.role || item.dutyType || item.assignmentType || item.category || ""
  );
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  const lower = raw.toLowerCase();

  if (upper === "INVIGILATION" || raw === "مراقبه" || raw === "مراقبة" || lower === "monitoring") return "INVIGILATION";
  if (upper === "RESERVE" || raw === "احتياط" || lower === "backup") return "RESERVE";

  if (
    upper === "DUTY_INVIGILATOR" ||
    upper === "FLOOR_MONITOR" ||
    upper === "HALL_MONITOR" ||
    upper === "CORRIDOR_MONITOR" ||
    upper === "DUTY_MONITOR" ||
    item.dutyInvigilator === true ||
    item.floorMonitor === true ||
    item.hallMonitor === true ||
    item.corridorMonitor === true ||
    raw === "مراقب دور" ||
    raw === "مراقب_دور" ||
    raw === "مراقب الدور" ||
    (raw.includes("دور") && (raw.includes("مراقب") || raw.includes("مراقبه"))) ||
    lower.includes("floor monitor") ||
    lower.includes("hall monitor") ||
    lower.includes("corridor monitor")
  ) {
    return "DUTY_INVIGILATOR";
  }

  return "";
}

function getDateISO(item: AssignmentLike): string {
  return normalizeISODate(item.dateISO || item.examDateISO || item.exam?.dateISO || item.exam?.date || item.date || item.day || "");
}

function getSubject(item: AssignmentLike): string {
  return firstNonEmpty(item.subject, item.examSubject, item.exam?.subject, item.course);
}

function hasAttendanceTaskData(value: unknown): value is AssignmentLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as AssignmentLike;
  return !!getTeacherName(item) && !!getTaskType(item) && !!getDateISO(item);
}

function collectAssignments(value: unknown, output: AssignmentLike[] = [], depth = 0): AssignmentLike[] {
  if (!value || depth > 6) return output;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasAttendanceTaskData(item)) output.push(item);
      else collectAssignments(item, output, depth + 1);
    }
    return output;
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const preferredKeys = ["assignments", "rows", "data", "results", "items", "distribution", "allData", "tableData", "resultRows", "currentRun", "lastRun"];

    for (const key of preferredKeys) collectAssignments(objectValue[key], output, depth + 1);
    for (const nested of Object.values(objectValue)) collectAssignments(nested, output, depth + 1);
  }

  return output;
}

function assignmentSignature(item: AssignmentLike) {
  return [
    firstNonEmpty(item.__uid, item.uid, item.id),
    getTeacherId(item),
    getTeacherName(item),
    getTaskType(item),
    getDateISO(item),
    normalizePeriod(item.period || item.examPeriod || item.exam?.period || item.session || item.time || "AM"),
    getSubject(item),
  ].join("|");
}

function dedupeAssignments(assignments: AssignmentLike[]): AssignmentLike[] {
  const seen = new Set<string>();
  const out: AssignmentLike[] = [];
  for (const item of assignments) {
    const key = assignmentSignature(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function readAssignmentsFromStorage(tenantId: string): AssignmentLike[] {
  if (typeof window === "undefined") return [];
  const collected: AssignmentLike[] = [];

  const run = loadRun(tenantId);
  collectAssignments(run, collected);

  const keys = Array.from(new Set([getStorageKeySafe(tenantId), ...STATIC_DISTRIBUTION_KEYS]));
  for (const key of keys) collectAssignments(readLocalJson<unknown>(key), collected);

  return dedupeAssignments(collected);
}

function buildDutyRows(assignments: AssignmentLike[], teachersById: Map<string, TeacherRecord>, teachersByName: Map<string, TeacherRecord>): DutyRow[] {
  const out: DutyRow[] = [];
  const seen = new Set<string>();

  for (const item of assignments) {
    const taskType = getTaskType(item);
    const dateISO = getDateISO(item);
    const teacherNameFromAssignment = getTeacherName(item);
    if (!taskType || !dateISO || !teacherNameFromAssignment) continue;

    const assignmentTeacherId = getTeacherId(item);
    const teacherFromId = teachersById.get(assignmentTeacherId);
    const teacherFromName = teachersByName.get(normalizeName(teacherNameFromAssignment));
    const teacher = teacherFromId || teacherFromName;

    const teacherId = firstNonEmpty(teacher?.id, assignmentTeacherId, teacherNameFromAssignment);
    const teacherName = firstNonEmpty(teacher?.name, teacherNameFromAssignment);
    const employeeNo = firstNonEmpty(teacher?.employeeNo, getEmployeeNo(item));
    const period = normalizePeriod(item.period || item.examPeriod || item.exam?.period || item.session || item.time || "AM");
    const subject = getSubject(item) || "—";
    const sourceUid = firstNonEmpty(item.__uid, item.uid, item.id, `${teacherId}-${dateISO}-${period}-${taskType}-${subject}`);
    const key = `${teacherId}__${dateISO}__${period}__${taskType}__${subject}__${sourceUid}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, teacherId, teacherName, employeeNo, dateISO, period, taskType, subject, sourceUid });
  }

  return out.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    if (a.period !== b.period) return a.period.localeCompare(b.period);
    return a.teacherName.localeCompare(b.teacherName, "ar");
  });
}

function readAttendanceRecords(tenantId: string): AttendanceRecords {
  return readLocalJson<AttendanceRecords>(getAttendanceStorageKey(tenantId)) || {};
}

function saveAttendanceRecords(tenantId: string, value: AttendanceRecords) {
  try {
    window.localStorage.setItem(getAttendanceStorageKey(tenantId), JSON.stringify(value));
    window.dispatchEvent(new Event("exam-manager:attendance12:updated"));
  } catch {}
}

function readBankAccounts(tenantId: string): BankAccounts {
  return readLocalJson<BankAccounts>(getBankStorageKey(tenantId)) || {};
}

function saveBankAccounts(tenantId: string, value: BankAccounts) {
  try {
    window.localStorage.setItem(getBankStorageKey(tenantId), JSON.stringify(value));
    window.dispatchEvent(new Event("exam-manager:attendance12:banks-updated"));
  } catch {}
}

function getRowStatus(rowKey: string, records: AttendanceRecords): AttendanceStatus {
  return records[rowKey]?.status || "PRESENT";
}

function buildTeacherSummaries(rows: DutyRow[], records: AttendanceRecords, bankAccounts: BankAccounts): TeacherSummaryRow[] {
  const map = new Map<string, { base: TeacherSummaryRow; presentDates: Set<string>; absentDates: Set<string>; dutyDates: Set<string> }>();

  for (const row of rows) {
    const key = row.teacherId || row.teacherName;
    const current =
      map.get(key) ||
      {
        base: {
          teacherId: row.teacherId,
          teacherName: row.teacherName,
          employeeNo: row.employeeNo,
          presentDays: 0,
          absentDays: 0,
          totalAttendance: 0,
          totalDutyDays: 0,
          totalTasks: 0,
          totalAssignmentValueOMR: 0,
          bankAccount: bankAccounts[key] || "",
        },
        presentDates: new Set<string>(),
        absentDates: new Set<string>(),
        dutyDates: new Set<string>(),
      };

    const status = getRowStatus(row.key, records);
    current.dutyDates.add(row.dateISO);
    current.base.totalTasks += 1;
    if (status === "ABSENT") current.absentDates.add(row.dateISO);
    else current.presentDates.add(row.dateISO);

    if (!current.base.employeeNo && row.employeeNo) current.base.employeeNo = row.employeeNo;
    map.set(key, current);
  }

  return Array.from(map.values())
    .map((item) => {
      const presentDays = item.presentDates.size;
      const absentDays = item.absentDates.size;
      const totalAttendance = presentDays - absentDays;
      return {
        ...item.base,
        presentDays,
        absentDays,
        totalAttendance,
        totalDutyDays: item.dutyDates.size,
        totalAssignmentValueOMR: totalAttendance * 8,
        bankAccount: bankAccounts[item.base.teacherId || item.base.teacherName] || "",
      };
    })
    .sort((a, b) => b.totalTasks - a.totalTasks || a.teacherName.localeCompare(b.teacherName, "ar"));
}

function formatDateWithDay(dateISO: string, lang: Lang) {
  if (!dateISO) return "—";
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  const locale = lang === "ar" ? "ar" : "en";
  const day = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
  const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return `${day} - ${date}`;
}

function formatOMR(value: number, lang: Lang) {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat(lang === "ar" ? "ar-OM" : "en-OM", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
  return lang === "ar" ? `${formatted} ريال عماني` : `${formatted} OMR`;
}

function formatPrintDate(dateISO: string) {
  const match = String(dateISO || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(dateISO || "").trim();
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function dayNameOnly(dateISO: string, lang: Lang) {
  if (!dateISO) return "—";
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", { weekday: "long" }).format(d);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function Attendance12Page() {
  const auth = useAuth() as any;
  const { lang } = useI18n();
  const tenantId = useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const currentUserId = String(auth?.user?.email || auth?.user?.uid || "").trim();
  const isRTL = lang === "ar";

  const [centerData, setCenterData] = useState<CenterData>(() => readCenterData());
  const [assignments, setAssignments] = useState<AssignmentLike[]>(() => readAssignmentsFromStorage(tenantId));
  const [teacherRoster, setTeacherRoster] = useState<TeacherRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecords>(() => readAttendanceRecords(tenantId));
  const [bankAccounts, setBankAccounts] = useState<BankAccounts>(() => readBankAccounts(tenantId));
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("ALL");
  const [selectedTaskType, setSelectedTaskType] = useState<"ALL" | TaskType>("ALL");
  const [searchText, setSearchText] = useState("");
  const [editingBankKey, setEditingBankKey] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("");
  const [cloudError, setCloudError] = useState("");
  const cloudHydratedRef = useRef(false);
  const attendanceSignatureRef = useRef("");
  const bankSignatureRef = useRef("");

  useEffect(() => {
    let mounted = true;
    let unsubscribeTeachers: (() => void) | undefined;
    let unsubscribeAssignments: (() => void) | undefined;

    const refreshLocalFallback = () => {
      setCenterData(readCenterData());
      setAssignments(readAssignmentsFromStorage(tenantId));
      setAttendanceRecords(readAttendanceRecords(tenantId));
      setBankAccounts(readBankAccounts(tenantId));
    };

    async function loadCloudData() {
      setCloudLoading(true);
      setCloudError("");
      setCloudStatus(tr(lang, "جاري تحميل بيانات الحضور من السحابة...", "Loading attendance data from cloud..."));

      try {
        const [centerCloud, latestRunCloud, assignmentRows, teacherRows, attendanceCloud, bankCloud] = await Promise.all([
          loadTenantSettings<any>(tenantId, DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID, {}).catch(() => ({})),
          loadTenantSettings<any>(tenantId, ATTENDANCE12_LATEST_RUN_SETTINGS_DOC_ID, {}).catch(() => ({})),
          loadTenantArray<any>(tenantId, ATTENDANCE12_ASSIGNMENTS_SUBCOLLECTION, { cacheFallback: true }).catch(() => []),
          loadTenantArray<any>(tenantId, TEACHERS_SUB, { cacheFallback: true }).catch(() => []),
          loadTenantSettings<any>(tenantId, ATTENDANCE12_RECORDS_SETTINGS_DOC_ID, {}).catch(() => ({})),
          loadTenantSettings<any>(tenantId, ATTENDANCE12_BANK_ACCOUNTS_SETTINGS_DOC_ID, {}).catch(() => ({})),
        ]);

        if (!mounted) return;

        const cloudCenter = mapCloudCenterData(centerCloud);
        if (hasCenterData(cloudCenter)) {
          setCenterData(cloudCenter);
          writeCenterCache(cloudCenter);
        } else {
          setCenterData(readCenterData());
        }

        const cloudAssignments = buildAssignmentsFromCloud(latestRunCloud, Array.isArray(assignmentRows) ? assignmentRows : []);
        const localAssignments = readAssignmentsFromStorage(tenantId);
        setAssignments(cloudAssignments.length ? cloudAssignments : localAssignments);

        setTeacherRoster(normalizeTeacherRoster(teacherRows));

        const localAttendanceRecords = readAttendanceRecords(tenantId);
        const cloudAttendanceRecords = (attendanceCloud?.records || {}) as AttendanceRecords;
        const nextAttendanceRecords =
          cloudAttendanceRecords && Object.keys(cloudAttendanceRecords).length
            ? cloudAttendanceRecords
            : localAttendanceRecords;

        setAttendanceRecords(nextAttendanceRecords);
        saveAttendanceRecords(tenantId, nextAttendanceRecords);
        attendanceSignatureRef.current = buildAttendanceRecordsSignature(nextAttendanceRecords);

        const localBankAccounts = readBankAccounts(tenantId);
        const cloudBankAccounts = (bankCloud?.bankAccounts || {}) as BankAccounts;
        const nextBankAccounts =
          cloudBankAccounts && Object.keys(cloudBankAccounts).length
            ? cloudBankAccounts
            : localBankAccounts;

        setBankAccounts(nextBankAccounts);
        saveBankAccounts(tenantId, nextBankAccounts);
        bankSignatureRef.current = buildBankAccountsSignature(nextBankAccounts);

        cloudHydratedRef.current = true;
        setCloudStatus(tr(lang, "تم تحميل بيانات الحضور من السحابة.", "Attendance data loaded from cloud."));

        unsubscribeTeachers = subscribeTenantArray<any>(
          tenantId,
          TEACHERS_SUB,
          (items) => {
            setTeacherRoster(normalizeTeacherRoster(items));
          }
        );

        unsubscribeAssignments = subscribeTenantArray<any>(
          tenantId,
          ATTENDANCE12_ASSIGNMENTS_SUBCOLLECTION,
          (items) => {
            const nextAssignments = normalizeCloudAssignments(items);
            if (nextAssignments.length) {
              setAssignments(nextAssignments);
              setCloudStatus(tr(lang, "تم تحديث بيانات التكليف من السحابة.", "Assignment data updated from cloud."));
            }
          },
          () => {
            setCloudError(tr(lang, "تعذر الاتصال اللحظي ببيانات التكليف.", "Realtime assignment connection failed."));
          }
        );
      } catch {
        if (!mounted) return;
        cloudHydratedRef.current = true;
        refreshLocalFallback();
        setCloudError(tr(lang, "تعذر تحميل السحابة؛ يتم عرض آخر نسخة محفوظة على الجهاز.", "Could not load cloud data; showing last saved device copy."));
      } finally {
        if (mounted) setCloudLoading(false);
      }
    }

    const onStorage = (event: StorageEvent) => {
      const key = event.key || "";
      if (
        key.includes("task-distribution") ||
        key.includes("attendance12") ||
        key.includes("exam-center") ||
        key.includes("control-head") ||
        key === APP_LOGO_KEY
      ) {
        refreshLocalFallback();
      }
    };

    void loadCloudData();

    window.addEventListener("focus", refreshLocalFallback);
    window.addEventListener("storage", onStorage);
    window.addEventListener("exam-manager:attendance12:updated", refreshLocalFallback);
    window.addEventListener("exam-manager:attendance12:banks-updated", refreshLocalFallback);
    DATA_EVENTS.forEach((eventName) => window.addEventListener(eventName, refreshLocalFallback));

    return () => {
      mounted = false;
      unsubscribeTeachers?.();
      unsubscribeAssignments?.();
      window.removeEventListener("focus", refreshLocalFallback);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("exam-manager:attendance12:updated", refreshLocalFallback);
      window.removeEventListener("exam-manager:attendance12:banks-updated", refreshLocalFallback);
      DATA_EVENTS.forEach((eventName) => window.removeEventListener(eventName, refreshLocalFallback));
    };
  }, [tenantId, lang]);

  useEffect(() => {
    if (!cloudHydratedRef.current) return;

    const signature = buildAttendanceRecordsSignature(attendanceRecords);
    if (signature === attendanceSignatureRef.current) return;

    const timeout = window.setTimeout(() => {
      attendanceSignatureRef.current = signature;
      setCloudStatus(tr(lang, "جاري حفظ سجل الحضور في السحابة...", "Saving attendance records to cloud..."));

      void saveTenantSettings(
        tenantId,
        ATTENDANCE12_RECORDS_SETTINGS_DOC_ID,
        {
          records: attendanceRecords,
          updatedAtISO: new Date().toISOString(),
        },
        { by: currentUserId || undefined }
      )
        .then(() => {
          setCloudStatus(tr(lang, "تم حفظ سجل الحضور في السحابة.", "Attendance records saved to cloud."));
        })
        .catch(() => {
          setCloudError(tr(lang, "تم الحفظ محليًا، لكن تعذر حفظ سجل الحضور في السحابة.", "Saved locally, but cloud attendance save failed."));
        });
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [attendanceRecords, tenantId, currentUserId, lang]);

  useEffect(() => {
    if (!cloudHydratedRef.current) return;

    const signature = buildBankAccountsSignature(bankAccounts);
    if (signature === bankSignatureRef.current) return;

    const timeout = window.setTimeout(() => {
      bankSignatureRef.current = signature;
      setCloudStatus(tr(lang, "جاري حفظ أرقام الحسابات في السحابة...", "Saving bank accounts to cloud..."));

      void saveTenantSettings(
        tenantId,
        ATTENDANCE12_BANK_ACCOUNTS_SETTINGS_DOC_ID,
        {
          bankAccounts,
          updatedAtISO: new Date().toISOString(),
        },
        { by: currentUserId || undefined }
      )
        .then(() => {
          setCloudStatus(tr(lang, "تم حفظ أرقام الحسابات في السحابة.", "Bank accounts saved to cloud."));
        })
        .catch(() => {
          setCloudError(tr(lang, "تم الحفظ محليًا، لكن تعذر حفظ أرقام الحسابات في السحابة.", "Saved locally, but cloud bank account save failed."));
        });
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [bankAccounts, tenantId, currentUserId, lang]);

  const teachersById = useMemo(() => {
    const map = new Map<string, TeacherRecord>();
    for (const teacher of teacherRoster) {
      if (teacher.id) map.set(teacher.id, teacher);
      if (teacher.employeeNo) map.set(teacher.employeeNo, teacher);
    }
    return map;
  }, [teacherRoster]);

  const teachersByName = useMemo(() => {
    const map = new Map<string, TeacherRecord>();
    for (const teacher of teacherRoster) {
      if (teacher.name) map.set(normalizeName(teacher.name), teacher);
    }
    return map;
  }, [teacherRoster]);

  const dutyRows = useMemo(() => buildDutyRows(assignments, teachersById, teachersByName), [assignments, teachersById, teachersByName]);
  const dates = useMemo(() => Array.from(new Set(dutyRows.map((row) => row.dateISO))).sort(), [dutyRows]);

  useEffect(() => {
    if (!selectedDate && dates.length) setSelectedDate(dates[0]);
    if (selectedDate && dates.length && !dates.includes(selectedDate)) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    return dutyRows.filter((row) => {
      if (selectedDate && row.dateISO !== selectedDate) return false;
      if (selectedPeriod !== "ALL" && row.period !== selectedPeriod) return false;
      if (selectedTaskType !== "ALL" && row.taskType !== selectedTaskType) return false;
      if (!q) return true;
      const haystack = normalizeText([row.teacherName, row.employeeNo, row.subject, labelTaskType(row.taskType, lang)].join(" ")).toLowerCase();
      return haystack.includes(q);
    });
  }, [dutyRows, selectedDate, selectedPeriod, selectedTaskType, searchText, lang]);

  const selectedDateRows = useMemo(
    () => (selectedDate ? dutyRows.filter((row) => row.dateISO === selectedDate) : dutyRows),
    [dutyRows, selectedDate]
  );

  const selectedDateTeacherCount = useMemo(() => {
    const teacherKeys = new Set<string>();
    for (const row of selectedDateRows) teacherKeys.add(row.teacherId || row.teacherName);
    return teacherKeys.size;
  }, [selectedDateRows]);

  const selectedDateLabel = selectedDate
    ? formatDateWithDay(selectedDate, lang)
    : tr(lang, "اختر تاريخ الامتحان", "Select exam date");

  const summaries = useMemo(() => buildTeacherSummaries(dutyRows, attendanceRecords, bankAccounts), [dutyRows, attendanceRecords, bankAccounts]);
  const currentPresent = filteredRows.filter((row) => getRowStatus(row.key, attendanceRecords) === "PRESENT").length;
  const currentAbsent = filteredRows.filter((row) => getRowStatus(row.key, attendanceRecords) === "ABSENT").length;
  const invCount = filteredRows.filter((row) => row.taskType === "INVIGILATION").length;
  const reserveCount = filteredRows.filter((row) => row.taskType === "RESERVE").length;
  const dutyCount = filteredRows.filter((row) => row.taskType === "DUTY_INVIGILATOR").length;

  const updateAttendance = (rowKey: string, status: AttendanceStatus) => {
    setAttendanceRecords((prev) => {
      const next = { ...prev, [rowKey]: { status, updatedAtISO: new Date().toISOString() } };
      saveAttendanceRecords(tenantId, next);
      return next;
    });
  };

  const markVisibleRows = (status: AttendanceStatus) => {
    setAttendanceRecords((prev) => {
      const next = { ...prev };
      const now = new Date().toISOString();
      for (const row of filteredRows) next[row.key] = { status, updatedAtISO: now };
      saveAttendanceRecords(tenantId, next);
      return next;
    });
  };

  const updateBankAccount = (teacherKey: string, value: string) => {
    setBankAccounts((prev) => {
      const next = { ...prev, [teacherKey]: value };
      saveBankAccounts(tenantId, next);
      return next;
    });
  };

  const toggleBankEdit = (teacherKey: string) => {
    if (editingBankKey === teacherKey) {
      setEditingBankKey(null);
      return;
    }
    setEditingBankKey(teacherKey);
  };

  const exportTablesToExcel = () => {
    const title = tr(lang, "حصر حضور وغياب الكادر التعليمي", "Teaching Staff Attendance Register");
    const attendanceSheetName = tr(lang, "سجل الحضور والغياب", "Attendance Register");
    const summarySheetName = tr(lang, "إحصائية الحضور", "Attendance Statistics");
    const attendanceHeaders = [
      "#",
      tr(lang, "اسم المعلم", "Teacher"),
      tr(lang, "الرقم الوظيفي", "Employee No."),
      tr(lang, "التاريخ", "Date"),
      tr(lang, "الفترة", "Period"),
      tr(lang, "التكليف", "Task"),
      tr(lang, "المادة", "Subject"),
      tr(lang, "الحالة", "Status"),
    ];
    const summaryHeaders = [
      "#",
      tr(lang, "اسم المعلم", "Teacher"),
      tr(lang, "الرقم الوظيفي", "Employee No."),
      tr(lang, "عدد أيام الحضور", "Present days"),
      tr(lang, "عدد أيام الغياب", "Absent days"),
      tr(lang, "إجمالي الحضور", "Net attendance"),
      tr(lang, "إجمالي أيام التكليف", "Duty days"),
      tr(lang, "إجمالي التكليف", "Total assignment value"),
      tr(lang, "الرقم البنكي", "Bank account"),
    ];

    const attendanceRows = filteredRows.map((row, index) => [
      index + 1,
      row.teacherName,
      row.employeeNo || "—",
      formatDateWithDay(row.dateISO, lang),
      periodLabel(row.period, lang),
      labelTaskType(row.taskType, lang),
      row.subject || "—",
      getRowStatus(row.key, attendanceRecords) === "ABSENT" ? tr(lang, "غائب", "Absent") : tr(lang, "حاضر", "Present"),
    ]);

    const summaryRows = summaries.map((row, index) => {
      const teacherKey = row.teacherId || row.teacherName;
      return [
        index + 1,
        row.teacherName,
        row.employeeNo || "—",
        row.presentDays,
        row.absentDays,
        row.totalAttendance,
        row.totalDutyDays,
        formatOMR(row.totalAssignmentValueOMR, lang),
        bankAccounts[teacherKey] || row.bankAccount || "",
      ];
    });

    const sanitizeSheetName = (value: string) => {
      const cleaned = String(value || "Sheet")
        .replace(/[\\/?:*\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return (cleaned || "Sheet").slice(0, 31);
    };

    const makeExcelCell = (value: unknown, styleId = "Data") => {
      const text = escapeHtml(value);
      return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${text}</Data></Cell>`;
    };

    const makeExcelRow = (cells: unknown[], styleId = "Data") => `
      <Row>${cells.map((cell) => makeExcelCell(cell, styleId)).join("")}</Row>
    `;

    const makeWorksheet = (sheetName: string, tableTitle: string, headers: string[], bodyRows: unknown[][]) => {
      const columnCount = Math.max(headers.length, 1);
      const titleRow = `<Row>${`<Cell ss:StyleID="Title" ss:MergeAcross="${Math.max(columnCount - 1, 0)}"><Data ss:Type="String">${escapeHtml(tableTitle)}</Data></Cell>`}</Row>`;
      const centerRow = `<Row>${`<Cell ss:StyleID="Meta" ss:MergeAcross="${Math.max(columnCount - 1, 0)}"><Data ss:Type="String">${escapeHtml(centerData.name || tr(lang, "مركز الامتحانات", "Exam Center"))}</Data></Cell>`}</Row>`;
      const dateRow = `<Row>${`<Cell ss:StyleID="Meta" ss:MergeAcross="${Math.max(columnCount - 1, 0)}"><Data ss:Type="String">${escapeHtml(`${tr(lang, "التاريخ المختار", "Selected date")}: ${selectedDateLabel}`)}</Data></Cell>`}</Row>`;
      const spacerRow = `<Row>${Array.from({ length: columnCount }, () => makeExcelCell("", "Data")).join("")}</Row>`;
      const headersRow = makeExcelRow(headers, "Header");
      const rowsXml = bodyRows.length
        ? bodyRows.map((row) => makeExcelRow(row, "Data")).join("")
        : makeExcelRow([tr(lang, "لا توجد بيانات", "No data")], "Data");

      return `
        <Worksheet ss:Name="${escapeHtml(sanitizeSheetName(sheetName))}">
          <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="22">
            ${Array.from({ length: columnCount }, () => '<Column ss:AutoFitWidth="1" ss:Width="135"/>').join("")}
            ${titleRow}
            ${centerRow}
            ${dateRow}
            ${spacerRow}
            ${headersRow}
            ${rowsXml}
          </Table>
          <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
            <DisplayRightToLeft/>
            <ProtectObjects>False</ProtectObjects>
            <ProtectScenarios>False</ProtectScenarios>
          </WorksheetOptions>
        </Worksheet>
      `;
    };

    const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook
        xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:html="http://www.w3.org/TR/REC-html40">
        <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
          <Title>${escapeHtml(title)}</Title>
          <Author>Exam Manager</Author>
          <Created>${new Date().toISOString()}</Created>
        </DocumentProperties>
        <Styles>
          <Style ss:ID="Default" ss:Name="Normal">
            <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="RightToLeft"/>
            <Font ss:FontName="Tahoma" ss:Size="11" ss:Color="#111827" ss:Bold="1"/>
          </Style>
          <Style ss:ID="Title">
            <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="RightToLeft"/>
            <Font ss:FontName="Tahoma" ss:Size="18" ss:Color="#111827" ss:Bold="1"/>
            <Interior ss:Color="#FFF7D6" ss:Pattern="Solid"/>
          </Style>
          <Style ss:ID="Meta">
            <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="RightToLeft"/>
            <Font ss:FontName="Tahoma" ss:Size="12" ss:Color="#111827" ss:Bold="1"/>
          </Style>
          <Style ss:ID="Header">
            <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="RightToLeft"/>
            <Font ss:FontName="Tahoma" ss:Size="12" ss:Color="#000000" ss:Bold="1"/>
            <Interior ss:Color="#F0C94F" ss:Pattern="Solid"/>
            <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
              <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
              <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
              <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
            </Borders>
          </Style>
          <Style ss:ID="Data">
            <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="RightToLeft"/>
            <Font ss:FontName="Tahoma" ss:Size="11" ss:Color="#111827" ss:Bold="1"/>
            <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
              <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
              <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
              <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111827"/>
            </Borders>
          </Style>
        </Styles>
        ${makeWorksheet(attendanceSheetName, attendanceSheetName, attendanceHeaders, attendanceRows)}
        ${makeWorksheet(summarySheetName, tr(lang, "إحصائية الحضور لكل معلم", "Teacher attendance statistics"), summaryHeaders, summaryRows)}
      </Workbook>
    `;

    const blob = new Blob(["﻿", workbookXml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance12-${selectedDate || "all"}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  const officialPrintHeaderData = useMemo(() => {
    const countryName = centerData.country?.trim() || tr(lang, "سلطنة عمان", "Sultanate of Oman");
    const ministryName = centerData.ministry?.trim() || tr(lang, "وزارة التعليم", "Ministry of Education");
    const directorateName = centerData.governorate?.trim() || tr(lang, "المديرية العامة للتعليم", "General Directorate of Education");
    const centerName = centerData.name?.trim() || centerData.officialTitle?.trim() || tr(lang, "مركز الامتحانات", "Exam Center");
    const semesterLabel = centerData.semester?.trim() || tr(lang, "الفصل الدراسي الأول", "First Semester");
    const academicYearLabel = centerData.academicYear?.trim() || "2026/2025";
    return { countryName, ministryName, directorateName, centerName, semesterLabel, academicYearLabel };
  }, [centerData, lang]);

  const getOfficialPrintContext = (rows: DutyRow[]) => {
    const baseRows = Array.isArray(rows) && rows.length ? rows : filteredRows.length ? filteredRows : dutyRows;
    const dateValues = Array.from(new Set(baseRows.map((row) => row.dateISO).filter(Boolean))).sort();
    const periodValues = Array.from(new Set(baseRows.map((row) => row.period).filter(Boolean)));
    const subjectValues = Array.from(new Set(baseRows.map((row) => String(row.subject || "").trim()).filter(Boolean).filter((value) => value !== "—")));

    const dateISO = dateValues.length === 1 ? dateValues[0] : selectedDate || "";
    const period = periodValues.length === 1 ? periodValues[0] : selectedPeriod !== "ALL" ? selectedPeriod : "ALL";
    const subject = subjectValues.length === 1 ? subjectValues[0] : subjectValues.length > 1 ? tr(lang, "مواد متعددة", "Multiple subjects") : "—";

    return {
      dateISO,
      dayLabel: dateISO ? dayNameOnly(dateISO, lang) : "—",
      dateLabel: dateISO ? formatPrintDate(dateISO) : "—",
      periodLabel: periodLabel(period, lang),
      subject,
      timeLabel: "08:00",
    };
  };

  const commonOfficialPrintStyles = `
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      direction: rtl;
      unicode-bidi: plaintext;
      font-family: Tahoma, Arial, sans-serif;
      background: #ffffff;
      color: #111827;
      font-weight: 900;
    }
    .print-shell { padding: 14px; }
    .official-header-grid {
      display: grid;
      grid-template-columns: 1fr 92px 1fr;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .official-header-right {
      text-align: ${isRTL ? "right" : "left"};
      line-height: 1.35;
      color: #000000;
      font-size: 13px;
      font-weight: 900;
    }
    .official-header-center {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .official-header-logo {
      width: 68px;
      height: 68px;
      object-fit: contain;
    }
    .official-header-left {
      text-align: ${isRTL ? "left" : "right"};
      line-height: 1.35;
      color: #000000;
      font-weight: 900;
    }
    .official-header-title {
      display: inline-block;
      border-bottom: 3px solid #111827;
      padding-bottom: 5px;
      margin-bottom: 6px;
      font-size: 20px;
      line-height: 1.25;
      color: #000000;
      font-weight: 950;
    }
    .official-header-sub {
      font-size: 13px;
      color: #000000;
      font-weight: 900;
      margin-top: 2px;
    }
    .official-hr {
      height: 3px;
      background: #111827;
      opacity: 0.9;
      margin: 10px 0 12px;
    }
    .official-exam-bar {
      border: 3px solid #111827;
      border-radius: 13px;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: #ffffff;
    }
    .official-exam-bar-inner {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      color: #000000;
      font-size: 13px;
      font-weight: 950;
    }
    .official-sep {
      color: #111827;
      font-weight: 950;
      opacity: 0.95;
    }
    .print-subtitle {
      margin: 8px 0 12px;
      color: #111827;
      font-size: 13px;
      line-height: 1.7;
      font-weight: 900;
    }
    h2 { margin: 16px 0 8px; font-size: 18px; color: #111827; font-weight: 950; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: auto; direction: rtl; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th {
      background: #f0c94f;
      color: #000000;
      border: 2px solid #111827;
      padding: 8px 6px;
      font-size: 12px;
      font-weight: 950;
      text-align: center;
      white-space: nowrap;
    }
    td {
      color: #000000;
      border: 2px solid #111827;
      padding: 7px 6px;
      font-size: 12px;
      font-weight: 900;
      text-align: center;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) td { background: #fffdf2; }
    .footer-note {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      gap: 14px;
      color: #111827;
      font-size: 12px;
      font-weight: 900;
    }
    .official-signature-area {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      align-items: end;
      page-break-inside: avoid;
    }
    .official-signature-block,
    .official-stamp-block {
      min-height: 96px;
      border: 2px solid #111827;
      border-radius: 14px;
      padding: 12px 16px;
      background: #ffffff;
      color: #000000;
      font-weight: 950;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .official-signature-title,
    .official-stamp-title {
      font-size: 15px;
      color: #000000;
      font-weight: 950;
      text-align: center;
    }
    .official-signature-name {
      margin-top: 8px;
      font-size: 13px;
      color: #000000;
      font-weight: 900;
      text-align: center;
      min-height: 22px;
    }
    .official-signature-line {
      margin-top: 18px;
      border-bottom: 2px solid #111827;
      height: 20px;
    }
    .official-stamp-box {
      height: 54px;
      border: 2px dashed #111827;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000000;
      font-size: 14px;
      font-weight: 950;
      margin-top: 10px;
    }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;

  const buildOfficialPrintHeader = (title: string, contextRows: DutyRow[]) => {
    const ctx = getOfficialPrintContext(contextRows);
    return `
      <div class="official-header-grid">
        <div class="official-header-right">
          <div>${escapeHtml(officialPrintHeaderData.countryName)}</div>
          <div>${escapeHtml(officialPrintHeaderData.ministryName)}</div>
          <div>${escapeHtml(officialPrintHeaderData.directorateName)}</div>
          <div>${escapeHtml(officialPrintHeaderData.centerName)}</div>
        </div>
        <div class="official-header-center">
          <img class="official-header-logo" src="${escapeHtml(centerData.logoUrl || DEFAULT_LOGO_URL)}" alt="logo" />
        </div>
        <div class="official-header-left">
          <div class="official-header-title">${escapeHtml(title)}</div>
          <div class="official-header-sub">${escapeHtml(officialPrintHeaderData.semesterLabel)}</div>
          <div class="official-header-sub">${escapeHtml(tr(lang, "العام الدراسي", "Academic Year"))} ${escapeHtml(officialPrintHeaderData.academicYearLabel)}</div>
        </div>
      </div>
      <div class="official-hr"></div>
      <div class="official-exam-bar">
        <div class="official-exam-bar-inner">
          <div><span>${escapeHtml(tr(lang, "الفترة", "Period"))}:</span> <span>${escapeHtml(ctx.periodLabel)}</span></div>
          <div class="official-sep">|</div>
          <div><span>${escapeHtml(tr(lang, "اليوم", "Day"))}:</span> <span>${escapeHtml(ctx.dayLabel)}</span></div>
          <div class="official-sep">|</div>
          <div><span>${escapeHtml(tr(lang, "الوقت", "Time"))}:</span> <span>${escapeHtml(ctx.timeLabel)}</span></div>
          <div><span>${escapeHtml(tr(lang, "المادة", "Subject"))}:</span> <span>${escapeHtml(ctx.subject)}</span></div>
          <div><span>${escapeHtml(tr(lang, "التاريخ", "Date"))}:</span> <span>${escapeHtml(ctx.dateLabel)}</span></div>
        </div>
      </div>
    `;
  };

  const buildPrintTable = (headers: string[], bodyRows: unknown[][]) => `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${bodyRows.length
          ? bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
          : `<tr><td colspan="${headers.length}">${escapeHtml(tr(lang, "لا توجد بيانات للطباعة", "No data to print"))}</td></tr>`}
      </tbody>
    </table>
  `;

  const buildOfficialPrintFooter = (metaLabel: string, metaValue: string | number) => `
    <div class="official-signature-area">
      <div class="official-signature-block">
        <div class="official-signature-title">${escapeHtml(tr(lang, "توقيع رئيس المركز", "Center Head Signature"))}</div>
        <div class="official-signature-name">${escapeHtml(centerData.controlHeadName || "—")}</div>
        <div class="official-signature-line"></div>
      </div>
      <div class="official-stamp-block">
        <div class="official-stamp-title">${escapeHtml(tr(lang, "ختم المركز", "Center Stamp"))}</div>
        <div class="official-stamp-box">${escapeHtml(tr(lang, "ختم المركز", "Center Stamp"))}</div>
      </div>
    </div>
    <div class="footer-note">
      <span>${escapeHtml(tr(lang, "رئيس المركز", "Center Head"))}: ${escapeHtml(centerData.controlHeadName || "—")}</span>
      <span>${escapeHtml(metaLabel)}: ${escapeHtml(metaValue)}</span>
    </div>
  `;

  const buildAttendancePrintRows = (rows: DutyRow[]) =>
    rows.map((row, index) => [
      index + 1,
      row.teacherName,
      row.employeeNo || "—",
      formatDateWithDay(row.dateISO, lang),
      periodLabel(row.period, lang),
      labelTaskType(row.taskType, lang),
      row.subject || "—",
      getRowStatus(row.key, attendanceRecords) === "ABSENT" ? tr(lang, "غائب", "Absent") : tr(lang, "حاضر", "Present"),
    ]);

  const buildSummaryPrintRows = (rows: TeacherSummaryRow[]) =>
    rows.map((row, index) => {
      const teacherKey = row.teacherId || row.teacherName;
      return [
        index + 1,
        row.teacherName,
        row.employeeNo || "—",
        row.presentDays,
        row.absentDays,
        row.totalAttendance,
        row.totalDutyDays,
        formatOMR(row.totalAssignmentValueOMR, lang),
        bankAccounts[teacherKey] || row.bankAccount || "",
      ];
    });

  const openPrintableWindow = (title: string, subtitle: string, attendanceRowsToPrint: DutyRow[], summaryRowsToPrint: TeacherSummaryRow[]) => {
    const attendanceHeaders = [
      "#",
      tr(lang, "اسم المعلم", "Teacher"),
      tr(lang, "الرقم الوظيفي", "Employee No."),
      tr(lang, "التاريخ", "Date"),
      tr(lang, "الفترة", "Period"),
      tr(lang, "التكليف", "Task"),
      tr(lang, "المادة", "Subject"),
      tr(lang, "الحالة", "Status"),
    ];

    const summaryHeaders = [
      "#",
      tr(lang, "اسم المعلم", "Teacher"),
      tr(lang, "الرقم الوظيفي", "Employee No."),
      tr(lang, "عدد أيام الحضور", "Present days"),
      tr(lang, "عدد أيام الغياب", "Absent days"),
      tr(lang, "إجمالي الحضور", "Net attendance"),
      tr(lang, "إجمالي أيام التكليف", "Duty days"),
      tr(lang, "إجمالي التكليف", "Total assignment value"),
      tr(lang, "الرقم البنكي", "Bank account"),
    ];

    const printableHtml = `
      <!doctype html>
      <html dir="${isRTL ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>${commonOfficialPrintStyles}</style>
        </head>
        <body>
          <div class="print-shell">
            ${buildOfficialPrintHeader(title, attendanceRowsToPrint)}
            <div class="print-subtitle">${escapeHtml(subtitle)}</div>

            <h2>${escapeHtml(tr(lang, "سجل الحضور والغياب", "Attendance register"))}</h2>
            ${buildPrintTable(attendanceHeaders, buildAttendancePrintRows(attendanceRowsToPrint))}

            <h2>${escapeHtml(tr(lang, "إحصائية الحضور", "Attendance statistics"))}</h2>
            ${buildPrintTable(summaryHeaders, buildSummaryPrintRows(summaryRowsToPrint))}

            ${buildOfficialPrintFooter(tr(lang, "إجمالي السجلات", "Total records"), attendanceRowsToPrint.length)}
          </div>
          <script>
            window.addEventListener('load', function () {
              window.focus();
              setTimeout(function () { window.print(); }, 350);
            });
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      alert(tr(lang, "يرجى السماح بالنوافذ المنبثقة حتى تتم الطباعة.", "Please allow pop-ups to print."));
      return;
    }
    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();
  };

  const printFullTable = () => {
    const rowsToPrint = filteredRows.length ? filteredRows : dutyRows;
    const title = tr(lang, "طباعة جدول الحضور والغياب كامل", "Print full attendance table");
    const subtitle = tr(
      lang,
      `حسب الفلاتر الحالية · التاريخ: ${selectedDateLabel} · عدد السجلات: ${rowsToPrint.length}`,
      `Based on current filters · Date: ${selectedDateLabel} · Records: ${rowsToPrint.length}`
    );
    openPrintableWindow(title, subtitle, rowsToPrint, summaries);
  };

  const printTeacherTable = (teacherSummary: TeacherSummaryRow) => {
    const teacherKey = teacherSummary.teacherId || teacherSummary.teacherName;
    const rowsToPrint = dutyRows.filter((row) => (row.teacherId || row.teacherName) === teacherKey);
    const title = tr(lang, "كشف حضور وغياب معلم", "Teacher attendance report");
    const subtitle = `${teacherSummary.teacherName} · ${tr(lang, "الرقم الوظيفي", "Employee No.")}: ${teacherSummary.employeeNo || "—"}`;
    openPrintableWindow(title, subtitle, rowsToPrint, [teacherSummary]);
  };

  const openSummaryStatsPrintableWindow = (title: string, subtitle: string, summaryRowsToPrint: TeacherSummaryRow[], contextRows: DutyRow[] = filteredRows) => {
    const summaryHeaders = [
      "#",
      tr(lang, "اسم المعلم", "Teacher"),
      tr(lang, "الرقم الوظيفي", "Employee No."),
      tr(lang, "عدد أيام الحضور", "Present days"),
      tr(lang, "عدد أيام الغياب", "Absent days"),
      tr(lang, "إجمالي الحضور", "Net attendance"),
      tr(lang, "إجمالي أيام التكليف", "Duty days"),
      tr(lang, "إجمالي التكليف", "Total assignment value"),
      tr(lang, "الرقم البنكي", "Bank account"),
    ];

    const printableHtml = `
      <!doctype html>
      <html dir="${isRTL ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>${commonOfficialPrintStyles}</style>
        </head>
        <body>
          <div class="print-shell">
            ${buildOfficialPrintHeader(title, contextRows)}
            <div class="print-subtitle">${escapeHtml(subtitle)}</div>

            <h2>${escapeHtml(tr(lang, "جدول إحصائية الحضور لكل معلم", "Teacher attendance statistics table"))}</h2>
            ${buildPrintTable(summaryHeaders, buildSummaryPrintRows(summaryRowsToPrint))}

            ${buildOfficialPrintFooter(tr(lang, "عدد المعلمين", "Teachers count"), summaryRowsToPrint.length)}
          </div>
          <script>
            window.addEventListener('load', function () {
              window.focus();
              setTimeout(function () { window.print(); }, 350);
            });
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      alert(tr(lang, "يرجى السماح بالنوافذ المنبثقة حتى تتم الطباعة.", "Please allow pop-ups to print."));
      return;
    }
    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();
  };

  const printSummaryStatsTable = () => {
    const title = tr(lang, "طباعة جدول إحصائية الحضور لكل معلم", "Print teacher attendance statistics");
    const subtitle = tr(
      lang,
      `حسب الفلاتر الحالية · التاريخ: ${selectedDateLabel} · عدد المعلمين: ${summaries.length}`,
      `Based on current filters · Date: ${selectedDateLabel} · Teachers: ${summaries.length}`
    );
    openSummaryStatsPrintableWindow(title, subtitle, summaries, filteredRows);
  };

  const printTeacherSummaryStatsTable = (teacherSummary: TeacherSummaryRow) => {
    const title = tr(lang, "طباعة إحصائية حضور معلم", "Print teacher attendance statistics");
    const subtitle = `${teacherSummary.teacherName} · ${tr(lang, "الرقم الوظيفي", "Employee No.")}: ${teacherSummary.employeeNo || "—"}`;
    openSummaryStatsPrintableWindow(title, subtitle, [teacherSummary], dutyRows.filter((row) => (row.teacherId || row.teacherName) === (teacherSummary.teacherId || teacherSummary.teacherName)));
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={styles.page}>
      <style>{`
        select,
        select option {
          color: #000000 !important;
          font-weight: 900 !important;
          background: #ffffff !important;
        }

        select:focus {
          color: #000000 !important;
          font-weight: 900 !important;
        }

        .attendance12-bank-input,
        .attendance12-bank-input:focus,
        .attendance12-bank-input:read-only {
          color: #000000 !important;
          font-weight: 950 !important;
          -webkit-text-fill-color: #000000 !important;
          caret-color: #000000 !important;
        }

        .attendance12-bank-input::placeholder {
          color: #000000 !important;
          font-weight: 900 !important;
          opacity: 0.72 !important;
        }
      `}</style>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />
      <div style={styles.container}>
        <header style={styles.headerCard}>
          <div style={styles.headerLeft}>
            <img src={centerData.logoUrl || DEFAULT_LOGO_URL} alt="logo" style={styles.logo} />
            <div>
              <div style={styles.kicker}>{tr(lang, "نظام إدارة الامتحانات", "Exam Management System")}</div>
              <h1 style={styles.title}>{tr(lang, "حصر حضور وغياب الكادر التعليمي", "Teaching Staff Attendance Register")}</h1>
              <div style={styles.subtitle}>
                {centerData.name || tr(lang, "مركز الامتحانات", "Exam Center")}
                {centerData.governorate ? ` · ${centerData.governorate}` : ""}
                {centerData.semester ? ` · ${centerData.semester}` : ""}
              </div>
            </div>
          </div>
          <div style={styles.headerMeta}>
            <div style={styles.metaLabel}>{tr(lang, "رئيس الكنترول", "Control Head")}</div>
            <div style={styles.metaValue}>{centerData.controlHeadName || "—"}</div>
            <div style={styles.metaHint}>{tr(lang, "مصدر البيانات: صفحات التشغيل والنتائج", "Data source: run and results pages")}</div>
          </div>
        </header>

        <section style={styles.cloudStatusCard}>
          <strong>
            {cloudLoading
              ? tr(lang, "جاري تحميل بيانات الحضور من السحابة...", "Loading attendance data from cloud...")
              : cloudError || cloudStatus || tr(lang, "جاهز للعمل المتزامن من أي جهاز.", "Ready for synchronized work from any device.")}
          </strong>
          <span>
            {tr(lang, "المعلمون", "Teachers")}: {teacherRoster.length} · {tr(lang, "سجلات التكليف", "Assignments")}: {assignments.length}
          </span>
        </section>

        <section style={styles.filtersCard}>
          <div style={styles.filterGroup}>
            <label style={styles.label}>{tr(lang, "تاريخ الامتحان", "Exam date")}</label>
            <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={styles.select}>
              {dates.length ? (
                dates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateWithDay(date, lang)}
                  </option>
                ))
              ) : (
                <option value="">{tr(lang, "لا توجد تواريخ", "No dates")}</option>
              )}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>{tr(lang, "الفترة", "Period")}</label>
            <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value as PeriodFilter)} style={styles.select}>
              <option value="ALL">{periodLabel("ALL", lang)}</option>
              <option value="AM">{periodLabel("AM", lang)}</option>
              <option value="PM">{periodLabel("PM", lang)}</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>{tr(lang, "نوع التكليف", "Task type")}</label>
            <select value={selectedTaskType} onChange={(event) => setSelectedTaskType(event.target.value as "ALL" | TaskType)} style={styles.select}>
              <option value="ALL">{tr(lang, "كل التكليفات", "All tasks")}</option>
              <option value="INVIGILATION">{labelTaskType("INVIGILATION", lang)}</option>
              <option value="RESERVE">{labelTaskType("RESERVE", lang)}</option>
              <option value="DUTY_INVIGILATOR">{labelTaskType("DUTY_INVIGILATOR", lang)}</option>
            </select>
          </div>

          <div style={styles.filterGroupWide}>
            <label style={styles.label}>{tr(lang, "بحث", "Search")}</label>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={tr(lang, "ابحث باسم المعلم أو الرقم الوظيفي أو المادة", "Search by teacher, employee number, or subject")}
              style={styles.input}
            />
          </div>
        </section>

        <section style={styles.kpiGrid}>
          <KpiCard title={tr(lang, "إجمالي السجلات", "Total records")} value={filteredRows.length} hint={tr(lang, "حسب الفلاتر الحالية", "Based on current filters")} />
          <KpiCard title={tr(lang, "حاضر", "Present")} value={currentPresent} hint={tr(lang, "الافتراضي حاضر ويمكن تغييره", "Default is present and can be changed")} />
          <KpiCard title={tr(lang, "غائب", "Absent")} value={currentAbsent} hint={tr(lang, "سجلات تم تحديدها غياب", "Marked absent records")} />
          <KpiCard title={tr(lang, "تفصيل التكليفات", "Task breakdown")} value={`${invCount}/${reserveCount}/${dutyCount}`} hint={tr(lang, "مراقبة / احتياط / مراقب دور", "Invigilation / Reserve / Duty")} />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>{tr(lang, "سجل الحضور والغياب حسب تاريخ الامتحان", "Attendance by exam date")}</h2>
              <p style={styles.panelSub}>
                {tr(
                  lang,
                  "البيانات مقروءة من توزيع المراقبة والاحتياط ومراقب الدور. التعديل هنا يخص حالة الحضور فقط ولا يغير التوزيع الأصلي.",
                  "Rows are read from invigilation, reserve, and duty invigilator distribution. Edits here affect attendance only and do not change the original distribution."
                )}
              </p>
            </div>
            <div style={styles.actionsRow}>
              <button type="button" style={styles.secondaryButton} onClick={() => {
                setAssignments(readAssignmentsFromStorage(tenantId));
                setCloudStatus(tr(lang, "تم تحديث البيانات من النسخة المؤقتة. أعد فتح الصفحة لتحميل السحابة.", "Temporary copy refreshed. Reopen page to reload cloud."));
              }}>
                {tr(lang, "تحديث البيانات", "Refresh data")}
              </button>
              <button type="button" style={styles.excelButton} onClick={exportTablesToExcel}>
                {tr(lang, "تصدير الجدول Excel", "Export table to Excel")}
              </button>
              <button type="button" style={styles.printButton} onClick={printFullTable}>
                {tr(lang, "طباعة الجدول كامل", "Print full table")}
              </button>
              <button type="button" style={styles.primaryButton} onClick={() => markVisibleRows("PRESENT")}>
                {tr(lang, "تحديد الظاهر حاضر", "Mark visible present")}
              </button>
              <button type="button" style={styles.dangerButton} onClick={() => markVisibleRows("ABSENT")}>
                {tr(lang, "تحديد الظاهر غائب", "Mark visible absent")}
              </button>
            </div>
          </div>

          <div style={styles.datePickerBar}>
            <div style={styles.datePickerMain}>
              <label style={styles.label}>{tr(lang, "اختر تاريخ الامتحان لعرض معلمي هذا اليوم فقط", "Select an exam date to show only that day's teachers")}</label>
              <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={styles.dateSelect}>
                {dates.length ? (
                  dates.map((date) => (
                    <option key={date} value={date}>
                      {formatDateWithDay(date, lang)}
                    </option>
                  ))
                ) : (
                  <option value="">{tr(lang, "لا توجد تواريخ امتحانات", "No exam dates")}</option>
                )}
              </select>
            </div>

            <div style={styles.datePickerInfoGrid}>
              <div style={styles.datePickerMetric}>
                <span style={styles.datePickerMetricLabel}>{tr(lang, "التاريخ المختار", "Selected date")}</span>
                <strong style={styles.datePickerMetricValue}>{selectedDateLabel}</strong>
              </div>
              <div style={styles.datePickerMetric}>
                <span style={styles.datePickerMetricLabel}>{tr(lang, "معلمو هذا اليوم", "Teachers this day")}</span>
                <strong style={styles.datePickerMetricValue}>{selectedDateTeacherCount}</strong>
              </div>
              <div style={styles.datePickerMetric}>
                <span style={styles.datePickerMetricLabel}>{tr(lang, "تكليفات هذا اليوم", "Tasks this day")}</span>
                <strong style={styles.datePickerMetricValue}>{selectedDateRows.length}</strong>
              </div>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>{tr(lang, "اسم المعلم", "Teacher")}</th>
                  <th style={styles.th}>{tr(lang, "الرقم الوظيفي", "Employee No.")}</th>
                  <th style={styles.th}>{tr(lang, "التاريخ", "Date")}</th>
                  <th style={styles.th}>{tr(lang, "الفترة", "Period")}</th>
                  <th style={styles.th}>{tr(lang, "التكليف", "Task")}</th>
                  <th style={styles.th}>{tr(lang, "المادة", "Subject")}</th>
                  <th style={styles.th}>{tr(lang, "الحالة", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row, index) => {
                    const status = getRowStatus(row.key, attendanceRecords);
                    return (
                      <tr key={row.key}>
                        <td style={styles.tdCenter}>{index + 1}</td>
                        <td style={styles.tdStrong}>{row.teacherName}</td>
                        <td style={styles.tdCenter}>{row.employeeNo || "—"}</td>
                        <td style={styles.tdCenter}>{formatDateWithDay(row.dateISO, lang)}</td>
                        <td style={styles.tdCenter}>{periodLabel(row.period, lang)}</td>
                        <td style={styles.tdCenter}>
                          <span
                            style={{
                              ...styles.taskPill,
                              ...getTaskPillStatusStyle(row.taskType, status),
                            }}
                          >
                            {labelTaskType(row.taskType, lang)}
                          </span>
                        </td>
                        <td style={styles.td}>{row.subject || "—"}</td>
                        <td style={styles.tdCenter}>
                          <select
                            value={status}
                            onChange={(event) => updateAttendance(row.key, event.target.value as AttendanceStatus)}
                            style={{ ...styles.statusSelect, ...(status === "ABSENT" ? styles.statusAbsent : styles.statusPresent) }}
                          >
                            <option value="PRESENT">{tr(lang, "حاضر", "Present")}</option>
                            <option value="ABSENT">{tr(lang, "غائب", "Absent")}</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td style={styles.emptyCell} colSpan={8}>
                      {tr(
                        lang,
                        "لا توجد بيانات لهذا الفلتر. نفّذ التوزيع أولاً أو افتح صفحة النتائج ثم عد إلى هذه الصفحة.",
                        "No data for this filter. Run the distribution first or open the results page, then return here."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>{tr(lang, "إحصائية الحضور لكل معلم", "Teacher attendance statistics")}</h2>
              <p style={styles.panelSub}>
                {tr(
                  lang,
                  "اضغط زر تعديل لإدخال الرقم البنكي أو تعديله، ثم احفظه ليظهر داخل الجدول والتصدير.",
                  "Click Edit to enter or update the bank account, then save it so it appears in the table and export."
                )}
              </p>
            </div>
            <div style={styles.actionsRow}>
              <button type="button" style={styles.excelButton} onClick={exportTablesToExcel}>
                {tr(lang, "تصدير الجدول Excel", "Export table to Excel")}
              </button>
              <button type="button" style={styles.statsPrintButton} onClick={printSummaryStatsTable}>
                {tr(lang, "طباعة إحصائية الحضور", "Print attendance statistics")}
              </button>
              <button type="button" style={styles.printButton} onClick={printFullTable}>
                {tr(lang, "طباعة الجدول كامل", "Print full table")}
              </button>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>{tr(lang, "اسم المعلم", "Teacher")}</th>
                  <th style={styles.th}>{tr(lang, "الرقم الوظيفي", "Employee No.")}</th>
                  <th style={styles.th}>{tr(lang, "عدد أيام الحضور", "Present days")}</th>
                  <th style={styles.th}>{tr(lang, "عدد أيام الغياب", "Absent days")}</th>
                  <th style={styles.th}>{tr(lang, "إجمالي الحضور", "Net attendance")}</th>
                  <th style={styles.th}>{tr(lang, "إجمالي أيام التكليف", "Duty days")}</th>
                  <th style={styles.th}>{tr(lang, "إجمالي التكليف", "Total assignment value")}</th>
                  <th style={styles.th}>{tr(lang, "الرقم البنكي", "Bank account")}</th>
                  <th style={styles.th}>{tr(lang, "الإجراء", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length ? (
                  summaries.map((row, index) => {
                    const teacherKey = row.teacherId || row.teacherName;
                    return (
                      <tr key={teacherKey}>
                        <td style={styles.tdCenter}>{index + 1}</td>
                        <td style={styles.tdStrong}>{row.teacherName}</td>
                        <td style={styles.tdCenter}>{row.employeeNo || "—"}</td>
                        <td style={styles.tdCenter}>{row.presentDays}</td>
                        <td style={styles.tdCenter}>{row.absentDays}</td>
                        <td style={styles.tdCenter}>{row.totalAttendance}</td>
                        <td style={styles.tdCenter}>{row.totalDutyDays}</td>
                        <td style={styles.tdCenter}>{formatOMR(row.totalAssignmentValueOMR, lang)}</td>
                        <td style={styles.tdCenter}>
                          <input
                            className="attendance12-bank-input"
                            value={bankAccounts[teacherKey] || ""}
                            onChange={(event) => updateBankAccount(teacherKey, event.target.value)}
                            placeholder={tr(lang, "اضغط تعديل لإدخال الرقم البنكي", "Click Edit to enter bank account")}
                            readOnly={editingBankKey !== teacherKey}
                            style={{ ...styles.bankInput, ...(editingBankKey !== teacherKey ? styles.bankInputReadonly : {}) }}
                          />
                        </td>
                        <td style={styles.tdCenter}>
                          <div style={styles.tableActionButtons}>
                            <button
                              type="button"
                              style={editingBankKey === teacherKey ? styles.saveBankButton : styles.editBankButton}
                              onClick={() => toggleBankEdit(teacherKey)}
                            >
                              {editingBankKey === teacherKey
                                ? tr(lang, "حفظ", "Save")
                                : bankAccounts[teacherKey]
                                ? tr(lang, "تعديل", "Edit")
                                : tr(lang, "إدخال", "Add")}
                            </button>
                            <button
                              type="button"
                              style={styles.printTeacherButton}
                              onClick={() => printTeacherTable(row)}
                            >
                              {tr(lang, "طباعة", "Print")}
                            </button>
                            <button
                              type="button"
                              style={styles.printTeacherStatsButton}
                              onClick={() => printTeacherSummaryStatsTable(row)}
                            >
                              {tr(lang, "طباعة إحصائية", "Print stats")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td style={styles.emptyCell} colSpan={10}>
                      {tr(lang, "لا توجد إحصائيات حتى الآن.", "No statistics yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ title, value, hint }: { title: string; value: string | number; hint: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiHint}>{hint}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%), linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%)",
    color: "#111827",
    padding: 20,
    fontFamily: "Tahoma, Arial, sans-serif",
    fontWeight: 800,
    position: "relative",
    overflow: "hidden",
  },
  glowOne: {
    position: "absolute",
    top: -180,
    left: "45%",
    width: 560,
    height: 560,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(212,175,55,0.22), transparent 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  glowTwo: {
    position: "absolute",
    bottom: -180,
    right: -160,
    width: 520,
    height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(34,197,94,0.10), transparent 72%)",
    filter: "blur(14px)",
    pointerEvents: "none",
  },
  container: {
    maxWidth: 1500,
    margin: "0 auto",
    display: "grid",
    gap: 18,
    position: "relative",
    zIndex: 1,
    color: "#111827",
    fontWeight: 800,
  },
  headerCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    border: "3px solid rgba(212,175,55,0.58)",
    borderRadius: 34,
    padding: 22,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,250,232,0.98) 100%)",
    boxShadow: "0 24px 70px rgba(150,120,20,0.18), inset 0 1px 0 rgba(255,255,255,0.7)",
    color: "#111827",
  },
  cloudStatusCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    border: "3px solid rgba(212,175,55,0.72)",
    borderRadius: 24,
    padding: "12px 18px",
    background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
    color: "#000000",
    fontWeight: 950,
    boxShadow: "0 14px 32px rgba(150,120,20,0.12)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  logo: {
    width: 76,
    height: 76,
    objectFit: "contain",
    borderRadius: 22,
    background: "#ffffff",
    border: "2px solid rgba(212,175,55,0.55)",
    padding: 8,
    boxShadow: "0 10px 24px rgba(150,120,20,0.18)",
  },
  kicker: {
    color: "#111827",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 50px)",
    color: "#111827",
    lineHeight: 1.16,
    fontWeight: 900,
  },
  subtitle: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 1.8,
    marginTop: 8,
    fontWeight: 900,
  },
  headerMeta: {
    minWidth: 240,
    border: "2px solid rgba(212,175,55,0.55)",
    background: "linear-gradient(180deg, #ffffff 0%, #fff7df 100%)",
    borderRadius: 24,
    padding: 16,
    color: "#111827",
    boxShadow: "0 10px 24px rgba(150,120,20,0.12)",
  },
  metaLabel: { fontSize: 12, color: "#111827", fontWeight: 900 },
  metaValue: { fontSize: 20, color: "#111827", fontWeight: 900, marginTop: 8 },
  metaHint: { fontSize: 12, color: "#111827", marginTop: 8, lineHeight: 1.7, fontWeight: 800 },
  datePickerBar: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 420px) 1fr",
    gap: 14,
    alignItems: "stretch",
    margin: "0 0 16px",
    padding: 16,
    borderRadius: 24,
    border: "3px solid rgba(212,175,55,0.62)",
    background: "linear-gradient(135deg, #ffffff 0%, #fff6d8 100%)",
    boxShadow: "0 14px 34px rgba(150,120,20,0.16)",
    color: "#111827",
  },
  datePickerMain: {
    display: "grid",
    gap: 8,
    alignContent: "center",
  },
  dateSelect: {
    width: "100%",
    borderRadius: 16,
    border: "3px solid rgba(212,175,55,0.76)",
    background: "#ffffff",
    color: "#000000",
    padding: "13px 14px",
    fontWeight: 900,
    outline: "none",
    minHeight: 48,
    fontSize: 15,
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), 0 8px 18px rgba(150,120,20,0.10)",
  },
  datePickerInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  datePickerMetric: {
    border: "2px solid rgba(17,24,39,0.35)",
    borderRadius: 18,
    padding: 12,
    background: "#fffdf5",
    color: "#111827",
  },
  datePickerMetricLabel: {
    display: "block",
    fontSize: 12,
    color: "#111827",
    fontWeight: 900,
    marginBottom: 6,
  },
  datePickerMetricValue: {
    display: "block",
    fontSize: 16,
    color: "#111827",
    fontWeight: 900,
    lineHeight: 1.45,
  },
  filtersCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    border: "3px solid rgba(212,175,55,0.62)",
    borderRadius: 28,
    padding: 16,
    background: "linear-gradient(180deg, #ffffff 0%, #fff8df 100%)",
    boxShadow: "0 16px 40px rgba(150,120,20,0.14)",
    color: "#111827",
  },
  filterGroup: { display: "grid", gap: 7 },
  filterGroupWide: { display: "grid", gap: 7, gridColumn: "span 2" },
  label: { fontSize: 13, color: "#111827", fontWeight: 900 },
  select: {
    width: "100%",
    borderRadius: 16,
    border: "3px solid rgba(212,175,55,0.72)",
    background: "#ffffff",
    color: "#000000",
    padding: "12px 12px",
    outline: "none",
    fontWeight: 900,
    fontSize: 15,
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    borderRadius: 16,
    border: "3px solid rgba(212,175,55,0.72)",
    background: "#ffffff",
    color: "#000000",
    padding: "12px 12px",
    outline: "none",
    fontWeight: 900,
    fontSize: 15,
    boxSizing: "border-box",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  kpiCard: {
    border: "3px solid rgba(212,175,55,0.55)",
    borderRadius: 26,
    background: "linear-gradient(180deg, #ffffff 0%, #fff6d8 100%)",
    padding: 18,
    boxShadow: "0 16px 38px rgba(150,120,20,0.14)",
    color: "#111827",
  },
  kpiTitle: { color: "#111827", fontSize: 13, fontWeight: 900 },
  kpiValue: { color: "#111827", fontSize: 36, fontWeight: 900, marginTop: 8 },
  kpiHint: { color: "#111827", fontSize: 12, lineHeight: 1.7, marginTop: 6, fontWeight: 800 },
  panel: {
    border: "3px solid rgba(212,175,55,0.62)",
    borderRadius: 30,
    background: "linear-gradient(180deg, #ffffff 0%, #fffaf0 100%)",
    padding: 20,
    boxShadow: "0 18px 50px rgba(150,120,20,0.16)",
    overflow: "hidden",
    color: "#111827",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  panelTitle: { margin: 0, color: "#111827", fontSize: 28, fontWeight: 900, lineHeight: 1.3 },
  panelSub: { margin: "8px 0 0", color: "#111827", fontSize: 14, lineHeight: 1.9, maxWidth: 900, fontWeight: 800 },
  actionsRow: { display: "flex", gap: 8, flexWrap: "wrap" },

  printButton: {
    border: "3px solid rgba(126,34,206,0.50)",
    borderRadius: 16,
    padding: "11px 15px",
    background: "linear-gradient(135deg, #ede9fe, #a78bfa)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(126,34,206,0.16)",
  },
  statsPrintButton: {
    border: "3px solid rgba(13,148,136,0.52)",
    borderRadius: 16,
    padding: "11px 15px",
    background: "linear-gradient(135deg, #ccfbf1, #2dd4bf)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(20,184,166,0.18)",
  },
  tableActionButtons: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  printTeacherButton: {
    border: "3px solid rgba(180,83,9,0.50)",
    borderRadius: 14,
    padding: "9px 13px",
    background: "linear-gradient(135deg, #ffedd5, #fdba74)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  printTeacherStatsButton: {
    border: "3px solid rgba(13,148,136,0.52)",
    borderRadius: 14,
    padding: "9px 13px",
    background: "linear-gradient(135deg, #ccfbf1, #5eead4)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  primaryButton: {
    border: "3px solid rgba(22,101,52,0.52)",
    borderRadius: 16,
    padding: "11px 14px",
    background: "linear-gradient(135deg, #bbf7d0, #22c55e)",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(34,197,94,0.18)",
  },
  secondaryButton: {
    border: "3px solid rgba(37,99,235,0.46)",
    borderRadius: 16,
    padding: "11px 14px",
    background: "linear-gradient(135deg, #dbeafe, #60a5fa)",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(59,130,246,0.16)",
  },
  dangerButton: {
    border: "3px solid rgba(185,28,28,0.48)",
    borderRadius: 16,
    padding: "11px 14px",
    background: "linear-gradient(135deg, #fee2e2, #f87171)",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(239,68,68,0.16)",
  },
  excelButton: {
    border: "3px solid rgba(126,34,206,0.50)",
    borderRadius: 16,
    padding: "11px 14px",
    background: "linear-gradient(135deg, #ede9fe, #a78bfa)",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(126,34,206,0.16)",
  },
  tableWrap: {
    overflowX: "auto",
    direction: "rtl",
    borderRadius: 20,
    border: "3px solid rgba(212,175,55,0.78)",
    background: "#ffffff",
    boxShadow: "0 12px 28px rgba(150,120,20,0.12)",
  },
  table: {
    width: "100%",
    direction: "rtl",
    minWidth: 1120,
    borderCollapse: "collapse",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
    border: "3px solid rgba(17,24,39,0.78)",
  },
  th: {
    background: "linear-gradient(180deg, #f8df82 0%, #f0c94f 100%)",
    color: "#111827",
    padding: "12px 10px",
    border: "2px solid rgba(17,24,39,0.72)",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  td: {
    padding: "11px 10px",
    border: "2px solid rgba(17,24,39,0.35)",
    color: "#111827",
    fontSize: 13,
    lineHeight: 1.7,
    fontWeight: 800,
    background: "#fffdf7",
  },
  tdCenter: {
    padding: "11px 10px",
    border: "2px solid rgba(17,24,39,0.35)",
    color: "#111827",
    fontSize: 13,
    textAlign: "center",
    whiteSpace: "nowrap",
    fontWeight: 900,
    background: "#fffdf7",
  },
  tdStrong: {
    padding: "11px 10px",
    border: "2px solid rgba(17,24,39,0.35)",
    color: "#111827",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.7,
    background: "#fffdf7",
  },
  taskPill: {
    display: "inline-flex",
    border: "2px solid",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    background: "#ffffff",
    color: "#111827",
  },
  statusSelect: {
    minWidth: 110,
    borderRadius: 14,
    border: "3px solid transparent",
    padding: "9px 10px",
    fontWeight: 900,
    fontSize: 14,
    outline: "none",
    color: "#000000",
  },
  statusPresent: {
    background: "linear-gradient(135deg, #dcfce7, #86efac)",
    borderColor: "rgba(22,101,52,0.55)",
    color: "#111827",
  },
  statusAbsent: {
    background: "linear-gradient(135deg, #fee2e2, #fca5a5)",
    borderColor: "rgba(185,28,28,0.55)",
    color: "#111827",
  },
  bankInput: {
    width: "100%",
    minWidth: 170,
    borderRadius: 14,
    border: "3px solid rgba(212,175,55,0.72)",
    background: "#ffffff",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    caretColor: "#000000",
    padding: "10px 11px",
    outline: "none",
    fontWeight: 950,
    fontSize: 15,
    boxSizing: "border-box",
  },
  bankInputReadonly: {
    background: "#f3f4f6",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    borderColor: "rgba(17,24,39,0.30)",
    cursor: "default",
  },
  editBankButton: {
    border: "3px solid rgba(37,99,235,0.48)",
    borderRadius: 14,
    padding: "9px 13px",
    background: "linear-gradient(135deg, #dbeafe, #60a5fa)",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  saveBankButton: {
    border: "3px solid rgba(22,101,52,0.52)",
    borderRadius: 14,
    padding: "9px 13px",
    background: "linear-gradient(135deg, #dcfce7, #22c55e)",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  emptyCell: {
    padding: 30,
    textAlign: "center",
    color: "#111827",
    lineHeight: 1.9,
    fontWeight: 900,
    background: "#fffdf7",
    border: "2px solid rgba(17,24,39,0.35)",
  },
};
