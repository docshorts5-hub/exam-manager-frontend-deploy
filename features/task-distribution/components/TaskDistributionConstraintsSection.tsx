import React from "react";

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
          <button type="button" style={hBtn} onClick={onReloadConstraints} title="تحديث/إعادة تحميل القيود">⟲ تحديث</button>
          <button type="button" style={hBtn} onClick={onSaveConstraints} title="حفظ القيود">💾 حفظ</button>
          <button type="button" style={hBtn} onClick={onClearConstraints} title="حذف القيود المحفوظة">🗑 حذف القيود</button>
          <button type="button" style={hBtn} onClick={onGoHome} title="لوحة التحكم">☐ لوحة التحكم</button>
          <button type="button" style={hBtn} onClick={onGoResults} title="الجدول الشامل">▦ الجدول الشامل</button>
          <button type="button" style={hBtn} onClick={onGoSuggestions} title="الاقتراحات">💡 الاقتراحات</button>
          <button type="button" style={hBtn} onClick={onDeleteAllDistributionData} title="حذف جميع بيانات التوزيع">✖ حذف بيانات التوزيع</button>
        </div>
      </div>

      <div style={pageGrid}>
        <div style={card}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>القيود والانصبة</div>
              <div style={cardSub}>الحد الأقصى للنصاب (مراقبة + احتياط + مراجعة)</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.9, color: gold2 }}>🎚️</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={row}>
              <div>
                <div style={label}>الحد الأقصى للنصاب</div>
                <div style={note}>لكل معلم = مراقبة + احتياط + مراجعة فقط</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.maxTasksPerTeacher)} onChange={(e) => setField("maxTasksPerTeacher", num(e.target.value, 10))} />
            </div>

            <div style={row}>
              <div>
                <div style={label}>الاحتياط لكل فترة</div>
                <div style={note}>يتوزع بعد المراقبة — ويُلغى يوم العجز</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.reservePerPeriod ?? 1)} onChange={(e) => setField("reservePerPeriod", num(e.target.value, 1))} />
            </div>

            <div style={row}>
              <div>
                <div style={label}>عدد أيام التصحيح</div>
                <div style={note}>المنطق هنا يوم واحد بعد الامتحان (ثابت)</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.correctionDays ?? 1)} onChange={(e) => setField("correctionDays", num(e.target.value, 1))} />
            </div>

            <div style={{ ...row, borderBottom: "none" }}>
              <div>
                <div style={label}>عدد محاولات التحسين</div>
                <div style={note}>يعيد التشغيل بعدة محاولات ويختار الأقل عجزًا (3/5/10)</div>
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
              <div style={cardTitle}>إعدادات القاعات</div>
              <div style={cardSub}>تحديد عدد المراقبين لكل قاعة</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.9, color: gold2 }}>👥</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={row}>
              <div>
                <div style={label}>صفوف 10</div>
                <div style={note}>عدد المراقبين لكل قاعة</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.invigilators_5_10)} onChange={(e) => setField("invigilators_5_10", num(e.target.value, 2))} />
            </div>
            <div style={row}>
              <div>
                <div style={label}>صفوف 11</div>
                <div style={note}>عدد المراقبين لكل قاعة</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.invigilators_11)} onChange={(e) => setField("invigilators_11", num(e.target.value, 2))} />
            </div>
            <div style={{ ...row, borderBottom: "none" }}>
              <div>
                <div style={label}>أخرى (12)</div>
                <div style={note}>عدد المراقبين لكل قاعة</div>
              </div>
              <input style={input} inputMode="numeric" value={String(constraints.invigilators_12)} onChange={(e) => setField("invigilators_12", num(e.target.value, 2))} />
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>خيارات متقدمة</div>
              <div style={cardSub}>قيود ذكية + مفعل/غير مفعل</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.9, color: gold2 }}>✨</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={row}>
              <div>
                <div style={label}>تجنب المهام المتتالية (Back-to-Back)</div>
                <div style={note}>منع تكليف نفس المعلم بفترتين في نفس اليوم (حسب السماح)</div>
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
                <div style={label}>منع مراقبة نفس المادة</div>
                <div style={note}>لا يُوزّع معلم المادة كمراقب لامتحان مادته</div>
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
                <div style={label}>تفريغ جميع معلمي المادة للتصحيح</div>
                <div style={note}>اليوم التالي فقط + صفوف 1-4 (مطابقة نصية) + صفوف 5-12 (مجموعات) — ويمكن تحديد يوم تصحيح بعينه</div>
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
                  <div style={label}>تفريغ التصحيح حسب تواريخ</div>
                  <div style={note}>اختر وضع التفريغ: <b>كل الأيام</b> (اليوم التالي لكل امتحان) أو <b>تواريخ محددة</b>. في وضع التواريخ المحددة: اليوم الذي تحدده يتم التفريغ به فقط، وغير المحدد لا يتم التفريغ به.</div>
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
                        <button style={{ ...btnMini, background: mode === "ALL" ? "rgba(201,162,39,.25)" : "rgba(255,255,255,.10)" }} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "ALL", correctionFreeDateISO: "" }))} title="تفريغ في كل أيام التصحيح">✅ كل الأيام</button>
                        <button style={{ ...btnMini, background: mode === "DATES" ? "rgba(201,162,39,.25)" : "rgba(255,255,255,.10)" }} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "DATES" }))} title="تفريغ حسب تواريخ محددة">📅 تواريخ محددة</button>
                        <button style={btnMini} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "DATES", correctionFreeDatesISO: [...correctionDatesSorted], correctionFreeDateISO: "" }))} title="تحديد كل الأيام المتاحة">تحديد الكل</button>
                        <button style={btnMini} onClick={() => setConstraints((p: any) => ({ ...p, correctionFreeMode: "DATES", correctionFreeDatesISO: [], correctionFreeDateISO: "" }))} title="مسح الاختيارات">مسح</button>
                      </div>
                      {mode === "DATES" ? (
                        <div style={{ marginTop: 10, padding: 12, border: `1px solid ${line}`, borderRadius: 18, background: "rgba(0,0,0,.18)" }}>
                          <div style={{ fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,.90)" }}>اختر التواريخ التي يسمح فيها بالتفريغ:</div>
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
                              {shortageDates.map((d) => <div key={d} style={{ marginTop: 6 }}>⚠️ عجز مراقبة في {d} = {Number(shortageByDate[d]) || 0} — اقتراح يوم بديل: <span style={{ color: gold2 }}>{suggestedByDate[d] || "—"}</span></div>)}
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
                <div style={label}>السماح بفترتين في اليوم الواحد</div>
                <div style={note}>اختر: كل الأيام أو تواريخ محددة فقط</div>
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
                    <div style={label}>نطاق السماح بفترتين</div>
                    <div style={note}>كل الأيام أو تواريخ محددة فقط</div>
                  </div>
                  <span style={{ ...pill, whiteSpace: "nowrap" }}>{twoAllDates ? "كل الأيام" : `تواريخ محددة (${twoDates.length})`}</span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" style={{ ...miniBtn, background: twoAllDates ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.06)" }} onClick={() => setField("allowTwoPeriodsSameDayAllDates", true)}>✅ كل الأيام</button>
                  <button type="button" style={{ ...miniBtn, background: !twoAllDates ? "rgba(201,162,39,.20)" : "rgba(255,255,255,.06)" }} onClick={() => setField("allowTwoPeriodsSameDayAllDates", false)}>📅 تواريخ محددة</button>
                  {!twoAllDates ? (
                    <>
                      <button type="button" style={miniBtn} onClick={() => setField("allowTwoPeriodsSameDayDates", [...allExamDatesSorted])}>تحديد الكل</button>
                      <button type="button" style={miniBtn} onClick={() => setField("allowTwoPeriodsSameDayDates", [])}>مسح</button>
                    </>
                  ) : null}
                </div>
                {!twoAllDates ? (
                  <div style={{ marginTop: 12 }}>
                    {allExamDatesSorted.length === 0 ? (
                      <div style={note}>لا توجد تواريخ امتحانات لعرضها. تأكد من جدول الامتحانات.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ ...note, marginTop: 2 }}>اختر التواريخ التي يُسمح فيها بفترتين.</div>
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

      <button type="button" style={{ ...bigRun, opacity: !hasBasics || isRunning ? 0.7 : 1 }} onClick={onRun} disabled={isRunning} title={!hasBasics ? "أدخل الكادر التعليمي  وجدول الامتحانات أولاً" : ""}>
        {isRunning ? "جارٍ تشغيل الخوارزمية..." : "تشغيل خوارزمية التوزيع"}
      </button>
    </>
  );
}
