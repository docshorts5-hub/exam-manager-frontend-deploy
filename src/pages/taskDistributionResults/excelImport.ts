// src/pages/taskDistributionResults/excelImport.ts
import type { Assignment } from "../../contracts/taskDistributionContract";
import {
  buildExamLookupFromStorage,
  inferBaseYearFromRun,
  mapPeriodFromText,
  mapTaskTypeFromText,
  normKey,
  parseCommitteesCountFromExamHeaderCell,
  parseMatrixCellToAssignments,
  parseMaybeDateToISO,
  shiftWeekendToSunday,
} from "./excelHelpers";

import { normalizeSubject } from "./taskUtils";

export async function parseExcelToAssignments(file: File, currentRun: any): Promise<Assignment[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const pickSheetName = () => {
    const preferred =
      wb.SheetNames.find((n) => String(n).includes("الجدول") || String(n).includes("الشامل")) || wb.SheetNames?.[0];
    if (!preferred) return "";
    return preferred;
  };

  const sheetName = pickSheetName();
  if (!sheetName) throw new Error("ملف Excel لا يحتوي على Sheets.");

  const ws = wb.Sheets[sheetName];
  if (!ws["!ref"]) throw new Error("Sheet بدون نطاق (!ref).");

  const range = XLSX.utils.decode_range(ws["!ref"]);

  // اقرأ الشبكة كاملة
  const grid: any[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: any[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[addr];
      const v = cell ? (cell.v ?? cell.w ?? "") : "";
      row.push(v);
    }
    grid.push(row);
  }

  // املأ الدمج
  const merges = (ws as any)["!merges"] || [];
  for (const m of merges) {
    const r1 = m.s.r - range.s.r;
    const c1 = m.s.c - range.s.c;
    const r2 = m.e.r - range.s.r;
    const c2 = m.e.c - range.s.c;

    const v = grid?.[r1]?.[c1];
    for (let rr = r1; rr <= r2; rr++) {
      for (let cc = c1; cc <= c2; cc++) {
        if (grid[rr] && (grid[rr][cc] === "" || grid[rr][cc] === null || grid[rr][cc] === undefined)) {
          grid[rr][cc] = v;
        }
      }
    }
  }

  // قص الصفوف الفارغة من البداية
  let top = 0;
  while (top < grid.length && grid[top].every((x) => String(x ?? "").trim() === "")) top++;
  if (top >= grid.length) throw new Error("Sheet فارغ أو لا يحتوي بيانات.");
  const rows = grid.slice(top);

  const arabicDayRe = /(الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)/u;

  // ابحث عن صف الهيدر الحقيقي (يحتوي 'المعلم')
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const row = rows[r] || [];
    const hasTeacher = row.some((c) => {
      const v = String(c ?? "").trim().replace(/\s+/g, "");
      return v === "المعلم" || v.toLowerCase() === "teacher";
    });
    if (hasTeacher) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx < 0) throw new Error("صيغة غير معروفة: لم أجد صف يحتوي عمود 'المعلم' داخل الملف.");

  const headerRow = (rows[headerRowIdx] || []).map((h) => String(h ?? "").trim());
  const teacherColIndex = headerRow.findIndex((h) => {
    const v = String(h ?? "").trim().replace(/\s+/g, "");
    return v === "المعلم" || v.toLowerCase() === "teacher";
  });
  if (teacherColIndex < 0) throw new Error("لم أجد عمود 'المعلم' في الهيدر.");

  // ✅ اكتشاف صف "هيدر الامتحانات" (الصف التالي الذي يحتوي الفترة/مجموع اللجان)
  let examHeaderRowIdx = headerRowIdx + 1;
  while (examHeaderRowIdx < rows.length && (rows[examHeaderRowIdx] || []).every((x) => String(x || "").trim() === "")) {
    examHeaderRowIdx++;
  }

  const examHeaderRowCandidate = examHeaderRowIdx < rows.length ? (rows[examHeaderRowIdx] || []) : [];
  const examHeaderHintCount = examHeaderRowCandidate
    .slice(teacherColIndex + 1)
    .filter((x) => {
      const s = String(x || "");
      return /الفترة/u.test(s) || /مجموع\s*اللجان/u.test(s);
    }).length;

  const examHeaderLikeCount = headerRow
    .slice(teacherColIndex + 1)
    .filter((h) => arabicDayRe.test(String(h || "")) && /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/.test(String(h || "")))
    .length;

  const dateLikeCountOld = headerRow
    .slice(teacherColIndex + 1)
    .filter((h) => String(h).trim().match(/^\d{1,2}[\/\-]\d{1,2}$/) || String(h).trim().match(/^\d{4}-\d{2}-\d{2}$/))
    .length;

  const isExamPerColumn = examHeaderLikeCount >= 1 || examHeaderHintCount >= 2;
  const isOldMatrix = dateLikeCountOld >= 2 && !isExamPerColumn;

  // ===== Old Matrix =====
  if (isOldMatrix) {
    const baseYear = inferBaseYearFromRun(currentRun);

    const parseHeaderMMDD = (header: string): { month: number; day: number } | null => {
      const s = String(header || "").trim();
      if (!s) return null;
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
      if (!m) return null;
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const month = b > 12 ? a : a > 12 ? b : a;
      const day = b > 12 ? b : a > 12 ? a : b;
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      return { month, day };
    };

    const toISODate = (year: number, month: number, day: number) => {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    };

    const dateCols: { colIndex: number; dateISO: string }[] = [];
    let currentYear = baseYear;
    let prevMonth: number | null = null;

    for (let c = teacherColIndex + 1; c < headerRow.length; c++) {
      const h = String(headerRow[c] || "").trim();
      if (!h) continue;

      if (h.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const iso = parseMaybeDateToISO(h);
        if (iso) dateCols.push({ colIndex: c, dateISO: shiftWeekendToSunday(iso) });
        continue;
      }

      const md = parseHeaderMMDD(h);
      if (!md) continue;

      if (prevMonth !== null && md.month < prevMonth) currentYear += 1;
      prevMonth = md.month;

      dateCols.push({ colIndex: c, dateISO: shiftWeekendToSunday(toISODate(currentYear, md.month, md.day)) });
    }

    if (!dateCols.length) throw new Error("لم أستطع استخراج تواريخ الأعمدة من ملف الـ Matrix.");

    const out: Assignment[] = [];
    for (let rIdx = headerRowIdx + 1; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const teacherName = String(row?.[teacherColIndex] ?? "").trim();
      if (!teacherName) continue;

      for (const dc of dateCols) {
        const cellText = String(row?.[dc.colIndex] ?? "").trim();
        if (!cellText || cellText === "—") continue;
        out.push(...parseMatrixCellToAssignments(cellText, teacherName, dc.dateISO));
      }
    }

    if (!out.length) throw new Error("لم يتم العثور على تكليفات داخل خلايا الـ Matrix.");
    return out;
  }

  // ===== Exam-per-column (الهيدر صفين) =====
  if (isExamPerColumn) {
    const dayHeaderRowIdx = headerRowIdx;

    let examHeaderRowIdx2 = dayHeaderRowIdx + 1;
    while (examHeaderRowIdx2 < rows.length && (rows[examHeaderRowIdx2] || []).every((x) => String(x || "").trim() === "")) {
      examHeaderRowIdx2++;
    }
    if (examHeaderRowIdx2 >= rows.length) throw new Error("لم أجد صف المادة/الفترة تحت صف المعلم.");

    const dayHeaderRow = (rows[dayHeaderRowIdx] || []).map((h) => String(h || "").trim());
    const examHeaderRow = (rows[examHeaderRowIdx2] || []).map((h) => String(h || "").trim());

    const carriedDay: string[] = [];
    let last = "";
    for (let c = 0; c < Math.max(dayHeaderRow.length, examHeaderRow.length); c++) {
      const v = String(dayHeaderRow[c] || "").trim();
      if (v) last = v;
      carriedDay[c] = last;
    }

    const hasAnyDateInDayRow = carriedDay
      .slice(teacherColIndex + 1)
      .some((x) => /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/.test(String(x || "")));

    const lookups = buildExamLookupFromStorage();

    const colMeta: { colIndex: number; dateISO: string; subject: string; period: string }[] = [];
    for (let c = teacherColIndex + 1; c < Math.max(carriedDay.length, examHeaderRow.length); c++) {
      const dayCell = carriedDay[c] || "";
      const examCell = examHeaderRow[c] || "";
      if (!String(examCell || "").trim()) continue;

      const lines = String(examCell || "")
        .split(/\n+/g)
        .map((x) => x.trim())
        .filter(Boolean);

      const subject = normalizeSubject(lines[0] || examCell);
      if (!subject || normKey(subject).includes("مجموعاللجان")) continue;

      const period = mapPeriodFromText(lines[1] || "AM") || "AM";
      const committeesInHeader = parseCommitteesCountFromExamHeaderCell(examCell);

      let dateISO = "";

      if (hasAnyDateInDayRow) {
        const mDate =
          String(dayCell || "").match(/(\d{4}-\d{2}-\d{2})/) ||
          String(dayCell || "").match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);

        const dateISO0 = parseMaybeDateToISO(mDate ? mDate[1] : dayCell);
        dateISO = dateISO0 ? shiftWeekendToSunday(dateISO0) : "";
      } else {
        const keySPC = committeesInHeader !== null && committeesInHeader !== undefined ? `${subject}__${period}__${committeesInHeader}` : "";

        dateISO = (keySPC && lookups.bySPC[keySPC]) || lookups.bySP[`${subject}__${period}`] || "";
      }

      if (!dateISO) continue;

      colMeta.push({ colIndex: c, dateISO, subject, period });
    }

    if (!colMeta.length) {
      if (!hasAnyDateInDayRow) {
        throw new Error(
          "لم أستطع تحديد تواريخ الأعمدة لأن صف اليوم/التاريخ داخل الملف فارغ.\n" +
            "الحل: تأكد أن جدول الامتحانات (صفحة الامتحانات) محفوظ داخل النظام، أو صدّر Excel من النظام بعد التحديث."
        );
      }
      throw new Error("لم أستطع استخراج (التاريخ + المادة + الفترة) من هيدر الملف.");
    }

    const out: Assignment[] = [];
    const dataStart = examHeaderRowIdx2 + 1;

    for (let rIdx = dataStart; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const teacherName = String(row?.[teacherColIndex] ?? "").trim();
      if (!teacherName) continue;

      for (const cm of colMeta) {
        const cellText = String(row?.[cm.colIndex] ?? "").trim();
        if (!cellText || cellText === "—" || cellText === "-" || cellText === "–") continue;

        const taskType = mapTaskTypeFromText(cellText);

        const mCommittee =
          cellText.match(/رقم\s*اللجنة\s*[:：]?\s*([0-9]+)/) ||
          cellText.match(/رقم\s*القاعة\s*[:：]?\s*([0-9]+)/) ||
          cellText.match(/committee\s*[:：]?\s*([0-9]+)/i) ||
          cellText.match(/room\s*[:：]?\s*([0-9]+)/i);

        const committeeNo = mCommittee ? String(mCommittee[1]).trim() : "";

        const a: any = {
          teacherName,
          dateISO: cm.dateISO,
          taskType,
          period: cm.period || "AM",
          subject: cm.subject || "",
          notes: "",
        };

        if (committeeNo) {
          a.committeeNo = committeeNo;
          a.committeeNumber = committeeNo;
          a.roomNo = committeeNo;
          a.roomNumber = committeeNo;
        }

        out.push(a as Assignment);
      }
    }

    if (!out.length) throw new Error("تم قراءة الهيدر لكن لم أجد تكليفات في صفوف البيانات.");
    return out;
  }

  // ===== Row-based =====
  const headerMap: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const k = normKey(h);
    if (!k) return;
    headerMap[k] = i;
  });

  const col = (names: string[]) => {
    for (const n of names) {
      const idx = headerMap[normKey(n)];
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  const idxTeacher = col(["المعلم", "اسم المعلم", "teacher", "teachername"]);
  const idxDate = col(["التاريخ", "date", "dateiso", "date_iso"]);
  const idxPeriod = col(["الفترة", "period"]);
  const idxTask = col(["طبيعة العمل", "نوع المهمة", "المهمة", "task", "tasktype", "task_type"]);
  const idxSubject = col(["المادة", "subject"]);
  const idxCommittee = col(["رقم اللجنة", "رقماللجنة", "اللجنة", "room", "roomno", "committee", "committeeno"]);
  const idxInvIdx = col(["رقم المراقب", "invigilatorindex", "invigilator_index", "index"]);
  const idxNotes = col(["ملاحظات", "notes"]);

  if (idxTeacher < 0 || idxDate < 0) {
    throw new Error("صيغة غير معروفة: لازم تكون Row-based أو Exam-per-column أو Matrix.");
  }

  const out: Assignment[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((x) => String(x || "").trim() === "")) continue;

    const teacherName = String(row[idxTeacher] ?? "").trim();
    const dateISO0 = parseMaybeDateToISO(row[idxDate]);
    const dateISO = dateISO0 ? shiftWeekendToSunday(dateISO0) : "";
    if (!teacherName || !dateISO) continue;

    const period = idxPeriod >= 0 ? mapPeriodFromText(row[idxPeriod]) : "AM";
    const taskType = idxTask >= 0 ? mapTaskTypeFromText(row[idxTask]) : "INVIGILATION";
    const subject = idxSubject >= 0 ? normalizeSubject(String(row[idxSubject] ?? "")) : "";
    const committeeNo = idxCommittee >= 0 ? String(row[idxCommittee] ?? "").trim() : "";
    const invigilatorIndexRaw = idxInvIdx >= 0 ? row[idxInvIdx] : undefined;
    const notes = idxNotes >= 0 ? String(row[idxNotes] ?? "").trim() : "";

    const a: any = { teacherName, dateISO, period, taskType, subject, notes };

    if (committeeNo) {
      a.committeeNo = committeeNo;
      a.committeeNumber = committeeNo;
      a.roomNo = committeeNo;
      a.roomNumber = committeeNo;
    }

    const invIdxNum =
      typeof invigilatorIndexRaw === "number"
        ? invigilatorIndexRaw
        : String(invigilatorIndexRaw ?? "").trim()
        ? Number(String(invigilatorIndexRaw).trim())
        : undefined;

    if (invIdxNum !== undefined && !Number.isNaN(invIdxNum)) a.invigilatorIndex = invIdxNum;

    out.push(a as Assignment);
  }

  if (!out.length) throw new Error("لم يتم العثور على صفوف صالحة داخل ملف Excel.");
  return out;
}
