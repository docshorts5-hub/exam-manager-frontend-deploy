// src/services/activityLog.service.ts
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

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
  | "SYSTEM"
  | "SAVE"
  | "SAVE_SETTINGS";

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
const PROJECT_ID = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "exam-manager-frontend");

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeTenantId(tenantId: string | null | undefined) {
  return clean(tenantId);
}

function getWriteActivityLogUrl() {
  return `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/writeActivityLog`;
}

async function buildSecureHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Best-effort: Cloud Function should still reject if auth is required.
  }

  return headers;
}

export async function logActivity(tenantId: string, payload: any) {
  return writeActivityLog(tenantId, payload as any);
}

function activityLogsCol(tenantId: string) {
  const tid = safeTenantId(tenantId);
  if (!tid) throw new Error("tenantId is required for activity logs.");

  // Must match Cloud Function write path:
  // tenants/{tenantId}/activityLogs/{logId}
  return collection(db, "tenants", tid, "activityLogs");
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

    const tid = safeTenantId(tenantId);
    if (!tid) return;

    const user = auth.currentUser;

    const response = await fetch(getWriteActivityLogUrl(), {
      method: "POST",
      headers: await buildSecureHeaders(),
      body: JSON.stringify({
        tenantId: tid,
        ...entry,
        actorUid: entry.actorUid || user?.uid || undefined,
        actorEmail: entry.actorEmail || user?.email || undefined,
        actorDisplayName: entry.actorDisplayName || user?.displayName || undefined,
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
  const tid = safeTenantId(tenantId);
  if (!tid) {
    onChange([]);
    return () => undefined;
  }

  const pageSize = opts?.pageSize ?? 200;
  const q = query(activityLogsCol(tid), orderBy("createdAt", "desc"), limit(pageSize));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(Boolean);
      onChange(rows as ActivityLogEntry[]);
    },
    () => {
      onChange([]);
    },
  );
}
