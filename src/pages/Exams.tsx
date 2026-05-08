import React, { useEffect, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { type Exam } from "../services/exams.service";
import type { Room } from "../services/rooms.service";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useExamsData } from "../hooks/useExamsData";
import { useRoomsData } from "../hooks/useRoomsData";
import { useRoomBlocksData } from "../hooks/useRoomBlocksData";
import { useExamRoomAssignmentsData } from "../hooks/useExamRoomAssignmentsData";
import { createId, isRoomBlockedForExam } from "../lib/roomScheduling";

const APP_NAME_AR = "نظام إدارة الامتحانات المطوّر";
const APP_NAME_EN = "Advanced Exam Management System";
const SUBCOLLECTION = "exams";
const ASSIGNMENTS_STORAGE_PREFIX = "exam_room_assignments";

const SUBJECT_OPTIONS_RAW = [
  "",
  "التربية الإسلامية 5",
  "التربية الإسلامية 6",
  "التربية الإسلامية 7",
  "التربية الإسلامية 8",
  "التربية الإسلامية 9",
  "التربية الإسلامية 10",
  "التربية الإسلامية 11",
  "التربية الإسلامية 12",
  "اللغة العربية 6",
  "اللغة العربية 7",
  "اللغة العربية 8",
  "اللغة العربية 9",
  "اللغة العربية 10",
  "اللغة العربية 11",
  "اللغة العربية 12",
  "اللغة الإنجليزية 6",
  "اللغة الإنجليزية 7",
  "اللغة الإنجليزية 8",
  "اللغة الإنجليزية 9",
  "اللغة الإنجليزية 10",
  "اللغة الإنجليزية 11",
  "اللغة الإنجليزية 12",
  "الرياضيات 5",
  "الرياضيات 6",
  "الرياضيات 7",
  "الرياضيات 8",
  "الرياضيات 9",
  "الرياضيات 10",
  "الرياضيات 11",
  "الرياضيات 12",
  "الرياضيات الأساسية 11",
  "الرياضيات المتقدمة 11",
  "الرياضيات الأساسية 12",
  "الرياضيات المتقدمة 12",
  "الدراسات الاجتماعية 5",
  "الدراسات الاجتماعية 6",
  "الدراسات الاجتماعية 7",
  "الدراسات الاجتماعية 8",
  "الدراسات الاجتماعية 9",
  "الدراسات الاجتماعية 10",
  "التاريخ والحضارة الإسلامية 11",
  "الجغرافيا البشرية 11",
  "هذا وطني 11",
  "التاريخ والحضارة الإسلامية 12",
  "الجغرافيا البشرية 12",
  "هذا وطني 12",
  "العلوم 5",
  "العلوم 6",
  "العلوم 7",
  "العلوم 8",
  "الفيزياء 9",
  "الفيزياء 10",
  "الفيزياء 11",
  "الفيزياء 12",
  "الكيمياء 9",
  "الكيمياء 10",
  "الكيمياء 11",
  "الكيمياء 12",
  "الأحياء 9",
  "الأحياء 10",
  "الأحياء 11",
  "الأحياء 12",
  "الرياضة المدرسية 11",
  "الفنون التشكيلية 11",
  "المهارات الموسيقية 11",
  "الرياضة المدرسية 12",
  "الفنون التشكيلية 12",
  "المهارات الموسيقية 12",
  "مواد التخصصات الهندسية والصناعية 12",
  "مهارات اللغة الإنجليزية 11",
  "مهارات اللغة الإنجليزية 12",
  "تقنية المعلومات 11",
  "تقنية المعلومات 12",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات 12",
  "اللغة الفرنسية 10",
  "اللغة الألمانية 10",
  "اللغة الصينية 10",
  "اللغة الفرنسية 11",
  "اللغة الألمانية 11",
  "اللغة الصينية 11",
  "اللغة الفرنسية 12",
  "اللغة الألمانية 12",
  "اللغة الصينية 12",
  "العلوم البيئية 11",
  "العلوم البيئية 12",
];

const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "التربية الإسلامية 5": "Islamic Education 5",
  "التربية الإسلامية 6": "Islamic Education 6",
  "التربية الإسلامية 7": "Islamic Education 7",
  "التربية الإسلامية 8": "Islamic Education 8",
  "التربية الإسلامية 9": "Islamic Education 9",
  "التربية الإسلامية 10": "Islamic Education 10",
  "التربية الإسلامية 11": "Islamic Education 11",
  "التربية الإسلامية 12": "Islamic Education 12",
  "اللغة العربية 6": "Arabic Language 6",
  "اللغة العربية 7": "Arabic Language 7",
  "اللغة العربية 8": "Arabic Language 8",
  "اللغة العربية 9": "Arabic Language 9",
  "اللغة العربية 10": "Arabic Language 10",
  "اللغة العربية 11": "Arabic Language 11",
  "اللغة العربية 12": "Arabic Language 12",
  "اللغة الإنجليزية 6": "English Language 6",
  "اللغة الإنجليزية 7": "English Language 7",
  "اللغة الإنجليزية 8": "English Language 8",
  "اللغة الإنجليزية 9": "English Language 9",
  "اللغة الإنجليزية 10": "English Language 10",
  "اللغة الإنجليزية 11": "English Language 11",
  "اللغة الإنجليزية 12": "English Language 12",
  "الرياضيات 5": "Mathematics 5",
  "الرياضيات 6": "Mathematics 6",
  "الرياضيات 7": "Mathematics 7",
  "الرياضيات 8": "Mathematics 8",
  "الرياضيات 9": "Mathematics 9",
  "الرياضيات 10": "Mathematics 10",
  "الرياضيات 11": "Mathematics 11",
  "الرياضيات 12": "Mathematics 12",
  "الرياضيات الأساسية 11": "Basic Mathematics 11",
  "الرياضيات المتقدمة 11": "Advanced Mathematics 11",
  "الرياضيات الأساسية 12": "Basic Mathematics 12",
  "الرياضيات المتقدمة 12": "Advanced Mathematics 12",
  "الدراسات الاجتماعية 5": "Social Studies 5",
  "الدراسات الاجتماعية 6": "Social Studies 6",
  "الدراسات الاجتماعية 7": "Social Studies 7",
  "الدراسات الاجتماعية 8": "Social Studies 8",
  "الدراسات الاجتماعية 9": "Social Studies 9",
  "الدراسات الاجتماعية 10": "Social Studies 10",
  "التاريخ والحضارة الإسلامية 11": "Islamic History and Civilization 11",
  "الجغرافيا البشرية 11": "Human Geography 11",
  "هذا وطني 11": "This Is My Nation 11",
  "التاريخ والحضارة الإسلامية 12": "Islamic History and Civilization 12",
  "الجغرافيا البشرية 12": "Human Geography 12",
  "هذا وطني 12": "This Is My Nation 12",
  "العلوم 5": "Science 5",
  "العلوم 6": "Science 6",
  "العلوم 7": "Science 7",
  "العلوم 8": "Science 8",
  "الفيزياء 9": "Physics 9",
  "الفيزياء 10": "Physics 10",
  "الفيزياء 11": "Physics 11",
  "الفيزياء 12": "Physics 12",
  "الكيمياء 9": "Chemistry 9",
  "الكيمياء 10": "Chemistry 10",
  "الكيمياء 11": "Chemistry 11",
  "الكيمياء 12": "Chemistry 12",
  "الأحياء 9": "Biology 9",
  "الأحياء 10": "Biology 10",
  "الأحياء 11": "Biology 11",
  "الأحياء 12": "Biology 12",
  "الرياضة المدرسية 11": "School Sports 11",
  "الفنون التشكيلية 11": "Visual Arts 11",
  "المهارات الموسيقية 11": "Music Skills 11",
  "الرياضة المدرسية 12": "School Sports 12",
  "الفنون التشكيلية 12": "Visual Arts 12",
  "المهارات الموسيقية 12": "Music Skills 12",
  "مواد التخصصات الهندسية والصناعية 12": "Engineering and Industrial Specializations 12",
  "مهارات اللغة الإنجليزية 11": "English Skills 11",
  "مهارات اللغة الإنجليزية 12": "English Skills 12",
  "تقنية المعلومات 11": "Information Technology 11",
  "تقنية المعلومات 12": "Information Technology 12",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات 12": "Travel, Tourism, Business Administration and IT 12",
  "اللغة الفرنسية 10": "French Language 10",
  "اللغة الألمانية 10": "German Language 10",
  "اللغة الصينية 10": "Chinese Language 10",
  "اللغة الفرنسية 11": "French Language 11",
  "اللغة الألمانية 11": "German Language 11",
  "اللغة الصينية 11": "Chinese Language 11",
  "اللغة الفرنسية 12": "French Language 12",
  "اللغة الألمانية 12": "German Language 12",
  "اللغة الصينية 12": "Chinese Language 12",
  "العلوم البيئية 11": "Environmental Science 11",
  "العلوم البيئية 12": "Environmental Science 12",
};

const PERIOD_OPTIONS_AR = [
  { value: "الفترة الأولى", label: "الفترة الأولى" },
  { value: "الفترة الثانية", label: "الفترة الثانية" },
];

const PERIOD_OPTIONS_EN = [
  { value: "الفترة الأولى", label: "First Period" },
  { value: "الفترة الثانية", label: "Second Period" },
];

function genId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis as any;
  if (c?.crypto?.randomUUID) return c.crypto.randomUUID();
  return `e_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const emptyExam: Exam = {
  id: "",
  subject: "",
  dateISO: "",
  dayLabel: "",
  time: "08:00",
  durationMinutes: 120,
  period: "الفترة الأولى",
  roomsCount: 1,
};

type PersistedExamRoomAssignment = {
  id: string;
  examId: string;
  roomId: string;
  roomName: string;
  dateISO: string;
  time: string;
  period: string;
  createdBy?: string;
};

function safeParseExams(v: string | null): Exam[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => {
      const rooms = Number(x.roomsCount ?? 0) || 1;
      return {
        id: String(x.id ?? "").trim() || genId(),
        subject: String(x.subject ?? "").trim(),
        dateISO: String(x.dateISO ?? "").trim(),
        dayLabel: String(x.dayLabel ?? "").trim(),
        time: String(x.time ?? "").trim(),
        durationMinutes: Number(x.durationMinutes ?? 0) || 0,
        period: String(x.period ?? "").trim(),
        roomsCount: rooms < 1 ? 1 : rooms,
      };
    });
  } catch {
    return [];
  }
}

function safeParseExamRoomAssignments(v: string | null): PersistedExamRoomAssignment[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        id: String(x?.id ?? "").trim() || createId("exam_room"),
        examId: String(x?.examId ?? "").trim(),
        roomId: String(x?.roomId ?? "").trim(),
        roomName: String(x?.roomName ?? "").trim(),
        dateISO: String(x?.dateISO ?? "").trim(),
        time: String(x?.time ?? "").trim(),
        period: String(x?.period ?? "").trim(),
        createdBy: String(x?.createdBy ?? "").trim() || undefined,
      }))
      .filter((x) => x.examId && x.roomId);
  } catch {
    return [];
  }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeHeader(h: string) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9]/g, "");
}

function getCell(row: any, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  const map: Record<string, any> = {};
  Object.keys(row || {}).forEach((kk) => (map[normalizeHeader(kk)] = row[kk]));
  for (const nk of keys.map(normalizeHeader)) {
    if (map[nk] != null && String(map[nk]).trim() !== "") return String(map[nk]).trim();
  }
  return "";
}

async function tryReadExcel(file: File): Promise<any[] | null> {
  try {
    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return json as any[];
  } catch {
    return null;
  }
}

function parseCSV(text: string): any[] {
  const lines: string[] = [];
  const s = text.replace(/\r/g, "");
  let cur = "";
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      if (inQ && s[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if (ch === "\n" && !inQ) {
      lines.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== "") lines.push(cur);

  if (!lines.length) return [];

  const split = (line: string) => {
    const out: string[] = [];
    let c = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          c += '"';
          i++;
        } else q = !q;
        continue;
      }
      if (ch === "," && !q) {
        out.push(c);
        c = "";
        continue;
      }
      c += ch;
    }
    out.push(c);
    return out.map((x) => x.trim());
  };

  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);

  return rows.map((cells) => {
    const obj: any = {};
    headers.forEach((h, idx) => (obj[h] = cells[idx] ?? ""));
    return obj;
  });
}

function parseExamsFromObjects(rows: any[]): Exam[] {
  return rows
    .map((r) => {
      const subject = getCell(r, ["المادة", "subject"]);
      const dateISO = getCell(r, ["التاريخ", "dateISO", "date"]);
      const dayLabel = getCell(r, ["اليوم", "dayLabel", "day"]);
      const time = getCell(r, ["الوقت", "time"]);
      const durationMinutes = Number(getCell(r, ["المدة", "duration", "durationMinutes"])) || 0;
      const period = getCell(r, ["الفترة", "period"]) || "الفترة الأولى";

      const roomsRaw = getCell(r, [
        "القاعات",
        "عدد القاعات",
        "عدد اللجان",
        "عدداللجان",
        "roomsCount",
        "rooms",
        "rooms_count",
      ]);
      const roomsCount = Math.max(1, Number(roomsRaw) || 1);

      return {
        id: genId(),
        subject: String(subject || "").trim(),
        dateISO: String(dateISO || "").trim(),
        dayLabel: String(dayLabel || "").trim(),
        time: String(time || "").trim(),
        durationMinutes,
        period: String(period || "").trim(),
        roomsCount,
      } as Exam;
    })
    .filter((e) => e.subject || e.dateISO);
}

function dayFromISO(iso: string, lang: "ar" | "en") {
  try {
    const d = new Date(iso + "T00:00:00");
    const w = d.getDay();
    const ar = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const en = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return (lang === "ar" ? ar : en)[w] || "";
  } catch {
    return "";
  }
}

function sortExams(a: Exam, b: Exam) {
  return a.dateISO.localeCompare(b.dateISO);
}

function sortExamsByDate(a: Exam, b: Exam, order: "asc" | "desc") {
  const result = a.dateISO.localeCompare(b.dateISO);
  return order === "asc" ? result : -result;
}

function sortRoomsByCode(a: Room, b: Room) {
  const codeA = String(a.code || "").trim();
  const codeB = String(b.code || "").trim();

  if (!codeA && !codeB) {
    return String(a.roomName || "").localeCompare(String(b.roomName || ""), "ar", {
      sensitivity: "base",
    });
  }
  if (!codeA) return 1;
  if (!codeB) return -1;

  const byCode = codeA.localeCompare(codeB, "ar", {
    numeric: true,
    sensitivity: "base",
  });

  if (byCode !== 0) return byCode;

  return String(a.roomName || "").localeCompare(String(b.roomName || ""), "ar", {
    sensitivity: "base",
  });
}

function normalizeExamPeriod(period: string) {
  const raw = String(period || "").trim();
  if (!raw) return "";

  const n = raw.toLowerCase().replace(/\s+/g, " ").trim();

  if (
    n.includes("الفترة الأولى") ||
    n.includes("first period") ||
    n === "الأولى" ||
    n === "اولى" ||
    n === "p1" ||
    n === "am" ||
    n === "a"
  ) {
    return "p1";
  }

  if (
    n.includes("الفترة الثانية") ||
    n.includes("second period") ||
    n === "الثانية" ||
    n === "ثانية" ||
    n === "p2" ||
    n === "pm" ||
    n === "bm" ||
    n === "b" ||
    n === "p"
  ) {
    return "p2";
  }

  return raw;
}

type DupModalState = {
  open: boolean;
  subject: string;
  candidates: Exam[];
  pending: Exam;
  context: "add" | "edit";
};

type RoomManagerState = {
  open: boolean;
  examId: string;
  selectedRoomIds: string[];
};

type AvailableRoomRow = Room & {
  blocked: boolean;
  inactive: boolean;
  sameDateConflict: boolean;
  sameDateConflictLabel: string;
};

export default function Exams() {
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const translateSubject = (s: string) => (lang === "ar" ? s : SUBJECT_TRANSLATIONS[s] || s);
  const APP_NAME = lang === "ar" ? APP_NAME_AR : APP_NAME_EN;

  const SUBJECT_OPTIONS = useMemo(
    () =>
      SUBJECT_OPTIONS_RAW.map((s) => ({
        value: s,
        label: s ? translateSubject(s) : tr("— اختر المادة —", "— Select Subject —"),
      })),
    [lang]
  );

  const PERIOD_OPTIONS = useMemo(
    () => (lang === "ar" ? PERIOD_OPTIONS_AR : PERIOD_OPTIONS_EN),
    [lang]
  );

  const { tenantId, exams, setExams } = useExamsData();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState<Exam>({ ...emptyExam, id: genId() });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Exam>({ ...emptyExam, id: "" });

  const [dateSortOrder, setDateSortOrder] = useState<"asc" | "desc">("asc");

  const [dupModal, setDupModal] = useState<DupModalState>({
    open: false,
    subject: "",
    candidates: [],
    pending: { ...emptyExam, id: "" },
    context: "add",
  });

  const topRef = useRef<HTMLDivElement>(null);
  const [tableFullScreen, setTableFullScreen] = useState(false);
  const { user } = useAuth() as any;
  const { rooms } = useRoomsData();
  const { roomBlocks } = useRoomBlocksData();
  const {
    examRoomAssignments,
    setExamRoomAssignments,
    persistExamRoomAssignmentsNow,
  } = useExamRoomAssignmentsData();
  const [roomManager, setRoomManager] = useState<RoomManagerState>({ open: false, examId: "", selectedRoomIds: [] });
  const assignmentsHydratedRef = useRef(false);
  const assignmentsHydrationKeyRef = useRef("");

  const assignmentsStorageKey = useMemo(() => {
    const suffix = String(tenantId || "default").trim() || "default";
    return `${ASSIGNMENTS_STORAGE_PREFIX}_${suffix}`;
  }, [tenantId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (tableFullScreen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tableFullScreen]);

  useEffect(() => {
    if (assignmentsHydrationKeyRef.current !== assignmentsStorageKey) {
      assignmentsHydrationKeyRef.current = assignmentsStorageKey;
      assignmentsHydratedRef.current = false;
    }
  }, [assignmentsStorageKey]);

  useEffect(() => {
    if (assignmentsHydratedRef.current) return;

    try {
      const savedAssignments = safeParseExamRoomAssignments(
        localStorage.getItem(assignmentsStorageKey)
      );

      if (!examRoomAssignments.length && savedAssignments.length) {
        setExamRoomAssignments(savedAssignments as any);
      }
    } catch {
    } finally {
      assignmentsHydratedRef.current = true;
    }
  }, [assignmentsStorageKey, examRoomAssignments.length, setExamRoomAssignments]);

  useEffect(() => {
    if (!assignmentsHydratedRef.current) return;
    try {
      localStorage.setItem(assignmentsStorageKey, JSON.stringify(examRoomAssignments));
    } catch {
    }
  }, [assignmentsStorageKey, examRoomAssignments]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .examTable3D {
        position: relative;
        background: linear-gradient(180deg, #fffdf6, #f8f2df);
        border-radius: 16px;
        padding: 12px;
        box-shadow: 0 18px 35px rgba(86,63,0,0.16), inset 0 0 0 4px rgba(255,255,255,0.65);
        overflow: hidden;
      }

      .examTable3D table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 8px;
      }

      .examTable3D th,
      .examTable3D td {
        border-right: ${isRTL ? "2px solid rgba(184,134,11,0.95)" : "none"} !important;
        border-left: ${!isRTL ? "2px solid rgba(184,134,11,0.95)" : "none"} !important;
      }
      .examTable3D th:last-child,
      .examTable3D td:last-child {
        border-right: none !important;
        border-left: none !important;
      }

      .examTable3D thead th {
        background: linear-gradient(180deg,#6e5200,#4a3600) !important;
        color: #fff1c4 !important;
        border-bottom: 1px solid rgba(212,175,55,0.35) !important;
        border-radius: 12px;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 14px rgba(0,0,0,0.55);
      }

      .examTable3D tbody td {
        background: linear-gradient(180deg,#fffdf7,#f7efd9) !important;
        color: #050505 !important;
        font-weight: 900;
        border-bottom: none !important;
        border-radius: 14px;
        box-shadow: none;
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
      }

      .examTable3D tbody tr:hover td {
        transform: translateY(-3px);
        box-shadow: none;
        filter: brightness(1.03);
      }

      .examTable3D .col-date {
        min-width: 210px;
        font-weight: 1000;
        background: linear-gradient(180deg,#7a5c00,#4a3600) !important;
        color: #fff1c4 !important;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 12px 24px rgba(0,0,0,0.70) !important;
      }

      .examTable3D::before {
        content: "";
        position: absolute;
        top: 0;
        left: -120%;
        width: 60%;
        height: 100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
        transform: skewX(-12deg);
        animation: examShine 10s infinite;
        pointer-events: none;
      }

      @keyframes examShine {
        0%, 88% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
        90% { opacity: 1; }
        100% { transform: translateX(240%) skewX(-12deg); opacity: 0.9; }
      }

      .examTable3D tbody tr.row-today td {
        outline: 2px solid rgba(255,215,0,0.85);
        outline-offset: -2px;
        box-shadow: 0 16px 34px rgba(255,215,0,0.10), 0 12px 26px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08);
        animation: todayPulse 2.4s ease-in-out infinite;
      }
      @keyframes todayPulse {
        0% { filter: brightness(1.00); }
        50% { filter: brightness(1.08); }
        100% { filter: brightness(1.00); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [isRTL]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const examsById = useMemo(() => new Map(exams.map((exam) => [exam.id, exam])), [exams]);

  const assignmentsByExamId = useMemo(() => {
    const map = new Map<string, typeof examRoomAssignments>();
    for (const row of examRoomAssignments) {
      const list = map.get(row.examId) || [];
      list.push(row);
      map.set(row.examId, list);
    }
    return map;
  }, [examRoomAssignments]);

  const activeBlocks = useMemo(() => roomBlocks.filter((block) => block.status === "active"), [roomBlocks]);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === roomManager.examId) || null,
    [exams, roomManager.examId]
  );

  const selectedExamAssignments = useMemo(
    () => (selectedExam ? assignmentsByExamId.get(selectedExam.id) || [] : []),
    [assignmentsByExamId, selectedExam]
  );

  const selectedExamAvailableRooms = useMemo(() => {
    if (!selectedExam) return [] as AvailableRoomRow[];

    const selectedPeriodKey = normalizeExamPeriod(selectedExam.period);

    return [...rooms]
      .sort(sortRoomsByCode)
      .map((room) => {
        const sameDateSamePeriodAssignments = examRoomAssignments.filter((assignment) => {
          if (assignment.roomId !== room.id) return false;
          if (assignment.examId === selectedExam.id) return false;

          const otherExam = examsById.get(assignment.examId);
          const otherDateISO = String(otherExam?.dateISO || assignment.dateISO || "").trim();
          const otherPeriodKey = normalizeExamPeriod(
            String(otherExam?.period || assignment.period || "").trim()
          );

          return otherDateISO === selectedExam.dateISO && otherPeriodKey === selectedPeriodKey;
        });

        const sameDateConflictLabel = sameDateSamePeriodAssignments
          .map((assignment) => {
            const otherExam = examsById.get(assignment.examId);
            const subject = String(otherExam?.subject || tr("مادة أخرى", "Another Subject")).trim();
            const period = String(otherExam?.period || assignment.period || "").trim();
            return period ? `${subject} — ${period}` : subject;
          })
          .join(lang === "ar" ? "، " : ", ");

        return {
          ...room,
          blocked: isRoomBlockedForExam(room.id, selectedExam, activeBlocks),
          inactive: (room.status || "active") !== "active",
          sameDateConflict: sameDateSamePeriodAssignments.length > 0,
          sameDateConflictLabel,
        };
      });
  }, [rooms, selectedExam, activeBlocks, examRoomAssignments, examsById, lang]);

  const filtered = useMemo(() => {
    const q = query.trim();

    const base = !q
      ? exams
      : exams.filter((e) =>
          [e.subject, e.dateISO, e.dayLabel, e.time, e.period, String(e.roomsCount)].some((x) =>
            String(x).includes(q)
          )
        );

    return [...base].sort((a, b) => sortExamsByDate(a, b, dateSortOrder));
  }, [exams, query, dateSortOrder]);

  function validateExam(e: Exam) {
    if (!e.subject.trim()) return tr("المادة مطلوبة.", "Subject is required.");
    if (!e.dateISO.trim()) return tr("التاريخ مطلوب.", "Date is required.");
    if (!e.time.trim()) return tr("الوقت مطلوب.", "Time is required.");
    if (!e.durationMinutes || e.durationMinutes <= 0) return tr("المدة مطلوبة.", "Duration is required.");
    if (!e.period.trim()) return tr("الفترة مطلوبة.", "Period is required.");
    if (!e.roomsCount || e.roomsCount <= 0) return tr("عدد القاعات مطلوب.", "Rooms count is required.");
    return "";
  }

  function findSubjectDuplicates(subject: string, ignoreId?: string | null) {
    const key = subject.trim();
    if (!key) return [];
    return exams.filter((x) => x.subject.trim() === key && x.id !== ignoreId);
  }

  function openDupModal(subject: string, ignoreId: string | null, pending: Exam, context: "add" | "edit") {
    setDupModal({
      open: true,
      subject: subject.trim(),
      candidates: findSubjectDuplicates(subject, ignoreId),
      pending,
      context,
    });
  }

  function fixExam(e: Exam): Exam {
    const rooms = Number(e.roomsCount) || 1;
    return {
      ...e,
      id: e.id || genId(),
      subject: String(e.subject || "").trim(),
      dateISO: String(e.dateISO || "").trim(),
      dayLabel: String(e.dayLabel || "").trim() || dayFromISO(e.dateISO, lang),
      period: String(e.period || "").trim() || "الفترة الأولى",
      time: String(e.time || "").trim() || "08:00",
      durationMinutes: Number(e.durationMinutes) || 120,
      roomsCount: rooms < 1 ? 1 : rooms,
    };
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setRow({ ...emptyExam, id: genId() });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveAdd() {
    const msg = validateExam(row);
    if (msg) return alert(msg);

    const fixed = fixExam({ ...row, dayLabel: row.dayLabel.trim() || dayFromISO(row.dateISO, lang) });

    const dups = findSubjectDuplicates(fixed.subject, null);
    if (dups.length) {
      return openDupModal(fixed.subject, null, fixed, "add");
    }

    setExams((prev) => [fixed, ...prev].sort(sortExams));
    setAdding(false);
    setRow({ ...emptyExam, id: genId() });
  }

  function startEditById(id: string) {
    const found = exams.find((x) => x.id === id);
    if (!found) return;
    setAdding(false);
    setEditingId(id);
    setEdit({ ...found });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveEdit() {
    if (!editingId) return;
    const msg = validateExam(edit);
    if (msg) return alert(msg);

    const fixed = fixExam({ ...edit, id: editingId, dayLabel: edit.dayLabel.trim() || dayFromISO(edit.dateISO, lang) });

    const dups = findSubjectDuplicates(fixed.subject, editingId);
    if (dups.length) {
      return openDupModal(fixed.subject, editingId, fixed, "edit");
    }

    setExams((prev) => prev.map((x) => (x.id === editingId ? fixed : x)).sort(sortExams));
    setEditingId(null);
    setEdit({ ...emptyExam, id: "" });
  }

  function removeExamById(id: string) {
    if (!confirm(tr("هل تريد حذف هذا الامتحان؟", "Do you want to delete this exam?"))) return;
    setExams((prev) => prev.filter((x) => x.id !== id));
    setExamRoomAssignments((prev) => prev.filter((row) => row.examId !== id));
  }

  function deleteAll() {
    if (!exams.length) return;
    const ok = confirm(tr("⚠️ هل أنت متأكد من حذف جدول الامتحانات كاملًا؟ لا يمكن التراجع.", "⚠️ Are you sure you want to delete the entire exams table? This cannot be undone."));
    if (!ok) return;
    setExams([]);
    setExamRoomAssignments([]);
  }

  function toCSV(rows: Exam[]) {
    const header =
      lang === "ar"
        ? ["المادة", "التاريخ", "اليوم", "الوقت", "المدة", "الفترة", "القاعات"]
        : ["Subject", "Date", "Day", "Time", "Duration", "Period", "Rooms"];
    const escape = (s: string) => {
      const v = (s ?? "").replace(/\r?\n/g, " ").trim();
      if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const lines = [
      header.join(","),
      ...rows.map((e) =>
        [
          lang === "ar" ? e.subject : translateSubject(e.subject),
          e.dateISO,
          e.dayLabel,
          e.time,
          String(e.durationMinutes),
          lang === "ar"
            ? e.period
            : e.period === "الفترة الأولى"
            ? "First Period"
            : e.period === "الفترة الثانية"
            ? "Second Period"
            : e.period,
          String(e.roomsCount),
        ]
          .map(escape)
          .join(",")
      ),
    ];
    return lines.join("\n");
  }

  function exportCSV() {
    downloadText("exams.csv", toCSV(exams));
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = exams.map((e) =>
        lang === "ar"
          ? {
              المادة: e.subject,
              التاريخ: e.dateISO,
              اليوم: e.dayLabel,
              الوقت: e.time,
              المدة: e.durationMinutes,
              الفترة: e.period,
              القاعات: e.roomsCount,
            }
          : {
              Subject: translateSubject(e.subject),
              Date: e.dateISO,
              Day: e.dayLabel,
              Time: e.time,
              Duration: e.durationMinutes,
              Period: e.period === "الفترة الأولى" ? "First Period" : e.period === "الفترة الثانية" ? "Second Period" : e.period,
              Rooms: e.roomsCount,
            }
      );
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exams");
      XLSX.writeFile(wb, "exams.xlsx");
    } catch {
      alert(tr("مكتبة xlsx غير متوفرة. استخدم تصدير CSV أو ثبّت xlsx.", "xlsx library is not available. Use CSV export or install xlsx."));
    }
  }

  async function importExcel(file: File) {
    const json = await tryReadExcel(file);
    if (!json) {
      alert(tr("تعذر قراءة Excel. تأكد من وجود مكتبة xlsx أو استخدم CSV.", "Unable to read Excel. Make sure xlsx is installed or use CSV."));
      return;
    }
    const incoming = parseExamsFromObjects(json).map(fixExam);

    for (const inc of incoming) {
      const dups = findSubjectDuplicates(inc.subject, null);
      if (dups.length) {
        openDupModal(inc.subject, null, inc, "add");
        return;
      }
    }

    setExams((prev) => [...incoming, ...prev].sort(sortExams));
    alert(tr("✅ تم استيراد البيانات.", "✅ Data imported successfully."));
  }

  async function importCSV(file: File) {
    const text = await file.text();
    const objs = parseCSV(text);
    const incoming = parseExamsFromObjects(objs).map(fixExam);

    for (const inc of incoming) {
      const dups = findSubjectDuplicates(inc.subject, null);
      if (dups.length) {
        openDupModal(inc.subject, null, inc, "add");
        return;
      }
    }

    setExams((prev) => [...incoming, ...prev].sort(sortExams));
    alert(tr("✅ تم استيراد البيانات.", "✅ Data imported successfully."));
  }

  function resolveDuplicate(action: "change" | "overwrite", selectedId?: string) {
    if (action === "change") {
      setDupModal((s) => ({ ...s, open: false }));
      return;
    }
    if (!selectedId) return;

    const pending = dupModal.pending;

    setExams((prev) => prev.map((x) => (x.id === selectedId ? { ...pending, id: selectedId } : x)).sort(sortExams));
    setDupModal((s) => ({ ...s, open: false }));

    if (dupModal.context === "add") {
      setAdding(false);
      setRow({ ...emptyExam, id: genId() });
    } else {
      setEditingId(null);
      setEdit({ ...emptyExam, id: "" });
    }
  }

  function openRoomManager(exam: Exam) {
    const selected = (assignmentsByExamId.get(exam.id) || []).map((row) => row.roomId);
    setRoomManager({ open: true, examId: exam.id, selectedRoomIds: selected });
  }

  function toggleRoomSelection(roomId: string) {
    setRoomManager((prev) => {
      const exists = prev.selectedRoomIds.includes(roomId);
      const next = exists
        ? prev.selectedRoomIds.filter((id) => id !== roomId)
        : [...prev.selectedRoomIds, roomId];
      return { ...prev, selectedRoomIds: next };
    });
  }

  function closeRoomManager() {
    setRoomManager({ open: false, examId: "", selectedRoomIds: [] });
  }

  async function saveRoomAssignments() {
    if (!selectedExam) return;
    const required = Math.max(1, Number(selectedExam.roomsCount) || 1);
    const selectedSet = new Set(roomManager.selectedRoomIds);

    if (selectedSet.size > required) {
      alert(tr(`لا يمكن ربط أكثر من ${required} قاعات لهذا الامتحان.`, `You cannot assign more than ${required} rooms to this exam.`));
      return;
    }

    const invalidBlockedOrInactive = selectedExamAvailableRooms.find(
      (room) => selectedSet.has(room.id) && (room.blocked || room.inactive)
    );
    if (invalidBlockedOrInactive) {
      alert(tr(`القاعات المحظورة أو الموقوفة لا يمكن ربطها: ${invalidBlockedOrInactive.roomName}`, `Blocked or inactive rooms cannot be assigned: ${invalidBlockedOrInactive.roomName}`));
      return;
    }

    const sameDateConflictRoom = selectedExamAvailableRooms.find(
      (room) => selectedSet.has(room.id) && room.sameDateConflict
    );
    if (sameDateConflictRoom) {
      alert(
        tr(
          `لا يمكن اختيار القاعة ${sameDateConflictRoom.roomName} لأنها مرتبطة بالفعل في نفس التاريخ ونفس الفترة بـ ${sameDateConflictRoom.sameDateConflictLabel}.`,
          `You cannot select room ${sameDateConflictRoom.roomName} because it is already assigned on the same date and period to ${sameDateConflictRoom.sameDateConflictLabel}.`
        )
      );
      return;
    }

    const remaining = examRoomAssignments.filter((row) => row.examId !== selectedExam.id);
    const next = [
      ...remaining,
      ...selectedExamAvailableRooms
        .filter((room) => selectedSet.has(room.id))
        .map((room) => ({
          id: createId("exam_room"),
          examId: selectedExam.id,
          roomId: room.id,
          roomName: room.roomName,
          dateISO: selectedExam.dateISO,
          time: selectedExam.time,
          period: selectedExam.period,
          createdBy: String(user?.email || "").trim() || undefined,
        })),
    ];

    setExamRoomAssignments(next as any);

    try {
      await persistExamRoomAssignmentsNow(next as any);
    } catch (error) {
      console.error("persistExamRoomAssignmentsNow error:", error);
      alert(tr("تم تحديث القاعات في الصفحة ولكن تعذر حفظها بشكل دائم.", "Rooms were updated on the page but could not be saved permanently."));
      return;
    }

    closeRoomManager();
  }

  const pageStyle: React.CSSProperties = {
    padding: 18,
    color: "#0b0b0b",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -10%, rgba(212,175,55,0.20), transparent 28%), linear-gradient(180deg, #fffdf6 0%, #f8f2df 45%, #fffaf0 100%)",
    position: "relative",
    overflowX: "hidden",
    direction: isRTL ? "rtl" : "ltr",
  };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "linear-gradient(135deg, #f1d27a, #d4af37, #b8962e)",
    color: "#0b1220",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 18px 60px rgba(212,175,55,0.25)",
    marginBottom: 14,
  };

  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, #fffdf6 0%, #f8f2df 100%)",
    border: "4px solid #d4af37",
    borderRadius: 30,
    padding: 18,
    boxShadow: "0 22px 50px rgba(86,63,0,0.16), inset 0 0 0 7px rgba(255,255,255,0.72)",
    marginBottom: 18,
    color: "#050505",
  };

  const fullScreenOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    padding: 14,
    background: "linear-gradient(180deg, #050a14, #070d1a)",
  };

  const btn = (bg: string, fg = "#0b1220"): React.CSSProperties => ({
    background: bg,
    color: fg,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  });

  const inputStyle: React.CSSProperties = {
    background: "#fffdf6",
    color: "#050505",
    border: "2px solid rgba(212,175,55,0.78)",
    borderRadius: 14,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
    fontWeight: 800,
  };

  const tableWrap: React.CSSProperties = {
    maxHeight: "55vh",
    overflow: "auto",
    borderRadius: 24,
    border: "3px solid #d4af37",
    background: "linear-gradient(180deg, #fffdf6 0%, #f8f2df 100%)",
    boxShadow: "0 18px 38px rgba(86,63,0,0.16)",
  };

  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "linear-gradient(180deg, #6f5300, #4f3900)",
    color: "#fff7d7",
    zIndex: 2,
    padding: 10,
    textAlign: isRTL ? "right" : "left",
    fontWeight: 1000,
    borderBottom: "2px solid rgba(212,175,55,0.75)",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: 10,
    borderBottom: "2px solid rgba(212,175,55,0.32)",
    whiteSpace: "nowrap",
    color: "#050505",
    fontWeight: 800,
  };

  const current = editingId ? edit : row;
  const setCurrent = (patch: Partial<Exam>) => {
    if (editingId) setEdit({ ...edit, ...patch });
    else setRow({ ...row, ...patch });
  };

  const modalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const modalCard: React.CSSProperties = {
    width: "min(860px, 96vw)",
    background: "linear-gradient(180deg, #0b1220, #09101d)",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 22px 80px rgba(0,0,0,0.55)",
    color: "#e6c76a",
    direction: isRTL ? "rtl" : "ltr",
  };

  return (
    <div style={pageStyle} ref={topRef} className="examsScheduleOuterCardTextBlackOnly">
      <style>{`
        .examsScheduleOuterCardTextBlackOnly .scheduleOuterCardText,
        .examsScheduleOuterCardTextBlackOnly .scheduleOuterCardText * {
          color: #000000 !important;
          font-weight: 900 !important;
          text-shadow: none !important;
          -webkit-text-fill-color: #000000 !important;
        }

        .examsScheduleOuterCardTextBlackOnly table,
        .examsScheduleOuterCardTextBlackOnly table *,
        .examsScheduleOuterCardTextBlackOnly th,
        .examsScheduleOuterCardTextBlackOnly td {
          color: inherit;
          -webkit-text-fill-color: initial;
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          top: -180,
          left: "50%",
          transform: "translateX(-50%)",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.05) 38%, transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: isRTL ? -120 : "auto",
          left: !isRTL ? -120 : "auto",
          top: 260,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.10), transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1500, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "grid",
            gap: 18,
            border: "5px solid #d4af37",
            borderRadius: 36,
            padding: 26,
            background: "linear-gradient(180deg, #fffdf7 0%, #f8f2df 100%)",
            boxShadow: "0 22px 50px rgba(88,64,0,0.18), inset 0 0 0 8px rgba(255,255,255,0.78)",
            marginBottom: 26,
            color: "#050505",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isRTL ? "minmax(0, 1.45fr) minmax(320px, 0.75fr)" : "minmax(320px, 0.75fr) minmax(0, 1.45fr)",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div
              style={{
                order: isRTL ? 2 : 1,
                border: "4px solid #d4af37",
                borderRadius: 30,
                padding: 24,
                background: "rgba(255,253,246,0.76)",
                boxShadow: "inset 0 0 0 4px rgba(255,255,255,0.68)",
                display: "grid",
                gap: 16,
              }}
            >
              {[
                { label: tr("إجمالي الامتحانات", "Total Exams"), value: exams.length },
                { label: tr("المعروض الآن", "Currently Shown"), value: filtered.length },
                { label: tr("قاعات الربط", "Assigned Rooms"), value: examRoomAssignments.length },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: "3px solid #d4af37",
                    borderRadius: 22,
                    padding: "18px 22px",
                    background: "linear-gradient(180deg, #fffdf8, #f7f0dd)",
                    color: "#050505",
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  <div style={{ fontSize: 14, color: "#050505", fontWeight: 1000 }}>{item.label}</div>
                  <div style={{ marginTop: 8, fontSize: 23, color: "#050505", fontWeight: 1000 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ order: isRTL ? 1 : 2, display: "grid", gap: 18, textAlign: isRTL ? "right" : "left" }}>
              <div
                style={{
                  display: "inline-flex",
                  justifySelf: isRTL ? "end" : "start",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 22px",
                  borderRadius: 999,
                  background: "#eaf2ff",
                  border: "4px solid #d4af37",
                  color: "#050505",
                  fontWeight: 1000,
                  fontSize: 15,
                }}
              >
                {tr("إدارة مركزية لجدول الامتحانات والقاعات", "Central management for exams schedule and rooms")}
              </div>

              <div>
                <div style={{ fontSize: 22, fontWeight: 1000, color: "#050505", marginBottom: 10 }}>
                  {APP_NAME}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(42px, 6vw, 76px)",
                    lineHeight: 1.08,
                    fontWeight: 1000,
                    color: "#050505",
                    letterSpacing: "-0.03em",
                    textShadow: "0 10px 24px rgba(0,0,0,0.08)",
                  }}
                >
                  {tr("مركز إدارة الامتحانات", "Exams Management Center")}
                </h1>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  lineHeight: 2.15,
                  color: "#050505",
                  fontWeight: 900,
                  maxWidth: 980,
                }}
              >
                {tr(
                  "تمنح هذه الصفحة الإدارة واجهة تنفيذية فاخرة لإدارة المواد والمواعيد والفترات وعدد القاعات، مع ربط ذكي بالقاعات المتاحة والمحظورة، وتجربة إدخال واستعراض منظمة تعكس جودة منتج مؤسسي متقن.",
                  "This page gives the administration a premium executive interface to manage subjects, dates, periods, and room counts, with smart linking to available and blocked rooms, and an organized entry and review experience that reflects the quality of a refined institutional product."
                )}
              </p>

            </div>
          </div>
        </div>

        {dupModal.open && (
          <div style={modalOverlay} onClick={() => resolveDuplicate("change")}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 8, color: "#d4af37" }}>
                {tr("⚠️ المادة مكررة", "⚠️ Duplicate subject")}
              </div>
              <div style={{ opacity: 0.95, marginBottom: 12, lineHeight: 1.8 }}>
                {tr(
                  `المادة ${dupModal.subject} موجودة بالفعل.\nإمّا تغيّر المادة، أو تختار واحدة من المواد المكررة لاستبدالها بالبيانات الحالية.`,
                  `Subject ${dupModal.subject} already exists.\nEither change the subject, or choose one of the duplicate subjects to replace it with the current data.`
                )}
              </div>

              <div style={{ border: "1px solid rgba(212,175,55,0.18)", borderRadius: 14, overflow: "hidden" }}>
                <table style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, position: "static" }}>{tr("المادة", "Subject")}</th>
                      <th style={{ ...thStyle, position: "static" }}>{tr("التاريخ", "Date")}</th>
                      <th style={{ ...thStyle, position: "static" }}>{tr("إجراء", "Action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dupModal.candidates.map((c) => (
                      <tr key={c.id}>
                        <td style={tdStyle}>{lang === "ar" ? c.subject : translateSubject(c.subject)}</td>
                        <td style={tdStyle}>{c.dateISO}</td>
                        <td style={tdStyle}>
                          <button style={btn("#f59e0b", "#07101f")} onClick={() => resolveDuplicate("overwrite", c.id)}>
                            {tr("استبدال هذا السجل", "Replace this record")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => resolveDuplicate("change")}>
                  {tr("تغيير المادة", "Change subject")}
                </button>
              </div>
            </div>
          </div>
        )}

        {roomManager.open && selectedExam && (
          <div style={modalOverlay} onClick={closeRoomManager}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 1000, fontSize: 18, color: "#d4af37" }}>{tr("إدارة قاعات الامتحان", "Exam Rooms Management")}</div>
                  <div style={{ opacity: 0.85 }}>
                    {lang === "ar" ? selectedExam.subject : translateSubject(selectedExam.subject)} — {selectedExam.dateISO} — {selectedExam.period === "الفترة الأولى" ? tr("الفترة الأولى", "First Period") : selectedExam.period === "الفترة الثانية" ? tr("الفترة الثانية", "Second Period") : selectedExam.period}
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: 900,
                    color: roomManager.selectedRoomIds.length === selectedExam.roomsCount ? "#22c55e" : "#f59e0b",
                  }}
                >
                  {roomManager.selectedRoomIds.length} / {selectedExam.roomsCount}
                </div>
              </div>
              {!rooms.length ? (
                <div style={{ ...card, marginBottom: 12 }}>
                  {tr("لا توجد قاعات مسجلة في النظام. أدخل القاعات أولًا ثم ارجع لتخصيصها.", "There are no rooms registered in the system. Add rooms first, then return to assign them.")}
                </div>
              ) : (
                <>
                  <div style={{ ...card, marginBottom: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{tr("الحالة الحالية", "Current Status")}</div>
                    <div>{tr("القاعات المطلوبة", "Required Rooms")}: {selectedExam.roomsCount}</div>
                    <div>{tr("القاعات المربوطة فعليًا", "Actually Assigned Rooms")}: {selectedExamAssignments.length}</div>
                    <div>
                      {tr("القاعات المتاحة للاختيار", "Available Rooms for Selection")}:{" "}
                      {
                        selectedExamAvailableRooms.filter(
                          (room) => !room.blocked && !room.inactive && !room.sameDateConflict
                        ).length
                      }
                    </div>
                  </div>
                  <div style={tableWrap}>
                    <table style={{ width: "100%", minWidth: 980 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{tr("اختيار", "Select")}</th>
                          <th style={thStyle}>{tr("القاعة", "Room")}</th>
                          <th style={thStyle}>{tr("الكود", "Code")}</th>
                          <th style={thStyle}>{tr("المبنى", "Building")}</th>
                          <th style={thStyle}>{tr("السعة", "Capacity")}</th>
                          <th style={thStyle}>{tr("الحالة", "Status")}</th>
                          <th style={thStyle}>{tr("الملاحظة", "Note")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExamAvailableRooms.map((room) => {
                          const checked = roomManager.selectedRoomIds.includes(room.id);
                          const disabled =
                            !checked &&
                            (
                              room.blocked ||
                              room.inactive ||
                              room.sameDateConflict ||
                              roomManager.selectedRoomIds.length >= selectedExam.roomsCount
                            );

                          return (
                            <tr key={room.id}>
                              <td style={tdStyle}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggleRoomSelection(room.id)}
                                />
                              </td>
                              <td style={tdStyle}>{room.roomName}</td>
                              <td style={tdStyle}>{room.code || "—"}</td>
                              <td style={tdStyle}>{room.building}</td>
                              <td style={tdStyle}>{room.capacity}</td>
                              <td style={tdStyle}>
                                {room.sameDateConflict
                                  ? tr("مرتبطة بمادة أخرى", "Assigned to another subject")
                                  : room.blocked
                                  ? tr("محظورة", "Blocked")
                                  : room.inactive
                                  ? tr("موقوفة", "Inactive")
                                  : tr("متاحة", "Available")}
                              </td>
                              <td style={tdStyle}>
                                {room.sameDateConflict
                                  ? tr(`مرتبطة في نفس التاريخ مع: ${room.sameDateConflictLabel}`, `Assigned on the same date with: ${room.sameDateConflictLabel}`)
                                  : room.blocked
                                  ? tr("يوجد حظر في نفس التاريخ/الفترة", "There is a block on the same date/period")
                                  : room.inactive
                                  ? tr("القاعة غير نشطة", "Room is inactive")
                                  : tr("يمكن ربطها", "Can be assigned")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
                <button style={btn("#10b981", "#07101f")} onClick={saveRoomAssignments}>{tr("حفظ الربط", "Save Assignment")}</button>
                <button style={btn("#1f2937", "#d4af37")} onClick={closeRoomManager}>{tr("إغلاق", "Close")}</button>
              </div>
            </div>
          </div>
        )}

        <div style={header}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 18, lineHeight: 1.2 }}>{APP_NAME}</div>
            <div style={{ fontWeight: 900, opacity: 0.75, marginTop: 4 }}>{tr("جدول الامتحانات", "Exams Schedule")}</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
              {tr("← رجوع", "← Back")}
            </button>
            <button style={btn("#f59e0b", "#07101f")} onClick={startAdd}>
              {tr("+ إضافة", "+ Add")}
            </button>
            <button style={btn("#ef4444", "#07101f")} onClick={deleteAll}>
              {tr("🗑 حذف الجدول كاملًا", "🗑 Delete Entire Table")}
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              style={{ ...inputStyle, maxWidth: 420 }}
              placeholder={tr("بحث...", "Search...")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <button style={btn("#10b981", "#07101f")} onClick={exportExcel}>
              {tr("تصدير Excel", "Export Excel")}
            </button>
            <button style={btn("#22c55e", "#07101f")} onClick={exportCSV}>
              {tr("تصدير CSV", "Export CSV")}
            </button>

            <label style={btn("#60a5fa", "#07101f")}>
              {tr("استيراد CSV ⬆️", "Import CSV ⬆️")}
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCSV(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <label style={btn("#93c5fd", "#07101f")}>
              {tr("استيراد Excel ⬆️", "Import Excel ⬆️")}
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importExcel(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#d4af37" }}>
              {tr("إجمالي", "Total")}: {exams.length} — {tr("المعروض", "Shown")}: {filtered.length}
            </div>
          </div>
        </div>

        {(adding || editingId != null) && (
          <div style={card}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(220px, 1fr))" }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("المادة", "Subject")}</div>
                <GoldDropdown
                  value={current.subject}
                  options={SUBJECT_OPTIONS}
                  placeholder={tr("— اختر المادة —", "— Select Subject —")}
                  onChange={(v) => setCurrent({ subject: v })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("التاريخ", "Date")}</div>
                <input
                  style={inputStyle}
                  type="date"
                  value={current.dateISO}
                  onChange={(e) => {
                    const nextDateISO = e.target.value;
                    setCurrent({
                      dateISO: nextDateISO,
                      dayLabel: nextDateISO ? dayFromISO(nextDateISO, lang) : "",
                    });
                  }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("اليوم", "Day")}</div>
                <input
                  style={inputStyle}
                  placeholder={tr("يُحسب تلقائيًا إن تركت فارغًا", "Calculated automatically if left blank")}
                  value={current.dayLabel}
                  onChange={(e) => setCurrent({ dayLabel: e.target.value })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الوقت", "Time")}</div>
                <input style={inputStyle} value={current.time} onChange={(e) => setCurrent({ time: e.target.value })} />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الفترة", "Period")}</div>
                <GoldDropdown
                  value={current.period}
                  options={PERIOD_OPTIONS}
                  placeholder={tr("— اختر الفترة —", "— Select Period —")}
                  onChange={(v) => setCurrent({ period: v })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("المدة (دقيقة)", "Duration (Minutes)")}</div>
                <input
                  style={inputStyle}
                  type="number"
                  value={String(current.durationMinutes)}
                  onChange={(e) => setCurrent({ durationMinutes: Number(e.target.value) || 0 })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("القاعات", "Rooms")}</div>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  value={String(current.roomsCount)}
                  onChange={(e) => setCurrent({ roomsCount: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {editingId != null ? (
                <>
                  <button style={btn("#10b981", "#07101f")} onClick={saveEdit}>
                    {tr("حفظ التعديل", "Save Changes")}
                  </button>
                  <button style={btn("#1f2937", "#d4af37")} onClick={() => setEditingId(null)}>
                    {tr("إلغاء", "Cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button style={btn("#10b981", "#07101f")} onClick={saveAdd}>
                    {tr("حفظ", "Save")}
                  </button>
                  <button style={btn("#1f2937", "#d4af37")} onClick={() => setAdding(false)}>
                    {tr("إلغاء", "Cancel")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div style={tableFullScreen ? fullScreenOverlay : undefined}>
          <div
            style={{
              ...card,
              height: tableFullScreen ? "100%" : undefined,
              marginBottom: tableFullScreen ? 0 : (card.marginBottom as any),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
                padding: "6px 8px 2px 8px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 1000, fontSize: 22, color: "#f2cf63" }}>{tr("الجدول التنفيذي للامتحانات", "Executive Exams Table")}</div>
                <div style={{ fontWeight: 800, color: "rgba(230,199,106,0.74)", marginTop: 4 }}>
                  {tr("عرض احترافي يوضح المادة والتاريخ والفترة وربط القاعات والإجراءات بصورة مؤسسية أنيقة", "A professional view showing subject, date, period, room assignments, and actions in an elegant institutional format")}
                </div>
              </div>
              <div style={{ fontWeight: 900, color: "#d4af37", opacity: 0.9 }}>
                {tr("عدد الصفوف المعروضة", "Rows Shown")}: {filtered.length}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 1000, color: "#d4af37" }}>📅 {tr("جدول الامتحانات", "Exams Schedule")}</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={btn("#eab308", "#07101f")}
                  onClick={() => setDateSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                >
                  {dateSortOrder === "asc" ? tr("ترتيب التاريخ: تصاعدي ↑", "Date Sort: Ascending ↑") : tr("ترتيب التاريخ: تنازلي ↓", "Date Sort: Descending ↓")}
                </button>

                <button
                  style={btn(tableFullScreen ? "#334155" : "#f59e0b", tableFullScreen ? "#e6c76a" : "#0b1220")}
                  onClick={() => setTableFullScreen((v) => !v)}
                >
                  {tableFullScreen ? tr("⤢ إغلاق ملء الشاشة", "⤢ Exit Fullscreen") : tr("⤢ ملء الشاشة", "⤢ Fullscreen")}
                </button>
              </div>
            </div>

            <div
              className="examTable3D"
              style={{
                ...tableWrap,
                maxHeight: tableFullScreen ? "calc(100vh - 140px)" : (tableWrap.maxHeight as any),
              }}
            >
              <table style={{ width: "100%", minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{tr("المادة", "Subject")}</th>
                    <th style={thStyle} className="col-date">
                      {tr("التاريخ", "Date")}
                    </th>
                    <th style={thStyle}>{tr("اليوم", "Day")}</th>
                    <th style={thStyle}>{tr("الوقت", "Time")}</th>
                    <th style={thStyle}>{tr("الفترة", "Period")}</th>
                    <th style={thStyle}>{tr("القاعات", "Rooms")}</th>
                    <th style={thStyle}>{tr("إجراءات", "Actions")}</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td style={tdStyle} colSpan={7}>
                        {tr("لا توجد بيانات.", "No data found.")}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((e) => (
                      <tr key={e.id} className={e.dateISO === todayISO ? "row-today" : undefined}>
                        <td style={tdStyle}>{lang === "ar" ? e.subject : translateSubject(e.subject)}</td>
                        <td style={tdStyle} className="col-date">
                          {e.dateISO}
                        </td>
                        <td style={tdStyle}>{e.dayLabel || dayFromISO(e.dateISO, lang)}</td>
                        <td style={tdStyle}>{e.time}</td>
                        <td style={tdStyle}>
                          {e.period === "الفترة الأولى" ? tr("الفترة الأولى", "First Period") : e.period === "الفترة الثانية" ? tr("الفترة الثانية", "Second Period") : e.period}
                        </td>
                        <td style={tdStyle}>
                          {(() => {
                            const assigned = assignmentsByExamId.get(e.id) || [];
                            const blockedAssigned = assigned.filter((row) =>
                              isRoomBlockedForExam(row.roomId, e, activeBlocks)
                            ).length;
                            const complete = assigned.length === e.roomsCount && blockedAssigned === 0;
                            return (
                              <button
                                style={{
                                  ...btn(
                                    complete ? "#10b981" : assigned.length === 0 ? "#ef4444" : "#f59e0b",
                                    "#07101f"
                                  ),
                                  padding: "8px 12px",
                                }}
                                onClick={() => openRoomManager(e)}
                                title={blockedAssigned > 0 ? tr(`يوجد ${blockedAssigned} قاعات محظورة ضمن الربط الحالي`, `There are ${blockedAssigned} blocked rooms in the current assignment`) : tr("إدارة ربط القاعات", "Manage room assignments")}
                              >
                                {assigned.length} / {e.roomsCount}
                              </button>
                            );
                          })()}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={btn("#60a5fa", "#07101f")} onClick={() => startEditById(e.id)}>
                              {tr("✏️ تعديل", "✏️ Edit")}
                            </button>
                            <button style={btn("#ef4444", "#07101f")} onClick={() => removeExamById(e.id)}>
                              {tr("🗑 حذف", "🗑 Delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
