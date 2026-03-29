export function isExcelImportFilenameSupported(filename: string): boolean {
  const ext = String(filename || '').split('.').pop()?.toLowerCase() || '';
  return ['xlsx', 'xls'].includes(ext);
}

export function buildImportedResultsRun(args: {
  assignments: any[];
  filename: string;
  now?: Date;
}) {
  const now = args.now || new Date();
  const nowISO = now.toISOString();
  return {
    runId: `import-xlsx-${nowISO}`,
    createdAtISO: nowISO,
    assignments: args.assignments,
    warnings: [`📥 تم استيراد الجدول الشامل من Excel: ${args.filename}`],
    debug: undefined,
  };
}

export function toImportErrorMessage(err: any): string {
  return err?.message ? String(err.message) : 'تعذر قراءة ملف Excel.';
}
