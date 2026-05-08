// src/lib/pdfExport.ts
import { auditEvent } from "../services/auditAuto";

/**
 * Export an existing DOM element (or HTML string) via browser print dialog,
 * commonly used as "Save as PDF". Automatically writes an audit event.
 */
export async function exportElementAsPdf(options: {
  action?: string;          // e.g. "export_pdf"
  entity?: string;          // e.g. "report"
  entityId?: string;
  meta?: any;

  title: string;
  subtitle?: string;
  elementId?: string;       // if provided, uses innerHTML of that element
  html?: string;            // optional full HTML document override
  dir?: "rtl" | "ltr";
  lang?: string;
}) {
  const {
    action = "export_pdf",
    entity = "pdf",
    entityId,
    meta,
    title,
    subtitle,
    elementId,
    html,
    dir = "rtl",
    lang = "ar",
  } = options;

  // Audit (best-effort)
  void auditEvent({
    action,
    entity,
    entityId,
    meta: { title, subtitle, elementId, ...(meta ?? {}) },
  });

  // Build HTML
  let docHtml = html;
  if (!docHtml) {
    let bodyContent = "";
    if (elementId) {
      const el = document.getElementById(elementId);
      bodyContent = el?.innerHTML || "";
    }
    docHtml = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family: Arial, Tahoma, sans-serif; margin:20px; color:#111;}
    .hdr{display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;}
    .ttl{font-size:18px; font-weight:700; margin:0 0 4px 0;}
    .sub{font-size:12px; color:#444; margin:0;}
    @media print { .no-print{display:none;} }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <p class="ttl">${escapeHtml(title)}</p>
      ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ""}
    </div>
  </div>
  <div id="content">${bodyContent}</div>
  <script>
    window.onload = function(){ setTimeout(function(){ window.print(); }, 50); };
  </script>
</body>
</html>`;
  }

  // Open print window
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    // Fallback to current window print
    window.print();
    return;
  }
  w.document.open();
  w.document.write(docHtml);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
