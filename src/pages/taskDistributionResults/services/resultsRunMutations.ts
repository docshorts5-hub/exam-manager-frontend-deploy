import { saveRun } from "../../../utils/taskDistributionStorage";
import { writeMasterTable } from "../masterTableStorage";

export function buildManualEditWarning(note?: string) {
  const nowISO = new Date().toISOString();
  return {
    nowISO,
    warning:
      note || `🖐️ تعديل يدوي (Drag & Drop) بتاريخ: ${nowISO.slice(0, 19).replace("T", " ")}`,
  };
}

export function persistEditedResultsRun({
  tenantId,
  run,
  nextAssignments,
  note,
}: {
  tenantId: string;
  run: any;
  nextAssignments: any[];
  note?: string;
}) {
  const { nowISO, warning } = buildManualEditWarning(note);
  const updated = {
    ...run,
    assignments: nextAssignments,
    editedAtISO: nowISO,
    warnings: Array.isArray(run?.warnings) ? [...run.warnings, warning] : [warning],
  };

  saveRun(tenantId, updated);
  writeMasterTable(updated.assignments || [], {
    runId: updated.runId,
    runCreatedAtISO: updated.createdAtISO,
    source: "manual",
  });
  return updated;
}

export function undoEditedResultsRun({
  tenantId,
  run,
  assignments,
}: {
  tenantId: string;
  run: any;
  assignments: any[];
}) {
  const nowISO = new Date().toISOString();
  const warning = `↩️ تراجع عن آخر تعديل يدوي: ${nowISO.slice(0, 19).replace("T", " ")}`;
  const updated = {
    ...run,
    assignments,
    editedAtISO: nowISO,
    warnings: Array.isArray(run?.warnings) ? [...run.warnings, warning] : [warning],
  };

  saveRun(tenantId, updated);
  writeMasterTable(updated.assignments || [], {
    runId: updated.runId,
    runCreatedAtISO: updated.createdAtISO,
    source: "manual",
  });
  return updated;
}
