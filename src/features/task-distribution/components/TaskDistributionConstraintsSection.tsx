import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

type Props = {
  constraints: any;
  allowTwo: boolean;
  twoAllDates: boolean;
  twoDates: string[];
  correctionDatesSorted: string[];
  allExamDatesSorted: string[];
  runOut: any;
  hasBasics: boolean;
  isRunning: boolean;
  onRun: () => void;
  onGoHome: () => void;
  onGoResults: () => void;
  onGoSuggestions: () => void;
  onDeleteAllDistributionData: () => void;
  onReloadConstraints: () => void;
  onSaveConstraints: () => void;
  onClearConstraints: () => void;
  setField: (field: string, value: any) => void;
  setConstraints: React.Dispatch<React.SetStateAction<any>>;
  toggleDate: (dateISO: string) => void;
  boolText: (v: boolean) => string;
  num: (v: string, fallback: number) => number;
  styles: any;
};

export default function TaskDistributionConstraintsSection({
  constraints,
  allowTwo,
  twoAllDates,
  twoDates,
  correctionDatesSorted,
  allExamDatesSorted,
  runOut,
  hasBasics,
  isRunning,
  onRun,
  onGoHome,
  onGoResults,
  onGoSuggestions,
  onDeleteAllDistributionData,
  onReloadConstraints,
  onSaveConstraints,
  onClearConstraints,
  setField,
  setConstraints,
  toggleDate,
  boolText,
  num,
  styles,
}: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const {
    hBtn,
    pageGrid,
    card,
    cardHead,
    cardTitle,
    cardSub,
    row,
    label,
    note,
    input,
    statusChip,
    toggle,
    knob,
    btnMini,
    miniBtn,
    pill,
    bigRun,
    line,
    gold2,
  } = styles;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={hBtn} onClick={onReloadConstraints} title={tr("تحديث/إعادة تحميل القيود", "Reload Constraints")}>⟲ {tr("تحديث", "Reload")}</button>
          <button type="button" style={hBtn} onClick={onSaveConstraints} title={tr("حفظ القيود", "Save Constraints")}>💾 {tr("حفظ", "Save")}</button>
          <button type="button" style={hBtn} onClick={onClearConstraints} title={tr("حذف القيود المحفوظة", "Delete Saved Constraints")}>🗑 {tr("حذف القيود", "Delete Constraints")}</button>
          <button type="button" style={hBtn} onClick={onGoHome} title={tr("لوحة التحكم", "Dashboard")}>☐ {tr("لوحة التحكم", "Dashboard")}</button>
          <button type="button" style={hBtn} onClick={onGoResults} title={tr("الجدول الشامل", "Master Table")}>▦ {tr("الجدول الشامل", "Master Table")}</button>
          <button type="button" style={hBtn} onClick={onGoSuggestions} title={tr("الاقتراحات", "Suggestions")}>💡 {tr("الاقتراحات", "Suggestions")}</button>
          <button type="button" style={hBtn} onClick={onDeleteAllDistributionData} title={tr("حذف جميع بيانات التوزيع", "Delete All Distribution Data")}>✖ {tr("حذف بيانات التوزيع", "Delete Distribution Data")}</button>
        </div>
      </div>

      <div style={pageGrid}>
        <div style={card}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>{tr("القيود والانصبة", "Constraints and Quotas")}</div>
              <div style={cardSub}>{tr("الحد الأقصى للنصاب (مراقبة + احتياط + مراجعة)", "Maximum quota (invigilation + reserve + review)")}</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.9, color: gold2 }}>🎚️</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={row}>
              <div>
                <div style={label}>{tr("الحد الأقصى للنصاب", "Maximum quota")}</div>
                <div style={note}>{tr("لكل معلم = مراقبة + احتياط + مراجعة فقط", "Per teacher = invigilation + reserve + review only")}</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.maxTasksPerTeacher)} onChange={(e) => setField("maxTasksPerTeacher", num(e.target.value, 10))} />
            </div>

            <div style={row}>
              <div>
                <div style={label}>{tr("الاحتياط لكل فترة", "Reserve per period")}</div>
                <div style={note}>{tr("يتوزع بعد المراقبة — ويُلغى يوم العجز", "Distributed after invigilation — cancelled on shortage days")}</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.reservePerPeriod ?? 1)} onChange={(e) => setField("reservePerPeriod", num(e.target.value, 1))} />
            </div>

            <div style={row}>
              <div>
                <div style={label}>{tr("عدد أيام التصحيح", "Correction days count")}</div>
                <div style={note}>{tr("المنطق هنا يوم واحد بعد الامتحان (ثابت)", "Logic here is one day after the exam (fixed)")}</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.correctionDays ?? 1)} onChange={(e) => setField("correctionDays", num(e.target.value, 1))} />
            </div>

            <div style={{ ...row, borderBottom: "none" }}>
              <div>
                <div style={label}>{tr("عدد محاولات التحسين", "Optimization attempts")}</div>
                <div style={note}>{tr("يعيد التشغيل بعدة محاولات ويختار الأقل عجزًا (3/5/10)", "Runs multiple attempts and picks the lowest-shortage result (3/5/10)")}</div>
              </div>
              <select style={{ ...input, width: 140, cursor: "pointer" }} value={String(constraints.optimizationAttempts ?? 5)} onChange={(e) => setField("optimizationAttempts", num(e.target.value, 5))}>
                {[1, 3, 5, 10, 15].map((n) => <option key={n} value={String(n)}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>{tr("إعدادات القاعات", "Room Settings")}</div>
              <div style={cardSub}>{tr("تحديد عدد المراقبين لكل قاعة", "Set invigilators per room")}</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.9, color: gold2 }}>👥</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={row}>
              <div>
                <div style={label}>{tr("صفوف 10", "Grade 10")}</div>
                <div style={note}>{tr("عدد المراقبين لكل قاعة", "Invigilators per room")}</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.invigilators_5_10)} onChange={(e) => setField("invigilators_5_10", num(e.target.value, 2))} />
            </div>
            <div style={row}>
              <div>
                <div style={label}>{tr("صفوف 11", "Grade 11")}</div>
                <div style={note}>{tr("عدد المراقبين لكل قاعة", "Invigilators per room")}</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.invigilators_11)} onChange={(e) => setField("invigilators_11", num(e.target.value, 2))} />
            </div>
            <div style={{ ...row, borderBottom: "none" }}>
              <div>
                <div style={label}>{tr("أخرى (12)", "Other (12)")}</div>
                <div style={note}>{tr("عدد المراقبين لكل قاعة", "Invigilators per room")}</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.invigilators_12)} onChange={(e) => setField("invigilators_12", num(e.target.value, 2))} />
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>{tr("خيارات متقدمة", "Advanced Options")}</div>
              <div style={cardSub}>{tr("قيود ذكية + مفعل/غير مفعل", "Smart constraints + enabled/disabled")}</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.9, color: gold2 }}>✨</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={row}>
              <div>
                <div style={label}>{tr("تجنب المهام المتتالية (Back-to-Back)", "Avoid back-to-back tasks")}</div>
                <div style={note}>{tr("منع تكليف نفس المعلم بفترتين في نفس اليوم (حسب السماح)", "Prevent assigning the same teacher to two periods in the same day (depending on allowance)")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={statusChip}>{boolText(!!constraints.avoidBackToBack)}</span>
                <div style={{ ...toggle, background: constraints.avoidBackToBack ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.10)" }} onClick={() => setField("avoidBackToBack", !constraints.avoidBackToBack)}>
                  <div style={{ ...knob, left: constraints.avoidBackToBack ? 28 : 3 }} />
                </div>
              </div>
            </div>

            <div style={row}>
              <div>
                <div style={label}>{tr("منع مراقبة نفس المادة", "Block invigilating the same subject")}</div>
                <div style={note}>{tr("لا يُوزّع معلم المادة كمراقب لامتحان مادته", "A subject teacher cannot invigilate their own subject exam")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={statusChip}>{boolText(!!constraints.smartBySpecialty)}</span>
                <div style={{ ...toggle, background: constraints.smartBySpecialty ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.10)" }} onClick={() => setField("smartBySpecialty", !constraints.smartBySpecialty)}>
                  <div style={{ ...knob, left: constraints.smartBySpecialty ? 28 : 3 }} />
                </div>
              </div>
            </div>

            <div style={row}>
              <div>
                <div style={label}>{tr("تفعيل شرط \"بن\"", "Enable the \"Bin\" rule")}</div>
                <div style={note}>{tr("عند التفعيل: يطبّق شرط \"بن\" داخل نفس اللجنة حسب قواعد التوزيع", "When enabled, the \"Bin\" rule is applied inside the same committee according to the distribution rules")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={statusChip}>{boolText(!!constraints.enforceBenRule)}</span>
                <div style={{ ...toggle, background: constraints.enforceBenRule ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.10)" }} onClick={() => setField("enforceBenRule", !constraints.enforceBenRule)}>
                  <div style={{ ...knob, left: constraints.enforceBenRule ? 28 : 3 }} />
                </div>
              </div>
            </div>

            <div style={row}>
              <div>
                <div style={label}>{tr("تفريغ جميع معلمي المادة للتصحيح", "Free all subject teachers for correction")}</div>
                <div style={note}>{tr("متوقف افتراضيًا — ويعمل فقط عند التفعيل اليدوي. اليوم التالي فقط + صفوف 1-4 (مطابقة نصية) + صفوف 5-12 (مجموعات)", "Disabled by default — works only when manually enabled. Next day only + Grades 1-4 (exact match) + Grades 5-12 (groups)")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={statusChip}>{boolText(!!constraints.freeAllSubjectTeachersForCorrection)}</span>
                <div style={{ ...toggle, background: constraints.freeAllSubjectTeachersForCorrection ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.10)" }} onClick={() => setField("freeAllSubjectTeachersForCorrection", !constraints.freeAllSubjectTeachersForCorrection)}>
                  <div style={{ ...knob, left: constraints.freeAllSubjectTeachersForCorrection ? 28 : 3 }} />
                </div>
              </div>
            </div>

            {constraints.freeAllSubjectTeachersForCorrection ? (
              <div style={{ ...row, borderBottom: "none", paddingTop: 12, paddingBottom: 12, display: "block" }}>
                <div>
                  <div style={label}>{tr("تفريغ التصحيح حسب تواريخ", "Correction release by dates")}</div>
                  <div style={note}>{tr("اختر وضع التفريغ: ", "Choose release mode: ")}<b>{tr("كل الأيام", "All days")}</b>{tr(" (اليوم التالي لكل امتحان) أو ", " (the next day for each exam) or ")}<b>{tr("تواريخ محددة", "Specific dates")}</b>{tr(". في وضع التواريخ المحددة: اليوم الذي تحدده يتم التفريغ به فقط، وغير المحدد لا يتم التفريغ به.", ". In specific dates mode, release is applied only on the selected days, and not applied on unselected days.")}</div>
                </div>
                {(() => {
                  const mode = String(constraints.correctionFreeMode || "ALL").toUpperCase() === "DATES" ? "DATES" : "ALL";
                  const selected: string[] = Array.isArray(constraints.correctionFreeDatesISO) ? constraints.correctionFreeDatesISO : [];
                  const selectedSet = new Set(selected);
                  const sum = runOut?.debug?.summary || {};
                  const shortageByDate: Record<string, number> = (sum.correctionFreeInvShortageByDate as any) || {};
                  const suggestedByDate: Record<string, string> = (sum.correctionFreeSuggestedDatesByDate as any) || {};
                  const shortageDates = Object.keys(shortageByDate || {}).filter((d) => (Number(shortageByDate[d]) || 0) > 0);
                  return (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
                        <button style={{ ...btnMini, background: mode === "ALL" ? "rgba(201,162,39,.25)" : "rgba(255,255,255,.10)" }} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "ALL", correctionFreeDateISO: "" }))} title={tr("تفريغ في كل أيام التصحيح", "Release on all correction days")}>✅ {tr("كل الأيام", "All days")}</button>
                        <button style={{ ...btnMini, background: mode === "DATES" ? "rgba(201,162,39,.25)" : "rgba(255,255,255,.10)" }} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "DATES" }))} title={tr("تفريغ حسب تواريخ محددة", "Release on specific dates")}>📅 {tr("تواريخ محددة", "Specific dates")}</button>
                        <button style={btnMini} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "DATES", correctionFreeDatesISO: [...correctionDatesSorted], correctionFreeDateISO: "" }))} title={tr("تحديد كل الأيام المتاحة", "Select all available days")}>{tr("تحديد الكل", "Select All")}</button>
                        <button style={btnMini} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "DATES", correctionFreeDatesISO: [], correctionFreeDateISO: "" }))} title={tr("مسح الاختيارات", "Clear selections")}>{tr("مسح", "Clear")}</button>
                      </div>
                      {mode === "DATES" ? (
                        <div style={{ marginTop: 10, padding: 12, border: `1px solid ${line}`, borderRadius: 18, background: "rgba(0,0,0,.18)" }}>
                          <div style={{ fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,.90)" }}>{tr("اختر التواريخ التي يسمح فيها بالتفريغ:", "Choose the dates where release is allowed:")}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                            {correctionDatesSorted.map((d) => {
                              const isOn = selectedSet.has(d);
                              return (
                                <label key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px", borderRadius: 18, border: `1px solid ${line}`, background: "rgba(255,255,255,.06)", cursor: "pointer" }}>
                                  <span style={{ fontSize: 18, fontWeight: 900, color: gold2 }}>{d}</span>
                                  <input type="checkbox" checked={isOn} onChange={() => {
                                    const next = new Set(selectedSet);
                                    if (next.has(d)) next.delete(d); else next.add(d);
                                    setConstraints((p: any) => ({ ...p, correctionFreeMode: "DATES", correctionFreeDatesISO: Array.from(next).sort(), correctionFreeDateISO: "" }));
                                  }} style={{ width: 22, height: 22 }} />
                                </label>
                              );
                            })}
                          </div>
                          {shortageDates.length ? (
                            <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 900, color: "rgba(255,255,255,.85)" }}>
                              {shortageDates.map((d) => <div key={d} style={{ marginTop: 6 }}>⚠️ {tr("عجز مراقبة في", "Invigilation shortage on")} {d} = {Number(shortageByDate[d]) || 0} — {tr("اقتراح يوم بديل", "Suggested alternative day")}: <span style={{ color: gold2 }}>{suggestedByDate[d] || "—"}</span></div>)}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            ) : null}

            <div style={{ ...row, borderBottom: allowTwo ? `1px solid ${line}` : "none" }}>
              <div>
                <div style={label}>{tr("السماح بفترتين في اليوم الواحد", "Allow two periods in the same day")}</div>
                <div style={note}>{tr("مغلق افتراضيًا — وعند التفعيل يمكنك اختيار كل الأيام أو تواريخ محددة فقط", "Disabled by default — when enabled, you can choose all days or only specific dates")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={statusChip}>{boolText(allowTwo)}</span>
                <div style={{ ...toggle, background: allowTwo ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.10)" }} onClick={() => {
                  const next = !allowTwo;
                  setField("allowTwoPeriodsSameDay", next);
                  if (next && typeof constraints.allowTwoPeriodsSameDayAllDates !== "boolean") setField("allowTwoPeriodsSameDayAllDates", true);
                  if (next && !Array.isArray(constraints.allowTwoPeriodsSameDayDates)) setField("allowTwoPeriodsSameDayDates", []);
                }}>
                  <div style={{ ...knob, left: allowTwo ? 28 : 3 }} />
                </div>
              </div>
            </div>

            {allowTwo ? (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 16, border: `1px solid ${line}`, background: "rgba(255,255,255,.03)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={label}>{tr("نطاق السماح بفترتين", "Two-period allowance scope")}</div>
                    <div style={note}>{tr("كل الأيام أو تواريخ محددة فقط", "All days or specific dates only")}</div>
                  </div>
                  <span style={{ ...pill, whiteSpace: "nowrap" }}>{twoAllDates ? tr("كل الأيام", "All days") : `${tr("تواريخ محددة", "Specific dates")} (${twoDates.length})`}</span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" style={{ ...miniBtn, background: twoAllDates ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.06)" }} onClick={() => setField("allowTwoPeriodsSameDayAllDates", true)}>{`✅ ${tr("كل الأيام", "All days")}`}</button>
                  <button type="button" style={{ ...miniBtn, background: !twoAllDates ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.06)" }} onClick={() => setField("allowTwoPeriodsSameDayAllDates", false)}>{`📅 ${tr("تواريخ محددة", "Specific dates")}`}</button>
                  {!twoAllDates ? (
                    <>
                      <button type="button" style={miniBtn} onClick={() => setField("allowTwoPeriodsSameDayDates", [...allExamDatesSorted])}>{tr("تحديد الكل", "Select All")}</button>
                      <button type="button" style={miniBtn} onClick={() => setField("allowTwoPeriodsSameDayDates", [])}>{tr("مسح", "Clear")}</button>
                    </>
                  ) : null}
                </div>
                {!twoAllDates ? (
                  <div style={{ marginTop: 12 }}>
                    {allExamDatesSorted.length === 0 ? (
                      <div style={note}>{tr("لا توجد تواريخ امتحانات لعرضها. تأكد من جدول الامتحانات.", "There are no exam dates to display. Check the exam schedule.")}</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ ...note, marginTop: 2 }}>{tr("اختر التواريخ التي يُسمح فيها بفترتين.", "Choose the dates where two periods are allowed.")}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {allExamDatesSorted.map((d) => {
                            const checked = twoDates.includes(d);
                            return (
                              <label key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 14, border: `1px solid ${line}`, background: checked ? "rgba(201,162,39,.14)" : "rgba(255,255,255,.04)", cursor: "pointer", fontWeight: 900 }}>
                                <span>{d}</span>
                                <input type="checkbox" checked={checked} onChange={() => toggleDate(d)} style={{ width: 18, height: 18 }} />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <button type="button" style={{ ...bigRun, opacity: !hasBasics || isRunning ? 0.7 : 1 }} onClick={onRun} disabled={isRunning} title={!hasBasics ? tr("أدخل الكادر التعليمي وجدول الامتحانات أولاً", "Enter the teaching staff and exam schedule first") : ""}>
        {isRunning ? tr("جارٍ تشغيل الخوارزمية...", "Running the distribution algorithm...") : tr("تشغيل خوارزمية التوزيع", "Run Distribution Algorithm")}
      </button>
    </>
  );
}
