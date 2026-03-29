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
  ts?: Timestamp;
  createdAt?: Timestamp;
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

const FUNCTIONS_REGION = String(import.meta.env.VITE_FUNCTIONS_REGION || "us-central1");
const PROJECT_ID = "exam-manager-frontend";

function getWriteActivityLogUrl() {
  return `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/writeActivityLog`;
}

export async function logActivity(tenantId: string, payload: any) {
  return writeActivityLog(tenantId, payload as any);
}

function activityLogsCol(tenantId: string) {
  // لازم يطابق مسار الكتابة في Cloud Function
  return collection(db, `tenants/${tenantId}/activityLogs`);
}

export async function writeActivityLog(
  tenantId: string,
  entry: Omit<ActivityLogEntry, "tenantId" | "ts" | "createdAt">,
) {
  try {
    if (
      (import.meta as any).env?.DEV &&
      String((import.meta as any).env?.VITE_DISABLE_FUNCTIONS ?? "") === "true"
    ) {
      return;
    }

    const safeTenantId = String(tenantId || "").trim();
    if (!safeTenantId) return;

    const response = await fetch(getWriteActivityLogUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId: safeTenantId,
        ...entry,
      }),
    });

    if (!response.ok) {
      // Best-effort: لا نكسر الواجهة بسبب فشل السجل
      return;
    }
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
  const q = query(activityLogsCol(tenantId), orderBy("createdAt", "desc"), limit(pageSize));

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
