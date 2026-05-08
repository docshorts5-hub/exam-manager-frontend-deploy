export function buildResultsPrintHtml(title: string, subtitle: string, contentHtml: string) {
  const safeTitle = String(title || "");
  const safeSubtitle = String(subtitle || "");
  const content = String(contentHtml || "");
  return `<!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeTitle}</title>
        <style>
          body{font-family: Arial, Tahoma, sans-serif; margin:16px; color:#111;}
          h1{margin:0 0 6px 0; font-size:18px;}
          h2{margin:0 0 12px 0; font-size:12px; font-weight:400; color:#444;}
          table{width:100%; border-collapse:collapse;}
          th,td{border:1px solid #ddd; padding:6px; font-size:12px;}
          th{background:#f2f2f2;}
          @media print { .no-print{display:none;} }
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        <h2>${safeSubtitle}</h2>
        ${content}
        <script>
          window.onload = function(){ setTimeout(function(){ window.print(); }, 50); };
        </script>
      </body>
      </html>`;
}
