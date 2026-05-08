import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import type { DistributionDebug, UnfilledSlotDebug } from "../../../contracts/taskDistributionContract";

type Props = {
  debug?: DistributionDebug | any;
  correctionByTeacher: any[];
  unfilledSlots: UnfilledSlotDebug[];
  debugOpen: boolean;
  setDebugOpen: React.Dispatch<React.SetStateAction<boolean>>;
  reasonLabel: (code?: string) => string;
  styles: any;
};

export default function TaskDistributionDebugPanel({ debug, correctionByTeacher, unfilledSlots, debugOpen, setDebugOpen, reasonLabel, styles }: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  if (!debug) return null;
  const { card, cardSub, gold2, hBtn, pill, note, th2, td2, line } = styles;
  return (
    <div style={{ ...card, marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 16, color: gold2 }}>{tr("لوحة التشخيص (Debug)", "Debug Panel")}</div>
          <div style={{ ...cardSub, marginTop: 4 }}>{tr("تُظهر المطلوب/الموزع + تواريخ التصحيح الفعلية + أيام أُلغي فيها الاحتياط بسبب عجز مراقبة.", "Shows required/assigned values + actual correction dates + days where reserve was cancelled due to invigilation shortage.")}</div>
        </div>
        <button type="button" style={hBtn} onClick={() => setDebugOpen((s) => !s)}>{debugOpen ? tr("إخفاء", "Hide") : tr("إظهار", "Show")}</button>
      </div>

      {debugOpen ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <span style={pill}>{tr("مراقبة", "Invigilation")}: {debug.summary.invAssigned}/{debug.summary.invRequired}</span>
            <span style={pill}>{tr("احتياط", "Reserve")}: {debug.summary.reserveAssigned}/{debug.summary.reserveRequired}</span>
            <span style={pill}>{tr("مراجعة (أيام×معلمين)", "Review (days×teachers)")}: {debug.summary.reviewFreeTeachersDays}</span>
            <span style={pill}>{tr("تصحيح (أيام×معلمين)", "Correction (days×teachers)")}: {debug.summary.correctionFreeTeachersDays}</span>
            <span style={pill}>{tr("معلمين", "Teachers")}: {debug.summary.teachersTotal}</span>
            <span style={pill}>{tr("امتحانات", "Exams")}: {debug.summary.examsTotal}</span>
          </div>

          {Array.isArray(debug?.summary?.daysNoReserveBecauseInvShortage) && debug.summary.daysNoReserveBecauseInvShortage.length ? (
            <div style={{ marginTop: 10, ...note }}>⚠️ تم إلغاء توزيع الاحتياط في الأيام التالية بسبب عجز {tr("مراقبة", "Invigilation")}: {debug.summary.daysNoReserveBecauseInvShortage.join(" , ")}</div>
          ) : null}

          <div style={{ marginTop: 14, borderTop: `1px solid ${line}`, paddingTop: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>📌 {tr("التصحيح الفعلي لكل معلم", "Actual correction per teacher")} (Teacher → Correction Dates)</div>
            {correctionByTeacher.length === 0 ? (
              <div style={note}>{tr("لا توجد أيام تصحيح محسوبة.", "No calculated correction days.")}</div>
            ) : (
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={th2}>{tr("المعلم", "Teacher")}</th>
                      <th style={th2}>TeacherId</th>
                      <th style={th2}>{tr("عدد الأيام", "Days Count")}</th>
                      <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>{tr("تواريخ التصحيح", "Correction Dates")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionByTeacher.map((r, idx) => (
                      <tr key={`${r.teacherId}-${idx}`}>
                        <td style={{ ...td2, textAlign: "right", paddingRight: 16 }}>{r.teacherName}</td>
                        <td style={td2}>{r.teacherId}</td>
                        <td style={td2}>{r.correctionDaysCount}</td>
                        <td style={{ ...td2, textAlign: "right", paddingRight: 16, fontWeight: 800, opacity: 0.95 }}>{(r.correctionDates || []).join(" , ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {unfilledSlots.length ? (
            <div style={{ marginTop: 14, borderTop: `1px solid ${line}`, paddingTop: 14 }}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>{tr("سلوطات ناقصة (لم تُغطَّ بالكامل)", "Unfilled slots (not fully covered)")}</div>
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={th2}>{tr("النوع", "Type")}</th>
                      <th style={th2}>{tr("التاريخ", "Date")}</th>
                      <th style={th2}>{tr("الفترة", "Period")}</th>
                      <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>{tr("المادة", "Subject")}</th>
                      <th style={th2}>{tr("المطلوب", "Required")}</th>
                      <th style={th2}>{tr("الموزّع", "Assigned")}</th>
                      <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>{tr("أكثر الأسباب", "Top Reasons")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unfilledSlots.map((u, idx) => {
                      const topReasons = (u.reasons || []).slice(0, 3);
                      return (
                        <tr key={`${u.kind}-${u.dateISO}-${u.period}-${idx}`}>
                          <td style={td2}>{u.kind === "INVIGILATION" ? tr("مراقبة", "Invigilation") : tr("احتياط", "Reserve")}</td>
                          <td style={td2}>{u.dateISO}</td>
                          <td style={td2}>{u.period === "AM" ? tr("الفترة الأولى", "First Period") : tr("الفترة الثانية", "Second Period")}</td>
                          <td style={{ ...td2, textAlign: "right", paddingRight: 16 }}>{u.subject || "-"}</td>
                          <td style={td2}>{u.required}</td>
                          <td style={td2}>{u.assigned}</td>
                          <td style={{ ...td2, textAlign: "right", paddingRight: 16, fontWeight: 800, opacity: 0.9 }}>{topReasons.length ? topReasons.map((r) => `${reasonLabel(r.code)} (${r.count})`).join(" • ") : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, ...note }}>✅ {tr("لا يوجد سلوطات ناقصة — التوزيع مكتمل حسب القيود الحالية.", "There are no unfilled slots — distribution is complete under the current constraints.")}</div>
          )}
        </>
      ) : null}
    </div>
  );
}
