// src/services/activityLog.service.ts
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { runFunctionWithRuntimePolicy } from "./functionsRuntimePolicy";

export type ActivityLogLevel = "info" | "warning" | "critical";
export type ActivityLogAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "IMPORT"
  | "EXPORT"
  | "PERMISSIONS_CHANGE"
  | "SETTINGS_CHANGE"
  | "SYSTEM";

export type ActivityLogEntry = {
  tenantId: string;
  ts: Timestamp;
  level: ActivityLogLevel;
  action: ActivityLogAction;
  entityType?: string;
  entityId?: string;
  message?: string;
  actorUid?: string;
  actorEmail?: string;
  actorDisplayName?: string;
  before?: any;
  after?: any;
};

export async function logActivity(tenantId: string, payload: any) {
  return writeActivityLog(tenantId, payload as any);
}

function activityLogsCol(tenantId: string) {
  return collection(db, `tenants/${tenantId}/auditLogs`);
}

export async function writeActivityLog(
  tenantId: string,
  entry: Omit<ActivityLogEntry, "tenantId" | "ts">,
) {
  try {
    if ((import.meta as any).env?.DEV && String((import.meta as any).env?.VITE_DISABLE_FUNCTIONS ?? "") === "true") {
      return;
    }
    if (!tenantId) return;

    await runFunctionWithRuntimePolicy("writeActivityLog", {
      tenantId,
      ...entry,
    }, {
      actionLabel: "كتابة سجل النشاط",
      bestEffort: true,
      fallbackToLocalOnError: true,
      wrapStrictErrors: false,
    });
  } catch {
    // intentional best-effort no-op
  }
}

export function listenActivityLogs(
  tenantId: string,
  onChange: (rows: ActivityLogEntry[]) => void,
  opts?: { pageSize?: number },
) {
  const pageSize = opts?.pageSize ?? 200;
  const q = query(activityLogsCol(tenantId), orderBy("ts", "desc"), limit(pageSize));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as any) }))
        .filter(Boolean);
      onChange(rows as ActivityLogEntry[]);
    },
    () => {
      onChange([]);
    },
  );
}
