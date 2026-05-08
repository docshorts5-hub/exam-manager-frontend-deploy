import React, { useEffect, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { type Teacher } from "../services/teachers.service";
import { useTeachersData } from "../hooks/useTeachersData";
import { useI18n } from "../i18n/I18nProvider";

const SUBCOLLECTION = "teachers";

// ✅ قائمة المواد
const SUBJECT_OPTIONS_RAW = [
  "",
  "التربية الإسلامية 5","التربية الإسلامية 6","التربية الإسلامية 7","التربية الإسلامية 8","التربية الإسلامية 9","التربية الإسلامية 10","التربية الإسلامية 11","التربية الإسلامية 12",
  "اللغة العربية 6","اللغة العربية 7","اللغة العربية 8","اللغة العربية 9","اللغة العربية 10","اللغة العربية 11","اللغة العربية 12",
  "اللغة الإنجليزية 6","اللغة الإنجليزية 7","اللغة الإنجليزية 8","اللغة الإنجليزية 9","اللغة الإنجليزية 10","اللغة الإنجليزية 11","اللغة الإنجليزية 12",
  "الرياضيات 5","الرياضيات 6","الرياضيات 7","الرياضيات 8","الرياضيات 9","الرياضيات 10","الرياضيات 11","الرياضيات 12",
  "الرياضيات الأساسية 11","الرياضيات المتقدمة 11",
  "الرياضيات الأساسية 12","الرياضيات المتقدمة 12",
  "الدراسات الاجتماعية 5","الدراسات الاجتماعية 6","الدراسات الاجتماعية 7","الدراسات الاجتماعية 8","الدراسات الاجتماعية 9","الدراسات الاجتماعية 10",
  "التاريخ والحضارة الإسلامية 11","الجغرافيا البشرية 11","هذا وطني 11",
  "التاريخ والحضارة الإسلامية 12","الجغرافيا البشرية 12","هذا وطني 12",
  "العلوم 5","العلوم 6","العلوم 7","العلوم 8",
  "الفيزياء 9","الفيزياء 10","الفيزياء 11","الفيزياء 12",
  "الكيمياء 9","الكيمياء 10","الكيمياء 11","الكيمياء 12",
  "الأحياء 9","الأحياء 10","الأحياء 11","الأحياء 12",
  "الرياضة المدرسية 11","الفنون التشكيلية 11","المهارات الموسيقية 11",
  "الرياضة المدرسية 12","الفنون التشكيلية 12","المهارات الموسيقية 12",
  "مواد التخصصات الهندسية والصناعية 12",
  "مهارات اللغة الإنجليزية 11","مهارات اللغة الإنجليزية 12",
  "تقنية المعلومات 11","تقنية المعلومات 12",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات 12",
  "اللغة الفرنسية 10","اللغة الألمانية 10","اللغة الصينية 10",
  "اللغة الفرنسية 11","اللغة الألمانية 11","اللغة الصينية 11",
  "اللغة الفرنسية 12","اللغة الألمانية 12","اللغة الصينية 12",
  "العلوم البيئية 11","العلوم البيئية 12",
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

const emptyTeacher: Teacher = {
  id: "",
  employeeNo: "",
  fullName: "",
  subject1: "",
  subject2: "",
  subject3: "",
  subject4: "",
  grades: "",
  phone: "",
  notes: "",
};

function genId() {
  // ✅ متوافق مع المتصفحات الحديثة + fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis as any;
  if (c?.crypto?.randomUUID) return c.crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParseTeachers(v: string | null): Teacher[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        id: String(x.id ?? "").trim() || genId(),
        employeeNo: String(x.employeeNo ?? "").trim(),
        fullName: String(x.fullName ?? "").trim(),
        subject1: String(x.subject1 ?? "").trim(),
        subject2: String(x.subject2 ?? "").trim(),
        subject3: String(x.subject3 ?? "").trim(),
        subject4: String(x.subject4 ?? "").trim(),
        grades: String(x.grades ?? "").trim(),
        phone: String(x.phone ?? "").trim(),
        notes: String(x.notes ?? "").trim(),
      }))
      .filter((t) => t.employeeNo || t.fullName);
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

function parseTeachersFromObjects(rows: any[]): Teacher[] {
  return rows
    .map((r) => {
      const fullName = getCell(r, ["الاسم الكامل", "الاسم", "الاسماء", "fullname", "name"]);
      const employeeNo = getCell(r, ["الرقم الوظيفي", "رقم وظيفي", "employeeNo", "employeeno", "id"]);
      const subject1 = getCell(r, ["المادة 1", "المادة1", "المادة الأولى", "المادة الاولى", "subject1"]);
      const subject2 = getCell(r, ["المادة 2", "المادة2", "المادة الثانية", "المادة الثانيه", "subject2"]);
      const subject3 = getCell(r, ["المادة 3", "المادة3", "المادة الثالثة", "المادة الثالثه", "subject3"]);
      const subject4 = getCell(r, ["المادة 4", "المادة4", "المادة الرابعة", "المادة الرابعه", "subject4"]);
      const grades = getCell(r, ["الصفوف", "الصف", "grades", "grade"]);
      const phone = getCell(r, ["رقم الهاتف", "الهاتف", "الجوال", "رقم الجوال", "phone", "mobile"]);
      const notes = getCell(r, ["ملاحظات", "notes", "note"]);

      return {
        id: genId(),
        employeeNo: employeeNo.trim(),
        fullName: fullName.trim(),
        subject1: subject1.trim(),
        subject2: subject2.trim(),
        subject3: subject3.trim(),
        subject4: subject4.trim(),
        grades: grades.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      } as Teacher;
    })
    .filter((t) => t.employeeNo || t.fullName);
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
      } else {
        inQ = !inQ;
      }
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

type DupModalState = {
  open: boolean;
  employeeNo: string;
  candidates: Teacher[];
  pending: Teacher;
  context: "add" | "edit";
};

export default function Teachers() {
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const translateSubject = (s: string) => (lang === "ar" ? s : SUBJECT_TRANSLATIONS[s] || s);

  const SUBJECT_OPTIONS = useMemo(
    () =>
      SUBJECT_OPTIONS_RAW.map((s) => ({
        value: s,
        label: s ? translateSubject(s) : tr("— اختر المادة —", "— Select Subject —"),
      })),
    [lang]
  );

  const { tenantId, teachers, setTeachers } = useTeachersData();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTeacher, setNewTeacher] = useState<Teacher>({ ...emptyTeacher, id: genId() });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Teacher>({ ...emptyTeacher, id: "" });

  const [dupModal, setDupModal] = useState<DupModalState>({
    open: false,
    employeeNo: "",
    candidates: [],
    pending: { ...emptyTeacher, id: "" },
    context: "add",
  });

  const topRef = useRef<HTMLDivElement>(null);
  const [tableFullScreen, setTableFullScreen] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes teachersShine {
        0%, 88% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
        90% { opacity: 1; }
        100% { transform: translateX(240%) skewX(-12deg); opacity: 0.9; }
      }

      .teachersTable3D { position: relative; }
      .teachersTable3D::before {
        content: "";
        position: absolute;
        top: 0;
        left: -120%;
        width: 60%;
        height: 100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%);
        transform: skewX(-12deg);
        animation: teachersShine 10s infinite;
        pointer-events: none;
        z-index: 1;
      }
      .teachersTable3D table { position: relative; z-index: 2; }

      .teachersTable3D th,
      .teachersTable3D td {
        border-color: #d4af37 !important;
      }

      .teachersTable3D td { transition: transform .18s ease, filter .18s ease; }
      .teachersTable3D td:hover {
        transform: translateY(-2px);
        filter: brightness(1.04);
      }

      .teachersTable3D .col-name { min-width: 260px; font-weight: 900; color: #fff1c4 !important; }

      .teachersTable3D th.col-emp,
      .teachersTable3D td.col-emp {
        min-width: 200px;
        font-weight: 900;
        background: linear-gradient(180deg,#7a5c00,#4a3600) !important;
        color: #fff1c4 !important;
      }
    `;

    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (tableFullScreen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tableFullScreen]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter((t) =>
      [
        t.fullName,
        t.employeeNo,
        t.subject1,
        t.subject2,
        t.subject3,
        t.subject4,
        t.grades,
        t.phone,
        t.notes,
      ].some((x) => String(x).includes(q))
    );
  }, [teachers, query]);

  function validateBasics(t: Teacher) {
    if (!t.employeeNo.trim()) return { ok: false, msg: tr("الرقم الوظيفي مطلوب.", "Employee number is required.") };
    if (!t.fullName.trim()) return { ok: false, msg: tr("الاسم الكامل مطلوب.", "Full name is required.") };
    return { ok: true, msg: "" };
  }

  function findDuplicates(employeeNo: string, ignoreId?: string | null) {
    const key = employeeNo.trim();
    if (!key) return [];
    return teachers.filter((t) => t.employeeNo.trim() === key && t.id !== ignoreId);
  }

  function openDupModal(employeeNo: string, ignoreId: string | null, pending: Teacher, context: "add" | "edit") {
    const candidates = findDuplicates(employeeNo, ignoreId);
    setDupModal({
      open: true,
      employeeNo: employeeNo.trim(),
      candidates,
      pending,
      context,
    });
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setNewTeacher({ ...emptyTeacher, id: genId() });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveAdd() {
    const basic = validateBasics(newTeacher);
    if (!basic.ok) return alert(basic.msg);

    const dups = findDuplicates(newTeacher.employeeNo, null);
    if (dups.length) {
      return openDupModal(newTeacher.employeeNo, null, { ...newTeacher }, "add");
    }

    setTeachers((prev) => [{ ...newTeacher, id: newTeacher.id || genId() }, ...prev]);
    setAdding(false);
    setNewTeacher({ ...emptyTeacher, id: genId() });
  }

  function startEdit(t: Teacher) {
    setAdding(false);
    setEditingId(t.id);
    setEdit({ ...t });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveEdit() {
    if (!editingId) return;

    const basic = validateBasics(edit);
    if (!basic.ok) return alert(basic.msg);

    const dups = findDuplicates(edit.employeeNo, editingId);
    if (dups.length) {
      return openDupModal(edit.employeeNo, editingId, { ...edit }, "edit");
    }

    setTeachers((prev) => prev.map((t) => (t.id === editingId ? { ...edit, id: editingId } : t)));
    setEditingId(null);
    setEdit({ ...emptyTeacher, id: "" });
  }

  function removeTeacher(id: string) {
    if (!confirm(tr("هل تريد حذف هذا المعلم؟", "Do you want to delete this teacher?"))) return;
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  }

  function deleteAll() {
    if (!teachers.length) return;
    const ok = confirm(
      tr(
        "⚠️ هل أنت متأكد من حذف جدول الكادر التعليمي كاملًا؟ لا يمكن التراجع.",
        "⚠️ Are you sure you want to delete the entire teaching staff table? This cannot be undone."
      )
    );
    if (!ok) return;
    setTeachers([]);
  }

  function toCSV(rows: Teacher[]) {
    const header =
      lang === "ar"
        ? ["الاسم الكامل", "الرقم الوظيفي", "المادة 1", "المادة 2", "المادة 3", "المادة 4", "الصفوف", "رقم الهاتف", "ملاحظات"]
        : ["Full Name", "Employee Number", "Subject 1", "Subject 2", "Subject 3", "Subject 4", "Grades", "Phone Number", "Notes"];

    const escape = (s: string) => {
      const v = (s ?? "").replace(/\r?\n/g, " ").trim();
      if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };

    const lines = [
      header.join(","),
      ...rows.map((t) =>
        [
          t.fullName,
          t.employeeNo,
          lang === "ar" ? t.subject1 : translateSubject(t.subject1),
          lang === "ar" ? t.subject2 : translateSubject(t.subject2),
          lang === "ar" ? t.subject3 : translateSubject(t.subject3),
          lang === "ar" ? t.subject4 : translateSubject(t.subject4),
          t.grades,
          t.phone,
          t.notes,
        ].map(escape).join(",")
      ),
    ];
    return lines.join("\n");
  }

  function exportCSV() {
    const csv = toCSV(teachers);
    downloadText("teachers.csv", csv);
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = teachers.map((t) =>
        lang === "ar"
          ? {
              "الاسم الكامل": t.fullName,
              "الرقم الوظيفي": t.employeeNo,
              "المادة 1": t.subject1,
              "المادة 2": t.subject2,
              "المادة 3": t.subject3,
              "المادة 4": t.subject4,
              "الصفوف": t.grades,
              "رقم الهاتف": t.phone,
              "ملاحظات": t.notes,
            }
          : {
              "Full Name": t.fullName,
              "Employee Number": t.employeeNo,
              "Subject 1": translateSubject(t.subject1),
              "Subject 2": translateSubject(t.subject2),
              "Subject 3": translateSubject(t.subject3),
              "Subject 4": translateSubject(t.subject4),
              "Grades": t.grades,
              "Phone Number": t.phone,
              "Notes": t.notes,
            }
      );
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Teachers");
      XLSX.writeFile(wb, "teachers.xlsx");
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
    const incoming = parseTeachersFromObjects(json);
    mergeImported(incoming);
  }

  async function importCSV(file: File) {
    const text = await file.text();
    const objs = parseCSV(text);
    const incoming = parseTeachersFromObjects(objs);
    mergeImported(incoming);
  }

  function mergeImported(incoming: Teacher[]) {
    if (!incoming.length) return alert(tr("لا توجد بيانات صالحة للاستيراد.", "No valid data found for import."));

    const existingByNo = new Map(teachers.map((t) => [t.employeeNo.trim(), t]));
    const next = [...teachers];

    for (const t of incoming) {
      const key = t.employeeNo.trim();
      if (!key) continue;

      if (existingByNo.has(key)) {
        const old = existingByNo.get(key)!;
        const ok = confirm(
          tr(
            `⚠️ الرقم الوظيفي (${key}) موجود بالفعل باسم: (${old.fullName}).\nهل تريد استبدال البيانات بالاسم الجديد: (${t.fullName}) ؟`,
            `⚠️ Employee number (${key}) already exists under: (${old.fullName}).\nDo you want to replace it with the new name: (${t.fullName})?`
          )
        );
        if (ok) {
          const idx = next.findIndex((x) => x.id === old.id);
          if (idx >= 0) next[idx] = { ...t, id: old.id };
        }
      } else {
        next.unshift({ ...t, id: t.id || genId() });
      }
    }

    setTeachers(next);
    alert(tr("✅ تم استيراد البيانات.", "✅ Data imported successfully."));
  }

  function resolveDuplicate(action: "change" | "overwrite", selectedId?: string) {
    if (action === "change") {
      setDupModal((s) => ({ ...s, open: false }));
      return;
    }

    if (!selectedId) return;

    const pending = dupModal.pending;

    setTeachers((prev) => prev.map((t) => (t.id === selectedId ? { ...pending, id: selectedId } : t)));

    setDupModal((s) => ({ ...s, open: false }));

    if (dupModal.context === "add") {
      setAdding(false);
      setNewTeacher({ ...emptyTeacher, id: genId() });
    } else {
      setEditingId(null);
      setEdit({ ...emptyTeacher, id: "" });
    }
  }

  const PAGE_BG = "#f7f3e7";
  const CARD_BG = "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)";
  const PANEL_BG = "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)";
  const GOLD_BORDER = "#d4af37";

  const pageStyle: React.CSSProperties = {
    padding: 18,
    color: "#000000",
    minHeight: "100vh",
    background: PAGE_BG,
    position: "relative",
    overflowX: "hidden",
    direction: isRTL ? "rtl" : "ltr",
    boxSizing: "border-box",
  };

  const card: React.CSSProperties = {
    background: CARD_BG,
    border: `5px solid ${GOLD_BORDER}`,
    borderRadius: 30,
    padding: 22,
    boxShadow: "0 0 0 6px rgba(245,232,170,0.35) inset, 0 14px 28px rgba(190,160,40,0.12)",
    marginBottom: 16,
    color: "#000000",
  };

  const btn = (bg: string, fg = "#000000"): React.CSSProperties => ({
    background: bg,
    color: fg,
    border: `3px solid ${GOLD_BORDER}`,
    borderRadius: 16,
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 1000,
    boxShadow: "0 10px 22px rgba(212,175,55,0.18), 0 0 0 2px rgba(255,235,140,0.35) inset",
  });

  const inputStyle: React.CSSProperties = {
    background: "#f8f4e8",
    color: "#000000",
    border: `3px solid ${GOLD_BORDER}`,
    borderRadius: 20,
    padding: "13px 16px",
    outline: "none",
    width: "100%",
    minHeight: 54,
    fontWeight: 1000,
    fontSize: 16,
    boxSizing: "border-box",
    WebkitTextFillColor: "#000000",
    boxShadow: "0 8px 18px rgba(150,120,20,0.08)",
  };

  const tableWrap: React.CSSProperties = {
    maxHeight: "55vh",
    overflow: "auto",
    borderRadius: 24,
    border: `4px solid ${GOLD_BORDER}`,
    background: PANEL_BG,
  };

  const tableStyle3D: React.CSSProperties = {
    width: "100%",
    minWidth: 1250,
    borderCollapse: "separate",
    borderSpacing: 8,
  };

  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
    color: "#000000",
    zIndex: 2,
    padding: 12,
    textAlign: isRTL ? "right" : "left",
    fontWeight: 1000,
    whiteSpace: "nowrap",
    borderRadius: 16,
    border: `3.5px solid ${GOLD_BORDER}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: 12,
    whiteSpace: "nowrap",
    color: "#000000",
    background: "#f8f4e8",
    borderRadius: 16,
    border: `3.5px solid ${GOLD_BORDER}`,
    fontWeight: 900,
  };

  const modalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const modalCard: React.CSSProperties = {
    width: "min(720px, 96vw)",
    background: CARD_BG,
    border: `5px solid ${GOLD_BORDER}`,
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 0 0 6px rgba(245,232,170,0.35) inset, 0 22px 80px rgba(150,120,20,0.18)",
    color: "#000000",
    direction: isRTL ? "rtl" : "ltr",
  };

  return (
    <div style={pageStyle} ref={topRef} className="teachers12PageRoot teachers12PreviousChangesScope">

      <style>{`
        .teachers12PreviousChangesScope table th:first-child,
        .teachers12PreviousChangesScope table td:first-child,
        .teachers12PreviousChangesScope table th:last-child,
        .teachers12PreviousChangesScope table td:last-child {
          color: #000000 !important;
          font-weight: 900 !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
        }

        .teachers12PreviousChangesScope td[style*="color"],
        .teachers12PreviousChangesScope th[style*="color"] {
          color: #000000 !important;
          font-weight: 900 !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
        }
      `}</style>


      <style>{`
        .teachers12PreviousChangesScope,
        .teachers12PreviousChangesScope * {
          color: #000000 !important;
          text-shadow: none !important;
        }

        .teachers12PreviousChangesScope h1,
        .teachers12PreviousChangesScope h2,
        .teachers12PreviousChangesScope h3,
        .teachers12PreviousChangesScope h4,
        .teachers12PreviousChangesScope p,
        .teachers12PreviousChangesScope div,
        .teachers12PreviousChangesScope span,
        .teachers12PreviousChangesScope label,
        .teachers12PreviousChangesScope button,
        .teachers12PreviousChangesScope input,
        .teachers12PreviousChangesScope select,
        .teachers12PreviousChangesScope textarea,
        .teachers12PreviousChangesScope option,
        .teachers12PreviousChangesScope th,
        .teachers12PreviousChangesScope td,
        .teachers12PreviousChangesScope strong,
        .teachers12PreviousChangesScope b {
          color: #000000 !important;
          font-weight: 900 !important;
          text-shadow: none !important;
        }

        .teachers12PreviousChangesScope table th,
        .teachers12PreviousChangesScope table td {
          color: #000000 !important;
          font-weight: 900 !important;
          border-width: 2px !important;
          border-style: solid !important;
          text-shadow: none !important;
        }

        .teachers12PreviousChangesScope table th:nth-child(10n + 1),
        .teachers12PreviousChangesScope table td:nth-child(10n + 1) { border-color: #2563eb !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 2),
        .teachers12PreviousChangesScope table td:nth-child(10n + 2) { border-color: #16a34a !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 3),
        .teachers12PreviousChangesScope table td:nth-child(10n + 3) { border-color: #dc2626 !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 4),
        .teachers12PreviousChangesScope table td:nth-child(10n + 4) { border-color: #9333ea !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 5),
        .teachers12PreviousChangesScope table td:nth-child(10n + 5) { border-color: #ea580c !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 6),
        .teachers12PreviousChangesScope table td:nth-child(10n + 6) { border-color: #0891b2 !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 7),
        .teachers12PreviousChangesScope table td:nth-child(10n + 7) { border-color: #4f46e5 !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 8),
        .teachers12PreviousChangesScope table td:nth-child(10n + 8) { border-color: #db2777 !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 9),
        .teachers12PreviousChangesScope table td:nth-child(10n + 9) { border-color: #ca8a04 !important; }

        .teachers12PreviousChangesScope table th:nth-child(10n + 10),
        .teachers12PreviousChangesScope table td:nth-child(10n + 10) { border-color: #059669 !important; }

        .teachers12PreviousChangesScope div[style*="border"],
        .teachers12PreviousChangesScope button[style*="border"],
        .teachers12PreviousChangesScope section[style*="border"],
        .teachers12PreviousChangesScope article[style*="border"] {
          border-width: 3px !important;
          border-style: solid !important;
        }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 1),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 1) { border-color: #2563eb !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 2),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 2) { border-color: #16a34a !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 3),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 3) { border-color: #dc2626 !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 4),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 4) { border-color: #9333ea !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 5),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 5) { border-color: #ea580c !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 6),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 6) { border-color: #0891b2 !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 7),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 7) { border-color: #4f46e5 !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 8),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 8) { border-color: #db2777 !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 9),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 9) { border-color: #ca8a04 !important; }

        .teachers12PreviousChangesScope div[style*="border"]:nth-of-type(10n + 10),
        .teachers12PreviousChangesScope button[style*="border"]:nth-of-type(10n + 10) { border-color: #059669 !important; }
      `}</style>

      <style>{`
        .teachers12PreviousChangesScope input,
        .teachers12PreviousChangesScope textarea,
        .teachers12PreviousChangesScope select {
          color: #000000 !important;
          font-weight: 900 !important;
          -webkit-text-fill-color: #000000 !important;
          caret-color: #000000 !important;
        }

        .teachers12PreviousChangesScope input::placeholder,
        .teachers12PreviousChangesScope textarea::placeholder {
          color: #000000 !important;
          opacity: 0.75 !important;
          font-weight: 900 !important;
        }

        .teachers12PreviousChangesScope input[name*="name"],
        .teachers12PreviousChangesScope input[id*="name"],
        .teachers12PreviousChangesScope input[placeholder*="اسم"],
        .teachers12PreviousChangesScope input[placeholder*="name"],
        .teachers12PreviousChangesScope input[aria-label*="اسم"],
        .teachers12PreviousChangesScope input[aria-label*="name"] {
          color: #000000 !important;
          font-weight: 900 !important;
          -webkit-text-fill-color: #000000 !important;
          caret-color: #000000 !important;
        }
      `}</style>


      <style>{`
        html,
        body,
        #root {
          margin: 0 !important;
          min-height: 100% !important;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }

        body {
          background-color: #f7f3e7 !important;
        }

        .teachers12PageRoot {
          position: relative;
          z-index: 1;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }

        .teachers12FixedLightBg {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }
      `}</style>
      <div className="teachers12FixedLightBg" aria-hidden="true" />

      {dupModal.open && (
        <div style={modalOverlay} onClick={() => resolveDuplicate("change")}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 8, color: "#000000" }}>
              {tr("⚠️ الرقم الوظيفي مكرر", "⚠️ Duplicate employee number")}
            </div>
            <div style={{ opacity: 0.95, marginBottom: 12, lineHeight: 1.8 }}>
              {tr(
                `الرقم الوظيفي ${dupModal.employeeNo} مستخدم بالفعل.\nإمّا تغيّر الرقم، أو تختار اسم من الموجودين بنفس الرقم لاستبدال بياناته بالبيانات الحالية.`,
                `Employee number ${dupModal.employeeNo} is already in use.\nEither change the number, or choose an existing name with the same number to replace its data with the current data.`
              )}
            </div>

            <div style={{ border: `4px solid ${GOLD_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, position: "static" }}>{tr("الاسم", "Name")}</th>
                    <th style={{ ...thStyle, position: "static" }}>{tr("الرقم", "Number")}</th>
                    <th style={{ ...thStyle, position: "static" }}>{tr("إجراء", "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dupModal.candidates.map((c) => (
                    <tr key={c.id}>
                      <td style={tdStyle}>{c.fullName}</td>
                      <td style={tdStyle}>{c.employeeNo}</td>
                      <td style={tdStyle}>
                        <button
                          style={btn("#f59e0b", "#000000")}
                          onClick={() => resolveDuplicate("overwrite", c.id)}
                        >
                          {tr("استبدال هذا الاسم", "Replace this name")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button style={btn("#fffdf7", "#000000")} onClick={() => resolveDuplicate("change")}>
                {tr("تغيير الرقم", "Change number")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: 1680,
          margin: "0 auto 18px auto",
          display: "grid",
          gap: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
            borderRadius: 40,
            border: "5px solid #d4af37",
            boxShadow: "0 0 0 10px rgba(212,175,55,0.12) inset, 0 18px 38px rgba(150,120,20,0.14)",
            padding: 28,
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
              borderRadius: 36,
              border: "5px solid #d4af37",
              boxShadow: "0 0 0 8px rgba(212,175,55,0.10) inset",
              padding: 26,
            }}
          >
            <div
              style={{
                background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
                borderRadius: 32,
                border: "5px solid #d4af37",
                boxShadow: "0 0 0 6px rgba(212,175,55,0.10) inset",
                padding: 18,
              }}
            >
              <div
                style={{
                  background: "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
                  borderRadius: 28,
                  border: "5px solid #d4af37",
                  padding: 28,
                  display: "grid",
                  gap: 26,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "#fffdf7",
                    border: "5px solid #d4af37",
                    color: "#000000",
                    fontWeight: 1000,
                    fontSize: 20,
                  }}
                >
                  {tr("واجهة تشغيل مخصصة", "Dedicated Operating View")}
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "clamp(46px, 6vw, 70px)",
                      lineHeight: 1.08,
                      fontWeight: 1000,
                      color: "#000000",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {tr("مركز إدارة الكادر التعليمي", "Teaching Staff Management Center")}
                  </h1>

                  <div
                    style={{
                      fontSize: "clamp(22px, 3vw, 34px)",
                      fontWeight: 1000,
                      color: "#000000",
                    }}
                  >
                    {tr("لوحة تحكم إدارة الكادر التعليمي", "Teaching Staff Control Panel")}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 18,
                      lineHeight: 2,
                      color: "#000000",
                      fontWeight: 1000,
                      maxWidth: 1380,
                    }}
                  >
                    {tr(
                      "هذه الصفحة تضبط بيانات المعلمين والمواد والصفوف والاتصال بنفس الهوية المعتمدة لصفحات الدبلوم، بحيث تظهر جميع العناصر بخلفية فاتحة وحدود ذهبية وخط أسود عريض واضح.",
                      "This page manages teachers, subjects, grades, and contact data using the same approved diploma visual identity, so every element appears with a light background, bold golden borders, and clear black text."
                    )}
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 18,
                  }}
                >
                  {[
                    { label: tr("إجمالي المعلمين", "Total Teachers"), value: String(teachers.length) },
                    { label: tr("المعروض الآن", "Currently Shown"), value: String(filtered.length) },
                    { label: tr("البحث الحالي", "Current Search"), value: query.trim() || tr("بدون فلترة", "No Filter") },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
                        border: "4px solid #d4af37",
                        borderRadius: 24,
                        padding: 18,
                        display: "grid",
                        gap: 8,
                        boxShadow: "0 8px 18px rgba(190,160,40,0.10)",
                      }}
                    >
                      <div style={{ fontSize: 18, color: "#000000", fontWeight: 1000 }}>{item.label}</div>
                      <div style={{ fontSize: 22, color: "#000000", fontWeight: 1000 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn("#fffdf7", "#000000")} onClick={() => history.back()}>
            {tr("← رجوع", "← Back")}
          </button>
          <button style={btn("#3b82f6", "#000000")} onClick={startAdd}>
            {tr("+ إضافة معلم جديد", "+ Add New Teacher")}
          </button>
          <button style={btn("#ef4444", "#000000")} onClick={deleteAll}>
            {tr("🗑 حذف الكل", "🗑 Delete All")}
          </button>

          <div style={{ marginInlineStart: "auto", fontWeight: 1000, color: "#000000" }}>
            {tr("إدارة بيانات الكادر التعليمي", "Teaching Staff Data Management")}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, maxWidth: 420 }}
            placeholder={tr("بحث بالاسم أو الرقم الوظيفي...", "Search by name or employee number...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button style={btn("#10b981", "#000000")} onClick={exportExcel}>
            {tr("تصدير Excel", "Export Excel")}
          </button>
          <button style={btn("#22c55e", "#000000")} onClick={exportCSV}>
            {tr("تصدير CSV", "Export CSV")}
          </button>

          <label style={btn("#60a5fa", "#000000")}>
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

          <label style={btn("#93c5fd", "#000000")}>
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

          <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#000000" }}>
            {tr("إجمالي", "Total")}: {teachers.length} — {tr("المعروض", "Shown")}: {filtered.length}
          </div>
        </div>
      </div>

      {(adding || editingId) && (
        <div style={card}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(220px, 1fr))" }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("الاسم الكامل", "Full Name")}</div>
              <input
                style={inputStyle}
                value={adding ? newTeacher.fullName : edit.fullName}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, fullName: e.target.value })
                    : setEdit({ ...edit, fullName: e.target.value })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("الرقم الوظيفي", "Employee Number")}</div>
              <input
                style={inputStyle}
                value={adding ? newTeacher.employeeNo : edit.employeeNo}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, employeeNo: e.target.value })
                    : setEdit({ ...edit, employeeNo: e.target.value })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("المادة 1", "Subject 1")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject1 : edit.subject1}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject1: v }) : setEdit({ ...edit, subject1: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("المادة 2", "Subject 2")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject2 : edit.subject2}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject2: v }) : setEdit({ ...edit, subject2: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("المادة 3", "Subject 3")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject3 : edit.subject3}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject3: v }) : setEdit({ ...edit, subject3: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("المادة 4", "Subject 4")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject4 : edit.subject4}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject4: v }) : setEdit({ ...edit, subject4: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("الصفوف", "Grades")}</div>
              <input
                style={inputStyle}
                placeholder={tr("مثال: 10-5", "Example: 10-5")}
                value={adding ? newTeacher.grades : edit.grades}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, grades: e.target.value })
                    : setEdit({ ...edit, grades: e.target.value })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("الهاتف", "Phone")}</div>
              <input
                style={inputStyle}
                value={adding ? newTeacher.phone : edit.phone}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, phone: e.target.value })
                    : setEdit({ ...edit, phone: e.target.value })
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("ملاحظات", "Notes")}</div>
              <textarea
                style={{ ...inputStyle, minHeight: 80 }}
                value={adding ? newTeacher.notes : edit.notes}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, notes: e.target.value })
                    : setEdit({ ...edit, notes: e.target.value })
                }
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {adding ? (
              <>
                <button style={btn("#10b981", "#000000")} onClick={saveAdd}>
                  {tr("حفظ", "Save")}
                </button>
                <button style={btn("#fffdf7", "#000000")} onClick={() => setAdding(false)}>
                  {tr("إلغاء", "Cancel")}
                </button>
              </>
            ) : (
              <>
                <button style={btn("#10b981", "#000000")} onClick={saveEdit}>
                  {tr("حفظ التعديل", "Save Changes")}
                </button>
                <button style={btn("#fffdf7", "#000000")} onClick={() => setEditingId(null)}>
                  {tr("إلغاء", "Cancel")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div
        style={
          tableFullScreen
            ? {
                ...card,
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 9999,
                marginBottom: 0,
                borderRadius: 0,
                padding: 12,
                background: PAGE_BG,
                overflow: "hidden",
                border: `5px solid ${GOLD_BORDER}`,
                boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
              }
            : card
        }
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, color: "#000000" }}>{tr("قائمة الكادر التعليمي", "Teaching Staff List")}</div>

          <button
            style={btn(tableFullScreen ? "#ef4444" : "#fffdf7", "#000000")}
            onClick={() => setTableFullScreen((v) => !v)}
            title={tableFullScreen ? tr("عودة للحجم الطبيعي", "Return to normal size") : tr("تكبير الجدول ملء الشاشة", "Fullscreen table")}
          >
            {tableFullScreen ? tr("إغلاق ملء الشاشة", "Exit Fullscreen") : tr("ملء الشاشة", "Fullscreen")}
          </button>
        </div>

        <div
          className="teachersTable3D"
          style={
            tableFullScreen
              ? {
                  height: "calc(100vh - 70px)",
                  overflow: "auto",
                  borderRadius: 16,
                  border: `4px solid ${GOLD_BORDER}`,
                  position: "relative",
                }
              : {
                  ...tableWrap,
                  position: "relative",
                }
          }
        >
          <table style={tableStyle3D}>
            <thead>
              <tr>
                <th style={thStyle} className="col-name">{tr("الاسم الكامل", "Full Name")}</th>
                <th style={thStyle} className="col-emp">{tr("الرقم الوظيفي", "Employee Number")}</th>
                <th style={thStyle}>{tr("المادة 1", "Subject 1")}</th>
                <th style={thStyle}>{tr("المادة 2", "Subject 2")}</th>
                <th style={thStyle}>{tr("المادة 3", "Subject 3")}</th>
                <th style={thStyle}>{tr("المادة 4", "Subject 4")}</th>
                <th style={thStyle}>{tr("الصفوف", "Grades")}</th>
                <th style={thStyle}>{tr("الهاتف", "Phone")}</th>
                <th style={thStyle}>{tr("ملاحظات", "Notes")}</th>
                <th style={thStyle}>{tr("إجراءات", "Actions")}</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={10}>
                    {tr("لا توجد بيانات.", "No data found.")}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id}>
                    <td style={{ ...tdStyle, color: "#000000", fontWeight: 1000 }} className="col-name"><span style={{ color: "#000000", fontWeight: 900, WebkitTextFillColor: "#000000", textShadow: "none" }}>{t.fullName}</span></td>
                    <td style={tdStyle} className="col-emp">{t.employeeNo}</td>
                    <td style={tdStyle}>{translateSubject(t.subject1)}</td>
                    <td style={tdStyle}>{translateSubject(t.subject2)}</td>
                    <td style={tdStyle}>{translateSubject(t.subject3)}</td>
                    <td style={tdStyle}>{translateSubject(t.subject4)}</td>
                    <td style={tdStyle}>{t.grades}</td>
                    <td style={tdStyle}>{t.phone}</td>
                    <td style={tdStyle} title={t.notes}>{t.notes}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={btn("#60a5fa", "#000000")} onClick={() => startEdit(t)}>
                          {tr("✏️ تعديل", "✏️ Edit")}
                        </button>
                        <button style={btn("#ef4444", "#000000")} onClick={() => removeTeacher(t.id)}>
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
  );
}