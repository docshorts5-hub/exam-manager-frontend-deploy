import { collection, deleteDoc, getDocs, doc, DocumentData } from "firebase/firestore";
import { db } from "../firebase/firebase";

export async function listCloudBackups(tenantId: string): Promise<Array<{ id: string } & DocumentData>> {
  const ref = collection(db, "tenants", tenantId, "archive");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteCloudBackup(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "tenants", tenantId, "archive", id));
}
