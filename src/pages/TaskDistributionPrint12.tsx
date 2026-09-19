import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadTenantArray, loadTenantSettings, subscribeTenantArray, writeTenantAudit } from "../services/tenantData";
import { loadRun, saveRun, RUN_UPDATED_EVENT, MASTER_TABLE_UPDATED_EVENT, taskDistributionKey } from "../utils/taskDistributionStorage";
import type { TaskType } from "../contracts/taskDistributionContract";

/** -------------------------------------------
 * ✅ Keys
 * ------------------------------------------ */
const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const CENTER_DATA_KEYS = [
  "exam-manager:school-data:v1",
  "exam-manager:center-data:v1",
  "exam-manager:exam-center-data:v1",
  "exam-manager:control-center-data:v1",
  "exam-manager:school-control:center-data:v1",
  "exam-manager:schoolControl:center-data:v1",
  "exam-manager:settings12:center-data:v1",
  "exam-manager:center-control-data:v1",
  "exam-manager:control-data:v1",
];
const LOGO_KEY = "exam-manager:app-logo";
const PRINT12_LOGO_KEYS = [
  "exam-manager:exam-center-logo:v1",
  "exam-manager:app-logo",
  "exam-manager:center-logo:v1",
  "exam-manager:school-logo:v1",
  "exam-manager:settings12:logo:v1",
];
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const EXAMS_SUB = "exams";
const TEACHERS_SUB = "teachers";
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";
const PRINT12_LATEST_RUN_SETTINGS_DOC_ID = "latestTaskDistributionRun12";
const PRINT12_ASSIGNMENTS_SUBCOLLECTION = "taskDistributionAssignments12";

/** ✅ Phone access gate helpers for sensitive diploma print pages */
function print12PhoneDigitsOnly(value: unknown): string {
  return String(value ?? "").replace(/[^\d٠-٩۰-۹]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function print12MaskPhoneFirstLast(value: unknown): string {
  const digits = print12PhoneDigitsOnly(value);
  if (!digits) return "";
  if (digits.length <= 2) return digits[0] ? `${digits[0]}x` : "";
  return `${digits.slice(0, 1)}${"x".repeat(Math.max(1, digits.length - 2))}${digits.slice(-1)}`;
}

function print12PickRegisteredPhone(data: any): string {
  if (!data || typeof data !== "object") return "";
  const direct = [
    data.phone,
    data.phoneNumber,
    data.mobile,
    data.mobileNumber,
    data.centerPhone,
    data.schoolPhone,
    data.contactPhone,
    data.officialPhone,
    data.settingsPhone,
    data.registeredPhone,
  ];
  for (const value of direct) {
    const digits = print12PhoneDigitsOnly(value);
    if (digits) return digits;
  }
  return "";
}

function print12ReadLocalRegisteredPhone(): string {
  const candidates = [
    "exam-manager:settings12:center-data:v1",
    "exam-manager:center-data:v1",
    "exam-manager:exam-center-data:v1",
    "exam-manager:control-center-data:v1",
    "exam-manager:school-control:center-data:v1",
    "exam-manager:schoolControl:center-data:v1",
    "exam-manager:center-control-data:v1",
    "exam-manager:control-data:v1",
  ];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const fromRoot = print12PickRegisteredPhone(parsed);
      if (fromRoot) return fromRoot;
      const fromPayload = print12PickRegisteredPhone(parsed?.data || parsed?.settings || parsed?.center || parsed?.school || parsed?.config);
      if (fromPayload) return fromPayload;
    } catch {
      // ignore malformed localStorage values
    }
  }
  return "";
}

function Print12PhoneGateScreen(props: {
  lang: "ar" | "en";
  tenantId: string;
  registeredPhone: string;
  loading: boolean;
  error: string;
  value: string;
  setValue: (value: string) => void;
  onVerify: () => void;
  onGoSettings: () => void;
}) {
  const isAr = props.lang === "ar";
  const masked = print12MaskPhoneFirstLast(props.registeredPhone);
  return (
    <div
      style={{
        minHeight: "100vh",
        direction: isAr ? "rtl" : "ltr",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top, rgba(212,175,55,.20), transparent 36%), linear-gradient(135deg,#fff8e1 0%,#fffdf7 55%,#f8ecd0 100%)",
        color: "#000000",
        fontWeight: 900,
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          border: "3px solid #d6b24a",
          borderRadius: 28,
          background: "rgba(255,255,255,.94)",
          boxShadow: "0 22px 55px rgba(81,58,8,.18)",
          padding: 28,
          color: "#000000",
          fontWeight: 900,
        }}
      >
        <div style={{ display: "inline-flex", border: "1.5px solid #d6b24a", borderRadius: 999, padding: "8px 16px", background: "#fff8df", color: "#000000", fontWeight: 1000 }}>
          {isAr ? "حماية الدخول" : "Access protection"}
        </div>
        <h1 style={{ margin: "18px 0 10px", color: "#000000", fontWeight: 1000, fontSize: 30 }}>
          {isAr ? "التحقق من رقم الهاتف" : "Phone verification"}
        </h1>
        <p style={{ margin: 0, color: "#000000", fontWeight: 900, lineHeight: 1.9 }}>
          {isAr
            ? "للوصول إلى بوابة تقارير توزيع المهام، أدخل رقم الهاتف المسجل في إعدادات مركز الدبلوم."
            : "To access task distribution reports, enter the phone number registered in diploma center settings."}
        </p>

        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          <div style={{ border: "1.5px solid #e5cf87", borderRadius: 18, padding: 14, background: "#fffaf0", color: "#000000", fontWeight: 1000 }}>
            {isAr ? "الرقم المسجل:" : "Registered phone:"}{" "}
            <span style={{ color: "#000000", fontWeight: 1000 }}>{masked || (props.loading ? (isAr ? "جاري التحميل..." : "Loading...") : "—")}</span>
          </div>

          {!props.loading && !props.registeredPhone ? (
            <div style={{ border: "2px solid #b91c1c", borderRadius: 18, padding: 14, background: "#fff1f2", color: "#000000", fontWeight: 1000 }}>
              {isAr ? "لا يوجد رقم هاتف مسجل في إعدادات مركز الدبلوم. يرجى تسجيل الرقم أولًا." : "No phone number is registered in diploma center settings. Please register it first."}
            </div>
          ) : null}

          <input
            value={props.value}
            onChange={(e) => props.setValue(e.target.value)}
            inputMode="numeric"
            placeholder={isAr ? "أدخل رقم الهاتف المسجل" : "Enter registered phone number"}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onVerify();
            }}
            disabled={props.loading || !props.registeredPhone}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "2px solid #d6b24a",
              borderRadius: 18,
              padding: "15px 18px",
              fontSize: 18,
              color: "#000000",
              fontWeight: 1000,
              outline: "none",
              background: "#ffffff",
            }}
          />

          {props.error ? (
            <div style={{ border: "2px solid #b91c1c", borderRadius: 18, padding: 12, background: "#fff1f2", color: "#000000", fontWeight: 1000 }}>
              {props.error}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
            <button
              type="button"
              onClick={props.onVerify}
              disabled={props.loading || !props.registeredPhone}
              style={{
                minWidth: 190,
                border: "2px solid #b88700",
                borderRadius: 18,
                padding: "13px 20px",
                background: "linear-gradient(180deg,#fff4c2,#d6a921)",
                color: "#000000",
                fontWeight: 1000,
                cursor: props.loading || !props.registeredPhone ? "not-allowed" : "pointer",
              }}
            >
              {isAr ? "دخول الصفحة" : "Open page"}
            </button>
            <button
              type="button"
              onClick={props.onGoSettings}
              style={{
                minWidth: 190,
                border: "2px solid #111827",
                borderRadius: 18,
                padding: "13px 20px",
                background: "#ffffff",
                color: "#000000",
                fontWeight: 1000,
                cursor: "pointer",
              }}
            >
              {isAr ? "العودة لإعدادات الدبلوم" : "Back to diploma settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

function firstNonEmpty(...values: any[]) {
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
}

function firstStoredLogoUrl() {
  for (const key of PRINT12_LOGO_KEYS) {
    try {
      const value = String(localStorage.getItem(key) || "").trim();
      if (value) return value;
    } catch {
      // ignore localStorage access errors
    }
  }
  return "";
}

function unwrapCenterPayload(raw: any): any {
  if (!raw || typeof raw !== "object") return raw || {};
  return raw.data || raw.centerData || raw.examCenterData || raw.controlData || raw.schoolData || raw.settings || raw.config || raw;
}

function normalizeCenterData(rawPayload: any): Partial<SchoolData> | null {
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
    data.name,
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
    data.educationRegion,
  );

  const semester = firstNonEmpty(data.semester, data.semesterLabel, data.term, data.termLabel, data.studySemester, data.studyTerm);
  const centerCode = firstNonEmpty(data.examCenterCode, data.centerCode, data.code, data.examCode, data.schoolCode, data.id);
  const phone = firstNonEmpty(data.phone, data.phoneNumber, data.mobile, data.centerPhone, data.controlPhone, data.officialPhone);
  const address = firstNonEmpty(data.address, data.officialAddress, data.centerAddress, data.location);
  const country = firstNonEmpty(data.country, data.countryName, data.sultanate);
  const ministry = firstNonEmpty(data.ministry, data.ministryName, data.educationMinistry);
  const centerHead = firstNonEmpty(
    data.centerHead,
    data.centerHeadName,
    data.headOfCenter,
    data.centerPresident,
    data.controlHead,
    data.controlHeadName,
    data.controllerName,
    data.chiefName,
    data.managerName,
    data.directorName,
    data.principalName,
    data.adminName,
  );
  const academicYear = firstNonEmpty(data.academicYear, data.yearLabel, data.schoolYear, data.studyYear, data.academicYearLabel);
  const officialTitle = firstNonEmpty(data.officialTitle, data.officialName, data.title, data.centerOfficialTitle);

  if (!name && !governorate && !semester && !centerCode && !phone && !address && !country && !ministry && !centerHead && !academicYear && !officialTitle) {
    return null;
  }

  return { name, governorate, semester, centerCode, phone, address, country, ministry, centerHead, academicYear, officialTitle };
}

function readCenterDataFromStorage(): Partial<SchoolData> | null {
  for (const key of CENTER_DATA_KEYS) {
    const parsed = readJson<any>(key);
    const normalized = normalizeCenterData(parsed);
    if (normalized) return normalized;
  }

  // Fallback: search any localStorage item that looks like exam/control center data.
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!/(center|control|school|setting|exam|data|مركز|كنترول)/i.test(key)) continue;
      const parsed = readJson<any>(key);
      const normalized = normalizeCenterData(parsed);
      if (normalized) return normalized;
    }
  } catch {}

  return null;
}

function buildEmptyCenterData(): SchoolData {
  return {
    name: "",
    governorate: "",
    semester: "",
    centerCode: "",
    phone: "",
    address: "",
    country: "",
    ministry: "",
    centerHead: "",
    academicYear: "",
    officialTitle: "",
  };
}

function readEffectiveCenterData(): SchoolData {
  const legacy = readJson<SchoolData>(SCHOOL_DATA_KEY) || buildEmptyCenterData();
  const center = readCenterDataFromStorage() || {};
  return { ...legacy, ...center } as SchoolData;
}

function mapCloudCenterToSchoolData(cloud: any): SchoolData | null {
  if (!cloud || typeof cloud !== "object") return null;

  const data = unwrapCenterPayload(cloud);
  const name = firstNonEmpty(data.name, data.centerName, data.examCenterName, data.examCentreName, data.officialCenterName, data.schoolName);
  const governorate = firstNonEmpty(data.governorate, data.governorateName, data.directorate, data.directorateName, data.educationDirectorate, data.generalDirectorate);
  const semester = firstNonEmpty(data.semester, data.term, data.semesterLabel, data.termLabel, data.studySemester, data.studyTerm);
  const centerCode = firstNonEmpty(data.examCenterCode, data.centerCode, data.code, data.examCode, data.schoolCode, data.id);
  const phone = firstNonEmpty(data.phone, data.phoneNumber, data.mobile, data.centerPhone, data.controlPhone, data.officialPhone);
  const address = firstNonEmpty(data.address, data.location, data.officialAddress, data.centerAddress);
  const centerHead = firstNonEmpty(data.controlHeadName, data.centerHead, data.centerHeadName, data.headOfCenter, data.controlHead, data.controllerName, data.managerName, data.directorName, data.principalName);
  const academicYear = firstNonEmpty(data.academicYear, data.yearLabel, data.schoolYear, data.studyYear, data.academicYearLabel);
  const officialTitle = firstNonEmpty(data.officialTitle, data.officialName, data.title, data.centerOfficialTitle);

  if (!name && !governorate && !semester && !centerCode && !phone && !address && !centerHead && !academicYear && !officialTitle) {
    return null;
  }

  return {
    name,
    governorate,
    semester,
    centerCode,
    phone,
    address,
    country: firstNonEmpty(data.country, data.countryName, "سلطنة عمان"),
    ministry: firstNonEmpty(data.ministry, data.ministryName, "وزارة التعليم"),
    centerHead,
    academicYear,
    officialTitle,
  };
}

function normalizePrintCloudAssignment(row: any, index: number) {
  const id = String(row?.__uid || row?.id || `assignment_${index + 1}`).trim();

  return {
    ...row,
    id,
    __uid: String(row?.__uid || id),
  };
}

function buildPrintRunFromCloud(settings: any, assignmentRows: any[]) {
  const settingsAssignments = Array.isArray(settings?.assignments) ? settings.assignments : [];
  const runAssignments = Array.isArray(settings?.run?.assignments) ? settings.run.assignments : [];
  const assignmentsSource = assignmentRows.length ? assignmentRows : runAssignments.length ? runAssignments : settingsAssignments;

  const assignments = assignmentsSource.map((row: any, index: number) => normalizePrintCloudAssignment(row, index));
  if (!assignments.length && !settings?.run) return null;

  return {
    ...(settings?.run || {}),
    runId: String(settings?.run?.runId || settings?.runId || `cloud_run_${Date.now()}`).trim(),
    createdAtISO: String(settings?.run?.createdAtISO || settings?.createdAtISO || settings?.updatedAtISO || new Date().toISOString()).trim(),
    assignments,
    warnings: Array.isArray(settings?.run?.warnings)
      ? settings.run.warnings
      : Array.isArray(settings?.warnings)
      ? settings.warnings
      : [],
    debug: settings?.run?.debug || settings?.debug || null,
  };
}

function normalizeText(s: string) {
  return (s || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeISODate(d: string) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(d);
}

function dayNameFromISO(d: string, lang: "ar" | "en") {
  if (!d) return "";
  const x = new Date(`${normalizeISODate(d)}T00:00:00`);
  if (Number.isNaN(x.getTime())) return "";
  const locale = lang === "ar" ? "ar" : "en";
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(x);
}

/** ✅ convert AM/BM/PM to periods */
function formatPeriod(p: string, lang: "ar" | "en") {
  const raw = (p || "").toString().trim();
  if (!raw) return "—";

  const lower = raw.toLowerCase();
  if (lang === "ar") {
    if (raw.includes("الأولى")) return "الفترة الأولى";
    if (raw.includes("الثانية")) return "الفترة الثانية";
    if (lower === "am" || lower.startsWith("am") || lower === "a" || lower === "a m") return "الفترة الأولى";
    if (lower === "pm" || lower.startsWith("pm") || lower === "p" || lower === "p m" || lower === "bm" || lower.startsWith("bm") || lower === "b" || lower === "b m") {
      return "الفترة الثانية";
    }
    return raw;
  }

  if (lower.includes("first period") || raw.includes("الأولى")) return "First Period";
  if (lower.includes("second period") || raw.includes("الثانية")) return "Second Period";
  if (lower === "am" || lower.startsWith("am") || lower === "a" || lower === "a m") return "First Period";
  if (lower === "pm" || lower.startsWith("pm") || lower === "p" || lower === "p m" || lower === "bm" || lower.startsWith("bm") || lower === "b" || lower === "b m") {
    return "Second Period";
  }
  return raw;
}

/** ✅ period key for exam matching */
function normalizePeriodKey(p: string) {
  const raw = (p || "").toString();
  if (raw.includes("الأولى") || /first period/i.test(raw)) return "p1";
  if (raw.includes("الثانية") || /second period/i.test(raw)) return "p2";
  const n = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (n === "am" || n.startsWith("am") || n === "a" || n === "a m") return "p1";
  if (n === "pm" || n.startsWith("pm") || n === "bm" || n.startsWith("bm") || n === "p" || n === "b" || n === "p m" || n === "b m") return "p2";
  return normalizeText(raw);
}

function normalizePhone(raw: string) {
  return String(raw || "").replace(/[^\d]/g, "");
}

function normalizePeriod(value: any): "AM" | "PM" {
  return String(value || "").toUpperCase() === "PM" ? "PM" : "AM";
}

function normalizeSubjectText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "الرياضيات": "Mathematics",
  "الرياضيات 10": "Mathematics 10",
  "الرياضيات 11": "Mathematics 11",
  "الرياضيات 12": "Mathematics 12",
  "الرياضيات المدرسية": "School Sports",
  "الرياضيات المدرسية 11": "School Sports 11",
  "الرياضيات المدرسية 12": "School Sports 12",
  "اللغة العربية": "Arabic Language",
  "اللغة العربية 10": "Arabic Language 10",
  "اللغة العربية 11": "Arabic Language 11",
  "اللغة العربية 12": "Arabic Language 12",
  "اللغة الإنجليزية": "English Language",
  "اللغة الإنجليزية 10": "English Language 10",
  "اللغة الإنجليزية 11": "English Language 11",
  "اللغة الإنجليزية 12": "English Language 12",
  "التربية الإسلامية": "Islamic Education",
  "التربية الإسلامية 10": "Islamic Education 10",
  "التربية الإسلامية 11": "Islamic Education 11",
  "التربية الإسلامية 12": "Islamic Education 12",
  "الجغرافيا البشرية": "Human Geography",
  "الجغرافيا البشرية 11": "Human Geography 11",
  "الدراسات الاجتماعية": "Social Studies",
  "الدراسات الاجتماعية 10": "Social Studies 10",
  "الدراسات الاجتماعية 11": "Social Studies 11",
  "العلوم البيئية": "Environmental Science",
  "العلوم البيئية 11": "Environmental Science 11",
  "العلوم البيئية 12": "Environmental Science 12",
  "الفنون التشكيلية": "Fine Arts",
  "الفنون التشكيلية 10": "Fine Arts 10",
  "الفنون التشكيلية 11": "Fine Arts 11",
  "الفنون التشكيلية 12": "Fine Arts 12",
  "المهارات الموسيقية": "Musical Skills",
  "المهارات الموسيقية 10": "Musical Skills 10",
  "المهارات الموسيقية 11": "Musical Skills 11",
  "المهارات الموسيقية 12": "Musical Skills 12",
  "الكيمياء": "Chemistry",
  "الكيمياء 10": "Chemistry 10",
  "الكيمياء 11": "Chemistry 11",
  "الكيمياء 12": "Chemistry 12",
  "الفيزياء": "Physics",
  "الفيزياء 10": "Physics 10",
  "الفيزياء 11": "Physics 11",
  "الفيزياء 12": "Physics 12",
  "الأحياء": "Biology",
  "الأحياء 10": "Biology 10",
  "الأحياء 11": "Biology 11",
  "الأحياء 12": "Biology 12",
  "التاريخ والحضارة الإسلامية": "Islamic History and Civilization",
  "التاريخ والحضارة الإسلامية 11": "Islamic History and Civilization 11",
  "تقنية المعلومات": "Information Technology",
  "تقنية المعلومات 10": "Information Technology 10",
  "تقنية المعلومات 11": "Information Technology 11",
  "تقنية المعلومات 12": "Information Technology 12",
};

function translateSubject(subject: string, lang: "ar" | "en") {
  const value = normalizeSubjectText(subject || "");
  if (!value) return value;
  if (lang === "ar") return value;
  return SUBJECT_TRANSLATIONS[value] || value;
}

function subjectMatchesFilter(subject: string, filter: string, lang: "ar" | "en") {
  const rawSubject = normalizeSubjectText(subject);
  const rawFilter = normalizeSubjectText(filter);
  if (!rawFilter) return true;

  const subjectKey = normalizeText(rawSubject);
  const filterKey = normalizeText(rawFilter);
  const translatedSubjectKey = normalizeText(translateSubject(rawSubject, lang));

  return subjectKey === filterKey || translatedSubjectKey === filterKey;
}

function getRowSubject(row: any) {
  return normalizeSubjectText(
    row?.subject ??
      row?.examSubject ??
      row?.subjectName ??
      row?.examName ??
      row?.name ??
      ""
  );
}

function getRowDateISO(row: any) {
  return String(row?.dateISO ?? row?.date ?? "").trim();
}

function getRowPeriod(row: any): "AM" | "PM" {
  return normalizePeriod(row?.period ?? row?.periodKey ?? row?.p ?? "AM");
}

function getRowCommitteeNo(row: any) {
  const value =
    row?.committeeNo ??
    row?.committee ??
    row?.roomNo ??
    row?.room ??
    row?.committeeLabel ??
    row?.committeeNumber;
  if (value === undefined || value === null || value === "") return "";
  return String(value).trim();
}

function maskPrint12CommitteeNo(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return "X".repeat(Math.max(1, raw.length));
}

function taskLabel(t: TaskType | string, lang: "ar" | "en") {
  switch (t) {
    case "INVIGILATION":
      return lang === "ar" ? "مراقبة" : "Invigilation";
    case "RESERVE":
      return lang === "ar" ? "احتياط" : "Reserve";
    case "REVIEW_FREE":
      return lang === "ar" ? "فاضي للمراجعة" : "Free for Review";
    case "CORRECTION_FREE":
      return lang === "ar" ? "فاضي للتصحيح" : "Free for Correction";
    default:
      if (typeof t === "string" && t.trim()) return t;
      return lang === "ar" ? "فارغ" : "Empty";
  }
}

/** -------------------------------------------
 * Shapes
 * ------------------------------------------ */
type SchoolData = {
  name: string;
  governorate: string;
  semester: string;
  centerCode?: string;
  phone: string;
  address: string;
  country?: string;
  ministry?: string;
  centerHead?: string;
  academicYear?: string;
  officialTitle?: string;
};

type Exam = {
  subject: string;
  dateISO: string;
  dayLabel: string;
  time: string;
  durationMinutes?: number;
  period: string;
  roomsCount?: number;
};

type Teacher = {
  id: string;
  employeeNo: string;
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

function getAssignmentText(a: AnyAssignment): string {
  return firstNonEmpty(
    a?.taskType,
    a?.type,
    a?.assignmentType,
    a?.dutyType,
    a?.task,
    a?.role,
    a?.roleName,
    a?.job,
    a?.jobName,
    a?.mission,
    a?.missionName,
    a?.notes,
    a?.note,
    a?.status,
    a?.taskLabel,
    a?.assignment?.taskType,
    a?.assignment?.type,
    a?.assignment?.role,
    a?.assignment?.roleName,
    a?.assignment?.notes,
    a?.duty?.taskType,
    a?.duty?.type,
    a?.duty?.role,
    a?.duty?.roleName,
    a?.duty?.notes
  );
}

function isFloorMonitorAssignment(a: AnyAssignment): boolean {
  const type = String(
    a?.taskType ??
      a?.assignment?.taskType ??
      a?.duty?.taskType ??
      a?.type ??
      a?.assignmentType ??
      a?.dutyType ??
      ""
  )
    .trim()
    .toUpperCase();

  // الربط الحقيقي مع صفحة /task-distribution-results12
  if (type === "DUTY_INVIGILATOR") return true;
  if (a?.dutyInvigilator === true || a?.assignment?.dutyInvigilator === true || a?.duty?.dutyInvigilator === true) return true;

  // دعم البيانات القديمة إن وجدت
  const text = normalizeText(getAssignmentText(a));
  if (!text) return false;

  return (
    text === "floor_monitor" ||
    text === "floormonitor" ||
    text === "floor monitor" ||
    text === "floor_supervisor" ||
    text === "floor supervisor" ||
    text === "hall_monitor" ||
    text === "hall monitor" ||
    text === "corridor_monitor" ||
    text === "corridor monitor" ||
    text.includes("مراقب دور") ||
    text.includes("مراقب الدور") ||
    text.includes("مشرف دور")
  );
}

function floorMonitorAppliesToPage(a: AnyAssignment, pageDateISO: string, pagePeriod: string): boolean {
  const rowDateISO = normalizeISODate(getExamDateISO(a));
  if (rowDateISO && pageDateISO && rowDateISO !== pageDateISO) return false;

  const wantedPeriod = normalizePeriodKey(pagePeriod);
  const rowPeriod = normalizePeriodKey(getExamPeriod(a));
  const coversPeriods = Array.isArray(a?.coversPeriods)
    ? a.coversPeriods.map((p: any) => normalizePeriodKey(p)).filter(Boolean)
    : [];

  if (coversPeriods.length && wantedPeriod) return coversPeriods.includes(wantedPeriod);
  if (rowPeriod && wantedPeriod) return rowPeriod === wantedPeriod;
  if (a?.fullDay === true || a?.dutyInvigilator === true) return true;

  return !wantedPeriod || !rowPeriod || rowPeriod === wantedPeriod;
}

function uniqueAssignmentsByTeacher(items: AnyAssignment[]): AnyAssignment[] {
  const seen = new Set<string>();
  const out: AnyAssignment[] = [];

  for (const item of items) {
    const key = normalizeText(
      item?.uid ||
        item?.id ||
        item?.assignmentId ||
        `${getTeacherName(item)}|${getExamDateISO(item)}|${getExamPeriod(item)}|${getAssignmentText(item)}`
    );
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

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

const printWindowCss = `
@page {
  size: A4 portrait;
  margin: 6mm;
}

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  direction: rtl;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.no-print { display: none !important; }
.screen-only-committee-no { display: inline !important; }
.print-only-committee-mask { display: none !important; }

@media print {
  .screen-only-committee-no { display: none !important; }
  .print-only-committee-mask { display: inline !important; }
}

/* ✅ A4 isolated print window: each generated report sheet is fitted inside one A4 page */
#print-page {
  width: 180mm;
  margin: 0 auto;
  overflow: visible;
  position: relative;
  box-sizing: border-box;
}

#print-page.single-page,
#print-page.multi-page {
  width: 180mm;
  margin: 0 auto;
  overflow: visible;
  position: relative;
  box-sizing: border-box;
}

#print-page #fit-target {
  width: 180mm;
  margin: 0 auto;
  transform-origin: top center;
}

.print-root {
  width: 180mm !important;
  margin: 0 auto !important;
}

.print-root .print-sheet {
  width: 180mm !important;
  min-height: 0 !important;
  height: 268mm !important;
  max-height: 268mm !important;
  margin: 0 auto 0 auto !important;
  background: #fff !important;
  padding: 1.5mm 1.5mm 2mm 1.5mm !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
  overflow: hidden !important;
  position: relative !important;
  box-sizing: border-box !important;
}

.print-root .print-sheet:last-child {
  page-break-after: auto;
  break-after: auto;
}

.print-root .print-sheet-fit-inner {
  width: 100%;
  max-width: 100%;
  transform-origin: top center;
  box-sizing: border-box;
}

.print-root table {
  width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
}

.print-root th,
.print-root td {
  word-break: break-word;
  overflow-wrap: anywhere;
  vertical-align: middle !important;
  font-size: 9.5px !important;
  padding: 3px 3px !important;
  line-height: 1.05 !important;
  height: 18px !important;
}

.print-root img,
.print-root svg,
.print-root canvas,
.print-root div,
.print-root section,
.print-root article {
  max-width: 100% !important;
}

.print-root * {
  box-shadow: none !important;
}

@media print {
  html, body {
    width: 210mm;
    min-height: 297mm;
    overflow: visible !important;
  }

  #print-page {
    width: 180mm !important;
    margin: 0 auto !important;
  }

  .print-root .print-sheet {
    width: 180mm !important;
    height: 268mm !important;
    max-height: 268mm !important;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    overflow: hidden !important;
  }

  .print-root .print-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
`;


async function printOnlyElement(el: HTMLElement, title = "report") {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());
  const isMultiPage = clone.querySelectorAll(".print-sheet").length > 1;

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${String(title).replace(/</g, "&lt;")}</title>
  <style>${printWindowCss}</style>
</head>
<body>
  <div id="print-page" class="${isMultiPage ? "multi-page" : "single-page"}">
    <div id="fit-target" class="print-root">${clone.outerHTML}</div>
  </div>

  <script>
    (function () {
      var pxPerMm = 96 / 25.4;
      var maxW = 180 * pxPerMm;
      var maxH = 268 * pxPerMm;

      function prepareSheetsForFit() {
        var sheets = Array.prototype.slice.call(document.querySelectorAll('.print-root .print-sheet') || []);
        sheets.forEach(function (sheet) {
          if (!sheet || sheet.getAttribute('data-yr-a4-fit-ready') === '1') return;

          var inner = document.createElement('div');
          inner.className = 'print-sheet-fit-inner';

          while (sheet.firstChild) {
            inner.appendChild(sheet.firstChild);
          }

          sheet.appendChild(inner);
          sheet.setAttribute('data-yr-a4-fit-ready', '1');
        });
      }

      function resetFit(inner) {
        if (!inner) return;
        inner.style.transform = 'none';
        inner.style.width = '100%';
        inner.style.maxWidth = '100%';
      }

      function fitOneSheet(sheet) {
        if (!sheet) return;

        var inner = sheet.querySelector('.print-sheet-fit-inner') || sheet;
        resetFit(inner);

        var contentW = Math.max(inner.scrollWidth || 0, inner.getBoundingClientRect().width || 0);
        var contentH = Math.max(inner.scrollHeight || 0, inner.getBoundingClientRect().height || 0);

        if (!contentW || !contentH) return;

        var scaleW = maxW / contentW;
        var scaleH = maxH / contentH;
        var scale = Math.min(scaleW, scaleH, 1);

        if (!Number.isFinite(scale) || scale <= 0) scale = 1;

        inner.style.transformOrigin = 'top center';
        inner.style.transform = 'scale(' + scale + ')';
        inner.setAttribute('data-yr-a4-scale', String(scale));
      }

      function fitToA4Pages() {
        prepareSheetsForFit();

        var sheets = Array.prototype.slice.call(document.querySelectorAll('.print-root .print-sheet') || []);
        if (sheets.length) {
          sheets.forEach(function (sheet) {
            fitOneSheet(sheet);
          });
          return;
        }

        var target = document.getElementById('fit-target');
        if (!target) return;

        target.style.transform = 'none';

        var rect = target.getBoundingClientRect();
        var contentW = Math.max(rect.width, target.scrollWidth || 0);
        var contentH = Math.max(rect.height, target.scrollHeight || 0);
        if (!contentW || !contentH) return;

        var scaleW = maxW / contentW;
        var scaleH = maxH / contentH;
        var scale = Math.min(scaleW, scaleH, 1);
        if (!Number.isFinite(scale) || scale <= 0) scale = 1;

        target.style.transformOrigin = 'top center';
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
          requestAnimationFrame(function () {
            fitToA4Pages();
            setTimeout(function () {
              window.focus();
              window.print();
            }, 180);
          });
        });
      });

      window.onafterprint = function () {
        setTimeout(function () {
          try { window.close(); } catch (e) {}
        }, 10000);
      };
    })();
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=950,height=720,top=80,left=120,resizable=yes,scrollbars=yes");
  if (!w) {
    document.body.classList.add("print-report-mode");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.body.classList.remove("print-report-mode");
      }, 1000);
    }, 120);
    return;
  }

  w.opener = null;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function sanitizePhoneToWhatsApp(phoneRaw: string): string {
  let p = String(phoneRaw || "").trim();
  if (!p) return "";
  p = p.replace(/[^\d]/g, "");
  if (p.length === 8) p = `968${p}`;
  if (p.startsWith("0") && p.length >= 9) p = `968${p.slice(1)}`;
  return p;
}

function openWhatsAppWindow({ text, phone }: { text: string; phone?: string }) {
  const cleanPhone = (phone || "").replace(/[^\d]/g, "");
  const encoded = encodeURIComponent(text || "");

  const urls = [
    `whatsapp://send?${cleanPhone ? `phone=${cleanPhone}&` : ""}text=${encoded}`,
    cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`,
    cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`,
    cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`,
  ];

  const features = "noopener,noreferrer,width=980,height=760,top=70,left=120,resizable=yes,scrollbars=yes";

  for (const url of urls) {
    try {
      const w = window.open(url, "_blank", features);
      if (w) return true;
    } catch {}
  }

  window.location.href = urls[1];
  return false;
}

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

export default function TaskDistributionPrint() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, effectiveTenantId } = useAuth() as any;
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const tenantId = String(effectiveTenantId || user?.tenantId || "").trim() || "default";

  const [phoneGateAllowed, setPhoneGateAllowed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`yr:phone-gate:task-print12:${tenantId}`) === "ok";
    } catch {
      return false;
    }
  });
  const [phoneGateValue, setPhoneGateValue] = useState("");
  const [phoneGateError, setPhoneGateError] = useState("");
  const [phoneGateLoading, setPhoneGateLoading] = useState(true);
  const [registeredGatePhone, setRegisteredGatePhone] = useState("");

  useEffect(() => {
    let mounted = true;
    setPhoneGateLoading(true);
    setPhoneGateError("");
    async function loadGatePhone() {
      try {
        const cloud = await loadTenantSettings<any>(tenantId, DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID, {});
        const fromCloud = print12PickRegisteredPhone(cloud);
        const fromLocal = print12PickRegisteredPhone(readEffectiveCenterData()) || print12ReadLocalRegisteredPhone();
        const phone = fromCloud || fromLocal;
        if (!mounted) return;
        setRegisteredGatePhone(phone);
        setPhoneGateLoading(false);
      } catch {
        if (!mounted) return;
        setRegisteredGatePhone(print12PickRegisteredPhone(readEffectiveCenterData()) || print12ReadLocalRegisteredPhone());
        setPhoneGateLoading(false);
      }
    }
    void loadGatePhone();
    return () => {
      mounted = false;
    };
  }, [tenantId]);

  const verifyPhoneGate = () => {
    const expected = print12PhoneDigitsOnly(registeredGatePhone);
    const actual = print12PhoneDigitsOnly(phoneGateValue);
    if (!expected) {
      setPhoneGateError(tr("لا يوجد رقم هاتف مسجل في إعدادات مركز الدبلوم.", "No registered phone number was found in diploma settings."));
      return;
    }
    if (!actual || actual !== expected) {
      setPhoneGateError(tr("رقم الهاتف غير مطابق للرقم المسجل.", "The phone number does not match the registered number."));
      return;
    }
    try {
      sessionStorage.setItem(`yr:phone-gate:task-print12:${tenantId}`, "ok");
    } catch {
      // ignore
    }
    setPhoneGateAllowed(true);
    setPhoneGateError("");
  };


  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const [run, setRun] = useState(() => loadRun(tenantId));
  const [schoolData, setSchoolData] = useState<SchoolData>(() => readEffectiveCenterData());
  const [logoUrl, setLogoUrl] = useState(() => {
    const savedLogo = firstStoredLogoUrl();
    return savedLogo || DEFAULT_LOGO_URL;
  });
  const [examsList, setExamsList] = useState<Exam[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("");
  const [cloudError, setCloudError] = useState("");

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

  function normalizeTeachersForPrint(rows: any[]): Teacher[] {
    return (Array.isArray(rows) ? rows : [])
      .map((t: any) => ({
        id: String(t.id ?? "").trim(),
        employeeNo: String(t.employeeNo ?? t.employeeNumber ?? t.jobNo ?? t.jobNumber ?? "").trim(),
        fullName: String(t.fullName ?? t.name ?? t.teacherName ?? "").trim(),
        phone: String(t.phone ?? t.mobile ?? "").trim(),
      }))
      .filter((t: Teacher) => t.fullName || t.employeeNo || t.phone);
  }

  async function refreshCloudPrintData() {
    setCloudLoading(true);
    setCloudError("");
    setCloudStatus(tr("جاري تحميل بيانات الطباعة من السحابة...", "Loading print data from cloud..."));

    try {
      const [centerCloud, runCloud, assignmentRows, exRows, tRows] = await Promise.all([
        loadTenantSettings<any>(tenantId, DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID, {}).catch(() => ({})),
        loadTenantSettings<any>(tenantId, PRINT12_LATEST_RUN_SETTINGS_DOC_ID, {}).catch(() => ({})),
        loadTenantArray<any>(tenantId, PRINT12_ASSIGNMENTS_SUBCOLLECTION, { cacheFallback: true }).catch(() => []),
        loadTenantArray<any>(tenantId, EXAMS_SUB, { cacheFallback: true }).catch(() => []),
        loadTenantArray<any>(tenantId, TEACHERS_SUB, { cacheFallback: true }).catch(() => []),
      ]);

      const center = mapCloudCenterToSchoolData(centerCloud);
      if (center) {
        setSchoolData(center);
        localStorage.setItem("exam-manager:exam-center-data:v1", JSON.stringify(center));
      }

      const cloudLogo = firstNonEmpty(centerCloud?.logo, centerCloud?.logoUrl, centerCloud?.officialLogo, centerCloud?.centerLogo, firstStoredLogoUrl(), DEFAULT_LOGO_URL);
      setLogoUrl(cloudLogo);
      if (cloudLogo) {
        localStorage.setItem("exam-manager:exam-center-logo:v1", cloudLogo);
      }

      const nextRun = buildPrintRunFromCloud(runCloud, Array.isArray(assignmentRows) ? assignmentRows : []);
      if (nextRun) {
        saveRun(tenantId, nextRun);
        setRun(nextRun);
      }

      setExamsList(Array.isArray(exRows) ? (exRows as Exam[]) : []);
      setTeachers(normalizeTeachersForPrint(tRows));

      setStorageTick((x) => x + 1);
      setCloudStatus(tr("تم تحميل بيانات الطباعة من السحابة.", "Print data loaded from cloud."));
    } catch {
      setCloudError(tr("تعذر تحميل بيانات الطباعة من السحابة؛ يتم عرض آخر نسخة مؤقتة.", "Could not load print data from cloud; showing last temporary copy."));
    } finally {
      setCloudLoading(false);
    }
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
      ...CENTER_DATA_KEYS,
      ...PRINT12_LOGO_KEYS,
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

      setSchoolData(readEffectiveCenterData());

      const nextLogo = firstStoredLogoUrl() || DEFAULT_LOGO_URL;
      setLogoUrl(nextLogo);

      refreshRosterFromFirestore();
      setStorageTick((x) => x + 1);
    }
  }

  useEffect(() => {
    let unsubscribeAssignments: (() => void) | undefined;
    let unsubscribeTeachers: (() => void) | undefined;
    let unsubscribeExams: (() => void) | undefined;

    refreshFromStorage();
    void refreshCloudPrintData();

    const onRunUpdated = (e: any) => {
      const tid = String(e?.detail?.tenantId || "").trim();
      if (!tid || tid === String(tenantId)) {
        refreshFromStorage();
        void refreshCloudPrintData();
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (!e?.key) return;
      if (
        e.key === taskDistributionKey(tenantId) ||
        CENTER_DATA_KEYS.includes(e.key) ||
        PRINT12_LOGO_KEYS.includes(e.key) ||
        e.key === "exam-manager:task-distribution:master-table:v1" ||
        e.key === "exam-manager:task-distribution:all-table:v1" ||
        e.key === "exam-manager:task-distribution:results-table:v1"
      ) {
        refreshFromStorage();
      }
    };

    unsubscribeAssignments = subscribeTenantArray<any>(
      tenantId,
      PRINT12_ASSIGNMENTS_SUBCOLLECTION,
      async (items) => {
        const runCloud = await loadTenantSettings<any>(tenantId, PRINT12_LATEST_RUN_SETTINGS_DOC_ID, {}).catch(() => ({}));
        const nextRun = buildPrintRunFromCloud(runCloud, Array.isArray(items) ? items : []);
        if (nextRun) {
          saveRun(tenantId, nextRun);
          setRun(nextRun);
          setStorageTick((x) => x + 1);
          setCloudStatus(tr("تم تحديث بيانات الطباعة من السحابة.", "Print data updated from cloud."));
        }
      }
    );

    unsubscribeTeachers = subscribeTenantArray<any>(
      tenantId,
      TEACHERS_SUB,
      (items) => setTeachers(normalizeTeachersForPrint(items))
    );

    unsubscribeExams = subscribeTenantArray<any>(
      tenantId,
      EXAMS_SUB,
      (items) => setExamsList(Array.isArray(items) ? (items as Exam[]) : [])
    );

    window.addEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
    window.addEventListener(MASTER_TABLE_UPDATED_EVENT, onRunUpdated as any);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshFromStorage);

    const iv = window.setInterval(() => {
      refreshFromStorage();
    }, 4000);

    return () => {
      unsubscribeAssignments?.();
      unsubscribeTeachers?.();
      unsubscribeExams?.();
      window.removeEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener(MASTER_TABLE_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshFromStorage);
      window.clearInterval(iv);
    };
  }, [tenantId, tr]);

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);

  const reportType = (qs.get("reportType") || (qs.get("teacher") ? "teacher" : "daily")) as "daily" | "teacher";
  const dateISO = normalizeISODate(qs.get("dateISO") || "");
  const teacherNameFilter = (qs.get("teacher") || "").trim();
  const subjectFilter = (qs.get("subject") || "").trim();
  const requestedPeriod = (qs.get("period") || "").trim();

  const schoolHeader = useMemo(() => {
    const countryName = schoolData.country?.trim() || (lang === "ar" ? "سلطنة عمان" : "Sultanate of Oman");
    const ministryName = schoolData.ministry?.trim() || (lang === "ar" ? "وزارة التعليم" : "Ministry of Education");
    const directorateName = schoolData.governorate?.trim() || (lang === "ar" ? "المديرية العامة للتعليم" : "General Directorate of Education");
    const rawCenterName = schoolData.name?.trim() || schoolData.officialTitle?.trim() || "";
    const schoolName = rawCenterName || (lang === "ar" ? "المركز" : "Center");
    const semesterLabel = schoolData.semester?.trim() || (lang === "ar" ? "الفصل الدراسي الأول" : "First Semester");
    const yearLabel = schoolData.academicYear?.trim() || "2026/2025";
    const centerHeadName = schoolData.centerHead?.trim() || "";
    const centerCode = String(schoolData.centerCode || "").trim();
    const phone = schoolData.phone?.trim() || "";
    const address = schoolData.address?.trim() || "";
    return { countryName, ministryName, directorateName, schoolName, semesterLabel, yearLabel, centerHeadName, centerCode, phone, address };
  }, [schoolData, lang]);

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

  const masterTableRows = useMemo<AnyAssignment[]>(() => {
    const m1 = readJson<any>("exam-manager:task-distribution:master-table:v1");
    const m2 = readJson<any>("exam-manager:task-distribution:all-table:v1");
    const m3 = readJson<any>("exam-manager:task-distribution:results-table:v1");

    const payload = m1 || m2 || m3 || null;
    const rows = payload?.rows || payload?.data || null;

    const meta = payload?.meta || {};
    const matchesCurrentRun = !run || meta?.runId === run.runId || meta?.runCreatedAtISO === run.createdAtISO;

    if (Array.isArray(rows) && rows.length && matchesCurrentRun) return rows;
    return Array.isArray(run?.assignments) ? (run!.assignments as any[]) : [];
  }, [run, storageTick]);

  const teacherOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of masterTableRows || []) {
      const n = (getTeacherName(r) || "").trim();
      if (!n) continue;
      const k = normalizeText(n);
      if (!set.has(k)) set.set(k, n);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, lang === "ar" ? "ar" : "en"));
  }, [masterTableRows, lang]);

  const subjectOptions = useMemo(() => {
    const set = new Map<string, { value: string; label: string }>();
    for (const r of masterTableRows || []) {
      const s = (getExamSubject(r) || "").trim();
      if (!s) continue;
      const n = normalizeText(s);
      if (!set.has(n)) set.set(n, { value: s, label: translateSubject(s, lang) });
    }
    return Array.from(set.values()).sort((a, b) => a.label.localeCompare(b.label, lang === "ar" ? "ar" : "en"));
  }, [masterTableRows, lang]);

  const filteredRows = useMemo(() => {
    let rows = [...(masterTableRows || [])];

    if (reportType === "daily" && dateISO) {
      rows = rows.filter((r) => normalizeISODate(getExamDateISO(r)) === dateISO);
    }

    if (reportType === "teacher" && teacherNameFilter) {
      rows = rows.filter((r) => getTeacherName(r).trim() === teacherNameFilter);
    }

    if (subjectFilter) {
      rows = rows.filter((r) => subjectMatchesFilter(getExamSubject(r), subjectFilter, lang));
    }

    if (reportType === "daily" && requestedPeriod) {
      const wanted = normalizePeriodKey(requestedPeriod);
      rows = rows.filter((r) => normalizePeriodKey(getExamPeriod(r)) === wanted);
    }

    return rows;
  }, [masterTableRows, reportType, dateISO, teacherNameFilter, subjectFilter, requestedPeriod]);

  function setQueryParams(values: Record<string, string>) {
    const sp = new URLSearchParams(loc.search);
    for (const [key, value] of Object.entries(values)) {
      if (!value) sp.delete(key);
      else sp.set(key, value);
    }
    const query = sp.toString();
    nav(query ? `${loc.pathname}?${query}` : loc.pathname, { replace: true });
  }

  function setQueryParam(key: string, value: string) {
    setQueryParams({ [key]: value });
  }

  function setTeacherSelection(v: string) {
    setQueryParams({ reportType: "teacher", teacher: v || "" });
  }
  function setReportDaily() {
    setQueryParams({ reportType: "daily", teacher: "" });
  }
  function setReportTeacher() {
    setQueryParams({ reportType: "teacher" });
  }

  async function openPrintDialog() {
    const el = printAreaRef.current;
    if (!el) return;

    void writeTenantAudit(tenantId, {
      action: "distribution_print_report",
      entity: "task_distribution",
      by: user?.uid || undefined,
      meta: {
        reportType,
        teacherNameFilter: teacherNameFilter || null,
        subjectFilter: subjectFilter || null,
        atISO: new Date().toISOString(),
      },
    }).catch(() => {});

    const isDailyAll = reportType === "daily" && !subjectFilter && dailyPages.length > 1;
    const isTeacherAll = reportType === "teacher" && !teacherNameFilter && allTeachersPages.length > 1;

    /*
      ✅ Print button behavior:
      Use the isolated print window for both single-page and multi-page reports.
      This keeps the original report data and layout, while fitting each generated
      print sheet into one A4 page without splitting the same sheet.
    */
    const safeTitle = (
      teacherNameFilter ||
      (isDailyAll ? "daily_all" : isTeacherAll ? "teachers_all" : reportType === "daily" ? "daily" : "report")
    ).trim() || "report";
    await printOnlyElement(el, safeTitle);
  }

  const safeRun = run || ({ createdAtISO: "" } as any);

  const title =
    reportType === "teacher"
      ? teacherNameFilter
        ? tr("تقرير معلم (فردي)", "Teacher Report (Individual)")
        : tr("تقرير الكادر التعليمي (الكل)", "Teaching Staff Report (All)")
      : tr("كشف يومي (امتحانات)", "Daily Report (Exams)");

  const dailyPages = useMemo(() => {
    if (reportType !== "daily") return [] as any[];

    const rows = [...filteredRows];
    if (!rows.length) return [] as any[];

    const floorMonitorRows = (masterTableRows || []).filter((r) => {
      if (!isFloorMonitorAssignment(r)) return false;
      if (dateISO && normalizeISODate(getExamDateISO(r)) !== dateISO) return false;
      if (requestedPeriod && !floorMonitorAppliesToPage(r, normalizeISODate(getExamDateISO(r)), requestedPeriod)) return false;
      if (teacherNameFilter && getTeacherName(r).trim() !== teacherNameFilter) return false;
      return true;
    });

    const groups = new Map<string, { subject: string; dISO: string; period: string; dayLabel: string; time: string; rows: AnyAssignment[] }>();

    for (const r of rows) {
      const subject = (getExamSubject(r) || "").trim();
      const dISO = normalizeISODate(getExamDateISO(r));
      const period = getExamPeriod(r) || "";
      if (!subject || !dISO) continue;

      const key = `${dISO}__${normalizePeriodKey(period)}__${normalizeText(subject)}`;
      if (!groups.has(key)) {
        const meta = lookupExamMeta(subject, dISO, period);
        groups.set(key, {
          subject,
          dISO,
          period,
          dayLabel: meta?.dayLabel || getExamDayLabel(r) || "—",
          time: meta?.time || getExamTime(r) || "—",
          rows: [],
        });
      }
      groups.get(key)!.rows.push(r);
    }

    const sortInvigilators = (items: AnyAssignment[]) => {
      return [...items].sort((a, b) => {
        const ra = parseCommitteeNumber(getRoomNumber(a));
        const rb = parseCommitteeNumber(getRoomNumber(b));
        if (ra.num !== rb.num) return ra.num - rb.num;
        if (ra.raw !== rb.raw) return ra.raw.localeCompare(rb.raw, lang === "ar" ? "ar" : "en");
        return (getTeacherName(a) || "").localeCompare(getTeacherName(b) || "", lang === "ar" ? "ar" : "en");
      });
    };

    const pages = Array.from(groups.values())
      .map((g) => ({
        ...g,
        invigilators: sortInvigilators(g.rows.filter((r) => String(getTaskType(r)).toUpperCase() === "INVIGILATION")),
        reserves: g.rows.filter((r) => String(getTaskType(r)).toUpperCase() === "RESERVE"),
        reviewFree: uniqueAssignmentsByTeacher([
          ...g.rows.filter((r) => isFloorMonitorAssignment(r)),
          ...floorMonitorRows.filter((r) => floorMonitorAppliesToPage(r, g.dISO, g.period)),
        ]),
      }))
      // ✅ لا تطبع صفحة كشف يومي فارغة: إذا لم يكن داخل الصفحة أي مراقب فعلي،
      // فهذا يعني غالبًا أنها صفحة نتجت من احتياط/مراقب دور أو تجميع زائد لنفس اليوم،
      // فتظهر باسم المادة فقط بدون توزيع. نخفيها من الطباعة والعرض.
      .filter((p) => Array.isArray(p.invigilators) && p.invigilators.length > 0)
      .sort((a, b) => {
        if (a.dISO !== b.dISO) return a.dISO.localeCompare(b.dISO);
        const pa = normalizePeriodKey(a.period);
        const pb = normalizePeriodKey(b.period);
        if (pa !== pb) return pa.localeCompare(pb, lang === "ar" ? "ar" : "en");
        return a.subject.localeCompare(b.subject, lang === "ar" ? "ar" : "en");
      });

    if (subjectFilter && !requestedPeriod && pages.length > 1) {
      const ranked = [...pages].sort((a, b) => {
        if (b.invigilators.length !== a.invigilators.length) return b.invigilators.length - a.invigilators.length;
        if (b.reserves.length !== a.reserves.length) return b.reserves.length - a.reserves.length;
        if (b.reviewFree.length !== a.reviewFree.length) return b.reviewFree.length - a.reviewFree.length;
        return normalizePeriodKey(a.period).localeCompare(normalizePeriodKey(b.period), lang === "ar" ? "ar" : "en");
      });
      return ranked.length ? [ranked[0]] : [];
    }

    return pages;
  }, [reportType, filteredRows, masterTableRows, subjectFilter, requestedPeriod, dateISO, teacherNameFilter, examsIndex, lang]);

  const shareText = useMemo(() => {
    const base = `${tr("تقرير توزيع المهام", "Task Distribution Report")} - ${schoolHeader.schoolName}
`;
    const typeLine = `${tr("نوع التقرير", "Report Type")}: ${title}
`;
    const teacherLine = teacherNameFilter ? `${tr("المعلم", "Teacher")}: ${teacherNameFilter}
` : "";
    const empLine = teacherNameFilter ? `${tr("الرقم الوظيفي", "Employee No")}: ${getTeacherEmployeeNoByName(teacherNameFilter) || "—"}
` : "";
    const subjectLine = subjectFilter ? `${tr("المادة", "Subject")}: ${translateSubject(subjectFilter, lang)}
` : "";
    const dateLine = dateISO ? `${tr("التاريخ", "Date")}: ${dateISO}
` : "";
    return `${base}${typeLine}${teacherLine}${empLine}${subjectLine}${dateLine}${tr("تم الإنشاء من النظام.", "Generated from the system.")}`;
  }, [schoolHeader.schoolName, title, teacherNameFilter, subjectFilter, dateISO, teacherEmployeeIndex, tr]);

  const allTeachersPages = useMemo(() => {
    if (reportType !== "teacher" || teacherNameFilter) return [];
    const pages = teacherOptions.map((tName) => {
      let rows = masterTableRows.filter((r) => getTeacherName(r).trim() === tName);

      if (subjectFilter) {
        rows = rows.filter((r) => subjectMatchesFilter(getExamSubject(r), subjectFilter, lang));
      }

      rows.sort((a, b) => {
        const da = normalizeISODate(getExamDateISO(a));
        const db = normalizeISODate(getExamDateISO(b));
        if (da !== db) return da.localeCompare(db);

        const pa = formatPeriod(getExamPeriod(a), lang);
        const pb = formatPeriod(getExamPeriod(b), lang);
        if (pa !== pb) return pa.localeCompare(pb, lang === "ar" ? "ar" : "en");

        return (getExamSubject(a) || "").toString().localeCompare((getExamSubject(b) || "").toString(), lang === "ar" ? "ar" : "en");
      });

      return { teacherName: tName, rows };
    });

    return pages.filter((p) => p.rows.length > 0);
  }, [reportType, teacherNameFilter, teacherOptions, masterTableRows, subjectFilter, lang]);

  if (!run) {
    return (
      <div style={{ ...styles.pageWrapDark, direction: lang === "ar" ? "rtl" : "ltr" }}>
        <style>{lightPageGlobalCss}</style>
        <div style={styles.darkCard}>
          <div style={styles.darkRow}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{tr("طباعة التقرير", "Print Report")}</div>
              <div style={{ color: "rgba(255,255,255,.75)", marginTop: 4 }}>
                {cloudLoading
                  ? tr("جاري تحميل آخر تشغيل من السحابة...", "Loading latest run from cloud...")
                  : cloudError || cloudStatus || tr("لا يوجد تشغيل محفوظ بعد", "No saved run yet")}
              </div>
            </div>
            <button style={styles.btnSoft} onClick={() => nav("/task-distribution")}>
              {tr("رجوع", "Back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function DailySheet(props: {
    subject: string;
    dISO: string;
    dayLabel: string;
    period: string;
    time: string;
    invigilators: AnyAssignment[];
    reserves: AnyAssignment[];
    reviewFree: AnyAssignment[];
    pageBreak?: boolean;
    createdAtISO: string;
  }) {
    return (
      <div className="print-sheet print-daily" style={{ ...styles.sheet, ...(props.pageBreak ? styles.pageBreak : {}), direction: lang === "ar" ? "rtl" : "ltr" }}>
        <div style={styles.headerGrid}>
          <div style={{ ...styles.headerRight, textAlign: lang === "ar" ? "right" : "left" }}>
            <div style={styles.headerRightLine}>{schoolHeader.countryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.ministryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.directorateName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.schoolName}</div>
          </div>

          <div style={styles.headerCenter}>
            <img src={logoUrl} alt={tr("شعار", "Logo")} style={{ width: 66, height: 66, objectFit: "contain" }} />
          </div>

          <div style={{ ...styles.headerLeft, textAlign: lang === "ar" ? "left" : "right" }}>
            <div style={styles.headerLeftTitle}>{tr("كشف مراقبة امتحان", "Exam Invigilation Sheet")}</div>
            <div style={styles.headerLeftSub}>{schoolHeader.semesterLabel}</div>
            <div style={styles.headerLeftSub}>{tr("العام الدراسي", "Academic Year")} {schoolHeader.yearLabel}</div>
          </div>
        </div>

        <div style={styles.hr} />

        <div style={styles.examBarWide}>
          <div style={styles.examBarWideInner}>
            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>{tr("الفترة", "Period")}:</span> <span style={styles.examValue}>{formatPeriod(props.period, lang)}</span>
            </div>
            <div style={styles.examBarWideSep}>|</div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>{tr("اليوم", "Day")}:</span> <span style={styles.examValue}>{props.dayLabel || "—"}</span>
            </div>
            <div style={styles.examBarWideSep}>|</div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>{tr("الوقت", "Time")}:</span> <span style={styles.examValue}>{props.time || "—"}</span>
            </div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>{tr("المادة", "Subject")}:</span> <span style={styles.examValue}>{translateSubject(props.subject, lang) || "—"}</span>
            </div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>{tr("التاريخ", "Date")}:</span> <span style={styles.examValue}>{props.dISO || "—"}</span>
            </div>
          </div>
        </div>

        <div style={styles.chipRow}>
          <div style={styles.chip}>{tr("كشف بأسماء المراقبين", "Invigilators List")}</div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 56, textAlign: "center" }}>{tr("م", "No.")}</th>
              <th style={{ ...styles.th }}>{tr("اسم المراقب", "Invigilator Name")}</th>
              <th style={{ ...styles.th, width: 120 }}>{tr("رقم اللجنة", "Committee No.")}</th>
              <th style={{ ...styles.th, width: 120 }}>{tr("التوقيع", "Signature")}</th>
            </tr>
          </thead>
          <tbody>
            {props.invigilators.length ? (
              props.invigilators.map((r, idx) => (
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
          <div style={styles.reserveTitle}>{tr("المراقبون الاحتياط", "Reserve Invigilators")}</div>
          <table style={styles.reserveTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 56, textAlign: "center" }}>{tr("م", "No.")}</th>
                <th style={{ ...styles.th }}>{tr("اسم المراقب الاحتياط", "Reserve Invigilator Name")}</th>
                <th style={{ ...styles.th, width: 150 }}>{tr("التوقيع", "Signature")}</th>
              </tr>
            </thead>
            <tbody>
              {props.reserves.length ? (
                props.reserves.map((r, idx) => (
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

          <div style={{ marginTop: 8 }}>
            <div style={styles.reserveTitle}>{tr("اسم معلم مراقب الدور", "Floor Monitor Teacher")}</div>
            <table style={styles.reserveTable}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 56, textAlign: "center" }}>{tr("م", "No.")}</th>
                  <th style={{ ...styles.th }}>{tr("اسم المعلم", "Teacher Name")}</th>
                  <th style={{ ...styles.th, width: 150 }}>{tr("التوقيع", "Signature")}</th>
                  <th style={{ ...styles.th, width: 170 }}>{tr("ملاحظات", "Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {props.reviewFree.length ? (
                  props.reviewFree.map((r, idx) => (
                    <tr key={idx}>
                      <td style={styles.tdNum}>{idx + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 900 }}>{getTeacherName(r) || "—"}</td>
                      <td style={styles.td}></td>
                      <td style={styles.td}>{tr("مراقب دور", "Floor Monitor")}</td>
                    </tr>
                  ))
                ) : (
                  Array.from({ length: 1 }).map((_, i) => (
                    <tr key={i}>
                      <td style={styles.tdNum}>{i + 1}</td>
                      <td style={styles.td}></td>
                      <td style={styles.td}></td>
                      <td style={styles.td}>{tr("مراقب دور", "Floor Monitor")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.bottomSigRow}>
          <div style={styles.bottomSigCell}>
            <div>{tr("رئيس المركز", "Center Head")}</div>
            {schoolHeader.centerHeadName ? <div style={styles.bottomSigName}>{schoolHeader.centerHeadName}</div> : null}
          </div>
        </div>

        <div style={styles.footerNote}>{tr("تم إنشاء التقرير من نظام توزيع مهام المراقبة", "Report generated from the invigilation task distribution system")} — {props.createdAtISO}</div>
      </div>
    );
  }

  function TeacherSheet(props: { teacherName: string; rows: AnyAssignment[]; pageBreak?: boolean; createdAtISO: string }) {
    const employeeNo = getTeacherEmployeeNoByName(props.teacherName);

    return (
      <div className="print-sheet" style={{ ...styles.sheet, ...(props.pageBreak ? styles.pageBreak : {}), direction: lang === "ar" ? "rtl" : "ltr" }}>
        <div style={styles.headerGrid}>
          <div style={{ ...styles.headerRight, textAlign: lang === "ar" ? "right" : "left" }}>
            <div style={styles.headerRightLine}>{schoolHeader.countryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.ministryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.directorateName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.schoolName}</div>
          </div>

          <div style={styles.headerCenter}>
            <img src={logoUrl} alt={tr("شعار", "Logo")} style={{ width: 66, height: 66, objectFit: "contain" }} />
          </div>

          <div style={{ ...styles.headerLeft, textAlign: lang === "ar" ? "left" : "right" }}>
            <div style={styles.headerLeftTitle}>{tr("تقرير معلم (فردي)", "Teacher Report (Individual)")}</div>
            <div style={styles.headerLeftSub}>{schoolHeader.semesterLabel}</div>
            <div style={styles.headerLeftSub}>{tr("العام الدراسي", "Academic Year")} {schoolHeader.yearLabel}</div>
          </div>
        </div>

        <div style={styles.hr} />

        <div style={styles.teacherInfoBox}>
          <div style={styles.teacherInfoRow}>
            <span style={styles.teacherInfoLabel}>{tr("اسم المعلم", "Teacher Name")}:</span>
            <span style={styles.teacherInfoValue}>{props.teacherName || "—"}</span>
          </div>

          <div style={styles.teacherInfoRow}>
            <span style={styles.teacherInfoLabel}>{tr("الرقم الوظيفي", "Employee No")}:</span>
            <span style={styles.teacherInfoValue}>{employeeNo || "—"}</span>
          </div>
        </div>

        <div style={styles.tableTitleWrap}>
          <div style={styles.tableTitle}>{tr("جدول مهام المراقبة والمراجعة والتصحيح", "Invigilation, Review, and Correction Tasks Schedule")}</div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 56 }}>{tr("م", "No.")}</th>
              <th style={{ ...styles.th, width: 170 }}>{tr("اليوم والتاريخ", "Day and Date")}</th>
              <th style={{ ...styles.th, width: 120 }}>{tr("الفترة", "Period")}</th>
              <th style={{ ...styles.th, width: 120 }}>{tr("طبيعة العمل", "Task Type")}</th>
              <th style={{ ...styles.th, width: 120 }}>{tr("المادة", "Subject")}</th>
              <th style={{ ...styles.th, width: 120 }}>{tr("رقم اللجنة", "Committee No.")}</th>
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
                    <td style={styles.td}>{formatPeriod(per, lang)}</td>
                    <td style={styles.td}>{taskLabel(getTaskType(r), lang)}</td>
                    <td style={{ ...styles.td, wordBreak: "break-word", overflowWrap: "anywhere" }}>{translateSubject(sub, lang) || "—"}</td>
                    <td style={styles.td}>
                      <span className="screen-only-committee-no">{getRoomNumber(r) || "—"}</span>
                      <span className="print-only-committee-mask">{maskPrint12CommitteeNo(getRoomNumber(r)) || "—"}</span>
                    </td>
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
          <div style={styles.importantTitle}>{tr("تنبيهات هامة:", "Important Notes:")}</div>
          <ul style={styles.importantList}>
            <li style={styles.importantLi}>{tr("يجب الحضور إلى مقر اللجنة قبل بدء الامتحان بـ 20 دقيقة على الأقل.", "You must arrive at the committee location at least 20 minutes before the exam starts.")}</li>
            <li style={styles.importantLi}>{tr("يرجى الالتزام التام بالتعليمات الواردة في لائحة إدارة الامتحانات.", "Please fully comply with the instructions in the exam administration regulations.")}</li>
            <li style={styles.importantLi}>{tr("يمنع استخدام الهاتف النقال داخل قاعات الامتحان.", "Using a mobile phone inside exam halls is prohibited.")}</li>
            <li style={styles.importantLi}>{tr("في حال وجود عذر طارئ يمنعك من الحضور، يرجى إبلاغ إدارة المدرسة فوراً لتوفير البديل.", "If there is an emergency excuse preventing your attendance, please inform the school administration immediately to arrange a replacement.")}</li>
            <li style={styles.importantLi}>{tr("في حال استدعاء أي معلم للمراقبة من خارج أيام الجدول المرفق و لم يحضر يتم تسجيله غياب يوم كامل.", "")}</li>
          </ul>

          <div style={styles.importantSigRow}>
            <div style={styles.importantSigCol}>
              <div style={styles.importantSigLabel}>{tr("توقيع المعلم بالعلم", "Teacher Signature (Acknowledgment)")}</div>
              <div style={styles.importantSigLine} />
            </div>

            <div style={styles.importantSigCol}>
              <div style={styles.importantSigLabel}>{tr("رئيس المركز", "Center Head")}</div>
              {schoolHeader.centerHeadName ? <div style={styles.importantSigName}>{schoolHeader.centerHeadName}</div> : null}
              <div style={styles.importantSigLine} />
            </div>
          </div>
        </div>

        <div style={styles.footerNote}>{tr("تم إنشاء التقرير من نظام توزيع مهام المراقبة", "Report generated from the invigilation task distribution system")} — {props.createdAtISO}</div>
      </div>
    );
  }

  async function handleWhatsAppClick() {
    const phone = teacherNameFilter ? getTeacherWhatsAppPhoneByName(teacherNameFilter) : "";
    openWhatsAppWindow({ text: shareText, phone: phone || undefined });

    window.setTimeout(async () => {
      try {
        const el = printAreaRef.current;
        if (!el) return;
        const safeName = (teacherNameFilter || title || "report").replace(/[\\/:*?"<>|]/g, "_");
        await exportElementToPng(el, `report_${safeName}_${dateISO || "all"}.png`);
      } catch {
        alert(tr("تعذر إنشاء صورة للتقرير (قد يكون بسبب الشعار الخارجي). يمكنك استخدام حفظ PDF من زر الطباعة.", "Could not generate an image for the report. You can use Save as PDF from the print button."));
      }
    }, 250);

    window.setTimeout(() => {
      openPrintDialog();
    }, 650);
  }


  if (!phoneGateAllowed) {
    return (
      <Print12PhoneGateScreen
        lang={lang as "ar" | "en"}
        tenantId={tenantId}
        registeredPhone={registeredGatePhone}
        loading={phoneGateLoading}
        error={phoneGateError}
        value={phoneGateValue}
        setValue={setPhoneGateValue}
        onVerify={verifyPhoneGate}
        onGoSettings={() => nav(`/t/${tenantId}/settings12`)}
      />
    );
  }

  return (
    <div style={{ ...styles.outer, direction: lang === "ar" ? "rtl" : "ltr" }}>
      <style>{printCss}</style>
      <style>{lightPageGlobalCss}</style>

      <div
        className="no-print"
        style={{
          maxWidth: 1180,
          margin: "0 auto 12px",
          background: "#fffaf0",
          border: "3px solid #d4af37",
          borderRadius: 16,
          padding: "10px 14px",
          color: "#000",
          fontWeight: 900,
          boxShadow: "0 10px 22px rgba(126,98,18,0.10)",
        }}
      >
        {cloudLoading
          ? tr("جاري تحميل بيانات الطباعة من السحابة...", "Loading print data from cloud...")
          : cloudError || cloudStatus || tr("جاهز لطباعة البيانات المتزامنة من أي جهاز.", "Ready to print synchronized data from any device.")}
      </div>

      <div className="no-print" style={styles.topActionBar}>
        <div style={styles.topActionTitle}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{tr("خيارات العرض والطباعة", "View and Print Options")}</div>
        </div>

        <div style={styles.topActionBtns}>
          <button
            style={{ ...styles.pillBtn, ...styles.pillAll }}
            onClick={() => {
              setReportTeacher();
              setTeacherSelection("");
            }}
            title={tr("طباعة الكل (كل معلم صفحة)", "Print all (one page per teacher)")}
          >
            {tr("طباعة الكل", "Print All")}
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillPrint }} onClick={openPrintDialog} title={tr("طباعة (تقرير فقط)", "Print (report only)")}>
            {tr("طباعة", "Print")}
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillPdf }} onClick={openPrintDialog} title={tr("PDF (Save as PDF) تقرير فقط", "PDF (Save as PDF) report only")}>
            PDF
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillWa }} onClick={handleWhatsAppClick} title={tr("واتساب + مرفق التقرير", "WhatsApp + attach report")}>
            {tr("واتساب", "WhatsApp")}
          </button>
        </div>

        <div style={styles.topActionRight}>
          <select className="td-print-select" value={reportType} onChange={(e) => setQueryParam("reportType", e.target.value)} style={styles.topSelect}>
            <option value="teacher" style={blackGoldDropdownOptionStyle}>{tr("تقرير معلم (فردي)", "Teacher Report (Individual)")}</option>
            <option value="daily" style={blackGoldDropdownOptionStyle}>{tr("كشف يومي (امتحانات)", "Daily Report (Exams)")}</option>
          </select>
        </div>
      </div>

      <div className="no-print" style={styles.filtersRow1to1}>
        <div style={styles.filtersGrid}>
          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>{tr("المعلم", "Teacher")}</div>
            <select className="td-print-select" value={teacherNameFilter} onChange={(e) => setTeacherSelection(e.target.value)} style={styles.filterSelect}>
              <option value="" style={blackGoldDropdownOptionStyle}>{tr("— اختر المعلم — (فارغ = طباعة الكل)", "— Select Teacher — (empty = print all)")}</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t} style={blackGoldDropdownOptionStyle}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>{tr("المادة", "Subject")}</div>
            <select className="td-print-select" value={subjectFilter} onChange={(e) => setQueryParam("subject", e.target.value)} style={styles.filterSelect}>
              <option value="" style={blackGoldDropdownOptionStyle}>{tr("— كل المواد —", "— All Subjects —")}</option>
              {subjectOptions.map((s) => (
                <option key={s.value} value={s.value} style={blackGoldDropdownOptionStyle}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>{tr("سريع", "Quick")}</div>
            <button style={styles.quickBtn} onClick={setReportDaily}>
              {tr("عرض الكشف اليومي", "Show Daily Report")}
            </button>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>{tr("تنقل", "Navigation")}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button style={styles.quickBtnSoft} onClick={() => nav("/task-distribution/results")}>
                {tr("النتائج", "Results")}
              </button>
              <button style={styles.quickBtnSoft} onClick={() => nav("/task-distribution")}>
                {tr("الرئيسية", "Home")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="print-root" ref={printAreaRef}>
        {reportType === "daily" && (
          <>
            {dailyPages.length ? (
              dailyPages.map((p, i) => (
                <DailySheet
                  key={`${p.dISO}-${normalizePeriodKey(p.period)}-${p.subject}`}
                  subject={p.subject}
                  dISO={p.dISO}
                  dayLabel={p.dayLabel}
                  period={p.period}
                  time={p.time}
                  invigilators={p.invigilators}
                  reserves={p.reserves}
                  reviewFree={p.reviewFree}
                  pageBreak={i < dailyPages.length - 1}
                  createdAtISO={safeRun.createdAtISO || ""}
                />
              ))
            ) : (
              <div className="print-sheet" style={{ ...styles.sheet, direction: lang === "ar" ? "rtl" : "ltr" }}>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>{tr("لا توجد بيانات للكشف اليومي.", "No data for the daily report.")}</div>
              </div>
            )}
          </>
        )}

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
                <div className="print-sheet" style={{ ...styles.sheet, direction: lang === "ar" ? "rtl" : "ltr" }}>
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>{tr("لا توجد بيانات لتقرير الكادر التعليمي.", "No data for the teaching staff report.")}</div>
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

const LIGHT_PAGE_BACKGROUND =
  "radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%), linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%)";

const lightPageGlobalCss = `
html,
body,
#root {
  margin: 0 !important;
  min-height: 100% !important;
  background: ${LIGHT_PAGE_BACKGROUND} !important;
}

body {
  background-color: #f7f3e7 !important;
}
`;

const styles: Record<string, React.CSSProperties> = {
  outer: {
    minHeight: "100vh",
    background: LIGHT_PAGE_BACKGROUND,
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
    padding: "8px 10px",
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
    padding: "8px 10px",
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
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#0f172a",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  quickBtnSoft: {
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  sheet: {
    width: "210mm",
    minHeight: "297mm",
    background: "white",
    margin: "0 auto",
    borderRadius: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,.35)",
    padding: "10mm 9mm",
    color: "#111",
    position: "relative",
  },
  pageBreak: { pageBreakAfter: "always", breakAfter: "page" },

  headerGrid: { display: "grid", gridTemplateColumns: "minmax(260px,1fr) 92px minmax(260px,1fr)", gap: 10, alignItems: "center" },
  headerLeft: { textAlign: "left", lineHeight: 1.25 },
  headerLeftTitle: {
    fontSize: 16,
    fontWeight: 900,
    borderBottom: "2px solid #111",
    display: "inline-block",
    paddingBottom: 4,
    marginBottom: 6,
  },
  headerLeftSub: { fontSize: 12.5, fontWeight: 800, marginTop: 2 },
  headerCenter: { display: "flex", justifyContent: "center", alignItems: "center" },
  headerRight: { textAlign: "right", lineHeight: 1.3 },
  headerRightLine: { fontSize: 12, fontWeight: 800, marginTop: 1 },

  hr: { height: 2, background: "#111", opacity: 0.85, margin: "10px 0 12px 0" },

  examBarWide: { border: "3px solid #111", borderRadius: 12, padding: "8px 10px", marginBottom: 10 },
  examBarWideInner: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    fontSize: 12.5,
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
    padding: "6px 10px",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    background: "#f3f4f6",
    fontWeight: 900,
    fontSize: 16,
  },

  teacherInfoBox: { border: "2px solid #111", borderRadius: 10, padding: "8px 10px", marginBottom: 12 },
  teacherInfoRow: { display: "flex", gap: 10, justifyContent: "flex-start", alignItems: "center", padding: "4px 0" },
  teacherInfoLabel: { fontWeight: 900 },
  teacherInfoValue: { fontWeight: 800 },

  tableTitleWrap: { marginTop: 8, display: "flex", justifyContent: "flex-end" },
  tableTitle: {
    border: "2px solid #111",
    borderBottom: "0",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: "6px 10px",
    fontWeight: 900,
    background: "#f3f4f6",
  },

  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "2px solid #111" },
  th: { background: "#f3f4f6", border: "1px solid #111", padding: "10px 8px", fontSize: 12.5, fontWeight: 900, textAlign: "right" },
  td: { border: "1px solid #111", padding: "10px 8px", fontSize: 12.5, verticalAlign: "middle", height: 38 },
  tdNum: {
    border: "1px solid #111",
    padding: "10px 8px",
    fontSize: 12.5,
    verticalAlign: "middle",
    textAlign: "center",
    height: 38,
    color: "#475569",
    fontWeight: 900,
  },

  reserveBlock: { marginTop: 8 },
  reserveTitle: { display: "inline-block", border: "1px solid #111", background: "#f3f4f6", padding: "6px 10px", fontWeight: 900, marginBottom: 0 },
  reserveTable: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "2px solid #111" },

  bottomSigRow: { marginTop: 14, display: "flex", justifyContent: "center", fontWeight: 900, fontSize: 15 },
  bottomSigCell: { width: "45%", textAlign: "center" },
  bottomSigName: { marginTop: 8, fontSize: 14, fontWeight: 900 },

  importantSection: { marginTop: 12, paddingTop: 6 },
  importantTitle: { fontSize: 12.5, fontWeight: 900, marginBottom: 8, textAlign: "right" },
  importantList: { margin: 0, paddingRight: 18, paddingLeft: 0, fontSize: 12.5, lineHeight: 1.85 },
  importantLi: { marginBottom: 4 },
  importantSigRow: { marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 },
  importantSigCol: { width: "45%", textAlign: "center" },
  importantSigLabel: { fontSize: 13, fontWeight: 900, marginBottom: 10 },
  importantSigName: { fontSize: 13, fontWeight: 900, marginBottom: 8 },
  importantSigLine: { height: 0, borderBottom: "2px dotted #111", width: "100%" },

  footerNote: { marginTop: 6, fontSize: 9.5, color: "#64748b", fontWeight: 700, textAlign: "center" },

  pageWrapDark: { minHeight: "100vh", background: LIGHT_PAGE_BACKGROUND, padding: 18, direction: "rtl", fontFamily: 'system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif' },
  darkCard: { maxWidth: 900, margin: "0 auto", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 16 },
  darkRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  btnSoft: { background: "rgba(255,255,255,.10)", color: "white", border: "1px solid rgba(255,255,255,.18)", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 800 },
};

const blackGoldDropdownOptionStyle = { background: "#000000", color: "#FFD700" } as const;

const printCss = `
@page {
  size: A4 portrait;
  margin: 6mm;
}

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

.screen-only-committee-no { display: inline !important; }
.print-only-committee-mask { display: none !important; }

@media print {
  .screen-only-committee-no { display: none !important; }
  .print-only-committee-mask { display: inline !important; }

  body * {
    visibility: hidden !important;
  }

  body.print-report-mode #print-root,
  body.print-report-mode #print-root * {
    visibility: visible !important;
  }

  body.print-report-mode #print-root {
    position: absolute;
    inset: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    background: #fff;
  }

  body.print-report-mode .print-sheet {
    width: 180mm !important;
    min-height: 268mm !important;
    margin: 0 auto !important;
    padding: 1.5mm 1.5mm 2mm 1.5mm !important;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }

  body.print-report-mode .print-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  body.print-report-mode .print-sheet table {
    width: 100% !important;
    max-width: 100% !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
  }

  body.print-report-mode .print-sheet th,
  body.print-report-mode .print-sheet td {
    font-size: 9.5px !important;
    padding: 3px 3px !important;
    line-height: 1.05 !important;
    height: 18px !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  body.print-report-mode .no-print {
    display: none !important;
  }
}
`;
