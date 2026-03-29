import React, { useEffect, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { type Exam } from "../services/exams.service";
import type { Room } from "../services/rooms.service";
import { useAuth } from "../auth/AuthContext";
import { useExamsData } from "../hooks/useExamsData";
import { useRoomsData } from "../hooks/useRoomsData";
import { useRoomBlocksData } from "../hooks/useRoomBlocksData";
import { useExamRoomAssignmentsData } from "../hooks/useExamRoomAssignmentsData";
import { createId, isRoomBlockedForExam } from "../lib/roomScheduling";

const APP_NAME = "نظام إدارة الامتحانات المطوّر";
const SUBCOLLECTION = "exams";

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

const SUBJECT_OPTIONS = SUBJECT_OPTIONS_RAW.map((s) => ({
  value: s,
  label: s || "— اختر المادة —",
}));

const PERIOD_OPTIONS = [
  { value: "الفترة الأولى", label: "الفترة الأولى" },
  { value: "الفترة الثانية", label: "الفترة الثانية" },
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

function toCSV(rows: Exam[]) {
  const header = ["المادة", "التاريخ", "اليوم", "الوقت", "المدة", "الفترة", "القاعات"];
  const escape = (s: string) => {
    const v = (s ?? "").replace(/\r?\n/g, " ").trim();
    if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [
    header.join(","),
    ...rows.map((e) =>
      [
        e.subject,
        e.dateISO,
        e.dayLabel,
        e.time,
        String(e.durationMinutes),
        e.period,
        String(e.roomsCount),
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
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

function dayFromISO(iso: string) {
  try {
    const d = new Date(iso + "T00:00:00");
    const w = d.getDay();
    const ar = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return ar[w] || "";
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

function fixExam(e: Exam): Exam {
  const rooms = Number(e.roomsCount) || 1;
  return {
    ...e,
    id: e.id || genId(),
    subject: String(e.subject || "").trim(),
    dateISO: String(e.dateISO || "").trim(),
    dayLabel: String(e.dayLabel || "").trim() || dayFromISO(e.dateISO),
    period: String(e.period || "").trim() || "الفترة الأولى",
    time: String(e.time || "").trim() || "08:00",
    durationMinutes: Number(e.durationMinutes) || 120,
    roomsCount: rooms < 1 ? 1 : rooms,
  };
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

export default function Exams() {
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
  const { examRoomAssignments, setExamRoomAssignments } = useExamRoomAssignmentsData();
  const [roomManager, setRoomManager] = useState<RoomManagerState>({ open: false, examId: "", selectedRoomIds: [] });

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (tableFullScreen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tableFullScreen]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .examTable3D {
        position: relative;
        background: linear-gradient(145deg, #111, #1a1a1a);
        border-radius: 16px;
        padding: 12px;
        box-shadow: 0 18px 35px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.05);
        overflow: hidden;
      }

      .examTable3D table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 8px;
      }

      .examTable3D th,
      .examTable3D td {
        border-right: 2px solid rgba(184,134,11,0.95) !important;
      }
      .examTable3D th:last-child,
      .examTable3D td:last-child {
        border-right: none !important;
      }

      .examTable3D thead th {
        background: linear-gradient(180deg,#6e5200,#4a3600) !important;
        color: #fff1c4 !important;
        border-bottom: 1px solid rgba(212,175,55,0.35) !important;
        border-radius: 12px;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 14px rgba(0,0,0,0.55);
      }

      .examTable3D tbody td {
        background: linear-gradient(145deg,#181818,#101010) !important;
        color: #d4af37 !important;
        border-bottom: none !important;
        border-radius: 14px;
        box-shadow: 0 10px 22px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06);
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
      }

      .examTable3D tbody tr:hover td {
        transform: translateY(-3px);
        box-shadow: 0 14px 30px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.10);
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
  }, []);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

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
    if (!selectedExam) return [] as (Room & { blocked: boolean; inactive: boolean })[];
    return rooms.map((room) => ({
      ...room,
      blocked: isRoomBlockedForExam(room.id, selectedExam, activeBlocks),
      inactive: (room.status || "active") !== "active",
    }));
  }, [rooms, selectedExam, activeBlocks]);

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
    if (!e.subject.trim()) return "المادة مطلوبة.";
    if (!e.dateISO.trim()) return "التاريخ مطلوب.";
    if (!e.time.trim()) return "الوقت مطلوب.";
    if (!e.durationMinutes || e.durationMinutes <= 0) return "المدة مطلوبة.";
    if (!e.period.trim()) return "الفترة مطلوبة.";
    if (!e.roomsCount || e.roomsCount <= 0) return "عدد القاعات مطلوب.";
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

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setRow({ ...emptyExam, id: genId() });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveAdd() {
    const msg = validateExam(row);
    if (msg) return alert(msg);

    const fixed = fixExam({ ...row, dayLabel: row.dayLabel.trim() || dayFromISO(row.dateISO) });

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

    const fixed = fixExam({ ...edit, id: editingId, dayLabel: edit.dayLabel.trim() || dayFromISO(edit.dateISO) });

    const dups = findSubjectDuplicates(fixed.subject, editingId);
    if (dups.length) {
      return openDupModal(fixed.subject, editingId, fixed, "edit");
    }

    setExams((prev) => prev.map((x) => (x.id === editingId ? fixed : x)).sort(sortExams));
    setEditingId(null);
    setEdit({ ...emptyExam, id: "" });
  }

  function removeExamById(id: string) {
    if (!confirm("هل تريد حذف هذا الامتحان؟")) return;
    setExams((prev) => prev.filter((x) => x.id !== id));
    setExamRoomAssignments((prev) => prev.filter((row) => row.examId !== id));
  }

  function deleteAll() {
    if (!exams.length) return;
    const ok = confirm("⚠️ هل أنت متأكد من حذف جدول الامتحانات كاملًا؟ لا يمكن التراجع.");
    if (!ok) return;
    setExams([]);
    setExamRoomAssignments([]);
  }

  function exportCSV() {
    downloadText("exams.csv", toCSV(exams));
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = exams.map((e) => ({
        المادة: e.subject,
        التاريخ: e.dateISO,
        اليوم: e.dayLabel,
        الوقت: e.time,
        المدة: e.durationMinutes,
        الفترة: e.period,
        القاعات: e.roomsCount,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exams");
      XLSX.writeFile(wb, "exams.xlsx");
    } catch {
      alert("مكتبة xlsx غير متوفرة. استخدم تصدير CSV أو ثبّت xlsx.");
    }
  }

  async function importExcel(file: File) {
    const json = await tryReadExcel(file);
    if (!json) {
      alert("تعذر قراءة Excel. تأكد من وجود مكتبة xlsx أو استخدم CSV.");
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
    alert("✅ تم استيراد البيانات.");
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
    alert("✅ تم استيراد البيانات.");
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

  function saveRoomAssignments() {
    if (!selectedExam) return;
    const required = Math.max(1, Number(selectedExam.roomsCount) || 1);
    const selectedSet = new Set(roomManager.selectedRoomIds);
    if (selectedSet.size > required) {
      alert(`لا يمكن ربط أكثر من ${required} قاعات لهذا الامتحان.`);
      return;
    }
    const invalid = selectedExamAvailableRooms.find((room) => selectedSet.has(room.id) && (room.blocked || room.inactive));
    if (invalid) {
      alert(`القاعات المحظورة أو الموقوفة لا يمكن ربطها: ${invalid.roomName}`);
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
    setExamRoomAssignments(next);
    closeRoomManager();
  }

  const pageStyle: React.CSSProperties = { padding: 16, color: "#e6c76a" };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "linear-gradient(135deg, #f1d27a, #d4af37, #b8962e)",
    color: "#0b1220",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 14px 60px rgba(212,175,55,0.25)",
    marginBottom: 14,
  };

  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, #0b1220, #09101d)",
    border: "1px solid rgba(212,175,55,0.15)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 14,
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
    background: "#0b1220",
    color: "#e6c76a",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
  };

  const tableWrap: React.CSSProperties = {
    maxHeight: "55vh",
    overflow: "auto",
    borderRadius: 16,
    border: "1px solid rgba(212,175,55,0.12)",
  };

  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "#0b1220",
    color: "#d4af37",
    zIndex: 2,
    padding: 10,
    textAlign: "right",
    fontWeight: 900,
    borderBottom: "1px solid rgba(212,175,55,0.2)",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: 10,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    whiteSpace: "nowrap",
    color: "#e6c76a",
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
    width: "min(720px, 96vw)",
    background: "linear-gradient(180deg, #0b1220, #09101d)",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 22px 80px rgba(0,0,0,0.55)",
    color: "#e6c76a",
  };

  return (
    <div style={pageStyle} ref={topRef}>
      {dupModal.open && (
        <div style={modalOverlay} onClick={() => resolveDuplicate("change")}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 8, color: "#d4af37" }}>⚠️ المادة مكررة</div>
            <div style={{ opacity: 0.95, marginBottom: 12, lineHeight: 1.8 }}>
              المادة <b>{dupModal.subject}</b> موجودة بالفعل.
              <br />
              إمّا تغيّر المادة، أو تختار واحدة من المواد المكررة لاستبدالها بالبيانات الحالية.
            </div>

            <div style={{ border: "1px solid rgba(212,175,55,0.18)", borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, position: "static" }}>المادة</th>
                    <th style={{ ...thStyle, position: "static" }}>التاريخ</th>
                    <th style={{ ...thStyle, position: "static" }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {dupModal.candidates.map((c) => (
                    <tr key={c.id}>
                      <td style={tdStyle}>{c.subject}</td>
                      <td style={tdStyle}>{c.dateISO}</td>
                      <td style={tdStyle}>
                        <button style={btn("#f59e0b", "#07101f")} onClick={() => resolveDuplicate("overwrite", c.id)}>
                          استبدال هذا السجل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button style={btn("#1f2937", "#d4af37")} onClick={() => resolveDuplicate("change")}>
                تغيير المادة
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
                <div style={{ fontWeight: 1000, fontSize: 18, color: "#d4af37" }}>إدارة قاعات الامتحان</div>
                <div style={{ opacity: 0.85 }}>
                  {selectedExam.subject} — {selectedExam.dateISO} — {selectedExam.period}
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
              <div style={{ ...card, marginBottom: 12 }}>لا توجد قاعات مسجلة في النظام. أدخل القاعات أولًا ثم ارجع لتخصيصها.</div>
            ) : (
              <>
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>الحالة الحالية</div>
                  <div>القاعات المطلوبة: {selectedExam.roomsCount}</div>
                  <div>القاعات المربوطة فعليًا: {selectedExamAssignments.length}</div>
                  <div>القاعات المتاحة للاختيار: {selectedExamAvailableRooms.filter((room) => !room.blocked && !room.inactive).length}</div>
                </div>
                <div style={tableWrap}>
                  <table style={{ width: "100%", minWidth: 860 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>اختيار</th>
                        <th style={thStyle}>القاعة</th>
                        <th style={thStyle}>الكود</th>
                        <th style={thStyle}>المبنى</th>
                        <th style={thStyle}>السعة</th>
                        <th style={thStyle}>الحالة</th>
                        <th style={thStyle}>الملاحظة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedExamAvailableRooms.map((room) => {
                        const checked = roomManager.selectedRoomIds.includes(room.id);
                        const disabled =
                          room.blocked ||
                          room.inactive ||
                          (!checked && roomManager.selectedRoomIds.length >= selectedExam.roomsCount);
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
                            <td style={tdStyle}>{room.blocked ? "محظورة" : room.inactive ? "موقوفة" : "متاحة"}</td>
                            <td style={tdStyle}>
                              {room.blocked
                                ? "يوجد حظر في نفس التاريخ/الفترة"
                                : room.inactive
                                ? "القاعة غير نشطة"
                                : "يمكن ربطها"}
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
              <button style={btn("#10b981", "#07101f")} onClick={saveRoomAssignments}>حفظ الربط</button>
              <button style={btn("#1f2937", "#d4af37")} onClick={closeRoomManager}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      <div style={header}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 1000, fontSize: 18, lineHeight: 1.2 }}>{APP_NAME}</div>
          <div style={{ fontWeight: 900, opacity: 0.75, marginTop: 4 }}>جدول الامتحانات</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
            ← رجوع
          </button>
          <button style={btn("#f59e0b", "#07101f")} onClick={startAdd}>
            + إضافة
          </button>
          <button style={btn("#ef4444", "#07101f")} onClick={deleteAll}>
            🗑 حذف الجدول كاملًا
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, maxWidth: 420 }}
            placeholder="بحث..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button style={btn("#10b981", "#07101f")} onClick={exportExcel}>
            تصدير Excel
          </button>
          <button style={btn("#22c55e", "#07101f")} onClick={exportCSV}>
            تصدير CSV
          </button>

          <label style={btn("#60a5fa", "#07101f")}>
            استيراد CSV ⬆️
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
            استيراد Excel ⬆️
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
            إجمالي: {exams.length} — المعروض: {filtered.length}
          </div>
        </div>
      </div>

      {(adding || editingId != null) && (
        <div style={card}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(220px, 1fr))" }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>المادة</div>
              <GoldDropdown
                value={current.subject}
                options={SUBJECT_OPTIONS}
                placeholder="— اختر المادة —"
                onChange={(v) => setCurrent({ subject: v })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>التاريخ</div>
              <input
                style={inputStyle}
                type="date"
                value={current.dateISO}
                onChange={(e) => setCurrent({ dateISO: e.target.value })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>اليوم</div>
              <input
                style={inputStyle}
                placeholder="يُحسب تلقائيًا إن تركت فارغًا"
                value={current.dayLabel}
                onChange={(e) => setCurrent({ dayLabel: e.target.value })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>الوقت</div>
              <input style={inputStyle} value={current.time} onChange={(e) => setCurrent({ time: e.target.value })} />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>الفترة</div>
              <GoldDropdown
                value={current.period}
                options={PERIOD_OPTIONS}
                placeholder="— اختر الفترة —"
                onChange={(v) => setCurrent({ period: v })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>المدة (دقيقة)</div>
              <input
                style={inputStyle}
                type="number"
                value={String(current.durationMinutes)}
                onChange={(e) => setCurrent({ durationMinutes: Number(e.target.value) || 0 })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>القاعات</div>
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
                  حفظ التعديل
                </button>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setEditingId(null)}>
                  إلغاء
                </button>
              </>
            ) : (
              <>
                <button style={btn("#10b981", "#07101f")} onClick={saveAdd}>
                  حفظ
                </button>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setAdding(false)}>
                  إلغاء
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
              gap: 10,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 1000, color: "#d4af37" }}>📅 جدول الامتحانات</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={btn("#eab308", "#07101f")}
                onClick={() => setDateSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              >
                {dateSortOrder === "asc" ? "ترتيب التاريخ: تصاعدي ↑" : "ترتيب التاريخ: تنازلي ↓"}
              </button>

              <button
                style={btn(tableFullScreen ? "#334155" : "#f59e0b", tableFullScreen ? "#e6c76a" : "#0b1220")}
                onClick={() => setTableFullScreen((v) => !v)}
              >
                {tableFullScreen ? "⤢ إغلاق ملء الشاشة" : "⤢ ملء الشاشة"}
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
                  <th style={thStyle}>المادة</th>
                  <th style={thStyle} className="col-date">
                    التاريخ
                  </th>
                  <th style={thStyle}>اليوم</th>
                  <th style={thStyle}>الوقت</th>
                  <th style={thStyle}>الفترة</th>
                  <th style={thStyle}>القاعات</th>
                  <th style={thStyle}>إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={7}>
                      لا توجد بيانات.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id} className={e.dateISO === todayISO ? "row-today" : undefined}>
                      <td style={tdStyle}>{e.subject}</td>
                      <td style={tdStyle} className="col-date">
                        {e.dateISO}
                      </td>
                      <td style={tdStyle}>{e.dayLabel}</td>
                      <td style={tdStyle}>{e.time}</td>
                      <td style={tdStyle}>{e.period}</td>
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
                              title={blockedAssigned > 0 ? `يوجد ${blockedAssigned} قاعات محظورة ضمن الربط الحالي` : "إدارة ربط القاعات"}
                            >
                              {assigned.length} / {e.roomsCount}
                            </button>
                          );
                        })()}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={btn("#60a5fa", "#07101f")} onClick={() => startEditById(e.id)}>
                            ✏️ تعديل
                          </button>
                          <button style={btn("#ef4444", "#07101f")} onClick={() => removeExamById(e.id)}>
                            🗑 حذف
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
  );
}