import React from "react";
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
  if (!debug) return null;
  const { card, cardSub, gold2, hBtn, pill, note, th2, td2, line } = styles;
  return (
    <div style={{ ...card, marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 16, color: gold2 }}>لوحة التشخيص (Debug)</div>
          <div style={{ ...cardSub, marginTop: 4 }}>تُظهر المطلوب/الموزع + تواريخ التصحيح الفعلية + أيام أُلغي فيها الاحتياط بسبب عجز مراقبة.</div>
        </div>
        <button type="button" style={hBtn} onClick={() => setDebugOpen((s) => !s)}>{debugOpen ? "إخفاء" : "إظهار"}</button>
      </div>

      {debugOpen ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <span style={pill}>مراقبة: {debug.summary.invAssigned}/{debug.summary.invRequired}</span>
            <span style={pill}>احتياط: {debug.summary.reserveAssigned}/{debug.summary.reserveRequired}</span>
            <span style={pill}>مراجعة (أيام×معلمين): {debug.summary.reviewFreeTeachersDays}</span>
            <span style={pill}>تصحيح (أيام×معلمين): {debug.summary.correctionFreeTeachersDays}</span>
            <span style={pill}>معلمين: {debug.summary.teachersTotal}</span>
            <span style={pill}>امتحانات: {debug.summary.examsTotal}</span>
          </div>

          {Array.isArray(debug?.summary?.daysNoReserveBecauseInvShortage) && debug.summary.daysNoReserveBecauseInvShortage.length ? (
            <div style={{ marginTop: 10, ...note }}>⚠️ تم إلغاء توزيع الاحتياط في الأيام التالية بسبب عجز مراقبة: {debug.summary.daysNoReserveBecauseInvShortage.join(" , ")}</div>
          ) : null}

          <div style={{ marginTop: 14, borderTop: `1px solid ${line}`, paddingTop: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>📌 التصحيح الفعلي لكل معلم (Teacher → Correction Dates)</div>
            {correctionByTeacher.length === 0 ? (
              <div style={note}>لا توجد أيام تصحيح محسوبة.</div>
            ) : (
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={th2}>المعلم</th>
                      <th style={th2}>TeacherId</th>
                      <th style={th2}>عدد الأيام</th>
                      <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>تواريخ التصحيح</th>
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
              <div style={{ fontWeight: 950, marginBottom: 10 }}>سلوطات ناقصة (لم تُغطَّ بالكامل)</div>
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={th2}>النوع</th>
                      <th style={th2}>التاريخ</th>
                      <th style={th2}>الفترة</th>
                      <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>المادة</th>
                      <th style={th2}>المطلوب</th>
                      <th style={th2}>الموزّع</th>
                      <th style={{ ...th2, textAlign: "right", paddingRight: 16 }}>أكثر الأسباب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unfilledSlots.map((u, idx) => {
                      const topReasons = (u.reasons || []).slice(0, 3);
                      return (
                        <tr key={`${u.kind}-${u.dateISO}-${u.period}-${idx}`}>
                          <td style={td2}>{u.kind === "INVIGILATION" ? "مراقبة" : "احتياط"}</td>
                          <td style={td2}>{u.dateISO}</td>
                          <td style={td2}>{u.period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}</td>
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
            <div style={{ marginTop: 12, ...note }}>✅ لا يوجد سلوطات ناقصة — التوزيع مكتمل حسب القيود الحالية.</div>
          )}
        </>
      ) : null}
    </div>
  );
}
