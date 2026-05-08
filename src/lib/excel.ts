
// src/lib/excel.ts
import * as XLSX from "xlsx";
import { Assignment } from "../engine/assignmentEngine";  // Import Assignment type from correct file
import { auditEvent } from "../services/auditAuto";

export function exportToExcel(rows: any[], filename: string = "export.xlsx", sheetName: string = "Sheet1") {
  auditEvent({
    action: "export_excel",
    entity: "excel",
    meta: { filename, sheetName, rowsCount: (rows ?? []).length },
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function handleAssignments(assignments: Assignment[]): void {
  assignments.forEach((assignment) => {
    // Using the correct field 'examId' from the Assignment type
    const { examId, date, subject } = assignment;

    if (!examId || !date || !subject) {
      throw new Error("Missing necessary fields in assignment");
    }

    console.log(`Handling assignment for examId: ${examId}, date: ${date}, subject: ${subject}`);
  });
}
