import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadRun, RUN_UPDATED_EVENT, MASTER_TABLE_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import { loadTenantArray } from "../services/tenantData";
import { exportElementAsPdf } from "../lib/pdfExport";
import SettingsReportHeader from "../features/settings/components/SettingsReportHeader";

const EXAMS_KEY = "exam-manager:exams:v1";
const LOGO_KEY = "exam-manager:app-logo";
const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";
const ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";
const WHATSAPP_ADMIN_KEY = "exam-manager:whatsapp-admin:v1";
const WHATSAPP_LAST_ALERT_KEY = "exam-manager:dist-stats:last-wa-alert:v1";

type Exam = {
  id: string;
  subject: string;
  dateISO: string;
  dayLabel?: string;
  period: "AM" | "PM";
  roomsCount: number;
  durationMinutes?: number;
};

function readJson<T = any>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function dayNameFromISO(iso: string, lang: "ar" | "en"): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  const wd = dt.getUTCDay();
  if (lang === "en") {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][wd] || "";
  }
  return ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][wd] || "";
}

function normalizePeriod(value: any): "AM" | "PM" {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[\.\s_-]+/g, "");

  if (
    raw.includes("الثانية") ||
    raw.includes("ثانيه") ||
    lower.includes("second") ||
    compact === "pm" ||
    compact === "bm" ||
    compact === "p2" ||
    compact === "period2" ||
    compact === "2" ||
    compact === "p"
  ) {
    return "PM";
  }

  return "AM";
}

function formatPeriodLabel(p: "AM" | "PM" | string, lang: "ar" | "en") {
  const isPm = normalizePeriod(p) === "PM";
  if (lang === "en") return isPm ? "Second Period" : "First Period";
  return isPm ? "الفترة الثانية" : "الفترة الأولى";
}

function normalizePhone(raw: string) {
  return String(raw || "").replace(/[^\d]/g, "");
}


function normalizeSubjectText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getRowSubject(row: any) {
  return normalizeSubjectText(
    row?.subject ??
      row?.examSubject ??
      row?.subjectName ??
      row?.examName ??
      row?.name ??
      ""
  );
}

function getRowDateISO(row: any) {
  return String(row?.dateISO ?? row?.date ?? "").trim();
}

function getRowPeriod(row: any): "AM" | "PM" {
  return normalizePeriod(row?.period ?? row?.periodKey ?? row?.p ?? "AM");
}

function getRowCommitteeNo(row: any) {
  const value =
    row?.committeeNo ??
    row?.committee ??
    row?.roomNo ??
    row?.room ??
    row?.committeeLabel ??
    row?.committeeNumber;
  if (value === undefined || value === null || value === "") return "";
  return String(value).trim();
}

function normalizeTaskType(value: any) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "INVIGILATION" || raw.includes("مراقبة")) return "INVIGILATION";
  if (raw === "RESERVE" || raw.includes("احتياط")) return "RESERVE";
  if (raw === "DUTY_INVIGILATOR" || raw.includes("مراقب دور")) return "DUTY_INVIGILATOR";
  return raw;
}

function getRowTaskType(row: any) {
  return normalizeTaskType(row?.taskType ?? row?.role ?? row?.type ?? row?.taskTypeLabelAr ?? "");
}

function getRowSubjectsList(row: any) {
  const out: string[] = [];
  const push = (value: any) => {
    const s = normalizeSubjectText(value);
    if (s && !out.includes(s)) out.push(s);
  };

  push(getRowSubject(row));

  if (Array.isArray(row?.daySubjects)) row.daySubjects.forEach(push);
  if (Array.isArray(row?.slotSubjects)) row.slotSubjects.forEach(push);
  if (Array.isArray(row?.subjects)) row.subjects.forEach(push);

  return out;
}

function assignmentCoversPeriod(row: any, period: "AM" | "PM") {
  const covers = Array.isArray(row?.coversPeriods) ? row.coversPeriods.map((p: any) => normalizePeriod(p)) : [];
  if (covers.length) return covers.includes(period);
  if (row?.fullDay) return true;
  return getRowPeriod(row) === period;
}

function rowMatchesExamSlot(row: any, exam: Exam) {
  if (getRowDateISO(row) !== String(exam.dateISO || "")) return false;
  if (!assignmentCoversPeriod(row, exam.period)) return false;

  const examSubject = normalizeSubjectText(exam.subject);
  const rowSubjects = getRowSubjectsList(row);
  if (!examSubject) return true;
  if (!rowSubjects.length) return true;
  return rowSubjects.some((s) => normalizeSubjectText(s) === examSubject);
}

type DistributionReportRow = Exam & {
  day: string;
  periodLabel: string;
  invAssigned: number;
  reserveAssigned: number;
  dutyAssigned: number;
  invPerRoom: number;
  requiredTotal: number;
  deficitWithoutReserve: number;
  coveragePct: number;
  deficit: number;
  total: number;
};

type DistributionTotals = {
  committees: number;
  inv: number;
  reserve: number;
  duty: number;
  deficit: number;
  total: number;
  requiredTotal: number;
};

function SettingsDistributionStatsSection({
  hasAssignments,
  isStatsFull,
  totalDeficit,
  totalCoveragePct,
  reportRows,
  totals,
  bigDeficitThreshold,
  whatsappAdminKey,
  onCloseFullscreen,
  onOpenFullscreen,
}: {
  hasAssignments: boolean;
  isStatsFull: boolean;
  totalDeficit: number;
  totalCoveragePct: number;
  reportRows: DistributionReportRow[];
  totals: DistributionTotals;
  bigDeficitThreshold: number;
  whatsappAdminKey: string;
  onCloseFullscreen: () => void;
  onOpenFullscreen: () => void;
}) {
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const whatsappAdmin = typeof window !== "undefined" ? String(localStorage.getItem(whatsappAdminKey) || "").trim() : "";

  const wrapperStyle: React.CSSProperties = isStatsFull
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "#f8f2e6",
        padding: 18,
        overflow: "auto",
        isolation: "isolate",
      }
    : {};


  const printTable = React.useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const table = document.querySelector("#dist-stats-report .distTable") as HTMLTableElement | null;
    const title = tr("تقرير جدول إحصائية التوزيع", "Distribution Statistics Table");

    if (!table) {
      window.print();
      return;
    }

    const html = `<!doctype html>
      <html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          *{ box-sizing:border-box; }
          body{font-family: Arial, Tahoma, sans-serif; margin:0; color:#000; background:#fff8ec;}
          .printWrap{padding:14px;}
          h1{font-size:18px; margin:0 0 6px 0; text-align:center; color:#000;}
          .date{font-size:12px; margin:0 0 12px 0; text-align:center; color:#333;}
          table{width:100%; border-collapse:collapse; font-size:11px; background:#f3ead7; color:#000;}
          th,td{border:2px solid #b8860b; padding:6px; text-align:center; background:#f3ead7; color:#000;}
          th{background:#e7d5b8; color:#000; font-weight:900;}
          tr > :nth-child(1){border-color:#b8860b;}
          tr > :nth-child(2){border-color:#2f855a;}
          tr > :nth-child(3){border-color:#2563eb;}
          tr > :nth-child(4){border-color:#7c3aed;}
          tr > :nth-child(5){border-color:#dc2626;}
          tr > :nth-child(6){border-color:#0891b2;}
          tr > :nth-child(7){border-color:#ca8a04;}
          tr > :nth-child(8){border-color:#16a34a;}
          tr > :nth-child(9){border-color:#9333ea;}
          tr > :nth-child(10){border-color:#ea580c;}
          tr > :nth-child(11){border-color:#0f766e;}
          .distTh,.distTd{box-shadow:none !important; transform:none !important; border-radius:0 !important;}
          .row-big-deficit .distTd,.row-big-deficit td{animation:none !important; outline:2px solid rgba(220,38,38,.55) !important;}
          button,.distToolbar{display:none !important;}
        </style>
      </head>
      <body>
        <div class="printWrap">
          <h1>${title}</h1>
          <p class="date">${new Date().toLocaleString(lang === "ar" ? "ar" : "en-GB")}</p>
          ${table.outerHTML}
        </div>
        <script>
          window.onload = function(){
            setTimeout(function(){ window.print(); }, 80);
          };
        </script>
      </body>
      </html>`;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }, [lang, tr]);

  if (!hasAssignments) {
    return (
      <div className="distStats3D" style={{ color: "#000", textAlign: "center", padding: 24 }}>
        {tr("لا توجد بيانات توزيع محفوظة للعرض.", "No saved distribution data to display.")}
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div className="distStats3D" id="dist-stats-report">
        {isStatsFull ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button
              type="button"
              className="distCloseButton"
              onClick={onCloseFullscreen}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2147483647,
                border: "2px solid #b91c1c",
                background: "#fee2e2",
                color: "#7f1d1d",
                borderRadius: 12,
                padding: "8px 14px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {tr("إغلاق", "Close")}
            </button>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div className="distTd" style={{ minWidth: 150 }}>
            {tr("إجمالي المراقبة", "Total Invigilation")}: <b>{totals.inv}</b>
          </div>
          <div className="distTd" style={{ minWidth: 150 }}>
            {tr("إجمالي الاحتياط", "Total Reserve")}: <b>{totals.reserve}</b>
          </div>
          <div className="distTd" style={{ minWidth: 140 }}>
            {tr("الإجمالي", "Total")}: <b>{totals.total}</b>
          </div>
          <div className="distTd" style={{ minWidth: 140, color: totalDeficit > 0 ? "#b91c1c" : "#166534" }}>
            {tr("العجز", "Deficit")}: <b>{totalDeficit}</b>
          </div>
          <div className="distTd" style={{ minWidth: 140 }}>
            {tr("التغطية", "Coverage")}: <b>{totalCoveragePct}%</b>
          </div>
          {whatsappAdmin ? (
            <div className="distTd" style={{ minWidth: 180, color: "#166534" }}>
              {tr("تنبيه واتساب مفعل", "WhatsApp alert enabled")}
            </div>
          ) : null}
        </div>

        <div className="distToolbar">
          <button
            type="button"
            className="distPrintButton"
            onClick={printTable}
          >
            {tr("طباعة الجدول", "Print Table")}
          </button>

          {!isStatsFull ? (
            <button
              type="button"
              className="distOpenFullButton"
              onClick={onOpenFullscreen}
            >
              {tr("تكبير الجدول", "Enlarge Table")}
            </button>
          ) : null}
        </div>

        <div className="distTableScroll" style={{ overflowX: "auto" }}>
          <table className="distTable">
            <thead>
              <tr>
                <th className="distTh">{tr("التاريخ", "Date")}</th>
                <th className="distTh">{tr("اليوم", "Day")}</th>
                <th className="distTh">{tr("الفترة", "Period")}</th>
                <th className="distTh">{tr("المادة", "Subject")}</th>
                <th className="distTh">{tr("عدد القاعات", "Rooms")}</th>
                <th className="distTh">{tr("المطلوب", "Required")}</th>
                <th className="distTh">{tr("المراقبة", "Invigilation")}</th>
                <th className="distTh">{tr("الاحتياط", "Reserve")}</th>
                <th className="distTh">{tr("الإجمالي", "Total")}</th>
                <th className="distTh">{tr("العجز", "Deficit")}</th>
                <th className="distTh">{tr("التغطية", "Coverage")}</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((r: any, index: number) => {
                const isBig = Number(r.deficit || 0) >= bigDeficitThreshold;
                const isDeficit = Number(r.deficit || 0) > 0;
                return (
                  <tr key={`${r.dateISO}-${r.period}-${r.subject}-${index}`} className={isBig ? "row-big-deficit" : isDeficit ? "row-deficit" : ""}>
                    <td className="distTd distColDate">{r.dateISO}</td>
                    <td className="distTd">{r.day}</td>
                    <td className="distTd">{r.periodLabel}</td>
                    <td className="distTd distColSubject">{r.subject}</td>
                    <td className="distTd">{r.roomsCount}</td>
                    <td className="distTd">{r.requiredTotal}</td>
                    <td className="distTd">{r.invAssigned}</td>
                    <td className="distTd">{r.reserveAssigned}</td>
                    <td className="distTd">{r.total}</td>
                    <td className="distTd" style={{ color: r.deficit > 0 ? "#b91c1c" : "#166534" }}>{r.deficit}</td>
                    <td className="distTd">{r.coveragePct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="distTh" colSpan={4}>{tr("الإجمالي", "Total")}</td>
                <td className="distTh">{totals.committees}</td>
                <td className="distTh">{totals.requiredTotal}</td>
                <td className="distTh">{totals.inv}</td>
                <td className="distTh">{totals.reserve}</td>
                <td className="distTh">{totals.total}</td>
                <td className="distTh">{totals.deficit}</td>
                <td className="distTh">{totalCoveragePct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const auth = useAuth() as any;
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const tenantId = String(auth?.tenantId || auth?.profile?.tenantId || "").trim();

  const [tick, setTick] = useState(0);
  const [isStatsFull, setIsStatsFull] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [fsExams, setFsExams] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (!tenantId) {
          if (alive) setFsExams([]);
          return;
        }
        const rows = await loadTenantArray<any>(String(tenantId), "exams");
        if (alive) setFsExams(Array.isArray(rows) ? rows : []);
      } catch {
        if (alive) setFsExams([]);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [tenantId]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .distStats3D{
        position: relative;
        background:#fff8ec;
        border-radius: 16px;
        padding: 12px;
        box-shadow:0 14px 28px rgba(120,88,28,.16);
        overflow: visible;
      }

      .distStats3D::before{
        content:"";
        position:absolute;
        top:0;
        left:-120%;
        width:60%;
        height:100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.55) 50%, transparent 100%);
        transform: skewX(-12deg);
        animation: distShine 10s infinite;
        pointer-events:none;
      }

      @keyframes distShine{
        0%, 88% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
        90% { opacity: 1; }
        100% { transform: translateX(240%) skewX(-12deg); opacity: 0.9; }
      }

      .distTable{
        width:100%;
        min-width: 1200px;
        border-collapse: separate;
        border-spacing: 8px;
        color:#000;
        font-size: 14px;
      }

      .distTh, .distTd{
        border-right: 3px solid rgba(184,134,11,0.95);
      }
      .distTh:last-child, .distTd:last-child{
        border-right:none;
      }

      .distTh{
        background:#ead7b8;
        color:#000;
        padding: 12px;
        border-radius: 12px;
        font-weight: 950;
        text-align:center;
        white-space: nowrap;
        box-shadow:0 6px 14px rgba(120,88,28,.12);
      }

      .distTd{
        background:#fff8ec;
        color:#000;
        padding: 12px;
        border-radius: 14px;
        text-align:center;
        box-shadow:0 6px 14px rgba(120,88,28,.10);
        transition: transform .15s ease, box-shadow .15s ease;
      }

      .distTd:hover{
        transform: translateY(-3px);
        box-shadow:0 12px 22px rgba(120,88,28,.22);
      }

      .distColDate{
        min-width: 200px;
        font-weight: 950;
        background:#f7ecd7;
        color:#000;
        box-shadow:0 6px 14px rgba(120,88,28,.10);
      }

      .distColSubject{
        min-width: 220px;
        font-weight: 950;
        background:#f7ecd7;
        color:#000;
        box-shadow:0 6px 14px rgba(120,88,28,.10);
      }

      /* Beige table theme: beige background, black text, and varied cell borders */
      .distTable{
        background:#f3ead7 !important;
        color:#000 !important;
        padding: 10px;
        border-radius: 16px;
      }

      .distTable .distTh,
      .distTable .distTd{
        background:#f3ead7 !important;
        color:#000 !important;
        border: 2px solid #b8860b !important;
        border-radius: 12px;
        box-shadow:none !important;
      }

      .distTable .distTh{
        background:#e7d5b8 !important;
        color:#000 !important;
        font-weight: 950;
      }

      .distTable .distTd.distColDate,
      .distTable .distTd.distColSubject{
        background:#f3ead7 !important;
        color:#000 !important;
        box-shadow:none !important;
      }

      .distTable tr > :nth-child(1){ border-color:#b8860b !important; }
      .distTable tr > :nth-child(2){ border-color:#2f855a !important; }
      .distTable tr > :nth-child(3){ border-color:#2563eb !important; }
      .distTable tr > :nth-child(4){ border-color:#7c3aed !important; }
      .distTable tr > :nth-child(5){ border-color:#dc2626 !important; }
      .distTable tr > :nth-child(6){ border-color:#0891b2 !important; }
      .distTable tr > :nth-child(7){ border-color:#ca8a04 !important; }
      .distTable tr > :nth-child(8){ border-color:#16a34a !important; }
      .distTable tr > :nth-child(9){ border-color:#9333ea !important; }
      .distTable tr > :nth-child(10){ border-color:#ea580c !important; }
      .distTable tr > :nth-child(11){ border-color:#0f766e !important; }

      tr.row-deficit .distTd{
        outline: 1px solid rgba(255,77,77,0.35);
      }

      tr.row-big-deficit .distTd,
      .row-big-deficit .distTd,
      .row-big-deficit td{
        outline: 2px solid rgba(255,0,0,0.55) !important;
        animation: deficit-shake 700ms ease-in-out infinite !important;
        box-shadow: inset 0 0 0 1px rgba(255,0,0,0.25);
      }

      @keyframes deficit-shake {
        0%, 100% { transform: translateX(0); }
        10% { transform: translateX(-2px); }
        20% { transform: translateX(2px); }
        30% { transform: translateX(-3px); }
        40% { transform: translateX(3px); }
        50% { transform: translateX(-2px); }
        60% { transform: translateX(2px); }
        70% { transform: translateX(-1px); }
        80% { transform: translateX(1px); }
        90% { transform: translateX(-1px); }
      }


      /* Light page + colorful controls */
      #settings-light-page,
      #settings-light-page *{
        scrollbar-color:#c9a45f #fff8ec;
      }

      #settings-light-page{
        background:#f8f2e6 !important;
        color:#000 !important;
      }

      #settings-light-page button,
      .distOpenFullButton,
      .distCloseButton{
        color:#111 !important;
        border:2px solid transparent !important;
        border-radius:12px !important;
        padding:9px 14px !important;
        font-weight:900 !important;
        cursor:pointer !important;
        box-shadow:0 8px 18px rgba(120,88,28,.16) !important;
      }

      #settings-light-page button:nth-of-type(6n+1){ background:#dbeafe !important; border-color:#2563eb !important; }
      #settings-light-page button:nth-of-type(6n+2){ background:#dcfce7 !important; border-color:#16a34a !important; }
      #settings-light-page button:nth-of-type(6n+3){ background:#fef3c7 !important; border-color:#ca8a04 !important; }
      #settings-light-page button:nth-of-type(6n+4){ background:#fae8ff !important; border-color:#9333ea !important; }
      #settings-light-page button:nth-of-type(6n+5){ background:#ffedd5 !important; border-color:#ea580c !important; }
      #settings-light-page button:nth-of-type(6n){ background:#ccfbf1 !important; border-color:#0f766e !important; }

      #settings-light-page button:hover,
      .distOpenFullButton:hover,
      .distCloseButton:hover{
        transform:translateY(-2px);
        box-shadow:0 12px 22px rgba(120,88,28,.22) !important;
      }

      .distOpenFullButton{
        background:#dbeafe !important;
        border-color:#2563eb !important;
        color:#111 !important;
        min-width:150px;
      }

      .distPrintButton{
        background:#dcfce7 !important;
        border-color:#16a34a !important;
        color:#111 !important;
        min-width:140px;
      }

      .distCloseButton{
        background:#fee2e2 !important;
        border-color:#b91c1c !important;
        color:#7f1d1d !important;
      }

      .distToolbar{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin:0 0 12px 0;
        position:sticky;
        top:0;
        z-index:2147483647;
        background:#fff8ec;
        border:1px solid #e2cfa8;
        border-radius:14px;
        padding:8px;
      }

      .distStats3D{
        background:#fff8ec !important;
        color:#000 !important;
        border:1px solid #e2cfa8 !important;
        box-shadow:0 14px 28px rgba(120,88,28,.16) !important;
      }

      .distStats3D::before{
        background:linear-gradient(120deg, transparent 0%, rgba(255,255,255,.55) 50%, transparent 100%) !important;
      }

      .distTableScroll{
        background:#fff8ec !important;
        border-radius:18px;
        padding:6px;
      }

      .distTd{
        background:#fff8ec !important;
        color:#000 !important;
        box-shadow:0 6px 14px rgba(120,88,28,.10) !important;
      }

      .distTh{
        background:#ead7b8 !important;
        color:#000 !important;
        box-shadow:0 6px 14px rgba(120,88,28,.12) !important;
      }

      .distColDate,
      .distColSubject{
        background:#f7ecd7 !important;
        color:#000 !important;
      }

      @media print{
        .distStats3D{ box-shadow: none !important; }
        .distStats3D::before{ display:none !important; }
        .distTh, .distTd{ box-shadow:none !important; transform:none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      try {
        document.head.removeChild(style);
      } catch {}
    };
  }, []);

  useEffect(() => {
    const bump = () => setTick((x) => x + 1);

    const onRunUpdated = () => bump();
    const onMasterUpdated = () => bump();
    const onStorage = (e: StorageEvent) => {
      const k = String(e.key || "");
      if (
        k.includes("exam-manager:task-distribution") ||
        k.includes("master-table") ||
        k.includes("all-table") ||
        k.includes("results-table") ||
        k === EXAMS_KEY
      ) {
        bump();
      }
    };

    window.addEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
    window.addEventListener(MASTER_TABLE_UPDATED_EVENT, onMasterUpdated as any);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", bump);

    return () => {
      window.removeEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener(MASTER_TABLE_UPDATED_EVENT, onMasterUpdated as any);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", bump);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (isStatsFull) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isStatsFull]);

  const run = useMemo(() => {
    if (!tenantId) return null;
    try {
      const r = loadRun(String(tenantId));
      if (r && Array.isArray((r as any).assignments)) return r;
    } catch {}
    return null;
  }, [tenantId, tick]);

  const distributionPayloads = useMemo(() => {
    const readPayload = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const p = JSON.parse(raw);
        const rows = Array.isArray(p?.rows) ? p.rows : Array.isArray(p?.data) ? p.data : [];
        const meta = p?.meta || null;
        return { rows, meta, key };
      } catch {
        return null;
      }
    };

    return [readPayload(MASTER_TABLE_KEY), readPayload(RESULTS_TABLE_KEY), readPayload(ALL_TABLE_KEY)].filter(Boolean) as any[];
  }, [tick]);

  const assignments = useMemo(() => {
    const fromRun = Array.isArray((run as any)?.assignments) ? (run as any).assignments : [];
    if (fromRun.length > 0) {
      return {
        rows: fromRun,
        source: "run",
        meta: { runId: (run as any)?.runId, runCreatedAtISO: (run as any)?.createdAtISO },
      };
    }

    for (const payload of distributionPayloads) {
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      if (rows.length > 0) {
        return { rows, source: payload?.key || "table-cache", meta: payload?.meta || null };
      }
    }

    return { rows: [], source: "none", meta: null };
  }, [run, distributionPayloads]);

  const branding = useMemo(() => {
    const logo = String(localStorage.getItem(LOGO_KEY) || "").trim();
    return { appName: tr("نظام إدارة الامتحانات الذكي", "Advanced Exam Management System"), logo };
  }, [tick, tr]);

  const exams = useMemo(() => {
    const primary = Array.isArray(fsExams) ? fsExams : [];
    const fallback = readJson<any[]>(EXAMS_KEY, []);
    const list = primary.length > 0 ? primary : Array.isArray(fallback) ? fallback : [];

    return list
      .map((e) => {
        const id = String(e?.id ?? e?._id ?? `${e?.dateISO ?? e?.date}-${e?.subject ?? ""}-${e?.period ?? ""}`);
        const dateISO = String(e?.dateISO ?? e?.date ?? "").trim();
        const subject = normalizeSubjectText(e?.subject ?? "");
        const period = normalizePeriod(e?.period ?? e?.periodKey ?? e?.p ?? "AM");
        const roomsCount = Number(e?.roomsCount ?? e?.rooms ?? e?.committees ?? 0) || 0;

        return {
          id,
          subject,
          dateISO,
          dayLabel: String(e?.dayLabel ?? e?.day ?? "") || undefined,
          period,
          roomsCount,
          durationMinutes: e?.durationMinutes != null ? Number(e.durationMinutes) : undefined,
        } as Exam;
      })
      .filter((e) => !!e.dateISO && !!e.subject);
  }, [fsExams, tick]);

  const reportRows = useMemo(() => {
    const rows = assignments.rows || [];

    const CONSTRAINTS_KEY = "exam-manager:task-distribution:constraints:v2";
    const constraintsRaw = (() => {
      try {
        return JSON.parse(String(localStorage.getItem(CONSTRAINTS_KEY) || "{}"));
      } catch {
        return {};
      }
    })();

    const inv_5_10 = Math.max(0, Number(constraintsRaw?.invigilators_5_10 ?? 0) || 0);
    const inv_11 = Math.max(0, Number(constraintsRaw?.invigilators_11 ?? 0) || 0);
    const inv_12 = Math.max(0, Number(constraintsRaw?.invigilators_12 ?? 0) || 0);

    const invigilatorsPerRoomForSubject = (subject: string) => {
      const s = String(subject || "");
      if (/\b11\b/.test(s) || s.includes("11")) return inv_11 || 2;
      if (/\b10\b/.test(s) || s.includes("10")) return inv_5_10 || 2;
      return inv_12 || 2;
    };

    const examsSummaryMap = new Map<string, { roomsCount: number; dayLabel?: string }>();

    for (const ex of exams) {
      const key = `${ex.dateISO}__${ex.period}__${normalizeSubjectText(ex.subject)}`;
      const prev = examsSummaryMap.get(key);
      examsSummaryMap.set(key, {
        roomsCount: Math.max(prev?.roomsCount || 0, Number(ex.roomsCount || 0)),
        dayLabel: prev?.dayLabel || ex.dayLabel,
      });
    }

    const computedFromExams = exams.map((ex) => {
      const invAssigned = rows.filter(
        (a: any) =>
          getRowTaskType(a) === "INVIGILATION" &&
          String(a?.examId || "") === String(ex.id)
      ).length;

      const reserveAssigned = rows.filter(
        (a: any) =>
          getRowTaskType(a) === "RESERVE" &&
          String(a?.dateISO || "") === String(ex.dateISO) &&
          assignmentCoversPeriod(a, ex.period)
      ).length;

      const dutyAssigned = rows.filter(
        (a: any) => getRowTaskType(a) === "DUTY_INVIGILATOR" && rowMatchesExamSlot(a, ex)
      ).length;

      const invPerRoom = invigilatorsPerRoomForSubject(ex.subject);
      const requiredTotal = Math.max(0, (Number(ex.roomsCount) || 0) * Math.max(0, Number(invPerRoom) || 0));
      const covered = invAssigned + reserveAssigned;
      const deficit = Math.max(0, requiredTotal - covered);
      const coveragePct = requiredTotal > 0 ? Math.round((covered / requiredTotal) * 100) : 100;
      const deficitWithoutReserve = Math.max(0, requiredTotal - invAssigned);
      const total = invAssigned + reserveAssigned + dutyAssigned;

      return {
        ...ex,
        day: ex.dayLabel || dayNameFromISO(ex.dateISO, lang),
        periodLabel: formatPeriodLabel(ex.period, lang),
        invAssigned,
        reserveAssigned,
        dutyAssigned,
        invPerRoom,
        requiredTotal,
        deficitWithoutReserve,
        coveragePct,
        deficit,
        total,
      };
    });

    let computed = computedFromExams;

    if (rows.length > 0 && assignments.source === "master-table") {
      const grouped = new Map<string, any>();

      for (const row of rows as any[]) {
        const subject = normalizeSubjectText(getRowSubject(row));
        const dateISO = getRowDateISO(row);
        const period = getRowPeriod(row);

        if (!subject || !dateISO) continue;

        const key = `${dateISO}__${period}__${subject}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            subject,
            dateISO,
            dayLabel: dayNameFromISO(dateISO, lang),
            period,
            committeeSet: new Set<string>(),
            invAssigned: 0,
            dutyAssigned: 0,
          });
        }

        const item = grouped.get(key);
        const taskType = getRowTaskType(row);
        const committeeNo = getRowCommitteeNo(row);

        if (committeeNo) item.committeeSet.add(committeeNo);
        if (taskType === "INVIGILATION") item.invAssigned += 1;
        if (taskType === "DUTY_INVIGILATOR") item.dutyAssigned += 1;
      }

      const reserveByDatePeriod = new Map<string, number>();
      for (const row of rows as any[]) {
        const taskType = getRowTaskType(row);
        if (taskType !== "RESERVE") continue;

        const dateISO = getRowDateISO(row);
        const period = getRowPeriod(row);
        if (!dateISO) continue;

        const key = `${dateISO}__${period}`;
        reserveByDatePeriod.set(key, (reserveByDatePeriod.get(key) || 0) + 1);
      }

      computed = Array.from(grouped.values()).map((item: any) => {
        const fallbackKey = `${item.dateISO}__${item.period}__${item.subject}`;
        const fallbackExamSummary = examsSummaryMap.get(fallbackKey);

        const roomsFromAssignments = Math.max(0, item.committeeSet.size || 0);
        const roomsFromExams = Math.max(0, Number(fallbackExamSummary?.roomsCount || 0));
        const roomsCount = Math.max(roomsFromAssignments, roomsFromExams);

        const invPerRoom = invigilatorsPerRoomForSubject(item.subject);
        const requiredTotal = Math.max(0, roomsCount * Math.max(0, Number(invPerRoom) || 0));
        const reserveAssigned = reserveByDatePeriod.get(`${item.dateISO}__${item.period}`) || 0;
        const dutyAssigned = Number(item.dutyAssigned || 0) || 0;
        const covered = item.invAssigned + reserveAssigned;
        const deficit = Math.max(0, requiredTotal - covered);
        const coveragePct = requiredTotal > 0 ? Math.round((covered / requiredTotal) * 100) : 100;
        const deficitWithoutReserve = Math.max(0, requiredTotal - item.invAssigned);
        const total = item.invAssigned + reserveAssigned + dutyAssigned;

        return {
          id: item.key,
          subject: item.subject,
          dateISO: item.dateISO,
          dayLabel: fallbackExamSummary?.dayLabel || item.dayLabel,
          period: item.period,
          roomsCount,
          durationMinutes: undefined,
          day: (fallbackExamSummary?.dayLabel || item.dayLabel) || dayNameFromISO(item.dateISO, lang),
          periodLabel: formatPeriodLabel(item.period, lang),
          invAssigned: item.invAssigned,
          reserveAssigned,
          dutyAssigned,
          invPerRoom,
          requiredTotal,
          deficitWithoutReserve,
          coveragePct,
          deficit,
          total,
        };
      });
    }

    const toKey = (dateISO: string, period: "AM" | "PM") => {
      const d = String(dateISO || "").trim();
      const p = period === "PM" ? 1 : 0;
      return `${d}-${p}`;
    };

    const sorted = computed
      .slice()
      .sort((a: any, b: any) => {
        const ak = toKey(a.dateISO, a.period);
        const bk = toKey(b.dateISO, b.period);
        return ak.localeCompare(bk);
      });

    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [exams, assignments.rows, assignments.source, sortDir, lang]);

  const totals = useMemo(() => {
    const t: DistributionTotals = { committees: 0, inv: 0, reserve: 0, duty: 0, deficit: 0, total: 0, requiredTotal: 0 };
    for (const r of reportRows as any[]) {
      t.committees += Number(r.roomsCount || 0) || 0;
      t.inv += Number(r.invAssigned || 0) || 0;
      t.reserve += Number(r.reserveAssigned || 0) || 0;
      t.duty += Number(r.dutyAssigned || 0) || 0;
      t.deficit += Number(r.deficit || 0) || 0;
      t.total += Number(r.total || 0) || 0;
      t.requiredTotal += Number(r.requiredTotal || 0) || 0;
    }
    return t;
  }, [reportRows]);

  const totalDeficit = totals.deficit;
  const totalCoveragePct = totals.requiredTotal > 0 ? Math.round((totals.total / totals.requiredTotal) * 100) : 100;
  const BIG_DEFICIT_THRESHOLD = 4;

  const exportPDF = async () => {
    const el = document.getElementById("dist-stats-report");
    const title = tr("تقرير إحصائية التوزيع", "Distribution Statistics Report");

    if (!el) {
      await exportElementAsPdf({
        action: "settings_export_pdf",
        entity: "settings",
        title,
        subtitle: "",
        html: undefined,
        meta: { fallback: "window_print_no_element" },
      });
      return;
    }

    const html = `<!doctype html>
      <html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body{font-family: Arial, Tahoma, sans-serif; margin:20px; color:#111; background:#f8f2e6;}
          .hdr{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;}
          .hdr-left{display:flex; align-items:center; gap:10px;}
          .logo{width:56px; height:56px; object-fit:contain;}
          .ttl{margin:0; font-size:18px; font-weight:700;}
          .sub{margin:2px 0 0 0; font-size:12px; color:#444;}
          .box{border:1px solid #e2cfa8; border-radius:12px; padding:12px; background:#fff8ec;}
          table{width:100%; border-collapse:collapse; font-size:12px; background:#f3ead7; color:#000;}
          th,td{border:2px solid #b8860b; padding:6px; text-align:center; background:#f3ead7; color:#000;}
          th{background:#e7d5b8; color:#000; font-weight:700;}
          tr > :nth-child(1){border-color:#b8860b;}
          tr > :nth-child(2){border-color:#2f855a;}
          tr > :nth-child(3){border-color:#2563eb;}
          tr > :nth-child(4){border-color:#7c3aed;}
          tr > :nth-child(5){border-color:#dc2626;}
          tr > :nth-child(6){border-color:#0891b2;}
          tr > :nth-child(7){border-color:#ca8a04;}
          tr > :nth-child(8){border-color:#16a34a;}
          tr > :nth-child(9){border-color:#9333ea;}
          tr > :nth-child(10){border-color:#ea580c;}
          tr > :nth-child(11){border-color:#0f766e;}
          button,.distToolbar{display:none !important;}
        </style>
      </head>
      <body>
        <div class="hdr">
          <div class="hdr-left">
            <img class="logo" src="${localStorage.getItem("exam-manager:app-logo") || ""}" alt="logo" />
            <div>
              <p class="ttl">${title}</p>
              <p class="sub">${new Date().toLocaleString(lang === "ar" ? "ar" : "en-GB")}</p>
            </div>
          </div>
        </div>
        <div class="box">${el.innerHTML}</div>
        <script>
          window.onload = function(){ setTimeout(function(){ window.print(); }, 50); };
        </script>
      </body>
      </html>`;

    await exportElementAsPdf({
      action: "settings_export_pdf",
      entity: "settings",
      title,
      subtitle: new Date().toLocaleString(lang === "ar" ? "ar" : "en-GB"),
      html,
    });
  };

  const lastWhatsAppAlertRef = useRef<string>("");

  useEffect(() => {
    const adminPhone = normalizePhone(localStorage.getItem(WHATSAPP_ADMIN_KEY) || "");
    if (!adminPhone) return;

    const big = reportRows.filter((r: any) => (Number(r.deficit) || 0) >= BIG_DEFICIT_THRESHOLD);
    if (big.length === 0) {
      lastWhatsAppAlertRef.current = "";
      return;
    }

    const signature =
      String((run as any)?.runId || "") +
      "|" +
      String((run as any)?.createdAtISO || "") +
      "|" +
      big.map((r: any) => `${r.dateISO}-${r.period}-${r.subject}:${r.deficit}`).join(",");

    const stored = String(localStorage.getItem(WHATSAPP_LAST_ALERT_KEY) || "");
    if (signature === stored || signature === lastWhatsAppAlertRef.current) return;

    const lines = big
      .slice(0, 10)
      .map((r: any) => `• ${r.dateISO} (${r.day}) - ${r.subject} - ${r.periodLabel} | ${tr("عجز", "Deficit")}: ${r.deficit}`)
      .join("\n");

    const msg =
      lang === "ar"
        ? `تنبيه عاجل: يوجد عجز كبير في توزيع المراقبة.\nإجمالي العجز: ${totalDeficit}\n\nتفاصيل (أعلى 10):\n${lines}\n\nيرجى مراجعة التوزيع والجدول الشامل.`
        : `Urgent alert: There is a large invigilation distribution deficit.\nTotal deficit: ${totalDeficit}\n\nDetails (top 10):\n${lines}\n\nPlease review the distribution and the master table.`;

    const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`;

    localStorage.setItem(WHATSAPP_LAST_ALERT_KEY, signature);
    lastWhatsAppAlertRef.current = signature;

    window.open(url, "_blank", "noopener,noreferrer");
  }, [reportRows, totalDeficit, run, lang, tr]);

  return (
    <div
      id="settings-light-page"
      className="settingsLightPage"
      style={{
        padding: 20,
        direction: lang === "ar" ? "rtl" : "ltr",
        background: "#f8f2e6",
        color: "#000",
        minHeight: "100vh",
      }}
    >
      <SettingsReportHeader
        logo={branding.logo}
        appName={branding.appName}
        sourceLabel={
          assignments.source === "run"
            ? tr("آخر تشغيل (Run)", "Last Run")
            : assignments.source === "none"
            ? "-"
            : tr("نسخة جدول مساعدة", "Helper Table Copy")
        }
        totalDeficit={totalDeficit}
        sortDir={sortDir}
        isStatsFull={isStatsFull}
        lastRunLabel={run?.createdAtISO || null}
        onSortAsc={() => setSortDir("asc")}
        onSortDesc={() => setSortDir("desc")}
        onExportPdf={exportPDF}
        onToggleFullscreen={() => setIsStatsFull((v) => !v)}
      />

      <div style={{ marginTop: 18 }}>
        <SettingsDistributionStatsSection
          hasAssignments={assignments.rows.length > 0}
          isStatsFull={isStatsFull}
          totalDeficit={totalDeficit}
          totalCoveragePct={totalCoveragePct}
          reportRows={reportRows as any[]}
          totals={totals}
          bigDeficitThreshold={BIG_DEFICIT_THRESHOLD}
          whatsappAdminKey={WHATSAPP_ADMIN_KEY}
          onCloseFullscreen={() => setIsStatsFull(false)}
          onOpenFullscreen={() => setIsStatsFull(true)}
        />
      </div>
    </div>
  );
}
