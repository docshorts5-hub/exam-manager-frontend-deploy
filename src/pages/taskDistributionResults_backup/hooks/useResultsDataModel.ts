import { useEffect, useMemo, useState } from "react";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import { loadTenantArray } from "../../../services/tenantData";
import { extractExamCommitteesCount, extractExamDateISO, extractExamPeriod, extractExamSubject } from "../excelHelpers";
import type { SubCol } from "../excelExport";
import { colKeyOf } from "../services/resultsDragDropRules";
import { getCommitteeNo } from "../taskUtils";
import { buildResultsConflictUids, buildResultsWarnings } from "../services/resultsDataModelHelpers";

const TEACHERS_SUB = "teachers";
const EXAMS_SUB = "exams";

export function useResultsDataModel({
  tenantId,
  run,
  normalizeSubject,
}: {
  tenantId: string;
  run: any;
  normalizeSubject: (subject: string) => string;
}) {
  const [teachersFromStorage, setTeachersFromStorage] = useState<any[]>([]);
  const [examsFromFS, setExamsFromFS] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tRows, eRows] = await Promise.all([
        loadTenantArray<any>(tenantId, TEACHERS_SUB).catch(() => []),
        loadTenantArray<any>(tenantId, EXAMS_SUB).catch(() => []),
      ]);
      if (cancelled) return;
      setTeachersFromStorage(Array.isArray(tRows) ? tRows : []);
      setExamsFromFS(Array.isArray(eRows) ? eRows : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const assignments: any[] = useMemo(
    () =>
      (run?.assignments || []).map((a: any) => ({
        ...a,
        __uid: a?.__uid,
        dateISO: a?.dateISO,
        subject: normalizeSubject(String(a?.subject || "")),
        period: String(a?.period || "AM").toUpperCase() || "AM",
      })),
    [run, normalizeSubject],
  );

  const teacherToSubjectsBase = useMemo(() => {
    const base = (s: string) =>
      String(s || "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\s*\d+\s*$/, "")
        .trim();

    const m = new Map<string, string[]>();
    for (const t of teachersFromStorage) {
      const name = String(t.fullName || t.name || "").trim();
      if (!name) continue;
      const subs = [t.subject1, t.subject2, t.subject3, t.subject4].map((x: any) => base(String(x || ""))).filter(Boolean);
      m.set(name, subs);
    }
    return m;
  }, [teachersFromStorage]);

  const teacherNameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teachersFromStorage as any[]) {
      const name = String(t.fullName || t.name || "").trim();
      const id = String(t.id || t.teacherId || name || "").trim();
      if (!name) continue;
      if (id) m.set(name, id);
    }
    return m;
  }, [teachersFromStorage]);

  const orderedExamSubjectsBase = useMemo(() => {
    const base = (s: string) =>
      String(s || "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\s*\d+\s*$/, "")
        .trim();

    const exams: any[] = Array.isArray(examsFromFS) ? examsFromFS : [];
    const list = exams
      .map((x, i) => ({ __i: i, dateISO: extractExamDateISO(x), subject: extractExamSubject(x), period: extractExamPeriod(x) }))
      .filter((x) => x.dateISO && x.subject);

    const periodWeight = (p: string) => (String(p || "AM").toUpperCase() === "PM" || String(p || "AM").toUpperCase() === "BM" ? 2 : 1);

    list.sort((a: any, b: any) => {
      const da = String(a.dateISO || "");
      const db = String(b.dateISO || "");
      if (da !== db) return da.localeCompare(db);
      const pa = periodWeight(a.period);
      const pb = periodWeight(b.period);
      if (pa !== pb) return pa - pb;
      return (a.__i ?? 0) - (b.__i ?? 0);
    });

    const out: string[] = [];
    const seen = new Set<string>();
    for (const ex of list) {
      const b = base(String(ex.subject || ""));
      if (!b || seen.has(b)) continue;
      seen.add(b);
      out.push(b);
    }
    return out;
  }, [examsFromFS]);

  const allTeachers = useMemo(() => {
    const base = (s: string) =>
      String(s || "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\s*\d+\s*$/, "")
        .trim();

    const rank = new Map<string, number>();
    orderedExamSubjectsBase.forEach((s, idx) => rank.set(s, idx));
    const unique = [...new Set(assignments.map((a) => String(a.teacherName || "").trim()))].filter(Boolean);

    const teacherRank = (teacherName: string) => {
      const subs = teacherToSubjectsBase.get(teacherName) || [];
      let best = Number.POSITIVE_INFINITY;
      for (const s of subs) {
        const r = rank.get(base(s));
        if (r !== undefined) best = Math.min(best, r);
      }
      if (!Number.isFinite(best)) {
        const first = (assignments as any[])
          .filter((a) => String(a.teacherName || "").trim() === teacherName)
          .map((a) => base(String(a.subject || "")))
          .find((s) => rank.has(s));
        if (first) best = rank.get(first) ?? best;
      }
      return Number.isFinite(best) ? best : 999999;
    };

    unique.sort((a, b) => {
      const ra = teacherRank(a);
      const rb = teacherRank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, "ar");
    });
    return unique;
  }, [assignments, orderedExamSubjectsBase, teacherToSubjectsBase]);

  const examsFromStorage = useMemo(() => {
    const list: any[] = Array.isArray(examsFromFS) ? examsFromFS : [];
    return list
      .map((x) => ({
        ...x,
        dateISO: extractExamDateISO(x),
        subject: extractExamSubject(x),
        period: extractExamPeriod(x),
        committeesCount: extractExamCommitteesCount(x),
      }))
      .filter((x) => x.dateISO && x.subject);
  }, [examsFromFS]);

  const colKeyToExamId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const ex of examsFromStorage as any[]) {
      const key = `${String(ex.dateISO || "").trim()}__${String(ex.period || "AM").toUpperCase()}__${normalizeSubject(String(ex.subject || "")).trim()}`;
      if (ex?.id) m[key] = String(ex.id);
    }
    return m;
  }, [examsFromStorage, normalizeSubject]);

  const constraintsFromStorage = useMemo(() => {
    const CONSTRAINTS_KEY = "exam-manager:task-distribution:constraints:v2";
    try {
      const raw = JSON.parse(String(localStorage.getItem(CONSTRAINTS_KEY) || "{}"));
      return {
        inv_5_10: Math.max(0, Number(raw?.invigilators_5_10 ?? 0) || 0),
        inv_11: Math.max(0, Number(raw?.invigilators_11 ?? 0) || 0),
        inv_12: Math.max(0, Number(raw?.invigilators_12 ?? 0) || 0),
      };
    } catch {
      return { inv_5_10: 0, inv_11: 0, inv_12: 0 };
    }
  }, []);

  const invigilatorsPerRoomForSubject = (subject: string) => {
    const s = String(subject || "");
    if (/\b11\b/.test(s) || s.includes("11")) return constraintsFromStorage.inv_11 || 2;
    if (/\b10\b/.test(s) || s.includes("10")) return constraintsFromStorage.inv_5_10 || 2;
    return constraintsFromStorage.inv_12 || 2;
  };

  const examKeyToCommittees = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ex of examsFromStorage) {
      const key = `${ex.dateISO}__${extractExamPeriod(ex)}__${extractExamSubject(ex)}`;
      m[key] = extractExamCommitteesCount(ex);
    }
    return m;
  }, [examsFromStorage]);

  const dateToSubCols = useMemo(() => {
    const map = new Map<string, Map<string, SubCol>>();
    const push = (dateISO: string, period: string, subject: string) => {
      const d = String(dateISO || "").trim();
      const p = String(period || "AM").toUpperCase() || "AM";
      const s = normalizeSubject(subject || "");
      if (!d || !s) return;
      const key = `${d}__${p}__${s}`;
      if (!map.has(d)) map.set(d, new Map());
      const inner = map.get(d)!;
      if (!inner.has(key)) inner.set(key, { key, dateISO: d, subject: s, period: p });
    };

    if (examsFromStorage.length) {
      for (const ex of examsFromStorage) push(ex.dateISO as string, ex.period as string, ex.subject as string);
      for (const a of assignments as any[]) {
        if (String(a?.taskType || "") !== "CORRECTION_FREE") continue;
        const d = String(a?.dateISO || "").trim();
        if (!d) continue;
        const p = String(a?.period || "AM");
        const s = normalizeSubject(String(a?.subject || "").trim()) || "تصحيح";
        push(d, p, s);
      }
    } else {
      for (const a of assignments as any[]) push(String(a.dateISO || ""), String(a.period || "AM"), String(a.subject || ""));
    }

    const out = new Map<string, SubCol[]>();
    const dates = [...map.keys()].sort();
    for (const d of dates) {
      const arr = [...map.get(d)!.values()];
      arr.sort((x, y) => {
        const px = x.period === "PM" || x.period === "BM" ? 2 : 1;
        const py = y.period === "PM" || y.period === "BM" ? 2 : 1;
        if (px !== py) return px - py;
        return x.subject.localeCompare(y.subject, "ar");
      });
      out.set(d, arr);
    }
    return out;
  }, [assignments, examsFromStorage, normalizeSubject]);

  const displayDates = useMemo(() => [...dateToSubCols.keys()], [dateToSubCols]);

  const allSubCols: SubCol[] = useMemo(() => {
    const out: SubCol[] = [];
    for (const d of displayDates) out.push(...(dateToSubCols.get(d) || []));
    return out;
  }, [displayDates, dateToSubCols]);

  const matrix2 = useMemo(() => {
    const m: Record<string, Record<string, Assignment[]>> = {};
    for (const t of allTeachers) m[t] = {};
    for (const a of assignments as any[]) {
      const teacher = String(a.teacherName || "").trim();
      if (!teacher) continue;
      const dateISO = String(a.dateISO || "").trim();
      const subject = normalizeSubject(String(a.subject || "").trim());
      const period = String(a.period || "AM").toUpperCase() || "AM";
      const key = `${dateISO}__${period}__${subject}`;
      if (!m[teacher]) m[teacher] = {};
      if (!m[teacher][key]) m[teacher][key] = [];
      m[teacher][key].push(a as Assignment);
    }
    for (const t of Object.keys(m)) {
      for (const k of Object.keys(m[t])) {
        m[t][k].sort((a: any, b: any) => {
          const pa = a.period === "PM" ? 2 : 1;
          const pb = b.period === "PM" ? 2 : 1;
          if (pa !== pb) return pa - pb;
          const ia = (a as any).invigilatorIndex ?? 0;
          const ib = (b as any).invigilatorIndex ?? 0;
          if (ia !== ib) return ia - ib;
          const ca = Number(getCommitteeNo(a) ?? 0);
          const cb = Number(getCommitteeNo(b) ?? 0);
          return ca - cb;
        });
      }
    }
    return m;
  }, [assignments, allTeachers, normalizeSubject]);

  const committeesCountBySubCol = useMemo(() => {
    const out: Record<string, number> = {};
    for (const sc of allSubCols) {
      const ek = `${sc.dateISO}__${sc.period}__${sc.subject}`;
      const fromExams = examKeyToCommittees[ek];
      if (typeof fromExams === "number" && fromExams > 0) {
        out[sc.key] = fromExams;
        continue;
      }
      const set = new Set<string>();
      for (const teacher of allTeachers) {
        const list = matrix2[teacher]?.[sc.key] || [];
        for (const a of list as any[]) {
          const cn = getCommitteeNo(a);
          if (cn) set.add(String(cn));
        }
      }
      out[sc.key] = set.size;
    }
    return out;
  }, [allSubCols, examKeyToCommittees, allTeachers, matrix2]);

  const totalsDetailBySubCol = useMemo(() => {
    const out: Record<string, { inv: number; res: number; corr: number; total: number; deficit: number; committees: number; required: number; coveragePct: number }> = {};
    for (const sc of allSubCols) {
      const committees = committeesCountBySubCol[sc.key] ?? 0;
      const ek = `${sc.dateISO}__${sc.period}__${sc.subject}`;
      const roomsFromExams = examKeyToCommittees[ek];
      const invPerRoom = typeof roomsFromExams === "number" && roomsFromExams > 0 ? invigilatorsPerRoomForSubject(sc.subject) : 0;
      const required = Math.max(0, (Number(roomsFromExams) || 0) * Math.max(0, Number(invPerRoom) || 0));
      out[sc.key] = { inv: 0, res: 0, corr: 0, total: 0, deficit: 0, committees, required, coveragePct: 100 };
    }
    for (const a of assignments as any[]) {
      const key = colKeyOf(a);
      if (!out[key]) {
        const committees = committeesCountBySubCol[key] ?? 0;
        out[key] = { inv: 0, res: 0, corr: 0, total: 0, deficit: 0, committees, required: 0, coveragePct: 100 };
      }
      const t = String(a.taskType || "");
      if (t === "INVIGILATION") out[key].inv += 1;
      if (t === "RESERVE") out[key].res += 1;
      if (t === "CORRECTION_FREE") out[key].corr += 1;
    }
    for (const k of Object.keys(out)) {
      const x = out[k];
      x.total = x.inv + x.res + x.corr;
      const covered = x.inv + x.res;
      x.deficit = Math.max(0, (x.required || 0) - covered);
      x.coveragePct = (x.required || 0) > 0 ? Math.round((covered / x.required) * 100) : 100;
    }
    return out;
  }, [assignments, allSubCols, committeesCountBySubCol, examKeyToCommittees]);

  const teacherTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of allTeachers) out[t] = 0;
    for (const a of assignments as any[]) {
      const teacher = String(a.teacherName || "").trim();
      if (!teacher) continue;
      const tt = String(a.taskType || "");
      if (tt === "INVIGILATION" || tt === "RESERVE" || tt === "REVIEW_FREE") out[teacher] = (out[teacher] || 0) + 1;
    }
    return out;
  }, [assignments, allTeachers]);

  const warnings = useMemo(
    () =>
      buildResultsWarnings({
        assignments,
        examsFromStorage,
        normalizeSubject,
      }),
    [assignments, examsFromStorage, normalizeSubject],
  );

  const conflictUids = useMemo(() => buildResultsConflictUids(run), [run]);

  return {
    teachersFromStorage,
    examsFromFS,
    assignments,
    teacherNameToId,
    allTeachers,
    examsFromStorage,
    colKeyToExamId,
    examKeyToCommittees,
    invigilatorsPerRoomForSubject,
    displayDates,
    dateToSubCols,
    allSubCols,
    matrix2,
    committeesCountBySubCol,
    totalsDetailBySubCol,
    teacherTotals,
    warnings,
    conflictUids,
  };
}
