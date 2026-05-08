import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebase";

export type AuditRow = {
  id: string;
  type: string;
  actorEmail?: string;
  targetEmail?: string;
  details?: any;
  createdAt?: Timestamp;
};

export function useTenantAuditFeed(tenantId: string) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState("");

  const qRef = useMemo(() => {
    if (!tenantId) return null;
    return query(collection(db, "tenants", tenantId, "securityAudit"), orderBy("createdAt", "desc"), limit(200));
  }, [tenantId]);

  useEffect(() => {
    setErr("");
    if (!qRef) return;
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const next: AuditRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setRows(next);
      },
      (e) => setErr(e?.message || "Failed to load")
    );
    return () => unsub();
  }, [qRef]);

  return { rows, err, canRead: !!tenantId };
}
