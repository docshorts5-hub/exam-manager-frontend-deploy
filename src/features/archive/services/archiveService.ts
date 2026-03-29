import { deleteArchivedRun, listArchivedRuns, saveRun } from "../../../utils/taskDistributionStorage";
import { callFn } from "../../../services/functionsClient";
import { listCloudArchive } from "../../../services/cloudArchive.service";
import type { ArchiveItem } from "../types";

export async function fetchCloudArchiveViaService(tenantId: string): Promise<ArchiveItem[]> {
  const rows = await listCloudArchive(tenantId, 500);
  return (rows || []) as ArchiveItem[];
}

export function mergeArchiveItems(tenantId: string, cloudItems: ArchiveItem[]): ArchiveItem[] {
  const local = listArchivedRuns(tenantId) as ArchiveItem[];
  const map = new Map<string, ArchiveItem>();

  const add = (it: ArchiveItem, src: "local" | "cloud") => {
    const id = String(it?.archiveId || "");
    if (!id) return;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { ...(it as any), __source: src });
      return;
    }
    const next: ArchiveItem = {
      ...(existing as any),
      ...(src === "cloud" ? (it as any) : {}),
      ...(src === "local" ? (it as any) : {}),
      __source: existing.__source && existing.__source !== src ? "both" : existing.__source || src,
    };
    next.run = (existing as any).run || (it as any).run;
    next.name = (it as any).name || (existing as any).name;
    const a = String((existing as any).createdAtISO || "");
    const b = String((it as any).createdAtISO || "");
    next.createdAtISO = b || a;
    map.set(id, next);
  };

  for (const it of cloudItems || []) add(it, "cloud");
  for (const it of local || []) add(it, "local");

  return Array.from(map.values()).sort((a: any, b: any) =>
    String(b?.createdAtISO || b?.createdAt || "").localeCompare(String(a?.createdAtISO || a?.createdAt || ""))
  );
}

export function restoreArchivedRun(tenantId: string, item: ArchiveItem): boolean {
  if (!item?.run) return false;
  saveRun(tenantId, item.run);
  return true;
}

export async function removeArchivedItem(tenantId: string, item: ArchiveItem): Promise<void> {
  if (!item?.archiveId) return;
  try { deleteArchivedRun(tenantId, item.archiveId); } catch {}
  try {
    await callFn<any, any>("tenantDeleteDoc")({ tenantId, sub: "archive", id: item.archiveId });
  } catch {}
}
