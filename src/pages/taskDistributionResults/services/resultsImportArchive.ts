import { addRunToArchive, type ArchivedDistributionRun } from "../../../utils/taskDistributionStorage";
import type { DistributionRun } from "../../../contracts/taskDistributionContract";
import { buildArchiveSnapshotName } from "./resultsActions";

export function openResultsImportPicker(input: HTMLInputElement | null) {
  if (!input) return;
  input.value = "";
  input.click();
}

export function archiveResultsRunSnapshot(tenantId: string, run: DistributionRun) {
  const now = new Date();
  const { iso, name, archiveId } = buildArchiveSnapshotName(now);
  const item: ArchivedDistributionRun = {
    archiveId,
    name,
    createdAtISO: iso,
    run,
  };
  addRunToArchive(tenantId, item);
  return item;
}
