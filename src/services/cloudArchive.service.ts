import { doc, getDocs, orderBy, query, setDoc, limit as fbLimit } from "firebase/firestore";
import { createTenantRepo } from "./tenantRepo";
import { runFunctionWithRuntimePolicy } from "./functionsRuntimePolicy";
import { isTenantReadOnlyView } from "../features/cloud-storage/readOnlyTenantGuard";
import type { ArchivedDistributionRun } from "../utils/taskDistributionStorage";

function normalizeTenantId(tenantId: string): string {
  return String(tenantId || "").trim();
}

export async function listCloudArchive(tenantId: string, maxItems = 500): Promise<ArchivedDistributionRun[]> {
  const tid = normalizeTenantId(tenantId);
  if (!tid) return [];

  try {
    const res = await runFunctionWithRuntimePolicy<any, any>(
      "tenantListDocs",
      { tenantId: tid, sub: "archive", limit: maxItems, orderBy: "createdAt", orderDir: "desc" },
      { fallbackToLocalOnError: true, bestEffort: true, actionLabel: "قراءة أرشيف السحابة" },
    );
    const items = ((res as any)?.items || res || []) as any[];
    if (Array.isArray(items) && items.length) {
      return items.map((x: any) => ({ archiveId: x.id || x.archiveId, ...(x.data || x) })) as ArchivedDistributionRun[];
    }
  } catch {
    // Continue to direct Firestore fallback.
  }

  try {
    const repo = createTenantRepo(tid);
    const q = query(repo.archive as any, (orderBy as any)("createdAt", "desc"), fbLimit(maxItems));
    const snap = await getDocs(q as any);
    return snap.docs.map((d) => ({ archiveId: d.id, ...(d.data() as any) })) as ArchivedDistributionRun[];
  } catch {
    return [];
  }
}

export async function upsertCloudArchiveItems(tenantId: string, items: ArchivedDistributionRun[]): Promise<number> {
  const tid = normalizeTenantId(tenantId);
  if (!tid || !Array.isArray(items) || items.length === 0) return 0;

  if (isTenantReadOnlyView(tid)) return 0;

  let successCount = 0;
  for (const item of items) {
    const id = String((item as any)?.archiveId || "");
    if (!id) continue;

    try {
      await runFunctionWithRuntimePolicy<any, any>(
        "tenantUpsertDoc",
        { tenantId: tid, sub: "archive", id, data: item },
        { fallbackToLocalOnError: true, actionLabel: "رفع سجل الأرشيف إلى السحابة" },
      );
      successCount += 1;
      continue;
    } catch {
      // Continue to direct Firestore fallback.
    }

    try {
      const repo = createTenantRepo(tid);
      await setDoc(doc(repo.archive as any, id), item as any, { merge: true });
      successCount += 1;
    } catch {
      // Ignore per-item failure.
    }
  }

  return successCount;
}

export async function syncArchiveCloudState(tenantId: string, localItems: ArchivedDistributionRun[]) {
  const tid = normalizeTenantId(tenantId);
  if (!tid) {
    return { uploaded: 0, downloaded: 0, cloudReadable: false, cloud: [] as ArchivedDistributionRun[] };
  }

  const uploaded = await upsertCloudArchiveItems(tid, localItems);
  const cloud = await listCloudArchive(tid, 200);
  return {
    uploaded,
    downloaded: cloud.length,
    cloudReadable: cloud.length > 0,
    cloud,
  };
}
