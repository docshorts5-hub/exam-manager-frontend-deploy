import { exportElementAsPdf } from "../../../lib/pdfExport";
import { buildResultsPrintHtml } from "./resultsDocumentActions";

type PdfAction = "distribution_print_table" | "distribution_export_pdf";

export function exportResultsPdfDocument({
  action,
  entityId,
  title,
  subtitle,
  htmlBody,
}: {
  action: PdfAction;
  entityId: string;
  title: string;
  subtitle: string;
  htmlBody: string;
}) {
  exportElementAsPdf({
    action,
    entity: "task_distribution",
    entityId,
    meta: { atISO: new Date().toISOString() },
    title,
    subtitle,
    html: buildResultsPrintHtml(title, subtitle, htmlBody),
  });
}
