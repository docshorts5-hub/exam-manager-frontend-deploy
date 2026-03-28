import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import type { DistributionRun } from "../contracts/taskDistributionContract";

const STORAGE_VERSION = "v1";
const ARCHIVE_VERSION = "v1";

export type ArchivedDistributionRun = {
  archiveId: string;
  name: string;
  createdAtISO: string;
  run: DistributionRun;
};


export function formatArchiveTitle(item: ArchivedDistributionRun): string {
  const name = String(item?.name || '').trim();
  if (name) return name;
  const date = String(item?.createdAtISO || '').slice(0, 10) || '—';
  const runId = String(item?.run?.runId || item?.archiveId || '').trim();
  return `نسخة مؤرشفة • ${date}${runId ? ` • ${runId}` : ''}`;
}

export const RUN_UPDATED_EVENT = "exam-manager:task-distribution:run-updated";
export const MASTER_TABLE_UPDATED_EVENT = "exam-manager:task-distribution:master-table-updated";
export const ARCHIVE_UPDATED_EVENT = "exam-manager:task-distribution:archive-updated";

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";
const RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";

function dispatchMasterTableUpdated(detail: Record<string, any> = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(MASTER_TABLE_UPDATED_EVENT, { detail: { ...detail, ts: Date.now() } })
    );
  } catch {}
}

function syncMasterTableWithRun(run: DistributionRun | null) {
  if (!run) return;
  const payload = {
    rows: run.assignments || [],
    data: run.assignments || [],
    meta: {
      runId: run.runId,
      runCreatedAtISO: run.createdAtISO,
      ts: Date.now(),
      source: "run",
    },
  };
  const raw = JSON.stringify(payload);
  localStorage.setItem(MASTER_TABLE_KEY, raw);
  localStorage.setItem(ALL_TABLE_KEY, raw);
  localStorage.setItem(RESULTS_TABLE_KEY, raw);
  dispatchMasterTableUpdated({ source: "run", runId: run.runId });
}

export const taskDistributionKey = (tenantId: string) =>
  `exam-manager:task-distribution:${tenantId}:${STORAGE_VERSION}`;

const taskDistributionArchiveKey = (tenantId: string) =>
  `exam-manager:task-distribution:archives:${tenantId}:${ARCHIVE_VERSION}`;

export function listArchivedRuns(tenantId: string): ArchivedDistributionRun[] {
  const raw = localStorage.getItem(taskDistributionArchiveKey(tenantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ArchivedDistributionRun[];
  } catch {
    return [];
  }
}

export function getArchivedRun(
  tenantId: string,
  archiveId: string
): ArchivedDistributionRun | null {
  const list = listArchivedRuns(tenantId);
  return list.find((x) => String(x?.archiveId) === String(archiveId)) || null;
}

/**
 * ✅ Merge incoming archive items into local archive WITHOUT deleting existing items.
 * - Dedup by archiveId
 * - If same archiveId exists, keep the newest (by createdAtISO when possible)
 * - Keeps maxKeep items (default 60) sorted by createdAtISO desc
 */
export function mergeArchivedRuns(
  tenantId: string,
  incoming: ArchivedDistributionRun[],
  maxKeep = 60
) {
  const local = listArchivedRuns(tenantId);
  const map = new Map<string, ArchivedDistributionRun>();

  // seed local
  for (const it of local) {
    if (!it?.archiveId) continue;
    map.set(String(it.archiveId), it);
  }

  let added = 0;
  let updated = 0;

  // merge incoming
  for (const it of (incoming || [])) {
    if (!it?.archiveId) continue;
    const id = String(it.archiveId);
    const prev = map.get(id);

    if (!prev) {
      map.set(id, it);
      added++;
      continue;
    }

    // choose newer if possible
    const a = String(prev.createdAtISO || "");
    const b = String(it.createdAtISO || "");
    const pickIncoming = b && a ? (b > a) : (!!b && !a);

    if (pickIncoming) {
      map.set(id, it);
      updated++;
    }
  }

  const next = Array.from(map.values()).sort((a, b) =>
    String(b?.createdAtISO || "").localeCompare(String(a?.createdAtISO || ""))
  ).slice(0, maxKeep);

  localStorage.setItem(taskDistributionArchiveKey(tenantId), JSON.stringify(next));

  try {
    window.dispatchEvent(
      new CustomEvent(ARCHIVE_UPDATED_EVENT, { detail: { tenantId, ts: Date.now(), added, updated } })
    );
  } catch {}

  return { added, updated, total: next.length };
}

export async function saveArchiveCloud(
  tenantId: string,
  item: ArchivedDistributionRun
) {
  try {
    const ref = doc(db, "tenants", tenantId, "archive", item.archiveId);
    await setDoc(ref, item);
  } catch (e) {
    console.error("cloud archive error", e);
  }
}

export function addRunToArchive(
  tenantId: string,
  item: ArchivedDistributionRun,
  maxKeep = 60
) {
  const list = listArchivedRuns(tenantId);
  const next = [item, ...list.filter((x) => x?.archiveId !== item.archiveId)].slice(
    0,
    maxKeep
  );
  localStorage.setItem(taskDistributionArchiveKey(tenantId), JSON.stringify(next));

  try {
    window.dispatchEvent(
      new CustomEvent(ARCHIVE_UPDATED_EVENT, {
        detail: { tenantId, archiveId: item.archiveId, name: item.name, ts: Date.now() },
      })
    );
  } catch {}

  // best-effort cloud save (doesn't block UI)
  saveArchiveCloud(tenantId, item);
}

export function deleteArchivedRun(tenantId: string, archiveId: string) {
  const list = listArchivedRuns(tenantId);
  const next = list.filter((x) => String(x?.archiveId) !== String(archiveId));
  localStorage.setItem(taskDistributionArchiveKey(tenantId), JSON.stringify(next));

  try {
    window.dispatchEvent(
      new CustomEvent(ARCHIVE_UPDATED_EVENT, { detail: { tenantId, ts: Date.now() } })
    );
  } catch {}
}

export function clearArchive(tenantId: string) {
  localStorage.removeItem(taskDistributionArchiveKey(tenantId));
  try {
    window.dispatchEvent(
      new CustomEvent(ARCHIVE_UPDATED_EVENT, { detail: { tenantId, ts: Date.now() } })
    );
  } catch {}
}

export function saveRun(tenantId: string, run: DistributionRun) {
  localStorage.setItem(taskDistributionKey(tenantId), JSON.stringify(run));
  // keep master tables in sync for reports
  try {
    syncMasterTableWithRun(run);
  } catch {}
  try {
    window.dispatchEvent(
      new CustomEvent(RUN_UPDATED_EVENT, { detail: { tenantId, ts: Date.now() } })
    );
  } catch {}
}

export function loadRun(tenantId: string): DistributionRun | null {
  const raw = localStorage.getItem(taskDistributionKey(tenantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DistributionRun;
  } catch {
    return null;
  }
}

export function clearRun(tenantId: string) {
  localStorage.removeItem(taskDistributionKey(tenantId));

  // remove master tables so reports won't show stale data
  try {
    localStorage.removeItem(MASTER_TABLE_KEY);
    localStorage.removeItem(ALL_TABLE_KEY);
    localStorage.removeItem(RESULTS_TABLE_KEY);
    dispatchMasterTableUpdated({ source: "clear" });
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent(RUN_UPDATED_EVENT, { detail: { tenantId, ts: Date.now() } })
    );
  } catch {}
}
