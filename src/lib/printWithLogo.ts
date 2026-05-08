// src/lib/printWithLogo.ts
import { buildOfficialHeaderLines } from "./schoolData";
import { auditEvent } from "../services/auditAuto";

const LOGO_KEY = "exam-manager:app-logo";

export function getAppLogo(): string {
  return localStorage.getItem(LOGO_KEY) || "https://i.imgur.com/vdDhSMh.png";
}

function escapeHtml(s: any) {
  const str = String(s ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type PrintOptions = {
  title: string;
  subtitle?: string;
  htmlBody: string;
  approvedMeta?: { approvedAt: number; approvedBy: string } | null;
};

export function printWithLogo(opts: PrintOptions) {
  // Auto-audit (best-effort)
  auditEvent({
    action: "print",
    entity: "document",
    meta: { title: opts.title, subtitle: opts.subtitle ?? null },
  });
  const logo = getAppLogo();
  const header = buildOfficialHeaderLines();
  const officialLines = header.lines || [];
  const officialHtml = officialLines.map((l) => `<div class="ol">${escapeHtml(l)}</div>`).join("");

  const systemName = "نظام إدارة الامتحانات والمراقبة";

  const w = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!w) return;

  w.document.open();
  w.document.write(`
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(opts.title)}</title>
      <style>
        *{ box-sizing:border-box; }
        body{
          font-family: Arial, sans-serif;
          padding:24px;
          padding-bottom:120px;
          color:#111827;
          position:relative;
        }

        @page { margin: 12mm 10mm 18mm 10mm; }

        .header{
          display:grid;
          grid-template-columns: 190px 1fr 220px;
          align-items:center;
          gap:14px;
          padding:12px 14px;
          border:1px solid #e5e7eb;
          border-radius:14px;
          background:#f8fafc;
          margin-bottom:14px;
          position:relative;
          z-index:2;
        }
        .logoWrap{ display:flex; justify-content:flex-start; }
        .official{ text-align:center; line-height:1.25; }
        .ol{ font-weight:800; font-size:13px; }
        .docTitle{ margin-top:6px; font-weight:900; font-size:16px; }
        .docSub{ margin-top:4px; font-size:12px; color:#6b7280; font-weight:700; }

        .meta{
          text-align:left;
          font-size:12px;
          color:#6b7280;
          font-weight:700;
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:4px;
        }

        .approvedBadge{
          margin-top:6px;
          display:inline-block;
          padding:6px 10px;
          border-radius:999px;
          font-weight:900;
          font-size:12px;
          background: rgba(16,185,129,0.12);
          border:1px solid rgba(16,185,129,0.35);
          color:#065f46;
          text-align:center;
        }
        .approvedBadge.pending{
          background: rgba(245,158,11,0.10);
          border:1px solid rgba(245,158,11,0.35);
          color:#92400e;
        }
        .approvedInfo{
          font-size:11px;
          color:#374151;
          font-weight:800;
          max-width:240px;
          text-align:right;
        }

        .watermark{
          position:fixed;
          inset:0;
          display:flex;
          align-items:center;
          justify-content:center;
          pointer-events:none;
          z-index:1;
        }
        .watermark span{
          transform: rotate(-22deg);
          font-size:64px;
          font-weight:900;
          letter-spacing:6px;
          opacity:0.06;
          color:#111827;
          border:2px dashed rgba(17,24,39,0.25);
          padding:26px 34px;
          border-radius:18px;
        }

        table{
          width:100%;
          border-collapse:collapse;
          font-size:12px;
          position:relative;
          z-index:2;
          background:#fff;
        }
        th,td{
          border:1px solid #e5e7eb;
          padding:8px;
          text-align:right;
          vertical-align:top;
        }
        th{ background:#f3f4f6; font-weight:900; }

        .signatures{
          margin-top:18px;
          border:1px solid #e5e7eb;
          border-radius:14px;
          padding:12px;
          background:#fff;
          position:relative;
          z-index:2;
        }
        .sigGrid{
          display:grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap:10px;
        }
        .sigBox{
          border:1px solid #e5e7eb;
          border-radius:12px;
          padding:10px;
          min-height:86px;
          position:relative;
          background:#fafafa;
        }
        .sigTitle{
          font-weight:900;
          margin-bottom:8px;
          color:#111827;
        }
        .sigLine{
          height:36px;
          border-bottom:2px dashed #d1d5db;
        }
        .sigHint{
          margin-top:8px;
          font-size:11px;
          color:#6b7280;
          font-weight:800;
        }

        .footer{
          position:fixed;
          bottom:0;
          left:0;
          right:0;
          padding:10px 14px;
          border-top:1px solid #e5e7eb;
          background:#fff;
          z-index:3;
        }
        .footerInner{
          display:flex;
          justify-content:space-between;
          align-items:center;
          font-size:11px;
          color:#6b7280;
          font-weight:800;
        }

        @media print {
          body{ padding:14px; }
        }
      </style>
    </head>

    <body>
      ${opts.approvedMeta?.approvedAt ? `<div class="watermark" aria-hidden="true"><span>معتمد</span></div>` : ""}

      <div class="header">
        <div class="logoWrap">
          <img src="${escapeHtml(logo)}" style="height:70px; width:auto; object-fit:contain" />
        </div>
        <div class="official">
          ${officialHtml}
          <div class="docTitle">${escapeHtml(opts.title)}</div>
          ${opts.subtitle ? `<div class="docSub">${escapeHtml(opts.subtitle)}</div>` : ""}
        </div>
        <div class="meta">
          <div>${new Date().toLocaleString("ar")}</div>
          ${
            opts.approvedMeta?.approvedAt
              ? `<div class="approvedBadge">✅ معتمد</div>
                 <div class="approvedInfo">(${escapeHtml(
                   new Date(opts.approvedMeta.approvedAt).toLocaleString("ar")
                 )}) — ${escapeHtml(opts.approvedMeta.approvedBy || "")}</div>`
              : `<div class="approvedBadge pending">غير معتمد</div>`
          }
        </div>
      </div>

      ${opts.htmlBody}

      <div class="signatures">
        <div class="sigGrid">
          <div class="sigBox">
            <div class="sigTitle">إعداد</div>
            <div class="sigLine"></div>
            <div class="sigHint">الاسم / التوقيع</div>
          </div>
          <div class="sigBox">
            <div class="sigTitle">اعتماد</div>
            <div class="sigLine"></div>
            <div class="sigHint">مدير المدرسة / التوقيع</div>
          </div>
          <div class="sigBox">
            <div class="sigTitle">الختم الرسمي</div>
            <div class="sigHint">مكان الختم</div>
          </div>
        </div>
      </div>

      <div class="footer" aria-hidden="true">
        <div class="footerInner">
          <div>${escapeHtml(systemName)}</div>
          <div class="pageNo"></div>
        </div>
      </div>

      <script>
        const imgs = Array.from(document.images || []);
        let pending = imgs.length;
        if(!pending){ window.print(); }
        imgs.forEach(img=>{
          const done = () => { pending--; if(pending<=0) window.print(); };
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        });
      </script>
    </body>
  </html>
  `);
  w.document.close();
}
