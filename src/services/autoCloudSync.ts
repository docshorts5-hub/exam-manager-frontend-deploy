// src/services/autoCloudSync.ts
import { runFunctionWithRuntimePolicy } from "./functionsRuntimePolicy";
import { listArchivedRuns, mergeArchivedRuns, type ArchivedDistributionRun } from "../utils/taskDistributionStorage";

/**
 * Auto Cloud Sync (Archive)
 * - Upload local archive to cloud (upsert, no deletes)
 * - Download cloud archive and merge into local (no deletes)
 */
export function initAutoArchiveCloudSync(opts: {
  tenantId: string;
  enabled?: boolean;
  intervalMs?: number;
  maxUpsert?: number;
  maxFetch?: number;
}) {
  const tenantId = String(opts.tenantId || "").trim();
  const enabled = opts.enabled !== false;
  const intervalMs = Math.max(Number(opts.intervalMs || 5 * 60 * 1000), 30_000);
  const maxUpsert = Math.min(Math.max(Number(opts.maxUpsert || 200), 1), 1000);
  const maxFetch = Math.min(Math.max(Number(opts.maxFetch || 500), 1), 1000);

  if (!enabled || !tenantId) return () => {};

  let disposed = false;
  let running = false;
  let lastRunAt = 0;

  const runOnce = async (_reason: string) => {
    if (disposed || running) return;
    const now = Date.now();
    if (now - lastRunAt < 10_000) return;

    running = true;
    lastRunAt = now;

    try {
      const local = listArchivedRuns(tenantId).slice(0, maxUpsert);
      for (const it of local) {
        const id = String((it as any)?.archiveId || "");
        if (!id) continue;
        const uploaded = await runFunctionWithRuntimePolicy("tenantUpsertDoc", {
          tenantId,
          sub: "archive",
          id,
          data: it,
        }, {
          actionLabel: "مزامنة الأرشيف إلى السحابة",
          bestEffort: true,
          fallbackToLocalOnError: true,
          wrapStrictErrors: false,
        });
        if (!uploaded) break;
      }

      const res = await runFunctionWithRuntimePolicy<any, any>("tenantListDocs", {
        tenantId,
        sub: "archive",
        limit: maxFetch,
        orderBy: "createdAt",
        orderDir: "desc",
      }, {
        actionLabel: "تحميل أرشيف السحابة",
        bestEffort: true,
        fallbackToLocalOnError: true,
        wrapStrictErrors: false,
      });

      const items = ((res as any)?.items || res || []) as any[];
      const cloud: ArchivedDistributionRun[] = items.map((x: any) => ({
        archiveId: x.id || x.archiveId,
        ...(x.data || x),
      }));
      if (cloud.length) mergeArchivedRuns(tenantId, cloud, 400);
    } finally {
      running = false;
    }
  };

  runOnce("init").catch(() => {});

  const onFocus = () => runOnce("focus").catch(() => {});
  const onOnline = () => runOnce("online").catch(() => {});

  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);

  const timer = window.setInterval(() => runOnce("interval").catch(() => {}), intervalMs);

  return () => {
    disposed = true;
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
    window.clearInterval(timer);
  };
}
