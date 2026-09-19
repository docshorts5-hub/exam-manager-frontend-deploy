// src/features/audit/auditTrail.ts
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { canAccessCapability } from "../authz/policies";
import type { AuthzSnapshot } from "../authz/types";

export type AuditLevel = "info" | "warning" | "danger";

export type AuditEntry = {
  id: string;
  at: string;
  level: AuditLevel;
  action: string;
  label: string;
  path: string;
  tenantId?: string;
  userEmail?: string;
  role?: string;
  governorate?: string;
  readOnly?: boolean;
  source?: string;
  cloudId?: string;
};

export const AUDIT_LOG_KEY = "exam-manager:audit-log:v1";
export const AUDIT_CLOUD_ENABLED_KEY = "exam-manager:audit-log:cloud-enabled";
export const AUDIT_CLOUD_LAST_OK_KEY = "exam-manager:audit-log:cloud-last-ok";
export const AUDIT_CLOUD_LAST_ERROR_KEY = "exam-manager:audit-log:cloud-last-error";

const MAX_AUDIT_ENTRIES = 800;
const AUDIT_RETENTION_DAYS = 60;
const AUDIT_RETENTION_MS = AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
function withinAuditRetention(entry: AuditEntry) {
  const timestamp = Date.parse(entry.at);
  return !Number.isFinite(timestamp) || timestamp >= Date.now() - AUDIT_RETENTION_MS;
}
const CLOUD_AUDIT_COLLECTION = "systemAuditLogs";
const MAX_CLOUD_LOAD = 500;

function assertPlatformOwner(snapshot: AuthzSnapshot): void {
  if (
    !snapshot ||
    snapshot.isAuthenticated !== true ||
    snapshot.isEnabled !== true ||
    !canAccessCapability(snapshot, "PLATFORM_OWNER")
  ) {
    throw new Error("AUDIT_ADMIN_PLATFORM_OWNER_REQUIRED");
  }
}

const LEGACY_KEYS = [
  AUDIT_LOG_KEY,
  "exam-manager:audit-log",
  "exam-manager:system-audit-log",
  "exam-manager:activity-log",
  "exam-manager:activity-logs",
  "exam-manager:activity-logs:v1",
  "exam-manager:logs",
  "activityLogs",
  "auditLogs",
  "systemAuditLog",
];

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function safeParse(raw: string | null): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function arrayFromUnknown(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.entries)) return obj.entries;
    if (Array.isArray(obj.logs)) return obj.logs;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

function normalizeLevel(value: unknown, fallback: AuditLevel = "info"): AuditLevel {
  const v = safeString(value).toLowerCase();
  if (["danger", "خطير", "حساس"].includes(v)) return "danger";
  if (["warning", "warn", "تشغيلي", "تحذير"].includes(v)) return "warning";
  if (["info", "عام"].includes(v)) return "info";
  return fallback;
}

function levelFromText(text: string): AuditLevel {
  const v = safeString(text).toLowerCase();
  if (["حذف", "delete", "remove", "استعادة", "restore", "تعطيل", "مسح"].some((w) => v.includes(w))) {
    return "danger";
  }
  if (["حفظ", "تعديل", "تشغيل", "توزيع", "استيراد", "رفع", "sync", "run", "update", "import", "upload"].some((w) => v.includes(w))) {
    return "warning";
  }
  return "info";
}

function normalizeTimestamp(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }
  if (typeof value?.seconds === "number") {
    try {
      return new Date(value.seconds * 1000).toISOString();
    } catch {
      return "";
    }
  }
  return safeString(value);
}

function normalizeEntry(item: unknown, index: number): AuditEntry | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  const label =
    safeString(obj.label) ||
    safeString(obj.message) ||
    safeString(obj.title) ||
    safeString(obj.event) ||
    safeString(obj.action) ||
    "عملية مسجلة";

  const action = safeString(obj.action) || safeString(obj.type) || "event";
  const at =
    safeString(obj.at) ||
    normalizeTimestamp(obj.createdAt) ||
    normalizeTimestamp(obj.time) ||
    normalizeTimestamp(obj.timestamp) ||
    new Date().toISOString();

  return {
    id: safeString(obj.id) || safeString(obj.cloudId) || `audit-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    cloudId: safeString(obj.cloudId),
    at,
    level: normalizeLevel(obj.level, levelFromText(`${label} ${action}`)),
    action,
    label,
    path: safeString(obj.path) || safeString(obj.route) || safeString(obj.url) || "-",
    tenantId: safeString(obj.tenantId),
    userEmail: safeString(obj.userEmail) || safeString(obj.email) || safeString(obj.user),
    role: safeString(obj.role),
    governorate: safeString(obj.governorate) || safeString(obj.scope),
    readOnly: Boolean(obj.readOnly),
    source: safeString(obj.source) || "legacy/local",
  };
}

function safeReadKey(key: string): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return arrayFromUnknown(safeParse(window.localStorage.getItem(key)))
      .map((item, index) => normalizeEntry(item, index))
      .filter(Boolean) as AuditEntry[];
  } catch {
    return [];
  }
}

function dedupe(entries: AuditEntry[]): AuditEntry[] {
  const seen = new Set<string>();
  const out: AuditEntry[] = [];
  for (const entry of entries) {
    const key = [entry.id, entry.at, entry.action, entry.label, entry.path, entry.userEmail].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, MAX_AUDIT_ENTRIES);
}

function readAuditEntries(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  const entries = LEGACY_KEYS.flatMap((key) => safeReadKey(key));
  return dedupe(entries);
}

export function getAuditEntries(snapshot: AuthzSnapshot): AuditEntry[] {
  assertPlatformOwner(snapshot);
  return readAuditEntries();
}

export function saveAuditEntries(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  try {
    const compact = dedupe(entries).filter(withinAuditRetention).slice(0, MAX_AUDIT_ENTRIES);
    window.localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(compact));
  } catch {
    // لا نوقف البرنامج إذا امتلأ التخزين المحلي.
  }
}

function cloudAuditEnabled() {
  if (typeof window === "undefined") return true;
  const flag = window.localStorage.getItem(AUDIT_CLOUD_ENABLED_KEY);
  return flag !== "0" && flag !== "false";
}

export function setCloudAuditEnabled(snapshot: AuthzSnapshot, enabled: boolean) {
  assertPlatformOwner(snapshot);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIT_CLOUD_ENABLED_KEY, enabled ? "1" : "0");
}

export function isCloudAuditEnabled(snapshot: AuthzSnapshot) {
  assertPlatformOwner(snapshot);
  return cloudAuditEnabled();
}

function markCloudOk() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIT_CLOUD_LAST_OK_KEY, new Date().toISOString());
    window.localStorage.removeItem(AUDIT_CLOUD_LAST_ERROR_KEY);
  } catch {
    // ignore
  }
}

function markCloudError(error: unknown) {
  if (typeof window === "undefined") return;
  try {
    const message = error instanceof Error ? error.message : String(error || "unknown error");
    window.localStorage.setItem(AUDIT_CLOUD_LAST_ERROR_KEY, message.slice(0, 300));
  } catch {
    // ignore
  }
}

let cloudQueue = Promise.resolve();

function queueCloudAuditWrite(entry: AuditEntry) {
  // YR_AUDIT_APPEND_ONLY_CLIENT_V1
  if (!entry.userEmail && !entry.role) return;

  const payload = {
    id: entry.id,
    at: entry.at,
    level: entry.level,
    action: entry.action,
    label: entry.label,
    path: entry.path,
    tenantId: entry.tenantId || "",
    userEmail: entry.userEmail || "",
    role: entry.role || "",
    governorate: entry.governorate || "",
    readOnly: Boolean(entry.readOnly),
    source: entry.source || "client-audit-agent",
    createdAt: serverTimestamp(),
  };

  cloudQueue = cloudQueue
    .then(async () => {
      await addDoc(collection(db, CLOUD_AUDIT_COLLECTION), payload);
      markCloudOk();
    })
    .catch((error) => {
      markCloudError(error);
    });
}

let lastAppendKey = "";
let lastAppendAt = 0;

export function appendAuditEntry(entry: Omit<AuditEntry, "id" | "at"> & Partial<Pick<AuditEntry, "id" | "at">>) {
  if (typeof window === "undefined") return;

  const finalEntry: AuditEntry = {
    ...entry,
    id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at || new Date().toISOString(),
  };

  const dedupeKey = [finalEntry.action, finalEntry.label, finalEntry.path, finalEntry.userEmail].join("|");
  const now = Date.now();
  if (dedupeKey === lastAppendKey && now - lastAppendAt < 700) return;
  lastAppendKey = dedupeKey;
  lastAppendAt = now;

  const current = readAuditEntries();
  saveAuditEntries([finalEntry, ...current]);
  queueCloudAuditWrite(finalEntry);

  try {
    window.dispatchEvent(new CustomEvent("exam-manager:audit-log-changed"));
  } catch {
    // ignore
  }
}

export async function getCloudAuditEntries(
  snapshot: AuthzSnapshot,
  options?: {
    governorate?: string;
    role?: string;
    max?: number;
  }
): Promise<AuditEntry[]> {
  assertPlatformOwner(snapshot);
  const role = safeString(options?.role).toLowerCase();
  const governorate = safeString(options?.governorate);
  const max = Math.min(Math.max(options?.max || MAX_CLOUD_LOAD, 50), 1000);

  const isGovernorateViewer = [
    "super",
    "super_regional",
    "regional_super",
    "governorate_super",
    "governorate-super",
    "سوبر المحافظة",
    "مشرف المحافظة",
  ].includes(role);

  const base = collection(db, CLOUD_AUDIT_COLLECTION);
  const q = isGovernorateViewer && governorate
    ? query(base, where("governorate", "==", governorate), limit(max))
    : query(base, orderBy("at", "desc"), limit(max));

  const snap = await getDocs(q);
  const items = snap.docs
    .map((docSnap, index) => normalizeEntry({ ...docSnap.data(), cloudId: docSnap.id }, index))
    .filter(Boolean) as AuditEntry[];

  return dedupe(items);
}

export function mergeAuditEntries(...groups: AuditEntry[][]) {
  return dedupe(groups.flat());
}

export function clearAuditEntries(snapshot: AuthzSnapshot) {
  assertPlatformOwner(snapshot);
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_KEYS) {
      if (key === AUDIT_LOG_KEY || key.includes("audit")) window.localStorage.removeItem(key);
    }
    window.dispatchEvent(new CustomEvent("exam-manager:audit-log-changed"));
  } catch {
    // ignore
  }
}

export function exportAuditEntriesFile(
  snapshot: AuthzSnapshot,
  entries: AuditEntry[]
) {
  assertPlatformOwner(snapshot);
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
