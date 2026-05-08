import { loadRun, saveRun } from "../../../utils/taskDistributionStorage";
import { ensureUidsOnRun } from "../uidUtils";

function stableRunSignature(run: any) {
  try {
    const assignments = Array.isArray(run?.assignments) ? run.assignments : [];

    return JSON.stringify({
      runId: String(run?.runId || ""),
      createdAtISO: String(run?.createdAtISO || ""),
      count: assignments.length,
      assignments: assignments.map((assignment: any, index: number) => ({
        id: String(assignment?.__uid || assignment?.id || index),
        teacherId: String(assignment?.teacherId || ""),
        teacherName: String(assignment?.teacherName || ""),
        dateISO: String(assignment?.dateISO || assignment?.date || ""),
        period: String(assignment?.period || ""),
        taskType: String(assignment?.taskType || ""),
        subject: String(assignment?.subject || ""),
        roomNo: String(assignment?.roomNo || assignment?.committeeNo || ""),
        invigilatorIndex: String(assignment?.invigilatorIndex || ""),
      })),
    });
  } catch {
    return "";
  }
}

export function getResultsRunSignature(run: any) {
  return stableRunSignature(run);
}

export function shouldRefreshResultsRun(eventTenantId: string, currentTenantId: string) {
  const tid = String(eventTenantId || "").trim();
  const current = String(currentTenantId || "").trim();

  return !tid || tid === current;
}

/**
 * Loads the current run, ensures UID values exist, and writes it back only if changed.
 *
 * Important:
 * saveRun is called with silent:true so this helper does not emit RUN_UPDATED_EVENT again.
 * This prevents:
 * saveRun -> RUN_UPDATED_EVENT -> useResultsRunSync.refresh -> saveRun -> loop
 */
export function loadAndPersistResultsRun(tenantId: string) {
  const loaded = loadRun(tenantId);
  const withUids = ensureUidsOnRun(loaded);

  if (!withUids) return withUids;

  const beforeSignature = stableRunSignature(loaded);
  const afterSignature = stableRunSignature(withUids);

  if (afterSignature && beforeSignature !== afterSignature) {
    saveRun(tenantId, withUids as any, {
      silent: true,
      source: "results-sync",
      syncMaster: true,
    });
  }

  return withUids;
}
