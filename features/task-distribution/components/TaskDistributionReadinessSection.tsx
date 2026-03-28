import React, { useEffect, useMemo, useState } from "react";

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

function statusMeta(status: ForecastRow["status"]) {
  if (status === "SAFE") return { label: "مريح", bg: "rgba(34,197,94,.16)", border: "rgba(34,197,94,.35)", color: "#86efac" };
  if (status === "TIGHT") return { label: "ضيق", bg: "rgba(245,158,11,.14)", border: "rgba(245,158,11,.30)", color: "#fcd34d" };
  return { label: "حرج", bg: "rgba(239,68,68,.14)", border: "rgba(239,68,68,.30)", color: "#fca5a5" };
}

function cardTone(tone: ReadinessCard["tone"]) {
  if (tone === "good") return { bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.28)", color: "#86efac" };
  if (tone === "warn") return { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.26)", color: "#fcd34d" };
  if (tone === "danger") return { bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.26)", color: "#fca5a5" };
  return { bg: "rgba(255,255,255,.04)", border: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.90)" };
}

function shortageText(row: ForecastRow) {
  const invGap = Math.max(0, Number(row.remainingInvigilations || 0));
  const reserveGap = Math.max(0, Number(row.remainingReserve || 0));
  if (!invGap && !reserveGap) return "مكتمل";
  const chunks: string[] = [];
  if (invGap) chunks.push(`مراقبة ${invGap}`);
  if (reserveGap) chunks.push(`احتياط ${reserveGap}`);
  return chunks.join(" • ");
}

function slotLabel(row: ForecastRow) {
  return `${row.dateISO} • ${row.period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`;
}

function suggestionChipMeta(suggestion: ForecastTeacherSuggestion, compact = false) {
  if (suggestion.source === "RESERVE") {
    return { bg: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.25)", color: "#93c5fd", label: compact ? "احتياط" : "من الاحتياط" };
  }
  if (suggestion.source === "FREE") {
    return { bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.24)", color: "#86efac", label: compact ? "متاح" : "متاح مباشر" };
  }
  if (suggestion.source === "MAX_TASK_RELAX") {
    return { bg: "rgba(249,115,22,.14)", border: "rgba(249,115,22,.28)", color: "#fdba74", label: compact ? "+نصاب" : "زيادة النصاب" };
  }
  if (suggestion.source === "SAME_DAY_RELAX") {
    return { bg: "rgba(168,85,247,.14)", border: "rgba(168,85,247,.28)", color: "#d8b4fe", label: compact ? "فترتان" : "فترتان" };
  }
  if (suggestion.source === "SPECIALTY_RELAX") {
    return { bg: "rgba(236,72,153,.14)", border: "rgba(236,72,153,.28)", color: "#f9a8d4", label: compact ? "استثناء مادة" : "استثناء المادة" };
  }
  if (suggestion.source === "TRANSFER_SAFE") {
    return { bg: "rgba(14,165,233,.14)", border: "rgba(14,165,233,.28)", color: "#7dd3fc", label: compact ? "نقل" : "نقل من فترة مريحة" };
  }
  return { bg: "rgba(234,179,8,.14)", border: "rgba(234,179,8,.28)", color: "#fde68a", label: compact ? "رفع تصحيح" : "رفع التصحيح" };
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
      const haystack = [row.dateISO, row.period === "AM" ? "الأولى" : "الثانية", ...row.subjects].join(" ").toLowerCase();
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
      setActionNotice({ tone: "warn", message: `تم استبعاد ${suggestion.teacherName} من اقتراحات ${slotLabel(row)} مؤقتًا.` });
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
    setActionNotice({ tone: "good", message: "تمت إعادة جميع الأسماء المستبعدة لهذه الفترة إلى قائمة الاقتراحات." });
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
    const tone = key === "CRITICAL" ? statusMeta("CRITICAL") : key === "TIGHT" ? statusMeta("TIGHT") : key === "SAFE" ? statusMeta("SAFE") : { bg: "rgba(255,255,255,.05)", border: line, color: "rgba(255,255,255,.95)", label: "الكل" };
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
      setActionNotice({ tone: "danger", message: error?.message || "حدث خطأ غير متوقع أثناء إضافة الاسم المقترح." });
    } finally {
      setSubmittingSuggestionKey(null);
    }
  }

  function pickAlternativeSuggestion() {
    if (!pendingSuggestion) return;
    const nextSuggestion = getNextSuggestion(pendingSuggestion.row, pendingSuggestion.suggestion);
    if (!nextSuggestion || suggestionIdentity(nextSuggestion) === suggestionIdentity(pendingSuggestion.suggestion)) {
      setActionNotice({ tone: "warn", message: "لا يوجد اسم بديل مختلف حاليًا لهذه الفترة." });
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
      setActionNotice({ tone: "danger", message: error?.message || "حدث خطأ غير متوقع أثناء التراجع عن الإضافة اليدوية." });
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
            const sourceMeta = suggestionChipMeta(suggestion, compactLabel);
            const key = `${row.key}-${suggestion.teacherId}-${suggestion.subject}`;
            const busy = submittingSuggestionKey === `${row.key}__${suggestion.teacherId}__${suggestion.subject}`;
            return (
              <button
                key={key}
                type="button"
                title={`${suggestion.note}${suggestion.source === "TRANSFER_SAFE" && suggestion.transferFromDateISO ? `\nسيتم نقل التكليف الحالي من ${suggestion.transferFromDateISO} ${suggestion.transferFromPeriod === "PM" ? "الفترة الثانية" : "الفترة الأولى"}` : ""}${onSuggestionPick ? "\nاضغط لإضافة الاسم إلى الجدول الشامل" : ""}`}
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
                <span style={{ opacity: 0.82 }}>• {busy ? "جارٍ الإضافة..." : sourceMeta.label}</span>
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
              اقتراح اسم آخر
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
              إعادة {dismissedCount} اسم مستبعد
            </button>
          ) : null}
          {(total > limit || dismissedCount) ? (
            <span style={{ ...note, alignSelf: "center" }}>المتوفر الآن: {total} اسم</span>
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
            <div style={{ fontWeight: 950, fontSize: 16, color: gold2 }}>فحص جاهزية التشغيل</div>
            <div style={{ ...cardSub, marginTop: 4 }}>
              قراءة مباشرة من بيانات البرنامج الحالية قبل تنفيذ الخوارزمية، مع احتساب المتاح الفعلي القابل للإسناد بعد تطبيق شروط التوزيع نفسها.
            </div>
          </div>
          {latestRunSummary ? (
            <span style={pill}>
              آخر تشغيل: {latestRunSummary.createdAtISO.slice(0, 16).replace("T", " ")} • {latestRunSummary.totalAssignments} مهمة
            </span>
          ) : (
            <span style={pill}>لا يوجد تشغيل محفوظ بعد</span>
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
            تم حذف بيانات التوزيع، وتمت تصفية تقرير الضغط المتوقع وملخص الجاهزية من هذه الصفحة. سيعاد بناء التقرير تلقائيًا عند تعديل القيود أو تشغيل التوزيع مرة أخرى.
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
                    إغلاق
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
                    <div style={{ fontWeight: 950, fontSize: 16, color: gold2 }}>سجل الإضافات اليدوية الأخيرة</div>
                    <div style={{ ...note, marginTop: 4 }}>يمكنك التراجع عن أي اسم تمت إضافته من الاقتراحات إذا أردت إعادة احتساب الضغط والعجز فورًا.</div>
                  </div>
                  <span style={pill}>{appliedSuggestionHistory.length} عملية محفوظة</span>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {appliedSuggestionHistory.slice(0, 6).map((entry) => {
                    const sourceMeta = suggestionChipMeta({
                      teacherId: entry.teacherId,
                      teacherName: entry.teacherName,
                      subject: entry.subject,
                      source: entry.source as any,
                      note: entry.note,
                    } as ForecastTeacherSuggestion, true);
                    const actionLabel = entry.actionKind === "CONVERT_RESERVE" ? "تحويل من الاحتياط" : entry.actionKind === "MOVE_FROM_SAFE" ? "نقل من فترة مريحة" : (entry.taskType === "RESERVE" ? "إضافة احتياط" : "إضافة مراقبة");
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
                            <span style={pill}>{entry.dateISO} • {entry.period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}</span>
                            <span style={{ ...pill, borderColor: sourceMeta.border, color: sourceMeta.color }}>{actionLabel}</span>
                          </div>
                          <div style={{ ...note }}>{entry.subject || "—"}{entry.note ? ` • ${entry.note}` : ""}</div>
                          <div style={{ ...note, opacity: 0.88 }}>تمت الإضافة: {String(entry.appliedAtISO || "").slice(0, 16).replace("T", " ")}</div>
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
                            {isBusy ? "جارٍ التراجع..." : "تراجع عن هذه الإضافة"}
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
                <div style={{ fontWeight: 950, marginBottom: 10 }}>ملخص آخر تشغيل محفوظ</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={pill}>مراقبة: {latestRunSummary.inv}</span>
                  <span style={pill}>احتياط: {latestRunSummary.res}</span>
                  <span style={pill}>مراجعة: {latestRunSummary.rev}</span>
                  <span style={pill}>تصحيح: {latestRunSummary.cor}</span>
                  <span style={pill}>تحذيرات: {latestRunSummary.warnings}</span>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${line}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                <div style={{ fontWeight: 950 }}>تقدير الضغط المتوقع لكل يوم/فترة</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {filterButton("ALL", "الكل", forecastRows.length)}
                  {filterButton("CRITICAL", "الحرجة", forecastSummary.critical.length)}
                  {filterButton("TIGHT", "الضيقة", forecastSummary.tight.length)}
                  {filterButton("SAFE", "المريحة", forecastSummary.safe.length)}
                </div>
              </div>
              <div style={note}>
                هذا تقدير تشغيلي قبل التنفيذ يعتمد على القاعات والاحتياط وعدم التوفر وتفريغ المراجعة/التصحيح المتوقع، ويرتبط أيضًا تلقائيًا بآخر تعديلات الجدول الشامل لنفس الفترات.
              </div>

              {forecastRows.length === 0 ? (
                <div style={{ ...note, marginTop: 12 }}>لا توجد فترات امتحان كافية لبناء توقعات التشغيل.</div>
              ) : (
                <>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
                    {[
                      {
                        key: "critical",
                        title: "الفترات الحرجة",
                        value: String(forecastSummary.critical.length),
                        sub: `العجز المتبقي: مراقبة ${forecastSummary.remainingInv} • احتياط ${forecastSummary.remainingReserve}`,
                        tone: forecastSummary.critical.length ? cardTone("danger") : cardTone("good"),
                      },
                      {
                        key: "tight",
                        title: "الفترات الضيقة",
                        value: String(forecastSummary.tight.length),
                        sub: "تحتاج متابعة قريبة قبل الاعتماد النهائي",
                        tone: forecastSummary.tight.length ? cardTone("warn") : cardTone("neutral"),
                      },
                      {
                        key: "safe",
                        title: "الفترات المريحة",
                        value: String(forecastSummary.safe.length),
                        sub: "يمكن السحب منها عند الحاجة وفق نفس الشروط",
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
                      <div style={{ fontWeight: 950, color: gold2 }}>أولويات المعالجة المقترحة</div>
                      <div style={{ ...note, marginTop: 4 }}>هذه قائمة مرتبة بالفترات التي تحتاج تدخلًا أولًا مع أفضل الأسماء المقترحة المتاحة حاليًا وفق الشروط الحالية نفسها. عند الضغط على الاسم ستظهر رسالة تأكيد لإضافته إلى الجدول الشامل.</div>
                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        {forecastSummary.actionRows.map((row) => {
                          const meta = statusMeta(row.status);
                          return (
                            <div key={`action-${row.key}`} style={{ borderRadius: 14, border: `1px solid ${meta.border}`, background: meta.bg, padding: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={{ fontWeight: 900 }}>{slotLabel(row)}</div>
                                <span style={{ ...pill, borderColor: meta.border, color: meta.color }}>{meta.label}</span>
                              </div>
                              <div style={{ ...note, marginTop: 6 }}>العجز الحالي: {shortageText(row)} • المواد: {row.subjects.slice(0, 3).join(" • ") || "—"}</div>
                              <div style={{ marginTop: 10 }}>
                                {row.teacherSuggestions?.length ? renderSuggestionPills(row, 4, false) : <span style={{ ...note, color: "#fca5a5" }}>لا توجد أسماء قابلة للنقل حاليًا في هذه الفترة.</span>}
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
                        placeholder="ابحث بالتاريخ أو المادة أو الفترة"
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
                    <div style={note}>المعروض الآن: {filteredRows.length} من أصل {forecastRows.length} فترة</div>
                  </div>

                  <div style={{ overflow: "auto", marginTop: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          <th style={th2}>الحالة</th>
                          <th style={th2}>التاريخ</th>
                          <th style={th2}>الفترة</th>
                          <th style={th2}>القاعات</th>
                          <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>المواد</th>
                          <th style={th2}>المراقبة</th>
                          <th style={th2}>الاحتياط</th>
                          <th style={th2}>غير المتاح</th>
                          <th style={th2}>مراجعة</th>
                          <th style={th2}>تصحيح</th>
                          <th style={th2}>المتاح</th>
                          <th style={th2}>العجز</th>
                          <th style={th2}>الهامش</th>
                          <th style={{ ...th2, minWidth: 340 }}>اقتراحات سد العجز</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => {
                          const meta = statusMeta(row.status);
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
                              <td style={td2}>{row.period === "AM" ? "الأولى" : "الثانية"}</td>
                              <td style={td2}>{row.rooms}</td>
                              <td style={{ ...td2, textAlign: "right", paddingRight: 16 }}>{row.subjects.slice(0, 3).join(" • ") || "—"}{row.subjects.length > 3 ? ` +${row.subjects.length - 3}` : ""}</td>
                              <td style={td2}>{`${row.assignedInvigilations || 0}/${row.invigilatorsRequired}`}</td>
                              <td style={td2}>{`${row.assignedReserve || 0}/${row.reserveRequired}`}</td>
                              <td style={td2}>{row.unavailableCount}</td>
                              <td style={td2}>{`${row.assignedReviewFree || 0}/${row.reviewFreeEstimate}`}</td>
                              <td style={td2}>{`${row.assignedCorrectionFree || 0}/${row.correctionFreeEstimate}`}</td>
                              <td style={td2}>{row.availableEstimate}</td>
                              <td style={{ ...td2, fontWeight: 900, color: (row.remainingInvigilations || row.remainingReserve) ? "#fca5a5" : "rgba(255,255,255,.82)" }}>{shortageText(row)}</td>
                              <td style={{ ...td2, fontWeight: 950, color: row.bufferEstimate < 0 ? "#fca5a5" : row.bufferEstimate === 0 ? "#fcd34d" : "#86efac" }}>
                                {row.bufferEstimate > 0 ? `+${row.bufferEstimate}` : row.bufferEstimate}
                              </td>
                              <td style={{ ...td2, minWidth: 340 }}>
                                {row.status === "SAFE" ? (
                                  <span style={{ ...note, color: "rgba(255,255,255,.70)" }}>لا يحتاج اقتراحات حالياً</span>
                                ) : row.teacherSuggestions?.length ? (
                                  renderSuggestionPills(row, 6, true)
                                ) : (
                                  <span style={{ ...note, color: "#fca5a5" }}>لا توجد أسماء صالحة حاليًا وفق الشروط الحالية</span>
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
        const sourceMeta = suggestionChipMeta(pendingSuggestion.suggestion, false);
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
              <div style={{ fontWeight: 950, fontSize: 20, color: gold2 }}>إضافة الاسم المقترح إلى الجدول الشامل</div>
              <div style={{ ...note, marginTop: 8 }}>
                {slotLabel(pendingSuggestion.row)} • العجز الحالي: {shortageText(pendingSuggestion.row)}
              </div>
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ ...pill, borderColor: sourceMeta.border, color: sourceMeta.color }}>{pendingSuggestion.suggestion.teacherName}</span>
                <span style={pill}>{pendingSuggestion.suggestion.subject || "—"}</span>
                <span style={{ ...pill, borderColor: sourceMeta.border, color: sourceMeta.color }}>{sourceMeta.label}</span>
                {pendingSuggestion.suggestion.source === "TRANSFER_SAFE" && pendingSuggestion.suggestion.transferFromDateISO ? (
                  <span style={pill}>
                    {pendingSuggestion.suggestion.transferFromDateISO} • {pendingSuggestion.suggestion.transferFromPeriod === "PM" ? "الفترة الثانية" : "الفترة الأولى"}
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 14, borderRadius: 14, border: `1px solid ${line}`, background: "rgba(255,255,255,.04)", padding: 12, color: "rgba(255,255,255,.92)", fontWeight: 800 }}>
                {pendingSuggestion.suggestion.source === "TRANSFER_SAFE"
                  ? `هل تريد نقل ${pendingSuggestion.suggestion.teacherName} من ${pendingSuggestion.suggestion.transferFromDateISO || "فترة مريحة"} ${pendingSuggestion.suggestion.transferFromPeriod === "PM" ? "الفترة الثانية" : "الفترة الأولى"} إلى ${slotLabel(pendingSuggestion.row)}؟ سيتم سحب تكليفه الحالي من الجدول الشامل ثم إضافته هنا مباشرة.`
                  : willNeedOverride
                    ? `هذا الاسم ليس متاحًا مباشرة وفق الشروط الحالية، لكنه مقترح إذا تم تطبيق هذا الاستثناء: ${pendingSuggestion.suggestion.note}. هل تريد إضافته يدويًا إلى الجدول الشامل رغم ذلك؟`
                    : `هل تريد إضافة ${pendingSuggestion.suggestion.teacherName} إلى الجدول الشامل لهذه الفترة؟ سيتم تحديث تقرير الضغط والاقتراحات مباشرة بعد الحفظ.`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <div style={note}>{pendingSuggestion.suggestion.source === "TRANSFER_SAFE" ? "سيتم النقل بشكل شبه تلقائي مع تحديث الجدول الشامل والضغط المتوقع فورًا. ويمكنك طلب اسم بديل أو التراجع لاحقًا من سجل الإضافات الأخيرة." : "بعد الإضافة يمكنك طلب اقتراح اسم آخر من نفس الفترة إذا بقي عجز."}</div>
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
                    لا
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
                    اسم بديل
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
                    {submittingSuggestionKey ? "جارٍ الحفظ..." : "نعم، أضف"}
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
