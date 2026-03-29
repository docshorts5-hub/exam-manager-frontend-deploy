export function buildResultsBlockedCellMessage(reason: string): string {
  const normalized = String(reason || '').trim();
  return `غير متاح: ${normalized || 'غير متاح'}`;
}

export function buildResultsExcelExportPayload({
  run,
  displayDates,
  dateToSubCols,
  allSubCols,
  allTeachers,
  matrix2,
  committeesCountBySubCol,
  totalsDetailBySubCol,
  teacherTotals,
}: {
  run: any;
  displayDates: any[];
  dateToSubCols: Map<string, any[]>;
  allSubCols: any[];
  allTeachers: string[];
  matrix2: Record<string, any>;
  committeesCountBySubCol: Record<string, number>;
  totalsDetailBySubCol: Record<string, any>;
  teacherTotals: Record<string, number>;
}) {
  return {
    run,
    displayDates,
    dateToSubCols,
    allSubCols,
    allTeachers,
    matrix2,
    committeesCountBySubCol,
    totalsDetailBySubCol,
    teacherTotals,
  };
}
