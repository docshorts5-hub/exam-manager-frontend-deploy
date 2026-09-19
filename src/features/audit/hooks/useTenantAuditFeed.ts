import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebase";

export type AuditRow = {
  id: string;
  type: string;
  action?: string;
  level?: string;
  entityType?: string;
  entityId?: string;
  message?: string;
  actorUid?: string;
  actorEmail?: string;
  actorDisplayName?: string;
  targetEmail?: string;
  details?: any;
  before?: any;
  after?: any;
  ts?: Timestamp;
  createdAt?: Timestamp;
};

function normalizeAuditRow(id: string, data: any): AuditRow {
  const action = String(data?.action || data?.type || "SYSTEM").trim();
  return {
    id,
    ...data,
    type: action,
    action,
    details: data?.details ?? data?.after ?? null,
    createdAt: data?.createdAt || data?.ts,
  } as AuditRow;
}

export function useTenantAuditFeed(tenantId: string) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState("");

  const qRef = useMemo(() => {
    const tid = String(tenantId || "").trim();
    if (!tid) return null;

    // Unified commercial audit source. writeTenantAudit writes here through activityLog.service.
    return query(collection(db, "tenants", tid, "activityLogs"), orderBy("createdAt", "desc"), limit(300));
  }, [tenantId]);

  useEffect(() => {
    setErr("");
    if (!qRef) {
      setRows([]);
      return;
    }

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const next: AuditRow[] = snap.docs.map((d) => normalizeAuditRow(d.id, d.data() as any));
        setRows(next);
      },
      (e) => {
        setRows([]);
        setErr(e?.message || "Failed to load audit logs");
      },
    );

    return () => unsub();
  }, [qRef]);

  return { rows, err, canRead: !!String(tenantId || "").trim() };
}
