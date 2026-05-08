import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadRun, RUN_UPDATED_EVENT, MASTER_TABLE_UPDATED_EVENT, taskDistributionKey } from "../utils/taskDistributionStorage";

type Lang = "ar" | "en";
type TaskType = "INVIGILATION" | "RESERVE" | "FLOOR_MONITOR";

type TeacherLike = {
  name?: string;
  fullName?: string;
  teacherName?: string;
  displayName?: string;
};

type Assignment = {
  teacherName?: string;
  teacherFullName?: string;
  employeeName?: string;
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
  monitoring?: number | string;
  invigilation?: number | string;
  invigilationCount?: number | string;
  monitoringCount?: number | string;
  reserve?: number | string;
  reserveCount?: number | string;
  backup?: number | string;
  floorMonitor?: number | string;
  floorMonitoring?: number | string;
  floorMonitorCount?: number | string;
  hallMonitor?: number | string;
  corridorMonitor?: number | string;
  roleMonitor?: number | string;
  [key: string]: unknown;
};

type TeacherAnalyticsRow = {
  teacher: string;
  monitoring: number;
  reserve: number;
  floorMonitor: number;
  total: number;
};

type TransferSuggestion = {
  taskType: TaskType;
  from: string;
  to: string;
  reason: string;
};

type DistributionItem = {
  key: TaskType;
  nameAr: string;
  nameEn: string;
  value: number;
  color: string;
};


type ExamCenterData = {
  name: string;
  governorate: string;
  semester: string;
  phone: string;
  address: string;
  controlHeadName?: string;
  country?: string;
  ministry?: string;
  academicYear?: string;
};

type AnalyticsSourceMeta = {
  tenantId: string;
  centerName: string;
  governorate: string;
  semester: string;
  controlHeadName: string;
  logoUrl: string;
  runId: string;
  createdAtISO: string;
  assignmentsCount: number;
  sourceLabelAr: string;
  sourceLabelEn: string;
};

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";
const ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";
const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const APP_LOGO_KEY = "exam-manager:app-logo";
const CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

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

const STATIC_TASK_DISTRIBUTION_RESULTS12_KEYS = [
  "exam-manager:task-distribution-results12:v1",
  "exam-manager:task-distribution-results12:current-run:v1",
  "exam-manager:task-distribution-results12:last-run:v1",
  "exam-manager:task-distribution-results12:results:v1",
  "exam-manager:task-distribution-results12:all-data:v1",
  "exam-manager:task-distribution-results:v1",
  "exam-manager:task-distribution:results:v1",
  "exam-manager:task-distribution:current-run:v1",
  "exam-manager:task-distribution:run:v1",
  "exam-manager:dist-stats:last-run:v1",
  MASTER_TABLE_KEY,
  RESULTS_TABLE_KEY,
  ALL_TABLE_KEY,
];

const RELATED_STORAGE_KEY_PARTS = [
  "task-distribution-results12",
  "task-distribution-results",
  "task-distribution",
  "dist-stats",
  "exam-center-data",
  "exam-center-logo",
  "control-head-name",
];

const DATA_UPDATED_EVENTS = [
  RUN_UPDATED_EVENT,
  MASTER_TABLE_UPDATED_EVENT,
  "exam-manager:task-distribution-results12:updated",
  "exam-manager:task-distribution:updated",
  "exam-manager:distribution-updated",
  "exam-manager:changed",
  "exam-manager:control-head-changed",
];

const COLORS: Record<TaskType, string> = {
  INVIGILATION: "#facc15",
  RESERVE: "#fb923c",
  FLOOR_MONITOR: "#60a5fa",
};

function tr(lang: Lang, ar: string, en: string) {
  return lang === "ar" ? ar : en;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
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

function getTaskDistributionStorageKeys(tenantId: string): string[] {
  const dynamicKeys: string[] = [];
  try {
    dynamicKeys.push(taskDistributionKey(tenantId));
  } catch {}

  return Array.from(new Set([...dynamicKeys, ...STATIC_TASK_DISTRIBUTION_RESULTS12_KEYS]));
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه");
}

function normalizeTeacherName(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getTeacherName(item: Assignment): string {
  const teacher = item.teacher;
  if (typeof teacher === "string") return normalizeTeacherName(teacher);

  return normalizeTeacherName(
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

function getRawTaskType(item: Assignment): string {
  return normalizeText(
    item.taskType ||
      (item as any).taskTypeLabelAr ||
      (item as any).taskTypeLabel ||
      item.type ||
      item.task ||
      (item as any).taskLabel ||
      item.role ||
      (item as any).roleName ||
      item.dutyType ||
      item.assignmentType ||
      item.category ||
      (item as any).mission ||
      (item as any).missionName ||
      ""
  );
}

function getTaskType(item: Assignment): TaskType | "" {
  const raw = getRawTaskType(item);
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  const lower = raw.toLowerCase();

  if (
    upper === "INVIGILATION" ||
    raw === "مراقبه" ||
    raw === "مراقبة" ||
    lower === "invigilation" ||
    lower === "monitoring"
  ) {
    return "INVIGILATION";
  }

  if (
    upper === "RESERVE" ||
    raw === "احتياط" ||
    lower === "reserve" ||
    lower === "backup"
  ) {
    return "RESERVE";
  }

  if (
    upper === "DUTY_INVIGILATOR" ||
    upper === "FLOOR_MONITOR" ||
    upper === "HALL_MONITOR" ||
    upper === "CORRIDOR_MONITOR" ||
    upper === "ROLE_MONITOR" ||
    upper === "DUTY_MONITOR" ||
    upper === "FLOOR_SUPERVISOR" ||
    upper === "HALL_SUPERVISOR" ||
    (item as any).dutyInvigilator === true ||
    raw === "مراقب دور" ||
    raw === "مراقب_دور" ||
    raw === "مراقب الدور" ||
    (raw.includes("دور") && (raw.includes("مراقب") || raw.includes("مراقبه"))) ||
    lower.includes("floor monitor") ||
    lower.includes("hall monitor") ||
    lower.includes("corridor monitor")
  ) {
    return "FLOOR_MONITOR";
  }

  return "";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readCount(item: Assignment, keys: string[]): number {
  return keys.reduce((sum, key) => sum + toNumber(item[key]), 0);
}

function hasSupportedTaskData(value: unknown): value is Assignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Assignment;
  const teacher = getTeacherName(item);
  if (!teacher) return false;
  if (getTaskType(item)) return true;

  const monitoring = readCount(item, ["monitoring", "invigilation", "invigilationCount", "monitoringCount", "مراقبة"]);
  const reserve = readCount(item, ["reserve", "reserveCount", "backup", "احتياط"]);
  const floorMonitor = readCount(item, [
    "floorMonitor",
    "floorMonitoring",
    "floorMonitorCount",
    "hallMonitor",
    "corridorMonitor",
    "roleMonitor",
    "dutyInvigilator",
    "dutyInvigilatorCount",
    "duty",
    "مراقب دور",
    "مراقب_دور",
  ]);

  return monitoring + reserve + floorMonitor > 0;
}

function collectAssignments(value: unknown, output: Assignment[] = [], depth = 0): Assignment[] {
  if (!value || depth > 6) return output;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasSupportedTaskData(item)) output.push(item);
      else collectAssignments(item, output, depth + 1);
    }
    return output;
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const preferredKeys = [
      "assignments",
      "rows",
      "data",
      "results",
      "items",
      "teachers",
      "distribution",
      "allData",
      "tableData",
      "resultRows",
      "currentRun",
      "lastRun",
    ];

    for (const key of preferredKeys) {
      collectAssignments(objectValue[key], output, depth + 1);
    }

    for (const nested of Object.values(objectValue)) {
      collectAssignments(nested, output, depth + 1);
    }
  }

  return output;
}

function makeAssignmentSignature(item: Assignment): string {
  const teacher = getTeacherName(item);
  const taskType = getTaskType(item);
  const date = String(item.date || item.examDate || item.day || "");
  const period = String(item.period || item.session || item.time || "");
  const room = String(item.room || item.classroom || item.hall || "");
  const subject = String(item.subject || item.course || "");

  if (taskType) return [teacher, taskType, date, period, room, subject].join("|");
  return JSON.stringify(item);
}

function dedupeAssignments(assignments: Assignment[]): Assignment[] {
  const seen = new Set<string>();
  const result: Assignment[] = [];

  for (const assignment of assignments) {
    const signature = makeAssignmentSignature(assignment);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(assignment);
  }

  return result;
}

function isRelatedStorageKey(key: string | null): boolean {
  if (!key) return true;
  return RELATED_STORAGE_KEY_PARTS.some((part) => key.includes(part));
}

function isWatchedStorageKey(key: string | null, tenantId: string): boolean {
  if (!key) return true;
  return (
    isRelatedStorageKey(key) ||
    getTaskDistributionStorageKeys(tenantId).includes(key) ||
    CENTER_DATA_KEYS.includes(key) ||
    key === APP_LOGO_KEY ||
    key === EXAM_CENTER_LOGO_KEY ||
    key === CONTROL_HEAD_NAME_KEY
  );
}

function readRunSafely(tenantId: string): any | null {
  if (typeof window === "undefined") return null;
  try {
    return loadRun(tenantId) || null;
  } catch {
    return null;
  }
}

function readAssignmentsFromStorage(tenantId = "default"): Assignment[] {
  if (typeof window === "undefined") return [];

  const collected: Assignment[] = [];
  const visitedKeys = new Set<string>();

  const directRun = readRunSafely(tenantId);
  collectAssignments(directRun, collected);

  const readKey = (key: string) => {
    if (visitedKeys.has(key)) return;
    visitedKeys.add(key);
    const parsed = safeParseJson<unknown>(window.localStorage.getItem(key));
    collectAssignments(parsed, collected);
  };

  for (const key of getTaskDistributionStorageKeys(tenantId)) readKey(key);

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && isRelatedStorageKey(key)) readKey(key);
  }

  return dedupeAssignments(collected);
}

function unwrapCenterPayload(raw: any): any {
  if (!raw || typeof raw !== "object") return raw || {};
  return raw.data || raw.centerData || raw.examCenterData || raw.controlData || raw.schoolData || raw.settings || raw.config || raw;
}

function normalizeCenterData(rawPayload: any): Partial<ExamCenterData> | null {
  const data = unwrapCenterPayload(rawPayload);
  if (!data || typeof data !== "object") return null;

  const name = firstNonEmpty(
    data.centerName,
    data.examCenterName,
    data.examCentreName,
    data.controlCenterName,
    data.center,
    data.examCenter,
    data.officialCenterName,
    data.schoolName,
    data.name
  );

  const governorate = firstNonEmpty(
    data.directorate,
    data.directorateName,
    data.educationDirectorate,
    data.generalDirectorate,
    data.governorate,
    data.governorateName,
    data.region,
    data.adminRegion,
    data.educationRegion
  );

  const semester = firstNonEmpty(data.semester, data.semesterLabel, data.term, data.termLabel, data.studySemester, data.studyTerm);
  const phone = firstNonEmpty(data.phone, data.phoneNumber, data.mobile, data.centerPhone, data.controlPhone);
  const address = firstNonEmpty(data.address, data.officialAddress, data.centerAddress, data.location);
  const controlHeadName = firstNonEmpty(
    data.controlHeadName,
    data.controlHead,
    data.centerHead,
    data.centerHeadName,
    data.headOfCenter,
    data.centerPresident,
    data.controllerName,
    data.chiefName,
    data.managerName,
    data.directorName,
    data.principalName,
    window.localStorage.getItem(CONTROL_HEAD_NAME_KEY)
  );
  const country = firstNonEmpty(data.country, data.countryName, data.sultanate);
  const ministry = firstNonEmpty(data.ministry, data.ministryName, data.educationMinistry);
  const academicYear = firstNonEmpty(data.academicYear, data.yearLabel, data.schoolYear, data.studyYear, data.academicYearLabel);

  if (!name && !governorate && !semester && !phone && !address && !controlHeadName && !country && !ministry && !academicYear) {
    return null;
  }

  return { name, governorate, semester, phone, address, controlHeadName, country, ministry, academicYear };
}

function readCenterDataFromStorage(): ExamCenterData {
  const fallback: ExamCenterData = {
    name: "",
    governorate: "",
    semester: "",
    phone: "",
    address: "",
    controlHeadName: "",
    country: "",
    ministry: "",
    academicYear: "",
  };

  if (typeof window === "undefined") return fallback;

  for (const key of CENTER_DATA_KEYS) {
    const normalized = normalizeCenterData(safeParseJson<unknown>(window.localStorage.getItem(key)));
    if (normalized) return { ...fallback, ...normalized };
  }

  return {
    ...fallback,
    controlHeadName: String(window.localStorage.getItem(CONTROL_HEAD_NAME_KEY) || "").trim(),
  };
}

function readLogoUrlFromStorage(): string {
  if (typeof window === "undefined") return DEFAULT_LOGO_URL;
  return (
    String(window.localStorage.getItem(EXAM_CENTER_LOGO_KEY) || "").trim() ||
    String(window.localStorage.getItem(APP_LOGO_KEY) || "").trim() ||
    DEFAULT_LOGO_URL
  );
}

function readAnalyticsSourceMeta(tenantId = "default", assignmentsCount?: number): AnalyticsSourceMeta {
  const center = readCenterDataFromStorage();
  const run = readRunSafely(tenantId);
  const count =
    typeof assignmentsCount === "number"
      ? assignmentsCount
      : Array.isArray(run?.assignments)
      ? run.assignments.length
      : readAssignmentsFromStorage(tenantId).length;

  return {
    tenantId,
    centerName: center.name || "",
    governorate: center.governorate || "",
    semester: center.semester || "",
    controlHeadName: center.controlHeadName || "",
    logoUrl: readLogoUrlFromStorage(),
    runId: String(run?.runId || ""),
    createdAtISO: String(run?.createdAtISO || ""),
    assignmentsCount: count,
    sourceLabelAr: run ? "تشغيل التوزيع الحالي" : "الجداول المحفوظة",
    sourceLabelEn: run ? "Current distribution run" : "Saved distribution tables",
  };
}

function buildTeacherAnalytics(assignments: Assignment[]): TeacherAnalyticsRow[] {
  const map = new Map<string, TeacherAnalyticsRow>();

  for (const assignment of assignments) {
    const teacher = getTeacherName(assignment);
    if (!teacher) continue;

    const taskType = getTaskType(assignment);
    const monitoringCount = readCount(assignment, ["monitoring", "invigilation", "invigilationCount", "monitoringCount", "مراقبة"]);
    const reserveCount = readCount(assignment, ["reserve", "reserveCount", "backup", "احتياط"]);
    const floorMonitorCount = readCount(assignment, [
      "floorMonitor",
      "floorMonitoring",
      "floorMonitorCount",
      "hallMonitor",
      "corridorMonitor",
      "roleMonitor",
      "مراقب دور",
      "مراقب_دور",
    ]);

    if (!taskType && monitoringCount + reserveCount + floorMonitorCount === 0) continue;

    const current = map.get(teacher) || {
      teacher,
      monitoring: 0,
      reserve: 0,
      floorMonitor: 0,
      total: 0,
    };

    if (taskType === "INVIGILATION") current.monitoring += 1;
    else if (taskType === "RESERVE") current.reserve += 1;
    else if (taskType === "FLOOR_MONITOR") current.floorMonitor += 1;
    else {
      current.monitoring += monitoringCount;
      current.reserve += reserveCount;
      current.floorMonitor += floorMonitorCount;
    }

    current.total = current.monitoring + current.reserve + current.floorMonitor;
    map.set(teacher, current);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.total - a.total || a.teacher.localeCompare(b.teacher, "ar")
  );
}

function buildTaskDistribution(rows: TeacherAnalyticsRow[]): DistributionItem[] {
  const monitoring = rows.reduce((sum, row) => sum + row.monitoring, 0);
  const reserve = rows.reduce((sum, row) => sum + row.reserve, 0);
  const floorMonitor = rows.reduce((sum, row) => sum + row.floorMonitor, 0);

  return [
    {
      key: "INVIGILATION",
      nameAr: "مراقبة",
      nameEn: "Invigilation",
      value: monitoring,
      color: COLORS.INVIGILATION,
    },
    {
      key: "RESERVE",
      nameAr: "احتياط",
      nameEn: "Reserve",
      value: reserve,
      color: COLORS.RESERVE,
    },
    {
      key: "FLOOR_MONITOR",
      nameAr: "مراقب دور",
      nameEn: "Floor monitor",
      value: floorMonitor,
      color: COLORS.FLOOR_MONITOR,
    },
  ];
}

function scoreFairness(rows: TeacherAnalyticsRow[]): number {
  if (!rows.length) return 100;
  const totals = rows.map((row) => row.total);
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  if (avg === 0) return 100;
  const variance =
    totals.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / totals.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (std / avg) * 45)));
}

function labelTaskType(type: TaskType, lang: Lang): string {
  const map: Record<TaskType, { ar: string; en: string }> = {
    INVIGILATION: { ar: "مراقبة", en: "Invigilation" },
    RESERVE: { ar: "احتياط", en: "Reserve" },
    FLOOR_MONITOR: { ar: "مراقب دور", en: "Floor monitor" },
  };
  return lang === "ar" ? map[type].ar : map[type].en;
}

function buildAutoRedistributionSuggestions(
  rows: TeacherAnalyticsRow[],
  lang: Lang
): TransferSuggestion[] {
  const suggestions: TransferSuggestion[] = [];
  const taskTypes: TaskType[] = ["INVIGILATION", "RESERVE", "FLOOR_MONITOR"];

  const getValue = (row: TeacherAnalyticsRow, taskType: TaskType) => {
    if (taskType === "INVIGILATION") return row.monitoring;
    if (taskType === "RESERVE") return row.reserve;
    return row.floorMonitor;
  };

  const highestTotal = [...rows].sort((a, b) => b.total - a.total)[0];
  const lowestTotal = [...rows].sort((a, b) => a.total - b.total)[0];

  if (
    highestTotal &&
    lowestTotal &&
    highestTotal.teacher !== lowestTotal.teacher &&
    highestTotal.total - lowestTotal.total >= 3
  ) {
    const mostLoadedType = taskTypes
      .map((taskType) => ({ taskType, value: getValue(highestTotal, taskType) }))
      .sort((a, b) => b.value - a.value)[0]?.taskType || "INVIGILATION";

    suggestions.push({
      taskType: mostLoadedType,
      from: highestTotal.teacher,
      to: lowestTotal.teacher,
      reason: tr(
        lang,
        `إجمالي الحمل على ${highestTotal.teacher} أعلى بوضوح من ${lowestTotal.teacher}، لذلك يفضّل نقل مهمة ${labelTaskType(mostLoadedType, lang)} أو أكثر بالتدرج.`,
        `${highestTotal.teacher} has a clearly heavier total workload than ${lowestTotal.teacher}, so gradually moving one or more ${labelTaskType(mostLoadedType, lang)} tasks is recommended.`
      ),
    });
  }

  for (const taskType of taskTypes) {
    const sorted = [...rows].sort((a, b) => getValue(b, taskType) - getValue(a, taskType));
    const from = sorted[0];
    const to = [...sorted].reverse().find((row) => row.teacher !== from?.teacher);
    if (!from || !to) continue;
    const difference = getValue(from, taskType) - getValue(to, taskType);
    if (difference >= 2) {
      suggestions.push({
        taskType,
        from: from.teacher,
        to: to.teacher,
        reason: tr(
          lang,
          `يوصى بنقل مهمة ${labelTaskType(taskType, lang)} واحدة من ${from.teacher} إلى ${to.teacher} لتقليل الفارق وتحسين التوازن.`,
          `Move one ${labelTaskType(taskType, lang)} task from ${from.teacher} to ${to.teacher} to reduce the gap and improve balance.`
        ),
      });
    }
  }

  return suggestions.slice(0, 6);
}

function buildInsights(rows: TeacherAnalyticsRow[], lang: Lang): string[] {
  if (!rows.length) {
    return [
      tr(
        lang,
        "لا توجد بيانات كافية لاستخراج ملاحظات تحليلية حالياً.",
        "There is not enough data yet to generate analytical insights."
      ),
    ];
  }

  const highest = [...rows].sort((a, b) => b.total - a.total)[0];
  const lowest = [...rows].sort((a, b) => a.total - b.total)[0];
  const fairness = scoreFairness(rows);
  const withoutReserve = rows.filter((row) => row.reserve === 0).length;
  const withoutFloorMonitor = rows.filter((row) => row.floorMonitor === 0).length;

  return [
    tr(
      lang,
      `درجة عدالة التوزيع الحالية تقارب ${fairness}%.`,
      `Current workload fairness is about ${fairness}%.`
    ),
    tr(
      lang,
      `أعلى حمل على ${highest.teacher} بإجمالي ${highest.total} مهام.`,
      `${highest.teacher} has the highest load with ${highest.total} tasks.`
    ),
    tr(
      lang,
      `أقل حمل على ${lowest.teacher} بإجمالي ${lowest.total} مهام.`,
      `${lowest.teacher} has the lowest load with ${lowest.total} tasks.`
    ),
    tr(
      lang,
      `عدد المعلمين بدون احتياط: ${withoutReserve}، وبدون مراقب دور: ${withoutFloorMonitor}.`,
      `${withoutReserve} teachers have no reserve tasks, and ${withoutFloorMonitor} have no floor monitor tasks.`
    ),
  ];
}

function runSelfTests(): void {
  const sample: Assignment[] = [
    { teacherName: "A", taskType: "INVIGILATION" },
    { teacherName: "A", taskType: "RESERVE" },
    { teacherName: "B", taskType: "FLOOR_MONITOR" },
    { teacherName: "B", taskType: "مراقب دور" },
    { teacherName: "C", monitoring: 2, reserve: 1, floorMonitor: 1 },
    { teacherName: "D", taskType: "OTHER_TASK" },
  ];

  const rows = buildTeacherAnalytics(sample);
  const tests = [
    {
      name: "aggregates total tasks per teacher using monitoring reserve and floor monitor only",
      pass: rows.find((row) => row.teacher === "A")?.total === 2,
    },
    {
      name: "floor monitor is counted",
      pass:
        rows.find((row) => row.teacher === "B")?.floorMonitor === 2 &&
        rows.find((row) => row.teacher === "B")?.total === 2,
    },
    {
      name: "aggregated result rows are imported",
      pass:
        rows.find((row) => row.teacher === "C")?.monitoring === 2 &&
        rows.find((row) => row.teacher === "C")?.total === 4,
    },
    {
      name: "unsupported task types are ignored",
      pass: !rows.some((row) => row.teacher === "D"),
    },
    {
      name: "distribution total equals rows total",
      pass:
        buildTaskDistribution(rows).reduce((sum, item) => sum + item.value, 0) ===
        rows.reduce((sum, row) => sum + row.total, 0),
    },
    {
      name: "fairness score is bounded",
      pass: scoreFairness(rows) >= 0 && scoreFairness(rows) <= 100,
    },
    {
      name: "suggestions array is produced safely",
      pass: Array.isArray(buildAutoRedistributionSuggestions(rows, "ar")),
    },
  ];

  const failed = tests.filter((test) => !test.pass);
  if (failed.length) {
    console.warn("Analytics dashboard self-tests failed", failed);
  }
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiSubtitle}>{subtitle}</div>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const width = max > 0 ? Math.max(8, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      style={styles.progressTrack}
    >
      {value > 0 ? (
        <div style={{ ...styles.progressFill, width: `${width}%`, background: color }} />
      ) : null}
    </div>
  );
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div style={styles.legendItem}>
      <div style={{ ...styles.legendDot, background: color }} />
      <div style={styles.legendText}>{label}</div>
      <div style={styles.legendValue}>{value}</div>
    </div>
  );
}

function PieLikeChart({ data, lang }: { data: DistributionItem[]; lang: Lang }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  let current = 0;
  const segments = data.map((item) => {
    const start = current;
    const end = current + item.value / total;
    current = end;
    return { ...item, start, end };
  });

  const hasData = data.some((item) => item.value > 0);
  const gradient = hasData
    ? segments
        .map((segment) => `${segment.color} ${segment.start * 100}% ${segment.end * 100}%`)
        .join(", ")
    : "rgba(255,255,255,0.08) 0% 100%";

  return (
    <div style={styles.panel}>
      <SectionHeader
        title={tr(lang, "توزيع أنواع المهام", "Task-type distribution")}
        subtitle={tr(
          lang,
          "عرض بصري مباشر لحجم كل نوع من التكليفات",
          "A direct visual summary of each assignment type."
        )}
      />
      <div style={styles.chartWrap}>
        <div
          role="img"
          aria-label={tr(lang, "توزيع أنواع المهام", "Task-type distribution")}
          style={{ ...styles.pieCircle, background: `conic-gradient(${gradient})` }}
        >
          <div style={styles.pieHole}>
            <div style={styles.pieLabel}>{tr(lang, "الإجمالي", "Total")}</div>
            <div style={styles.pieValue}>
              {data.reduce((sum, item) => sum + item.value, 0)}
            </div>
          </div>
        </div>
        <div style={styles.legendList}>
          {data.map((item) => (
            <LegendItem
              key={item.key}
              color={item.color}
              label={lang === "ar" ? item.nameAr : item.nameEn}
              value={item.value}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TeacherBars({ rows, lang }: { rows: TeacherAnalyticsRow[]; lang: Lang }) {
  const topRows = rows.slice(0, 8);
  const maxTotal = Math.max(1, ...topRows.map((row) => row.total));
  const monitoringTotal = rows.reduce((sum, row) => sum + row.monitoring, 0);
  const reserveTotal = rows.reduce((sum, row) => sum + row.reserve, 0);
  const floorMonitorTotal = rows.reduce((sum, row) => sum + row.floorMonitor, 0);

  return (
    <div style={styles.panel}>
      <SectionHeader
        title={tr(lang, "مقارنة أحمال المعلمين", "Teacher workload comparison")}
        subtitle={tr(lang, "أعلى 8 معلمين من حيث إجمالي الحمل", "Top 8 teachers by total workload.")}
      />
      <div style={styles.barList}>
        {topRows.map((row) => (
          <div key={row.teacher} style={styles.barRow}>
            <div style={styles.barTeacher}>{row.teacher}</div>
            <div style={styles.barTrack}>
              <div style={{ ...styles.barFill, width: `${(row.total / maxTotal) * 100}%` }} />
            </div>
            <div style={styles.barValue}>{row.total}</div>
          </div>
        ))}
      </div>
      <div style={styles.legendRow}>
        <LegendItem color={COLORS.INVIGILATION} label={tr(lang, "مراقبة", "Invigilation")} value={monitoringTotal} />
        <LegendItem color={COLORS.RESERVE} label={tr(lang, "احتياط", "Reserve")} value={reserveTotal} />
        <LegendItem color={COLORS.FLOOR_MONITOR} label={tr(lang, "مراقب دور", "Floor monitor")} value={floorMonitorTotal} />
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  tone = "gold",
}: {
  label: string;
  tone?: "gold" | "green" | "blue";
}) {
  const palette = {
    gold: {
      bg: "rgba(250,204,21,0.12)",
      border: "rgba(250,204,21,0.22)",
      color: "#fde68a",
    },
    green: {
      bg: "rgba(16,185,129,0.12)",
      border: "rgba(16,185,129,0.22)",
      color: "#a7f3d0",
    },
    blue: {
      bg: "rgba(96,165,250,0.12)",
      border: "rgba(96,165,250,0.22)",
      color: "#bfdbfe",
    },
  } as const;
  const current = palette[tone];

  return (
    <span
      style={{
        ...styles.statusBadge,
        background: current.bg,
        borderColor: current.border,
        color: current.color,
      }}
    >
      {label}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div style={styles.summaryTile}>
      <div style={styles.summaryTileLabel}>{label}</div>
      <div style={styles.summaryTileValue}>{value}</div>
      <div style={styles.summaryTileHint}>{hint}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={styles.sectionHeaderWrap}>
      <div>
        <div style={styles.sectionTitle}>{title}</div>
        {subtitle ? <div style={styles.sectionSub}>{subtitle}</div> : null}
      </div>
      <div style={styles.sectionLine} />
    </div>
  );
}

export default function AnalyticsDashboardProductionGrade() {
  const { lang } = useI18n();
  const auth = useAuth();
  const tenantId = useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const [assignments, setAssignments] = useState<Assignment[]>(() => readAssignmentsFromStorage(tenantId));
  const [sourceMeta, setSourceMeta] = useState<AnalyticsSourceMeta>(() => readAnalyticsSourceMeta(tenantId));
  const [showSuggestions, setShowSuggestions] = useState(true);

  const refreshAnalytics = React.useCallback(() => {
    const nextAssignments = readAssignmentsFromStorage(tenantId);
    setAssignments(nextAssignments);
    setSourceMeta(readAnalyticsSourceMeta(tenantId, nextAssignments.length));
  }, [tenantId]);

  useEffect(() => {
    runSelfTests();
    refreshAnalytics();

    const onStorage = (event: StorageEvent) => {
      if (isWatchedStorageKey(event.key, tenantId)) refreshAnalytics();
    };

    const onDataEvent = (event: Event) => {
      const detailTenantId = String((event as CustomEvent)?.detail?.tenantId || "").trim();
      if (!detailTenantId || detailTenantId === tenantId) refreshAnalytics();
    };

    window.addEventListener("focus", refreshAnalytics);
    window.addEventListener("storage", onStorage);
    DATA_UPDATED_EVENTS.forEach((eventName) => window.addEventListener(eventName, onDataEvent as EventListener));

    return () => {
      window.removeEventListener("focus", refreshAnalytics);
      window.removeEventListener("storage", onStorage);
      DATA_UPDATED_EVENTS.forEach((eventName) => window.removeEventListener(eventName, onDataEvent as EventListener));
    };
  }, [refreshAnalytics, tenantId]);

  const isRTL = lang === "ar";
  const rows = useMemo(() => buildTeacherAnalytics(assignments), [assignments]);
  const taskDistribution = useMemo(() => buildTaskDistribution(rows), [rows]);
  const insights = useMemo(() => buildInsights(rows, lang), [rows, lang]);
  const suggestions = useMemo(
    () => buildAutoRedistributionSuggestions(rows, lang),
    [rows, lang]
  );
  const fairness = useMemo(() => scoreFairness(rows), [rows]);
  const totalTasks = useMemo(() => rows.reduce((sum, row) => sum + row.total, 0), [rows]);
  const highest = rows[0];
  const lowest = [...rows].sort((a, b) => a.total - b.total)[0];
  const gapValue = highest && lowest ? highest.total - lowest.total : 0;
  const fairnessLabel =
    fairness >= 85
      ? tr(lang, "متوازن جداً", "Highly balanced")
      : fairness >= 70
      ? tr(lang, "جيد", "Good")
      : tr(lang, "بحاجة لتحسين", "Needs improvement");
  const activeTaskTypes = taskDistribution.filter((item) => item.value > 0).length;
  const maxMonitoring = Math.max(1, ...rows.map((row) => row.monitoring));
  const maxReserve = Math.max(1, ...rows.map((row) => row.reserve));
  const maxFloorMonitor = Math.max(1, ...rows.map((row) => row.floorMonitor));

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={styles.page}>
      <div style={styles.pageGlowTop} />
      <div style={styles.pageGlowSide} />
      <div style={styles.pageGlowBottom} />
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.topBarBrandWrap}>
            <div style={styles.brandMark}>
              {sourceMeta.logoUrl ? (
                <img src={sourceMeta.logoUrl} alt="Exam center logo" style={styles.brandLogo} />
              ) : (
                "EM"
              )}
            </div>
            <div>
              <div style={styles.topBarTitle}>
                {sourceMeta.centerName || tr(lang, "مركز قيادة التحليلات", "Ultra Analytics Command Center")}
              </div>
              <div style={styles.topBarSub}>
                {tr(
                  lang,
                  sourceMeta.governorate || "لوحة تنفيذية فائقة الفخامة لقراءة أحمال المراقبة والاحتياط ومراقب الدور",
                  sourceMeta.governorate || "Ultra-premium executive dashboard for invigilation, reserve, and floor monitor workload visibility"
                )}
              </div>
            </div>
          </div>
          <div style={styles.topBarBadges}>
            <StatusBadge label={lang === "ar" ? sourceMeta.sourceLabelAr : sourceMeta.sourceLabelEn} tone="green" />
            <StatusBadge label={tr(lang, `Tenant: ${sourceMeta.tenantId}`, `Tenant: ${sourceMeta.tenantId}`)} tone="blue" />
            <StatusBadge
              label={tr(lang, `حالة التوازن: ${fairnessLabel}`, `Balance status: ${fairnessLabel}`)}
              tone={fairness >= 70 ? "gold" : "blue"}
            />
          </div>
        </div>

        <div style={styles.premiumRibbon}>
          <div style={styles.premiumRibbonItem}>
            {tr(lang, "مرتبط بصفحة التشغيل والنتائج والطباعة", "Linked to run, results, and print pages")}
          </div>
          <div style={styles.premiumRibbonDivider} />
          <div style={styles.premiumRibbonItem}>
            {tr(lang, "مراقبة + احتياط + مراقب دور", "Invigilation + Reserve + Floor monitor")}
          </div>
          <div style={styles.premiumRibbonDivider} />
          <div style={styles.premiumRibbonItem}>
            {sourceMeta.runId ? tr(lang, `Run ID: ${sourceMeta.runId}`, `Run ID: ${sourceMeta.runId}`) : tr(lang, "قراءة تلقائية من التخزين الحالي", "Automatic read from current storage")}
          </div>
        </div>

        <div style={styles.hero}>
          <div style={styles.heroGrid}>
            <div>
              <div style={styles.heroEyebrow}>
                {tr(lang, "نظام إدارة الامتحانات المطور", "Enhanced Exam Management System")}
              </div>
              <h1 style={styles.heroTitle}>
                {tr(lang, "لوحة تحليل التوزيع", "Distribution Analytics Dashboard")}
              </h1>
              <p style={styles.heroText}>
                {tr(
                  lang,
                  "تعرض هذه الصفحة أحمال المعلمين من تشغيل التوزيع الحالي وجداول النتائج والطباعة وبيانات مركز الامتحان المحفوظة في صفحة الإعدادات.",
                  "This page reads teacher workloads from the current distribution run, results/print tables, and exam-center settings saved from the settings page."
                )}
              </p>

              <div style={styles.heroFeatureRow}>
                <div style={styles.heroFeatureCard}>
                  <div style={styles.heroFeatureValue}>{rows.length}</div>
                  <div style={styles.heroFeatureLabel}>{tr(lang, "معلم مشارك", "Active teachers")}</div>
                </div>
                <div style={styles.heroFeatureCard}>
                  <div style={styles.heroFeatureValue}>{totalTasks}</div>
                  <div style={styles.heroFeatureLabel}>{tr(lang, "حمل فعلي", "Real workload")}</div>
                </div>
                <div style={styles.heroFeatureCard}>
                  <div style={styles.heroFeatureValue}>{`${fairness}%`}</div>
                  <div style={styles.heroFeatureLabel}>{tr(lang, "توازن الأحمال", "Workload balance")}</div>
                </div>
              </div>
            </div>

            <div style={styles.heroSpotlight}>
              <div style={styles.heroSpotlightBadge}>
                {tr(lang, "تحليل مباشر من task-distribution-results12", "Live analytics from task-distribution-results12")}
              </div>
              <div style={styles.heroSpotlightTitle}>
                {tr(
                  lang,
                  "مراقبة أوضح للأحمال بعد اعتماد مراقب الدور في التحليل.",
                  "Clearer workload visibility after including floor monitor in analytics."
                )}
              </div>
              <div style={styles.heroSpotlightText}>
                {tr(
                  lang,
                  "تم ربط التحليل بمفتاح التشغيل الفعلي حسب المستأجر، وبجداول master/results/all، وبأحداث التحديث الصادرة من صفحات التشغيل والنتائج والإعدادات.",
                  "Analytics is now linked to the tenant-specific run key, master/results/all tables, and update events from run, results, and settings pages."
                )}
              </div>
              <div style={styles.heroButtons}>
                <button
                  style={styles.primaryButton}
                  onClick={refreshAnalytics}
                >
                  {tr(lang, "تحديث الآن", "Refresh now")}
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={() => setShowSuggestions((value) => !value)}
                >
                  {showSuggestions
                    ? tr(lang, "إخفاء الاقتراحات", "Hide suggestions")
                    : tr(lang, "إظهار الاقتراحات", "Show suggestions")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.executiveStrip}>
          <SummaryTile
            label={tr(lang, "ملخص تنفيذي", "Executive summary")}
            value={rows.length ? fairnessLabel : tr(lang, "بانتظار البيانات", "Awaiting data")}
            hint={tr(lang, "قراءة سريعة لحالة التشغيل الحالية", "A quick reading of the current run")}
          />
          <SummaryTile
            label={tr(lang, "أنواع المهام النشطة", "Active task types")}
            value={activeTaskTypes}
            hint={tr(
              lang,
              "عدد الأنواع التي ظهرت فعلياً في هذا التشغيل",
              "Task categories that actually appeared in this run"
            )}
          />
          <SummaryTile
            label={tr(lang, "أعلى حمل", "Highest load")}
            value={highest ? highest.total : 0}
            hint={highest ? highest.teacher : tr(lang, "لا يوجد", "None")}
          />
          <SummaryTile
            label={tr(lang, "فجوة التوزيع", "Distribution gap")}
            value={gapValue}
            hint={tr(
              lang,
              "الفارق بين أعلى وأقل معلم حملاً",
              "Difference between highest and lowest load"
            )}
          />
        </div>

        <div style={styles.executiveStrip}>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "الحالة التشغيلية", "Operational status")}</div>
            <div style={styles.executiveValue}>
              {rows.length ? tr(lang, "نشط", "Active") : tr(lang, "بانتظار البيانات", "Waiting for data")}
            </div>
          </div>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "مصدر البيانات", "Data source")}</div>
            <div style={styles.executiveValue}>{tr(lang, "صفحة النتائج", "Results page")}</div>
          </div>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "المعلم الأعلى حملاً", "Top loaded teacher")}</div>
            <div style={styles.executiveValueSm}>{highest?.teacher || tr(lang, "—", "—")}</div>
          </div>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "المعلم الأقل حملاً", "Lowest loaded teacher")}</div>
            <div style={styles.executiveValueSm}>{lowest?.teacher || tr(lang, "—", "—")}</div>
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <KpiCard
            title={tr(lang, "عدد المعلمين", "Teachers")}
            value={rows.length}
            subtitle={tr(lang, "المشاركون في هذا التشغيل", "Participating in this run")}
          />
          <KpiCard
            title={tr(lang, "إجمالي الأحمال", "Total workload")}
            value={totalTasks}
            subtitle={tr(lang, "مراقبة + احتياط + مراقب دور فقط", "Invigilation + reserve + floor monitor only")}
          />
          <KpiCard
            title={tr(lang, "درجة العدالة", "Fairness score")}
            value={`${fairness}%`}
            subtitle={tr(
              lang,
              "كلما ارتفعت كانت الأحمال أكثر توازناً",
              "Higher means a better-balanced workload"
            )}
          />
          <KpiCard
            title={tr(lang, "أعلى فجوة", "Highest gap")}
            value={highest && lowest ? highest.total - lowest.total : 0}
            subtitle={tr(lang, "الفرق بين أعلى وأقل حمل", "Difference between highest and lowest load")}
          />
        </div>

        <div style={styles.twoCols}>
          <PieLikeChart data={taskDistribution} lang={lang} />
          <TeacherBars rows={rows} lang={lang} />
        </div>

        <div style={styles.twoCols}>
          <div style={styles.panel}>
            <SectionHeader
              title={tr(lang, "التحليل التفصيلي للمعلمين", "Detailed teacher analytics")}
              subtitle={tr(
                lang,
                "عرض تفصيلي لكل معلم حسب المراقبة والاحتياط ومراقب الدور",
                "Detailed teacher-by-teacher breakdown by invigilation, reserve, and floor monitor."
              )}
            />
            <div style={styles.teacherList}>
              {rows.length ? (
                rows.map((row, index) => (
                  <div key={row.teacher} style={styles.teacherCard}>
                    <div style={styles.teacherHeader}>
                      <div>
                        <div style={styles.teacherName}>
                          {index + 1}. {row.teacher}
                        </div>
                        <div style={styles.teacherSub}>
                          {tr(lang, "إجمالي الحمل", "Total load")}: {row.total}
                        </div>
                      </div>
                      <div style={styles.pillsWrap}>
                        <span
                          style={{
                            ...styles.pill,
                            background: "rgba(250,204,21,0.18)",
                            color: COLORS.INVIGILATION,
                          }}
                        >
                          {tr(lang, "مراقبة", "Invigilation")}: {row.monitoring}
                        </span>
                        <span
                          style={{
                            ...styles.pill,
                            background: "rgba(251,146,60,0.18)",
                            color: COLORS.RESERVE,
                          }}
                        >
                          {tr(lang, "احتياط", "Reserve")}: {row.reserve}
                        </span>
                        <span
                          style={{
                            ...styles.pill,
                            background: "rgba(96,165,250,0.18)",
                            color: COLORS.FLOOR_MONITOR,
                          }}
                        >
                          {tr(lang, "مراقب دور", "Floor monitor")}: {row.floorMonitor}
                        </span>
                      </div>
                    </div>
                    <div style={styles.progressGrid}>
                      <div>
                        <div style={styles.metricLabel}>
                          {tr(lang, "مراقبة", "Invigilation")} — {row.monitoring}
                        </div>
                        <ProgressBar value={row.monitoring} max={maxMonitoring} color={COLORS.INVIGILATION} />
                      </div>
                      <div>
                        <div style={styles.metricLabel}>
                          {tr(lang, "احتياط", "Reserve")} — {row.reserve}
                        </div>
                        <ProgressBar value={row.reserve} max={maxReserve} color={COLORS.RESERVE} />
                      </div>
                      <div>
                        <div style={styles.metricLabel}>
                          {tr(lang, "مراقب دور", "Floor monitor")} — {row.floorMonitor}
                        </div>
                        <ProgressBar value={row.floorMonitor} max={maxFloorMonitor} color={COLORS.FLOOR_MONITOR} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>
                  <div style={styles.emptyStateIcon}>✦</div>
                  <div style={styles.emptyStateTitle}>
                    {tr(lang, "لا توجد بيانات حقيقية متاحة حالياً", "No real data is currently available")}
                  </div>
                  <div style={styles.emptyStateText}>
                    {tr(
                      lang,
                      "يرجى تنفيذ التوزيع أو فتح صفحة task-distribution-results12 أولاً، ثم العودة إلى هذه الصفحة لعرض التحليلات الفعلية.",
                      "Please run the distribution or open task-distribution-results12 first, then return to this page to view the actual analytics."
                    )}
                  </div>
                  <div style={styles.emptyStateHint}>
                    {tr(
                      lang,
                      "بمجرد توفر البيانات سيظهر هنا التحليل الكامل والرسوم والمؤشرات بشكل تلقائي.",
                      "Once real data is available, the complete analytics, charts, and indicators will appear here automatically."
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={styles.panel}>
            <SectionHeader
              title={tr(lang, "ملاحظات تحليلية", "Analytical notes")}
              subtitle={tr(
                lang,
                "خلاصة سريعة تساعد المسؤول على فهم الوضع الحالي",
                "Quick insights to help administrators understand the current state."
              )}
            />
            <div style={styles.notesList}>
              {insights.map((note, index) => (
                <div key={`${note}-${index}`} style={styles.noteCard}>
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>

        {showSuggestions && (
          <div style={{ ...styles.panel, borderColor: "rgba(16,185,129,0.28)" }}>
            <SectionHeader
              title={tr(lang, "اقتراحات إعادة التوزيع", "Redistribution suggestions")}
              subtitle={tr(
                lang,
                "اقتراحات استرشادية لتحسين التوازن دون تنفيذ تلقائي",
                "Advisory suggestions to improve balance without automatic execution."
              )}
            />
            <div style={styles.sectionSub}>
              {tr(
                lang,
                "اقتراحات مبنية على الفروقات الحالية بين المعلمين في المراقبة والاحتياط ومراقب الدور فقط.",
                "Suggestions based only on current gaps in invigilation, reserve, and floor monitor tasks."
              )}
            </div>
            {suggestions.length ? (
              <div style={styles.suggestionGrid}>
                {suggestions.map((item, index) => (
                  <div key={`${item.from}-${item.to}-${index}`} style={styles.suggestionCard}>
                    <div style={styles.suggestionTitle}>{labelTaskType(item.taskType, lang)}</div>
                    <div style={styles.suggestionBody}>{item.reason}</div>
                    <div style={styles.tagsWrap}>
                      <span
                        style={{
                          ...styles.tag,
                          background: "rgba(239,68,68,0.16)",
                          color: "#fecaca",
                        }}
                      >
                        {tr(lang, "من", "From")}: {item.from}
                      </span>
                      <span
                        style={{
                          ...styles.tag,
                          background: "rgba(16,185,129,0.16)",
                          color: "#a7f3d0",
                        }}
                      >
                        {tr(lang, "إلى", "To")}: {item.to}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>
                {tr(
                  lang,
                  "لا توجد فجوات كبيرة حالياً. التوزيع يبدو متوازناً بشكل جيد.",
                  "No major gaps detected right now. The distribution already looks fairly balanced."
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bgOrbOne: {
    position: "fixed",
    top: -140,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,158,11,0.18), rgba(245,158,11,0) 70%)",
    pointerEvents: "none",
    filter: "blur(10px)",
  },
  bgOrbTwo: {
    position: "fixed",
    bottom: -120,
    right: -80,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.14), rgba(59,130,246,0) 72%)",
    pointerEvents: "none",
    filter: "blur(14px)",
  },
  bgGrid: {
    position: "fixed",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
    backgroundSize: "34px 34px",
    maskImage: "radial-gradient(circle at center, black 46%, transparent 100%)",
    pointerEvents: "none",
    opacity: 0.28,
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
    backdropFilter: "blur(10px)",
  },
  executiveStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  executiveItem: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    backdropFilter: "blur(16px)",
  },
  executiveLabel: {
    fontSize: 12,
    color: "rgba(226,232,240,0.72)",
    fontWeight: 800,
    marginBottom: 8,
  },
  executiveValue: {
    fontSize: 24,
    color: "#f8fafc",
    fontWeight: 900,
  },
  executiveValueSm: {
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: 800,
    lineHeight: 1.7,
  },
  sectionHeaderWrap: {
    display: "grid",
    gap: 12,
    marginBottom: 16,
  },
  sectionLine: {
    height: 1,
    background:
      "linear-gradient(90deg, rgba(245,158,11,0.35), rgba(255,255,255,0.05), rgba(255,255,255,0))",
  },
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(250,204,21,0.16), transparent 22%), radial-gradient(circle at 20% 20%, rgba(59,130,246,0.09), transparent 25%), linear-gradient(180deg, #070707 0%, #030303 100%)",
    color: "#fef3c7",
    padding: 20,
    fontFamily: "Tahoma, Arial, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  pageGlowTop: {
    position: "absolute",
    top: -160,
    left: "50%",
    transform: "translateX(-50%)",
    width: 620,
    height: 620,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(250,204,21,0.18) 0%, rgba(250,204,21,0.05) 35%, transparent 72%)",
    pointerEvents: "none",
    filter: "blur(8px)",
  },
  pageGlowBottom: {
    position: "absolute",
    bottom: -220,
    left: -160,
    width: 520,
    height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 72%)",
    pointerEvents: "none",
    filter: "blur(16px)",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: "6px 2px 0",
  },
  topBarBrandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    letterSpacing: ".06em",
    color: "#111",
    background: "linear-gradient(135deg, #fff1a6, #f59e0b)",
    boxShadow: "0 12px 28px rgba(245,158,11,0.22)",
    overflow: "hidden",
  },
  brandLogo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#fff7cc",
    lineHeight: 1.4,
  },
  topBarSub: {
    fontSize: 13,
    color: "rgba(254,243,199,0.66)",
    lineHeight: 1.7,
  },
  topBarBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid transparent",
    borderRadius: 999,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.2,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  summaryTile: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 20,
    background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
    boxShadow: "0 18px 46px rgba(0,0,0,0.26)",
    backdropFilter: "blur(10px)",
  },
  summaryTileLabel: {
    fontSize: 13,
    color: "rgba(191,219,254,0.92)",
    fontWeight: 800,
    marginBottom: 10,
  },
  summaryTileValue: {
    fontSize: 28,
    fontWeight: 900,
    color: "#fff7cc",
    marginBottom: 8,
    lineHeight: 1.2,
  },
  summaryTileHint: {
    fontSize: 12,
    color: "rgba(254,243,199,0.66)",
    lineHeight: 1.75,
  },
  pageGlowSide: {
    position: "absolute",
    top: 240,
    right: -180,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
    filter: "blur(10px)",
  },
  premiumRibbon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    flexWrap: "wrap",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "12px 18px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
    boxShadow: "0 16px 36px rgba(0,0,0,0.22)",
    backdropFilter: "blur(10px)",
  },
  premiumRibbonItem: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff4b0",
    letterSpacing: ".01em",
  },
  premiumRibbonDivider: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "rgba(250,204,21,0.7)",
    boxShadow: "0 0 16px rgba(250,204,21,0.45)",
  },
  container: {
    maxWidth: 1500,
    margin: "0 auto",
    display: "grid",
    gap: 22,
    position: "relative",
    zIndex: 1,
  },
  hero: {
    border: "1px solid rgba(250,204,21,0.16)",
    borderRadius: 38,
    background:
      "linear-gradient(135deg, rgba(36,29,7,0.92), rgba(0,0,0,0.92), rgba(31,24,4,0.94))",
    boxShadow:
      "0 30px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(255,255,255,0.03)",
    padding: 30,
    position: "relative",
    overflow: "hidden",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)",
    gap: 22,
    alignItems: "stretch",
  },
  heroEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#fde68a",
    fontWeight: 800,
    border: "1px solid rgba(250,204,21,0.2)",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(250,204,21,0.08)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  heroTitle: {
    margin: "16px 0 12px",
    fontSize: "clamp(34px, 5vw, 64px)",
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#fff4b0",
    letterSpacing: "-0.02em",
    textShadow: "0 8px 30px rgba(250,204,21,0.12)",
  },
  heroText: {
    margin: 0,
    maxWidth: 840,
    fontSize: 16,
    lineHeight: 2,
    color: "rgba(254,243,199,0.84)",
  },
  heroFeatureRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
    marginTop: 20,
  },
  heroFeatureCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
    borderRadius: 28,
    padding: 20,
    boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
  },
  heroFeatureValue: {
    fontSize: 34,
    fontWeight: 900,
    color: "#fff1a6",
    marginBottom: 6,
  },
  heroFeatureLabel: {
    fontSize: 13,
    color: "rgba(254,243,199,0.74)",
    fontWeight: 700,
  },
  heroSpotlight: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 34,
    padding: 22,
    background: "linear-gradient(180deg, rgba(250,204,21,0.07), rgba(255,255,255,0.03))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    display: "grid",
    alignContent: "space-between",
    gap: 16,
  },
  heroSpotlightBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.22)",
    color: "#a7f3d0",
    fontWeight: 800,
    fontSize: 12,
  },
  heroSpotlightTitle: {
    fontSize: 27,
    lineHeight: 1.45,
    fontWeight: 900,
    color: "#fff7cc",
  },
  heroSpotlightText: {
    fontSize: 14,
    lineHeight: 1.95,
    color: "rgba(254,243,199,0.8)",
  },
  heroButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    background: "linear-gradient(135deg, #fde047, #f59e0b)",
    color: "#111",
    border: "none",
    borderRadius: 20,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(250,204,21,0.2)",
  },
  secondaryButton: {
    background: "rgba(255,255,255,0.04)",
    color: "#fef3c7",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
    backdropFilter: "blur(6px)",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 16,
  },
  kpiCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 30,
    background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
    padding: 20,
    boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
    backdropFilter: "blur(10px)",
  },
  kpiTitle: {
    fontSize: 13,
    color: "rgba(253,224,71,0.76)",
    fontWeight: 800,
    letterSpacing: ".02em",
  },
  kpiValue: {
    fontSize: 42,
    color: "#fff8c9",
    fontWeight: 900,
    marginTop: 10,
  },
  kpiSubtitle: {
    fontSize: 12,
    color: "rgba(254,243,199,0.64)",
    marginTop: 8,
    lineHeight: 1.7,
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: 20,
  },
  panel: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 34,
    background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
    padding: 24,
    boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
    backdropFilter: "blur(10px)",
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: 900,
    color: "#fff1a6",
    marginBottom: 14,
    lineHeight: 1.25,
  },
  sectionSub: {
    fontSize: 14,
    lineHeight: 1.95,
    color: "rgba(254,243,199,0.72)",
    marginBottom: 18,
  },
  chartWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    alignItems: "center",
    gap: 22,
  },
  pieCircle: {
    width: 276,
    height: 276,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    boxShadow: "0 18px 44px rgba(0,0,0,0.34)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  pieHole: {
    width: 138,
    height: 138,
    borderRadius: "50%",
    background: "rgba(6,6,6,0.96)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    border: "1px solid rgba(250,204,21,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  pieLabel: {
    fontSize: 13,
    color: "rgba(254,243,199,0.7)",
  },
  pieValue: {
    fontSize: 32,
    fontWeight: 900,
    color: "#fff1a6",
  },
  legendList: {
    display: "grid",
    gap: 12,
  },
  legendRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "9px 11px",
    background: "rgba(255,255,255,0.03)",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    flex: "0 0 auto",
  },
  legendText: {
    fontSize: 14,
    color: "#fef3c7",
  },
  legendValue: {
    fontSize: 13,
    color: "#fde047",
    fontWeight: 800,
  },
  barList: {
    display: "grid",
    gap: 14,
  },
  barRow: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 220px) 1fr 48px",
    gap: 10,
    alignItems: "center",
  },
  barTeacher: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#fef3c7",
    fontWeight: 700,
  },
  barTrack: {
    height: 18,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    boxShadow: "inset 0 1px 5px rgba(0,0,0,0.5)",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #fde047, #f97316)",
    boxShadow: "0 8px 18px rgba(250,204,21,0.18)",
  },
  barValue: {
    textAlign: "center",
    color: "#fff1a6",
    fontWeight: 900,
  },
  teacherList: {
    display: "grid",
    gap: 14,
    maxHeight: 820,
    overflowY: "auto",
    paddingRight: 4,
  },
  teacherCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 28,
    background: "linear-gradient(180deg, rgba(250,204,21,0.05), rgba(255,255,255,0.02))",
    padding: 20,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  teacherHeader: {
    display: "grid",
    gap: 12,
    marginBottom: 14,
  },
  teacherName: {
    fontSize: 19,
    fontWeight: 900,
    color: "#fff1a6",
    lineHeight: 1.55,
  },
  teacherSub: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(254,243,199,0.68)",
  },
  pillsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  progressGrid: {
    display: "grid",
    gap: 13,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fef3c7",
    marginBottom: 6,
  },
  progressTrack: {
    width: "100%",
    height: 14,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    boxShadow: "0 6px 16px rgba(255,255,255,0.08)",
  },
  notesList: {
    display: "grid",
    gap: 12,
  },
  noteCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    background: "linear-gradient(180deg, rgba(250,204,21,0.06), rgba(255,255,255,0.02))",
    color: "rgba(254,243,199,0.9)",
    lineHeight: 1.95,
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
  },
  suggestionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 15,
  },
  suggestionCard: {
    border: "1px solid rgba(16,185,129,0.18)",
    borderRadius: 28,
    background: "linear-gradient(180deg, rgba(16,185,129,0.08), rgba(255,255,255,0.02))",
    padding: 20,
    boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#6ee7b7",
    marginBottom: 10,
  },
  suggestionBody: {
    fontSize: 14,
    lineHeight: 1.95,
    color: "rgba(254,243,199,0.9)",
  },
  tagsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  tag: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  emptyState: {
    border: "1px dashed rgba(250,204,21,0.28)",
    borderRadius: 30,
    padding: "34px 22px",
    color: "rgba(254,243,199,0.78)",
    textAlign: "center",
    lineHeight: 1.9,
    background: "radial-gradient(circle at top, rgba(250,204,21,0.08), rgba(255,255,255,0.02))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  emptyStateIcon: {
    textShadow: "0 0 30px rgba(250,204,21,0.35)",
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
    fontSize: 32,
    color: "#fde047",
    background: "rgba(250,204,21,0.1)",
    border: "1px solid rgba(250,204,21,0.2)",
    boxShadow: "0 12px 30px rgba(250,204,21,0.08)",
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#fff1a6",
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 2,
    color: "rgba(254,243,199,0.84)",
    maxWidth: 720,
    margin: "0 auto",
  },
  emptyStateHint: {
    marginTop: 14,
    fontSize: 13,
    color: "rgba(167,243,208,0.88)",
    fontWeight: 700,
  },
};