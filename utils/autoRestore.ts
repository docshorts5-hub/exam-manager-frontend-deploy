import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { mergeArchivedRuns, type ArchivedDistributionRun } from "./taskDistributionStorage";

/**
 * ✅ Auto-restore (SAFE):
 * - Downloads latest archive runs from cloud
 * - Merges them into local archive WITHOUT deleting local items
 * This does NOT overwrite the main database; it's a safe sync for Archive.
 */
export async function autoRestoreArchiveFromCloud(tenantId: string, max = 200) {
  if (!tenantId) return { added: 0, updated: 0, total: 0 };
  const ref = collection(db, "tenants", tenantId, "archive");
  const q = query(ref, orderBy("createdAtISO", "desc"), limit(max));
  const snap = await getDocs(q);
  const incoming = snap.docs.map((d) => d.data() as ArchivedDistributionRun);
  return mergeArchivedRuns(tenantId, incoming, 200);
}
