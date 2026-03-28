import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadRun, RUN_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import { loadTenantArray } from "../services/tenantData";
import { exportElementAsPdf } from "../lib/pdfExport";
import SettingsReportHeader from "../features/settings/components/SettingsReportHeader";
import SettingsDistributionStatsSection from "../features/settings/components/SettingsDistributionStatsSection";

const EXAMS_KEY = "exam-manager:exams:v1";
const LOGO_KEY = "exam-manager:app-logo";
const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";

// ✅ رقم مسؤول الواتساب (ضعه في LocalStorage)
// localStorage.setItem("exam-manager:whatsapp-admin:v1", "9689XXXXXXXX"); // مثال عمان
const WHATSAPP_ADMIN_KEY = "exam-manager:whatsapp-admin:v1";

// ✅ لمنع فتح واتساب بشكل متكرر لنفس الحالة
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

function dayNameArFromISO(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  const wd = dt.getUTCDay();
  return ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][wd] || "";
}

function formatPeriodAr(p: "AM" | "PM" | string) {
  return String(p || "").toUpperCase() === "PM" ? "الفترة الثانية" : "الفترة الأولى";
}

function normalizePhone(raw: string) {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  return digits;
}

export default function Settings() {
  const { tenantId } = useAuth();
  const [tick, setTick] = useState(0);
  const [isStatsFull, setIsStatsFull] = useState(false);

  // ✅ NEW: sort direction for table
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ✅ Firestore exams (tenant-scoped)
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
      /* ===== Distribution Stats 3D Table ===== */
      .distStats3D{
        position: relative;
        background: linear-gradient(145deg, #111111, #1a1a1a);
        border-radius: 16px;
        padding: 12px;
        box-shadow: 0 18px 35px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.05);
        overflow: hidden;
      }

      .distStats3D::before{
        content:"";
        position:absolute;
        top:0;
        left:-120%;
        width:60%;
        height:100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
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
        border-collapse: separate;
        border-spacing: 8px;
        color: rgba(255,255,255,0.95);
        font-size: 14px;
      }

      .distTh, .distTd{
        border-right: 3px solid rgba(184,134,11,0.95);
      }
      .distTh:last-child, .distTd:last-child{
        border-right:none;
      }

      .distTh{
        background: linear-gradient(180deg,#6e5200,#4a3600);
        color:#fff1c4;
        padding: 12px;
        border-radius: 12px;
        font-weight: 950;
        text-align:center;
        white-space: nowrap;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.2), 0 5px 12px rgba(0,0,0,0.6);
      }

      .distTd{
        background: linear-gradient(145deg,#181818,#101010);
        color:#d4af37;
        padding: 12px;
        border-radius: 14px;
        text-align:center;
        box-shadow: 0 8px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
        transition: transform .15s ease, box-shadow .15s ease;
      }
      .distTd:hover{
        transform: translateY(-3px);
        box-shadow: 0 14px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1);
      }

      .distColDate{
        min-width: 200px;
        font-weight: 950;
        background: linear-gradient(180deg,#7a5c00,#4a3600);
        color:#fff1c4;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 10px 20px rgba(0,0,0,0.65);
      }
      .distColSubject{
        min-width: 220px;
        font-weight: 950;
        background: linear-gradient(180deg,#0f5132,#0a3622);
        color:#eafff3;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.14), 0 10px 20px rgba(0,0,0,0.65);
      }

      tr.row-deficit .distTd{
        outline: 1px solid rgba(255,77,77,0.35);
      }
      tr.row-big-deficit .distTd{
        outline: 2px solid rgba(255,0,0,0.55);
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
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", bump);
    const iv = window.setInterval(bump, 2000);

    return () => {
      window.removeEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", bump);
      window.clearInterval(iv);
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
    const candidates = [tenantId, tenantId || "system", "system", ""].filter((v, i, a) => a.indexOf(v as any) === i);

    for (const t of candidates) {
      try {
        const r = loadRun(String(t));
        if (r && Array.isArray((r as any).assignments)) return r;
      } catch {}
    }
    return null;
  }, [tenantId, tick]);

  const masterPayload = useMemo(() => {
    try {
      const raw = localStorage.getItem(MASTER_TABLE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      const rows = Array.isArray(p?.rows) ? p.rows : Array.isArray(p?.data) ? p.data : [];
      const meta = p?.meta || null;
      return { rows, meta };
    } catch {
      return null;
    }
  }, [tick]);

  const assignments = useMemo(() => {
    const fromRun = Array.isArray((run as any)?.assignments) ? (run as any).assignments : [];
    if (fromRun.length > 0)
      return {
        rows: fromRun,
        source: "run",
        meta: { runId: (run as any)?.runId, runCreatedAtISO: (run as any)?.createdAtISO },
      };
    const fromMaster = Array.isArray(masterPayload?.rows) ? masterPayload!.rows : [];
    if (fromMaster.length > 0) return { rows: fromMaster, source: "master-table", meta: masterPayload?.meta || null };
    return { rows: [], source: "none", meta: null };
  }, [run, masterPayload]);

  const branding = useMemo(() => {
    const logo = String(localStorage.getItem(LOGO_KEY) || "").trim();
    const appName = "نظام إدارة الامتحانات الذكي";
    return { appName, logo };
  }, [tick]);

  const exams = useMemo(() => {
    const primary = Array.isArray(fsExams) ? fsExams : [];
    const fallback = readJson<any[]>(EXAMS_KEY, []);
    const list = primary.length > 0 ? primary : Array.isArray(fallback) ? fallback : [];

    return list
      .map((e) => {
        const id = String(e?.id ?? e?._id ?? `${e?.dateISO ?? e?.date}-${e?.subject ?? ""}-${e?.period ?? ""}`);
        const dateISO = String(e?.dateISO ?? e?.date ?? "");
        const period =
          (String(e?.period ?? e?.periodKey ?? e?.p ?? "AM").toUpperCase() === "PM" ? "PM" : "AM") as "AM" | "PM";
        const roomsCount = Number(e?.roomsCount ?? e?.rooms ?? e?.committees ?? 0) || 0;

        return {
          id,
          subject: String(e?.subject ?? ""),
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

    const computed = exams.map((ex) => {
      const invAssigned = rows.filter(
        (a: any) => a?.taskType === "INVIGILATION" && String(a?.examId || "") === String(ex.id)
      ).length;

      const reserveAssigned = rows.filter(
        (a: any) =>
          a?.taskType === "RESERVE" &&
          String(a?.dateISO || "") === String(ex.dateISO) &&
          String(a?.period || "") === String(ex.period)
      ).length;

      const invPerRoom = invigilatorsPerRoomForSubject(ex.subject);
      const requiredTotal = Math.max(0, (Number(ex.roomsCount) || 0) * Math.max(0, Number(invPerRoom) || 0));

      const covered = invAssigned + reserveAssigned;
      const deficit = Math.max(0, requiredTotal - covered);
      const coveragePct = requiredTotal > 0 ? Math.round((covered / requiredTotal) * 100) : 100;

      const deficitWithoutReserve = Math.max(0, requiredTotal - invAssigned);
      const total = covered;

      return {
        ...ex,
        day: ex.dayLabel || dayNameArFromISO(ex.dateISO),
        periodLabel: formatPeriodAr(ex.period),
        invAssigned,
        reserveAssigned,
        invPerRoom,
        requiredTotal,
        deficitWithoutReserve,
        coveragePct,
        deficit,
        total,
      };
    });

    // ✅ SORT BY date then period (AM before PM) with direction control
    const toKey = (dateISO: string, period: "AM" | "PM") => {
      const d = String(dateISO || "").trim(); // expected YYYY-MM-DD
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
  }, [exams, assignments.rows, sortDir]);

  const totals = useMemo(() => {
    const t = { committees: 0, inv: 0, reserve: 0, deficit: 0, total: 0, requiredTotal: 0 };
    for (const r of reportRows as any[]) {
      t.committees += Number(r.roomsCount || 0) || 0;
      t.inv += Number(r.invAssigned || 0) || 0;
      t.reserve += Number(r.reserveAssigned || 0) || 0;
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
    const title = "تقرير إحصائية التوزيع";

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
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body{font-family: Arial, Tahoma, sans-serif; margin:20px; color:#111;}
          .hdr{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;}
          .hdr-left{display:flex; align-items:center; gap:10px;}
          .logo{width:56px; height:56px; object-fit:contain;}
          .ttl{margin:0; font-size:18px; font-weight:700;}
          .sub{margin:2px 0 0 0; font-size:12px; color:#444;}
          .box{border:1px solid #ddd; border-radius:12px; padding:12px;}
          table{width:100%; border-collapse:collapse; font-size:12px;}
          th,td{border:1px solid #ddd; padding:6px; text-align:center;}
          th{background:#f3f3f3;}
        </style>
      </head>
      <body>
        <div class="hdr">
          <div class="hdr-left">
            <img class="logo" src="${localStorage.getItem("exam-manager:app-logo") || ""}" alt="logo" />
            <div>
              <p class="ttl">${title}</p>
              <p class="sub">${new Date().toLocaleString("ar")}</p>
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
      subtitle: new Date().toLocaleString("ar"),
      html,
    });
  };

  // ✅ WhatsApp auto alert
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
      .map((r: any) => `• ${r.dateISO} (${r.day}) - ${r.subject} - ${r.periodLabel} | عجز: ${r.deficit}`)
      .join("\n");

    const msg =
      `تنبيه عاجل: يوجد عجز كبير في توزيع المراقبة.\n` +
      `إجمالي العجز: ${totalDeficit}\n\n` +
      `تفاصيل (أعلى 10):\n${lines}\n\n` +
      `يرجى مراجعة التوزيع والجدول الشامل.`;

    const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`;

    localStorage.setItem(WHATSAPP_LAST_ALERT_KEY, signature);
    lastWhatsAppAlertRef.current = signature;

    window.open(url, "_blank", "noopener,noreferrer");
  }, [reportRows, totalDeficit, run]);

  return (
    <div style={{ padding: 20, direction: "rtl", background: "#0f0f0f", minHeight: "100vh" }}>
      <style>{`
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
        .row-deficit {
          background: rgba(255, 0, 0, 0.09);
        }
        .row-deficit .cell-deficit,
        .row-deficit .cell-subject {
          color: #ff4d4d !important;
          font-weight: 900 !important;
        }
        .row-big-deficit {
          animation: deficit-shake 700ms ease-in-out infinite;
          box-shadow: inset 0 0 0 1px rgba(255,0,0,0.25);
        }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <SettingsReportHeader
        logo={branding.logo}
        appName={branding.appName}
        sourceLabel={assignments.source === "run" ? "آخر تشغيل (Run)" : assignments.source === "master-table" ? "الجدول الشامل" : "-"}
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
        />
      </div>
    </div>
  );
}