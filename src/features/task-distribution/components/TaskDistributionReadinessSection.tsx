import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../i18n/I18nProvider";

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

function translateSubjectValue(value: string, lang: "ar" | "en") {
  const raw = String(value || "").trim();
  if (!raw || lang === "ar") return raw;
  return SUBJECT_TRANSLATIONS[raw] || raw;
}

function translateSubjectsList(values: string[], lang: "ar" | "en") {
  return (Array.isArray(values) ? values : []).map((value) => translateSubjectValue(String(value || ""), lang));
}


type ReadinessCard = {
  key: string;
  title: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "danger" | "neutral";
};

type ForecastTeacherSuggestion = {
  teacherId: string;
  teacherName: string;
  subject: string;
  source: "RESERVE" | "FREE" | "MAX_TASK_RELAX" | "SAME_DAY_RELAX" | "SPECIALTY_RELAX" | "CORRECTION_RELAX" | "TRANSFER_SAFE";
  note: string;
  transferAssignmentId?: string;
  transferFromDateISO?: string;
  transferFromPeriod?: "AM" | "PM";
  transferFromTaskType?: string;
  transferFromSubject?: string;
};

type ForecastRow = {
  key: string;
  dateISO: string;
  period: "AM" | "PM";
  rooms: number;
  subjects: string[];
  invigilatorsRequired: number;
  reserveRequired: number;
  unavailableCount: number;
  availableEstimate: number;
  reviewFreeEstimate: number;
  correctionFreeEstimate: number;
  assignedInvigilations?: number;
  assignedReserve?: number;
  assignedReviewFree?: number;
  assignedCorrectionFree?: number;
  remainingInvigilations?: number;
  remainingReserve?: number;
  teacherSuggestions?: ForecastTeacherSuggestion[];
  bufferEstimate: number;
  status: "SAFE" | "TIGHT" | "CRITICAL";
};

type LatestRunSummary = {
  createdAtISO: string;
  totalAssignments: number;
  inv: number;
  res: number;
  rev: number;
  cor: number;
  warnings: number;
} | null;

type SuggestionActionResult = {
  ok?: boolean;
  message?: string;
};

type ActionNotice = {
  tone: "good" | "warn" | "danger";
  message: string;
} | null;

type AppliedSuggestionHistoryEntry = {
  id: string;
  teacherId: string;
  teacherName: string;
  dateISO: string;
  period: "AM" | "PM";
  subject: string;
  taskType: string;
  source: string;
  note: string;
  appliedAtISO: string;
  actionKind: "ADD" | "CONVERT_RESERVE" | "MOVE_FROM_SAFE";
};

type Props = {
  readinessCards: ReadinessCard[];
  alerts: string[];
  forecastRows: ForecastRow[];
  latestRunSummary: LatestRunSummary;
  isCleared?: boolean;
  styles: any;
  onSuggestionPick?: (row: ForecastRow, suggestion: ForecastTeacherSuggestion) => Promise<SuggestionActionResult | void> | SuggestionActionResult | void;
  appliedSuggestionHistory?: AppliedSuggestionHistoryEntry[];
  onUndoSuggestion?: (historyId: string) => Promise<SuggestionActionResult | void> | SuggestionActionResult | void;
};

function statusMeta(status: ForecastRow["status"], tr: (ar: string, en: string) => string) {
  if (status === "SAFE") return { label: tr("مريح", "Safe"), bg: "rgba(34,197,94,.16)", border: "rgba(34,197,94,.35)", color: "#86efac" };
  if (status === "TIGHT") return { label: tr("ضيق", "Tight"), bg: "rgba(245,158,11,.14)", border: "rgba(245,158,11,.30)", color: "#fcd34d" };
  return { label: tr("حرج", "Critical"), bg: "rgba(239,68,68,.14)", border: "rgba(239,68,68,.30)", color: "#fca5a5" };
}

function cardTone(tone: ReadinessCard["tone"]) {
  if (tone === "good") return { bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.28)", color: "#86efac" };
  if (tone === "warn") return { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.26)", color: "#fcd34d" };
  if (tone === "danger") return { bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.26)", color: "#fca5a5" };
  return { bg: "rgba(255,255,255,.04)", border: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.90)" };
}

function shortageText(row: ForecastRow, tr: (ar: string, en: string) => string) {
  const invGap = Math.max(0, Number(row.remainingInvigilations || 0));
  const reserveGap = Math.max(0, Number(row.remainingReserve || 0));
  if (!invGap && !reserveGap) return tr("مكتمل", "Complete");
  const chunks: string[] = [];
  if (invGap) chunks.push(`${tr("مراقبة", "Invigilation")} ${invGap}`);
  if (reserveGap) chunks.push(`${tr("احتياط", "Reserve")} ${reserveGap}`);
  return chunks.join(" • ");
}

function slotLabel(row: ForecastRow, tr: (ar: string, en: string) => string) {
  return `${row.dateISO} • ${row.period === "AM" ? tr("الفترة الأولى", "First Period") : tr("الفترة الثانية", "Second Period")}`;
}

function suggestionChipMeta(suggestion: ForecastTeacherSuggestion, tr: (ar: string, en: string) => string, compact = false) {
  if (suggestion.source === "RESERVE") {
    return { bg: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.25)", color: "#93c5fd", label: compact ? tr("احتياط", "Reserve") : tr("من الاحتياط", "From reserve") };
  }
  if (suggestion.source === "FREE") {
    return { bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.24)", color: "#86efac", label: compact ? tr("متاح", "Available") : tr("متاح مباشر", "Directly available") };
  }
  if (suggestion.source === "MAX_TASK_RELAX") {
    return { bg: "rgba(249,115,22,.14)", border: "rgba(249,115,22,.28)", color: "#fdba74", label: compact ? tr("+نصاب", "+Quota") : tr("زيادة النصاب", "Increase quota") };
  }
  if (suggestion.source === "SAME_DAY_RELAX") {
    return { bg: "rgba(168,85,247,.14)", border: "rgba(168,85,247,.28)", color: "#d8b4fe", label: compact ? tr("فترتان", "Two periods") : tr("فترتان", "Two periods") };
  }
  if (suggestion.source === "SPECIALTY_RELAX") {
    return { bg: "rgba(236,72,153,.14)", border: "rgba(236,72,153,.28)", color: "#f9a8d4", label: compact ? tr("استثناء مادة", "Subject exception") : tr("استثناء المادة", "Subject exception") };
  }
  if (suggestion.source === "TRANSFER_SAFE") {
    return { bg: "rgba(14,165,233,.14)", border: "rgba(14,165,233,.28)", color: "#7dd3fc", label: compact ? tr("نقل", "Move") : tr("نقل من فترة مريحة", "Move from a safe slot") };
  }
  return { bg: "rgba(234,179,8,.14)", border: "rgba(234,179,8,.28)", color: "#fde68a", label: compact ? tr("رفع تصحيح", "Lift correction") : tr("رفع التصحيح", "Lift correction") };
}

export default function TaskDistributionReadinessSection({
  readinessCards,
  alerts,
  forecastRows,
  latestRunSummary,
  isCleared = false,
  styles,
  onSuggestionPick,
  appliedSuggestionHistory = [],
  onUndoSuggestion,
}: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const translateSubject = (value: string) => translateSubjectValue(value, lang);
  const translateSubjects = (values: string[]) => translateSubjectsList(values, lang);
  const { card, cardSub, gold2, note, th2, td2, line, pill } = styles;
  const [statusFilter, setStatusFilter] = useState<"ALL" | ForecastRow["status"]>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingSuggestion, setPendingSuggestion] = useState<{ row: ForecastRow; suggestion: ForecastTeacherSuggestion } | null>(null);
  const [submittingSuggestionKey, setSubmittingSuggestionKey] = useState<string | null>(null);
  const [visibleSuggestionStart, setVisibleSuggestionStart] = useState<Record<string, number>>({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, string[]>>({});
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [undoingHistoryId, setUndoingHistoryId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return forecastRows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [row.dateISO, row.period === "AM" ? tr("الأولى", "First") : tr("الثانية", "Second"), ...translateSubjects(row.subjects)].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [forecastRows, searchTerm, statusFilter]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  function suggestionIdentity(suggestion: ForecastTeacherSuggestion) {
    return `${suggestion.teacherId}__${suggestion.subject}__${suggestion.source}`;
  }

  function getFilteredSuggestions(row: ForecastRow) {
    const list = Array.isArray(row.teacherSuggestions) ? row.teacherSuggestions : [];
    const hidden = new Set(dismissedSuggestions[row.key] || []);
    return list.filter((suggestion) => !hidden.has(suggestionIdentity(suggestion)));
  }

  function getNextSuggestion(row: ForecastRow, current?: ForecastTeacherSuggestion | null) {
    const list = getFilteredSuggestions(row);
    if (!list.length) return null;
    if (!current) return list[0];
    const currentKey = suggestionIdentity(current);
    const idx = list.findIndex((item) => suggestionIdentity(item) === currentKey);
    if (idx < 0) return list[0];
    return list[(idx + 1) % list.length] || null;
  }

  function dismissSuggestion(row: ForecastRow, suggestion: ForecastTeacherSuggestion, silent = false) {
    const key = suggestionIdentity(suggestion);
    setDismissedSuggestions((prev) => {
      const rowHidden = new Set(prev[row.key] || []);
      rowHidden.add(key);
      return { ...prev, [row.key]: Array.from(rowHidden) };
    });
    if (!silent) {
      setActionNotice({ tone: "warn", message: `${tr("تم استبعاد", "Excluded")} ${suggestion.teacherName} ${tr("من اقتراحات", "from suggestions of")} ${slotLabel(row, tr)} ${tr("مؤقتًا.", "temporarily.")}` });
    }
  }

  function restoreDismissedSuggestions(rowKey: string) {
    setDismissedSuggestions((prev) => {
      if (!prev[rowKey]?.length) return prev;
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setVisibleSuggestionStart((prev) => ({ ...prev, [rowKey]: 0 }));
    setActionNotice({ tone: "good", message: tr("تمت إعادة جميع الأسماء المستبعدة لهذه الفترة إلى قائمة الاقتراحات.", "All dismissed names for this slot were restored to the suggestions list.") });
  }

  const forecastSummary = useMemo(() => {
    const critical = forecastRows.filter((row) => row.status === "CRITICAL");
    const tight = forecastRows.filter((row) => row.status === "TIGHT");
    const safe = forecastRows.filter((row) => row.status === "SAFE");
    const remainingInv = forecastRows.reduce((sum, row) => sum + Math.max(0, Number(row.remainingInvigilations || 0)), 0);
    const remainingReserve = forecastRows.reduce((sum, row) => sum + Math.max(0, Number(row.remainingReserve || 0)), 0);
    const actionRows = [...critical, ...tight]
      .sort((a, b) => {
        const aGap = Math.max(0, Number(a.remainingInvigilations || 0)) + Math.max(0, Number(a.remainingReserve || 0));
        const bGap = Math.max(0, Number(b.remainingInvigilations || 0)) + Math.max(0, Number(b.remainingReserve || 0));
        if (a.status !== b.status) return a.status === "CRITICAL" ? -1 : 1;
        if (aGap !== bGap) return bGap - aGap;
        return a.dateISO === b.dateISO ? (a.period === b.period ? 0 : a.period === "AM" ? -1 : 1) : a.dateISO.localeCompare(b.dateISO);
      })
      .slice(0, 8);
    return { critical, tight, safe, remainingInv, remainingReserve, actionRows };
  }, [forecastRows]);

  const filterButton = (key: "ALL" | ForecastRow["status"], label: string, count: number) => {
    const active = statusFilter === key;
    const tone = key === "CRITICAL" ? statusMeta("CRITICAL", tr) : key === "TIGHT" ? statusMeta("TIGHT", tr) : key === "SAFE" ? statusMeta("SAFE", tr) : { bg: "rgba(255,255,255,.05)", border: line, color: "rgba(255,255,255,.95)", label: tr("الكل", "All") };
    return (
      <button
        key={key}
        type="button"
        onClick={() => setStatusFilter(key)}
        style={{
          borderRadius: 999,
          border: `1px solid ${active ? tone.border : line}`,
          background: active ? tone.bg : "rgba(255,255,255,.03)",
          color: active ? tone.color : "rgba(255,255,255,.86)",
          padding: "8px 12px",
          fontWeight: 900,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{label}</span>
        <span style={{ opacity: 0.82 }}>{count}</span>
      </button>
    );
  };

  function getSuggestionVisibleSlice(row: ForecastRow, limit: number) {
    const list = getFilteredSuggestions(row);
    if (!list.length) return list;
    const start = Math.max(0, Number(visibleSuggestionStart[row.key] || 0));
    if (list.length <= limit) return list;
    const normalizedStart = start % list.length;
    const rotated = [...list.slice(normalizedStart), ...list.slice(0, normalizedStart)];
    return rotated.slice(0, limit);
  }

  function rotateSuggestions(rowKey: string, total: number) {
    if (total <= 1) return;
    setVisibleSuggestionStart((prev) => ({
      ...prev,
      [rowKey]: ((Number(prev[rowKey] || 0) + 1) % total),
    }));
  }

  async function confirmSuggestionPick() {
    if (!pendingSuggestion || !onSuggestionPick) {
      setPendingSuggestion(null);
      return;
    }
    const actionKey = `${pendingSuggestion.row.key}__${pendingSuggestion.suggestion.teacherId}__${pendingSuggestion.suggestion.subject}`;
    try {
      setSubmittingSuggestionKey(actionKey);
      const result = await onSuggestionPick(pendingSuggestion.row, pendingSuggestion.suggestion);
      if (result?.message) {
        setActionNotice({ tone: result.ok === false ? "danger" : "good", message: result.message });
      }
      if (result?.ok !== false) {
        dismissSuggestion(pendingSuggestion.row, pendingSuggestion.suggestion, true);
      }
      setPendingSuggestion(null);
    } catch (error: any) {
      setActionNotice({ tone: "danger", message: error?.message || tr("حدث خطأ غير متوقع أثناء إضافة الاسم المقترح.", "An unexpected error occurred while adding the suggested name.") });
    } finally {
      setSubmittingSuggestionKey(null);
    }
  }

  function pickAlternativeSuggestion() {
    if (!pendingSuggestion) return;
    const nextSuggestion = getNextSuggestion(pendingSuggestion.row, pendingSuggestion.suggestion);
    if (!nextSuggestion || suggestionIdentity(nextSuggestion) === suggestionIdentity(pendingSuggestion.suggestion)) {
      setActionNotice({ tone: "warn", message: tr("لا يوجد اسم بديل مختلف حاليًا لهذه الفترة.", "There is no different alternative name currently for this slot.") });
      return;
    }
    setPendingSuggestion({ row: pendingSuggestion.row, suggestion: nextSuggestion });
  }

  function dismissPendingSuggestion() {
    if (!pendingSuggestion) return;
    dismissSuggestion(pendingSuggestion.row, pendingSuggestion.suggestion);
    const nextSuggestion = getNextSuggestion(pendingSuggestion.row, pendingSuggestion.suggestion);
    if (nextSuggestion && suggestionIdentity(nextSuggestion) !== suggestionIdentity(pendingSuggestion.suggestion)) {
      setPendingSuggestion({ row: pendingSuggestion.row, suggestion: nextSuggestion });
      return;
    }
    setPendingSuggestion(null);
  }

  async function undoAppliedSuggestion(historyId: string) {
    if (!onUndoSuggestion) return;
    try {
      setUndoingHistoryId(historyId);
      const result = await onUndoSuggestion(historyId);
      if (result?.message) {
        setActionNotice({ tone: result.ok === false ? "danger" : "good", message: result.message });
      }
    } catch (error: any) {
      setActionNotice({ tone: "danger", message: error?.message || tr("حدث خطأ غير متوقع أثناء التراجع عن الإضافة اليدوية.", "An unexpected error occurred while undoing the manual addition.") });
    } finally {
      setUndoingHistoryId(null);
    }
  }

  function renderSuggestionPills(row: ForecastRow, limit: number, compactLabel = false) {
    const total = getFilteredSuggestions(row).length;
    const dismissedCount = Array.isArray(dismissedSuggestions[row.key]) ? dismissedSuggestions[row.key].length : 0;
    const visible = getSuggestionVisibleSlice(row, limit);
    return (
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
          {visible.map((suggestion) => {
            const sourceMeta = suggestionChipMeta(suggestion, tr, compactLabel);
            const key = `${row.key}-${suggestion.teacherId}-${suggestion.subject}`;
            const busy = submittingSuggestionKey === `${row.key}__${suggestion.teacherId}__${suggestion.subject}`;
            return (
              <button
                key={key}
                type="button"
                title={`${suggestion.note}${suggestion.source === "TRANSFER_SAFE" && suggestion.transferFromDateISO ? `\n${tr("سيتم نقل التكليف الحالي من", "The current assignment will be moved from")} ${suggestion.transferFromDateISO} ${suggestion.transferFromPeriod === "PM" ? tr("الفترة الثانية", "Second Period") : tr("الفترة الأولى", "First Period")}` : ""}${onSuggestionPick ? `\n${tr("اضغط لإضافة الاسم إلى الجدول الشامل", "Click to add this name to the master table")}` : ""}`}
                onClick={() => onSuggestionPick && setPendingSuggestion({ row, suggestion })}
                disabled={busy || !onSuggestionPick}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 999,
                  border: `1px solid ${sourceMeta.border}`,
                  background: sourceMeta.bg,
                  color: sourceMeta.color,
                  fontWeight: 850,
                  lineHeight: 1.3,
                  cursor: onSuggestionPick ? "pointer" : "default",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <span>{suggestion.teacherName}</span>
                <span style={{ opacity: 0.82 }}>• {busy ? tr("جارٍ الإضافة...", "Adding...") : sourceMeta.label}</span>
              </button>
            );
          })}
          {total > limit ? (
            <button
              type="button"
              onClick={() => rotateSuggestions(row.key, total)}
              style={{
                borderRadius: 999,
                border: `1px dashed ${line}`,
                background: "rgba(255,255,255,.04)",
                color: "rgba(255,255,255,.88)",
                fontWeight: 800,
                padding: "7px 10px",
                cursor: "pointer",
              }}
            >
              {tr("اقتراح اسم آخر", "Suggest another name")}
            </button>
          ) : null}
          {dismissedCount ? (
            <button
              type="button"
              onClick={() => restoreDismissedSuggestions(row.key)}
              style={{
                borderRadius: 999,
                border: `1px dashed rgba(245,158,11,.35)`,
                background: "rgba(245,158,11,.08)",
                color: "#fcd34d",
                fontWeight: 800,
                padding: "7px 10px",
                cursor: "pointer",
              }}
            >
              {tr("إعادة", "Restore")} {dismissedCount} {tr("اسم مستبعد", "dismissed names")}
            </button>
          ) : null}
          {(total > limit || dismissedCount) ? (
            <span style={{ ...note, alignSelf: "center" }}>{tr("المتوفر الآن", "Currently available")}: {total} {tr("اسم", "names")}</span>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ ...card, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 16, color: gold2 }}>{tr("فحص جاهزية التشغيل", "Run readiness check")}</div>
            <div style={{ ...cardSub, marginTop: 4 }}>
              {tr("قراءة مباشرة من بيانات البرنامج الحالية قبل تنفيذ الخوارزمية، مع احتساب المتاح الفعلي القابل للإسناد بعد تطبيق شروط التوزيع نفسها.", "A direct reading from the current program data before running the algorithm, while calculating the actually available assignments after applying the same distribution rules.")}
            </div>
          </div>
          {latestRunSummary ? (
            <span style={pill}>
              {tr("آخر تشغيل", "Last run")}: {latestRunSummary.createdAtISO.slice(0, 16).replace("T", " ")} • {latestRunSummary.totalAssignments} {tr("مهمة", "tasks")}
            </span>
          ) : (
            <span style={pill}>{tr("لا يوجد تشغيل محفوظ بعد", "No saved run yet")}</span>
          )}
        </div>

        {isCleared ? (
          <div
            style={{
              marginTop: 14,
              borderRadius: 16,
              border: `1px solid ${line}`,
              background: "rgba(255,255,255,.04)",
              padding: "14px 16px",
              fontWeight: 850,
              color: "rgba(255,255,255,.92)",
            }}
          >
            {tr("تم حذف بيانات التوزيع، وتمت تصفية تقرير الضغط المتوقع وملخص الجاهزية من هذه الصفحة. سيعاد بناء التقرير تلقائيًا عند تعديل القيود أو تشغيل التوزيع مرة أخرى.", "Distribution data has been deleted, and the expected pressure report and readiness summary have been cleared from this page. The report will be rebuilt automatically when constraints are changed or the distribution is run again.")}
          </div>
        ) : (
          <>
            {actionNotice ? (() => {
              const tone = cardTone(actionNotice.tone);
              return (
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    border: `1px solid ${tone.border}`,
                    background: tone.bg,
                    color: tone.color,
                    padding: "12px 14px",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>{actionNotice.message}</span>
                  <button
                    type="button"
                    onClick={() => setActionNotice(null)}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${tone.border}`,
                      background: "transparent",
                      color: tone.color,
                      padding: "6px 10px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {tr("إغلاق", "Close")}
                  </button>
                </div>
              );
            })() : null}
            {appliedSuggestionHistory.length ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: `1px solid ${line}`,
                  background: "rgba(255,255,255,.04)",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 16, color: gold2 }}>{tr("سجل الإضافات اليدوية الأخيرة", "Recent manual additions log")}</div>
                    <div style={{ ...note, marginTop: 4 }}>{tr("يمكنك التراجع عن أي اسم تمت إضافته من الاقتراحات إذا أردت إعادة احتساب الضغط والعجز فورًا.", "You can undo any name added from suggestions if you want to recalculate pressure and shortage immediately.")}</div>
                  </div>
                  <span style={pill}>{appliedSuggestionHistory.length} {tr("عملية محفوظة", "saved actions")}</span>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {appliedSuggestionHistory.slice(0, 6).map((entry) => {
                    const sourceMeta = suggestionChipMeta({
                      teacherId: entry.teacherId,
                      teacherName: entry.teacherName,
                      subject: entry.subject,
                      source: entry.source as any,
                      note: entry.note,
                    } as ForecastTeacherSuggestion, tr, true);
                    const actionLabel = entry.actionKind === "CONVERT_RESERVE" ? tr("تحويل من الاحتياط", "Converted from reserve") : entry.actionKind === "MOVE_FROM_SAFE" ? tr("نقل من فترة مريحة", "Move from a safe slot") : (entry.taskType === "RESERVE" ? tr("إضافة احتياط", "Add reserve") : tr("إضافة مراقبة", "Add invigilation"));
                    const isBusy = undoingHistoryId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        style={{
                          borderRadius: 16,
                          border: `1px solid ${sourceMeta.border}`,
                          background: "rgba(255,255,255,.03)",
                          padding: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ ...pill, borderColor: sourceMeta.border, color: sourceMeta.color }}>{entry.teacherName}</span>
                            <span style={pill}>{entry.dateISO} • {entry.period === "AM" ? tr("الفترة الأولى", "First Period") : tr("الفترة الثانية", "Second Period")}</span>
                            <span style={{ ...pill, borderColor: sourceMeta.border, color: sourceMeta.color }}>{actionLabel}</span>
                          </div>
                          <div style={{ ...note }}>{translateSubject(entry.subject || "—")}{entry.note ? ` • ${entry.note}` : ""}</div>
                          <div style={{ ...note, opacity: 0.88 }}>{tr("تمت الإضافة", "Added on")}: {String(entry.appliedAtISO || "").slice(0, 16).replace("T", " ")}</div>
                        </div>
                        {onUndoSuggestion ? (
                          <button
                            type="button"
                            onClick={() => undoAppliedSuggestion(entry.id)}
                            disabled={isBusy}
                            style={{
                              borderRadius: 12,
                              border: `1px solid rgba(239,68,68,.28)`,
                              background: "rgba(239,68,68,.08)",
                              color: "#fca5a5",
                              fontWeight: 900,
                              padding: "10px 14px",
                              cursor: "pointer",
                              opacity: isBusy ? 0.7 : 1,
                            }}
                          >
                            {isBusy ? tr("جارٍ التراجع...", "Undoing...") : tr("تراجع عن هذه الإضافة", "Undo this addition")}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
              {readinessCards.map((cardItem) => {
                const tone = cardTone(cardItem.tone);
                return (
                  <div
                    key={cardItem.key}
                    style={{
                      borderRadius: 18,
                      border: `1px solid ${tone.border}`,
                      background: tone.bg,
                      padding: 14,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>{cardItem.title}</div>
                    <div style={{ fontWeight: 950, fontSize: 26, marginTop: 8, color: tone.color }}>{cardItem.value}</div>
                    {cardItem.sub ? <div style={{ ...note, marginTop: 8 }}>{cardItem.sub}</div> : null}
                  </div>
                );
              })}
            </div>

            {alerts.length ? (
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {alerts.map((alert, index) => (
                  <div
                    key={`readiness-alert-${index}`}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${line}`,
                      padding: "10px 12px",
                      background: index === 0 ? "rgba(245,158,11,.10)" : "rgba(255,255,255,.04)",
                      fontWeight: 800,
                      color: "rgba(255,255,255,.92)",
                    }}
                  >
                    {alert}
                  </div>
                ))}
              </div>
            ) : null}

            {latestRunSummary ? (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${line}` }}>
                <div style={{ fontWeight: 950, marginBottom: 10 }}>{tr("ملخص آخر تشغيل محفوظ", "Summary of the last saved run")}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={pill}>{tr("مراقبة", "Invigilation")}: {latestRunSummary.inv}</span>
                  <span style={pill}>{tr("احتياط", "Reserve")}: {latestRunSummary.res}</span>
                  <span style={pill}>{tr("مراجعة", "Review")}: {latestRunSummary.rev}</span>
                  <span style={pill}>{tr("تصحيح", "Correction")}: {latestRunSummary.cor}</span>
                  <span style={pill}>{tr("تحذيرات", "Warnings")}: {latestRunSummary.warnings}</span>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${line}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                <div style={{ fontWeight: 950 }}>{tr("تقدير الضغط المتوقع لكل يوم/فترة", "Expected pressure estimate for each day/period")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {filterButton("ALL", tr("الكل", "All"), forecastRows.length)}
                  {filterButton("CRITICAL", tr("الحرجة", "Critical"), forecastSummary.critical.length)}
                  {filterButton("TIGHT", tr("الضيقة", "Tight"), forecastSummary.tight.length)}
                  {filterButton("SAFE", tr("المريحة", "Safe"), forecastSummary.safe.length)}
                </div>
              </div>
              <div style={note}>
                {tr("هذا تقدير تشغيلي قبل التنفيذ يعتمد على القاعات والاحتياط وعدم التوفر وتفريغ المراجعة/التصحيح المتوقع، ويرتبط أيضًا تلقائيًا بآخر تعديلات الجدول الشامل لنفس الفترات.", "This is a pre-run operational estimate based on rooms, reserve, unavailability, and expected review/correction release. It is also automatically tied to the latest master table changes for the same slots.")}
              </div>

              {forecastRows.length === 0 ? (
                <div style={{ ...note, marginTop: 12 }}>{tr("لا توجد فترات امتحان كافية لبناء توقعات التشغيل.", "There are not enough exam slots to build run forecasts.")}</div>
              ) : (
                <>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
                    {[
                      {
                        key: "critical",
                        title: tr("الفترات الحرجة", "Critical slots"),
                        value: String(forecastSummary.critical.length),
                        sub: `${tr("العجز المتبقي", "Remaining shortage")}: ${tr("مراقبة", "Invigilation")} ${forecastSummary.remainingInv} • ${tr("احتياط", "Reserve")} ${forecastSummary.remainingReserve}`,
                        tone: forecastSummary.critical.length ? cardTone("danger") : cardTone("good"),
                      },
                      {
                        key: "tight",
                        title: tr("الفترات الضيقة", "Tight slots"),
                        value: String(forecastSummary.tight.length),
                        sub: tr("تحتاج متابعة قريبة قبل الاعتماد النهائي", "Needs close follow-up before final approval"),
                        tone: forecastSummary.tight.length ? cardTone("warn") : cardTone("neutral"),
                      },
                      {
                        key: "safe",
                        title: tr("الفترات المريحة", "Safe slots"),
                        value: String(forecastSummary.safe.length),
                        sub: tr("يمكن السحب منها عند الحاجة وفق نفس الشروط", "Can be used when needed under the same conditions"),
                        tone: cardTone("good"),
                      },
                    ].map((item) => (
                      <div key={item.key} style={{ borderRadius: 16, border: `1px solid ${item.tone.border}`, background: item.tone.bg, padding: 14 }}>
                        <div style={{ fontWeight: 850, fontSize: 12 }}>{item.title}</div>
                        <div style={{ fontWeight: 950, fontSize: 24, marginTop: 8, color: item.tone.color }}>{item.value}</div>
                        <div style={{ ...note, marginTop: 8 }}>{item.sub}</div>
                      </div>
                    ))}
                  </div>

                  {forecastSummary.actionRows.length ? (
                    <div style={{ marginTop: 14, borderRadius: 18, border: `1px solid ${line}`, background: "rgba(255,255,255,.03)", padding: 14 }}>
                      <div style={{ fontWeight: 950, color: gold2 }}>{tr("أولويات المعالجة المقترحة", "Suggested handling priorities")}</div>
                      <div style={{ ...note, marginTop: 4 }}>{tr("هذه قائمة مرتبة بالفترات التي تحتاج تدخلًا أولًا مع أفضل الأسماء المقترحة المتاحة حاليًا وفق الشروط الحالية نفسها. عند الضغط على الاسم ستظهر رسالة تأكيد لإضافته إلى الجدول الشامل.", "This is an ordered list of the slots that need intervention first, with the best currently available suggested names under the same current rules. Clicking a name shows a confirmation prompt to add it to the master table.")}</div>
                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        {forecastSummary.actionRows.map((row) => {
                          const meta = statusMeta(row.status, tr);
                          return (
                            <div key={`action-${row.key}`} style={{ borderRadius: 14, border: `1px solid ${meta.border}`, background: meta.bg, padding: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={{ fontWeight: 900 }}>{slotLabel(row, tr)}</div>
                                <span style={{ ...pill, borderColor: meta.border, color: meta.color }}>{meta.label}</span>
                              </div>
                              <div style={{ ...note, marginTop: 6 }}>{tr("العجز الحالي", "Current shortage")}: {shortageText(row, tr)} • {tr("المواد", "Subjects")}: {translateSubjects(row.subjects).slice(0, 3).join(" • ") || "—"}</div>
                              <div style={{ marginTop: 10 }}>
                                {row.teacherSuggestions?.length ? renderSuggestionPills(row, 4, false) : <span style={{ ...note, color: "#fca5a5" }}>{tr("لا توجد أسماء قابلة للنقل حاليًا في هذه الفترة.", "There are currently no transferable names for this slot.")}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={tr("ابحث بالتاريخ أو المادة أو الفترة", "Search by date, subject, or period")}
                        style={{
                          minWidth: 260,
                          borderRadius: 12,
                          border: `1px solid ${line}`,
                          background: "rgba(255,255,255,.04)",
                          color: "white",
                          padding: "10px 12px",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div style={note}>{tr("المعروض الآن", "Currently shown")}: {filteredRows.length} {tr("من أصل", "out of")} {forecastRows.length} {tr("فترة", "slots")}</div>
                  </div>

                  <div style={{ overflow: "auto", marginTop: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          <th style={th2}>{tr("الحالة", "Status")}</th>
                          <th style={th2}>{tr("التاريخ", "Date")}</th>
                          <th style={th2}>{tr("الفترة", "Period")}</th>
                          <th style={th2}>{tr("القاعات", "Rooms")}</th>
                          <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>{tr("المواد", "Subjects")}</th>
                          <th style={th2}>{tr("المراقبة", "Invigilation")}</th>
                          <th style={th2}>{tr("احتياط", "Reserve")}</th>
                          <th style={th2}>{tr("غير المتاح", "Unavailable")}</th>
                          <th style={th2}>{tr("مراجعة", "Review")}</th>
                          <th style={th2}>{tr("تصحيح", "Correction")}</th>
                          <th style={th2}>{tr("المتاح", "Available")}</th>
                          <th style={th2}>{tr("العجز", "Shortage")}</th>
                          <th style={th2}>{tr("الهامش", "Buffer")}</th>
                          <th style={{ ...th2, minWidth: 340 }}>{tr("اقتراحات سد العجز", "Shortage-fill suggestions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => {
                          const meta = statusMeta(row.status, tr);
                          return (
                            <tr key={row.key}>
                              <td style={td2}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minWidth: 68,
                                    borderRadius: 999,
                                    padding: "6px 10px",
                                    fontWeight: 950,
                                    background: meta.bg,
                                    border: `1px solid ${meta.border}`,
                                    color: meta.color,
                                  }}
                                >
                                  {meta.label}
                                </span>
                              </td>
                              <td style={td2}>{row.dateISO}</td>
                              <td style={td2}>{row.period === "AM" ? tr("الأولى", "First") : tr("الثانية", "Second")}</td>
                              <td style={td2}>{row.rooms}</td>
                              <td style={{ ...td2, textAlign: "right", paddingRight: 16 }}>{translateSubjects(row.subjects).slice(0, 3).join(" • ") || "—"}{row.subjects.length > 3 ? ` +${row.subjects.length - 3}` : ""}</td>
                              <td style={td2}>{`${row.assignedInvigilations || 0}/${row.invigilatorsRequired}`}</td>
                              <td style={td2}>{`${row.assignedReserve || 0}/${row.reserveRequired}`}</td>
                              <td style={td2}>{row.unavailableCount}</td>
                              <td style={td2}>{`${row.assignedReviewFree || 0}/${row.reviewFreeEstimate}`}</td>
                              <td style={td2}>{`${row.assignedCorrectionFree || 0}/${row.correctionFreeEstimate}`}</td>
                              <td style={td2}>{row.availableEstimate}</td>
                              <td style={{ ...td2, fontWeight: 900, color: (row.remainingInvigilations || row.remainingReserve) ? "#fca5a5" : "rgba(255,255,255,.82)" }}>{shortageText(row, tr)}</td>
                              <td style={{ ...td2, fontWeight: 950, color: row.bufferEstimate < 0 ? "#fca5a5" : row.bufferEstimate === 0 ? "#fcd34d" : "#86efac" }}>
                                {row.bufferEstimate > 0 ? `+${row.bufferEstimate}` : row.bufferEstimate}
                              </td>
                              <td style={{ ...td2, minWidth: 340 }}>
                                {row.status === "SAFE" ? (
                                  <span style={{ ...note, color: "rgba(255,255,255,.70)" }}>{tr("لا يحتاج اقتراحات حالياً", "No suggestions needed right now")}</span>
                                ) : row.teacherSuggestions?.length ? (
                                  renderSuggestionPills(row, 6, true)
                                ) : (
                                  <span style={{ ...note, color: "#fca5a5" }}>{tr("لا توجد أسماء صالحة حاليًا وفق الشروط الحالية", "There are currently no valid names under the current rules")}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {pendingSuggestion ? (() => {
        const sourceMeta = suggestionChipMeta(pendingSuggestion.suggestion, tr, false);
        const willNeedOverride = !["FREE", "RESERVE"].includes(pendingSuggestion.suggestion.source);
        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.55)",
              zIndex: 70,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <div
              style={{
                width: "min(640px, 100%)",
                borderRadius: 20,
                border: `1px solid ${sourceMeta.border}`,
                background: "linear-gradient(180deg, rgba(11,20,45,.96), rgba(8,14,32,.98))",
                boxShadow: "0 20px 60px rgba(0,0,0,.45)",
                padding: 18,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 20, color: gold2 }}>{tr("إضافة الاسم المقترح إلى الجدول الشامل", "Add the suggested name to the master table")}</div>
              <div style={{ ...note, marginTop: 8 }}>
                {slotLabel(pendingSuggestion.row, tr)} • {tr("العجز الحالي", "Current shortage")}: {shortageText(pendingSuggestion.row, tr)}
              </div>
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ ...pill, borderColor: sourceMeta.border, color: sourceMeta.color }}>{pendingSuggestion.suggestion.teacherName}</span>
                <span style={pill}>{translateSubject(pendingSuggestion.suggestion.subject || "—")}</span>
                <span style={{ ...pill, borderColor: sourceMeta.border, color: sourceMeta.color }}>{sourceMeta.label}</span>
                {pendingSuggestion.suggestion.source === "TRANSFER_SAFE" && pendingSuggestion.suggestion.transferFromDateISO ? (
                  <span style={pill}>
                    {pendingSuggestion.suggestion.transferFromDateISO} • {pendingSuggestion.suggestion.transferFromPeriod === "PM" ? tr("الفترة الثانية", "Second Period") : tr("الفترة الأولى", "First Period")}
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 14, borderRadius: 14, border: `1px solid ${line}`, background: "rgba(255,255,255,.04)", padding: 12, color: "rgba(255,255,255,.92)", fontWeight: 800 }}>
                {pendingSuggestion.suggestion.source === "TRANSFER_SAFE"
                  ? `${tr("هل تريد نقل", "Do you want to move")} ${pendingSuggestion.suggestion.teacherName} ${tr("من", "from")} ${pendingSuggestion.suggestion.transferFromDateISO || tr("فترة مريحة", "a safe slot")} ${pendingSuggestion.suggestion.transferFromPeriod === "PM" ? tr("الفترة الثانية", "Second Period") : tr("الفترة الأولى", "First Period")} ${tr("إلى", "to")} ${slotLabel(pendingSuggestion.row, tr)}؟ ${tr("سيتم سحب تكليفه الحالي من الجدول الشامل ثم إضافته هنا مباشرة.", "Its current assignment will be removed from the master table and then added here immediately.")}`
                  : willNeedOverride
                    ? `هذا الاسم ليس متاحًا مباشرة وفق الشروط الحالية، لكنه مقترح إذا تم تطبيق هذا الاستثناء: ${pendingSuggestion.suggestion.note}. هل تريد إضافته يدويًا إلى الجدول الشامل رغم ذلك؟`
                    : `هل تريد إضافة ${pendingSuggestion.suggestion.teacherName} إلى الجدول الشامل لهذه الفترة؟ سيتم تحديث تقرير الضغط والاقتراحات مباشرة بعد الحفظ.`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <div style={note}>{pendingSuggestion.suggestion.source === "TRANSFER_SAFE" ? tr("سيتم النقل بشكل شبه تلقائي مع تحديث الجدول الشامل والضغط المتوقع فورًا. ويمكنك طلب اسم بديل أو التراجع لاحقًا من سجل الإضافات الأخيرة.", "The move will be handled almost automatically with immediate updates to the master table and expected pressure. You can request an alternative name or undo it later from the recent additions log.") : tr("بعد الإضافة يمكنك طلب اقتراح اسم آخر من نفس الفترة إذا بقي عجز.", "After adding, you can request another suggested name from the same slot if a shortage remains.")}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setPendingSuggestion(null)}
                    disabled={!!submittingSuggestionKey}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${line}`,
                      background: "rgba(255,255,255,.05)",
                      color: "white",
                      fontWeight: 900,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    {tr("لا", "No")}
                  </button>
                  <button
                    type="button"
                    onClick={pickAlternativeSuggestion}
                    disabled={!!submittingSuggestionKey}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${line}`,
                      background: "rgba(255,255,255,.05)",
                      color: "#fde68a",
                      fontWeight: 900,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    {tr("اسم بديل", "Alternative name")}
                  </button>
                  <button
                    type="button"
                    onClick={dismissPendingSuggestion}
                    disabled={!!submittingSuggestionKey}
                    style={{
                      borderRadius: 12,
                      border: `1px solid rgba(239,68,68,.28)`,
                      background: "rgba(239,68,68,.08)",
                      color: "#fca5a5",
                      fontWeight: 900,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    استبعد هذا الاسم
                  </button>
                  <button
                    type="button"
                    onClick={confirmSuggestionPick}
                    disabled={!!submittingSuggestionKey}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${sourceMeta.border}`,
                      background: sourceMeta.bg,
                      color: sourceMeta.color,
                      fontWeight: 950,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    {submittingSuggestionKey ? tr("جارٍ الحفظ...", "Saving...") : tr("نعم، أضف", "Yes, add")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}
    </>
  );
}
