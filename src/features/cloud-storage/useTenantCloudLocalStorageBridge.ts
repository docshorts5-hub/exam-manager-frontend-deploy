import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

type BridgeOptions = {
  tenantId?: string | null;
  readOnly?: boolean;
  enabled?: boolean;
};

type BridgeState = {
  ready: boolean;
  error: string | null;
};

type QueuedWrite = {
  tenantId: string;
  key: string;
  value: string;
};

const CLOUD_COLLECTION = "cloudLocalStorage";
const READY_EVENT = "exam-manager:cloud-local-storage:ready";
const UPDATED_EVENT = "exam-manager:cloud-local-storage:updated";
const MAX_FIRESTORE_VALUE_BYTES = 900_000;
const WRITE_DEBOUNCE_MS = 350;
const BRIDGE_ORIGIN = `cloud-bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const BRIDGE_BYPASS_FLAG = "__examManagerCloudLocalStorageBridgeBypass";

const AUTH_LOCAL_KEYS = new Set([
  "role",
  "effectiveRole",
  "selectedRole",
  "viewAsRole",
  "tenantId",
  "effectiveTenantId",
  "selectedTenantId",
  "examSuperEmail",
  "effectiveExamSuperEmail",
  "selectedExamSuperEmail",
  "viewAsEmail",
]);

const SENSITIVE_LOCAL_KEY_PARTS = [
  "token",
  "auth",
  "allowlist",
  "firebase",
  "credential",
  "password",
  "secret",
  "session",
  "uid",
  "role",
  "permission",
  "readonly",
  "read-only",
  "viewas",
  "governoratesuper",
  "selectedtenantid",
  "effectivetenantid",
  "tenantid",
  "microsoft-email",
  "examsuperemail",
  "viewasemail",
  "email-code-access",
  "email-code-lock",
];

let patched = false;
let activeTenantId = "";
let activeReadOnly = false;
let internalMutationDepth = 0;
let managerEventDispatchDepth = 0;
let originalSetItem: ((key: string, value: string) => void) | null = null;
let originalRemoveItem: ((key: string) => void) | null = null;
let writeTimers = new Map<string, number>();
let removeTimers = new Map<string, number>();
let migrationPermissionDeniedTenants = new Set<string>();
let writePermissionDeniedTenants = new Set<string>();
let removePermissionDeniedTenants = new Set<string>();
let listenerPermissionDeniedTenants = new Set<string>();

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isBridgeBypassEnabled() {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as Record<string, unknown>)[BRIDGE_BYPASS_FLAG]);
}
function safeGetBrowserStorageValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function isReadOnlyViewFromBrowser(tenantId: string) {
  const targetTenantId = String(tenantId || "").trim();
  if (!targetTenantId) return false;

  const readOnlyFlag = [
    safeGetBrowserStorageValue("governorateSuperReadOnly"),
    safeGetBrowserStorageValue("viewAsReadOnly"),
    safeGetBrowserStorageValue("readOnly"),
  ].some((value) => ["1", "true", "yes"].includes(value.toLowerCase()));

  if (!readOnlyFlag) return false;

  const expiresAt = Number(safeGetBrowserStorageValue("governorateSuperViewExpiresAt") || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) return false;

  const candidateTenantIds = [
    safeGetBrowserStorageValue("governorateSuperViewTenantId"),
    safeGetBrowserStorageValue("viewAsTenantId"),
    safeGetBrowserStorageValue("effectiveTenantId"),
    safeGetBrowserStorageValue("selectedTenantId"),
    safeGetBrowserStorageValue("tenantId"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return candidateTenantIds.includes(targetTenantId);
}

function isPermissionDeniedError(error: unknown) {
  const anyError = error as { code?: unknown; message?: unknown };
  const code = String(anyError?.code || "").toLowerCase();
  const message = String(anyError?.message || "").toLowerCase();

  return code.includes("permission-denied") || message.includes("missing or insufficient permissions");
}

function isNetworkTimeoutError(error: unknown) {
  const anyError = error as { code?: unknown; message?: unknown };
  const code = String(anyError?.code || "").toLowerCase();
  const message = String(anyError?.message || "").toLowerCase();

  return code.includes("unavailable") || message.includes("deadline") || message.includes("timed out") || message.includes("offline");
}

function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId = 0;

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label}-soft-timeout`));
    }, timeoutMs);
  });

  // نضع catch على الوعد الأصلي حتى لا يظهر Unhandled Promise في Console إذا انتهى بعد المهلة.
  promise.catch(() => undefined);

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  }) as Promise<T>;
}

function markInitialMigrationPermissionDenied(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (id) migrationPermissionDeniedTenants.add(id);
}

function wasInitialMigrationDeniedForTenant(tenantId: string) {
  return migrationPermissionDeniedTenants.has(String(tenantId || "").trim());
}

function markWritePermissionDenied(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (id) writePermissionDeniedTenants.add(id);
}

function wasWriteDeniedForTenant(tenantId: string) {
  return writePermissionDeniedTenants.has(String(tenantId || "").trim());
}

function markRemovePermissionDenied(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (id) removePermissionDeniedTenants.add(id);
}

function wasRemoveDeniedForTenant(tenantId: string) {
  return removePermissionDeniedTenants.has(String(tenantId || "").trim());
}

function markListenerPermissionDenied(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (id) listenerPermissionDeniedTenants.add(id);
}

function wasListenerDeniedForTenant(tenantId: string) {
  return listenerPermissionDeniedTenants.has(String(tenantId || "").trim());
}


function encodeDocId(key: string) {
  return encodeURIComponent(key).replace(/\./g, "%2E");
}

function safeByteLength(value: string) {
  try {
    return new Blob([value]).size;
  } catch {
    return value.length;
  }
}

function shouldSyncLocalStorageKey(rawKey: unknown) {
  const key = String(rawKey || "").trim();
  if (!key) return false;

  const lower = key.toLowerCase();

  if (AUTH_LOCAL_KEYS.has(key)) return false;
  if (SENSITIVE_LOCAL_KEY_PARTS.some((part) => lower.includes(part))) return false;

  // مهم جدًا: هذه المفاتيح مجرد Cache محلي مؤقت تنشئه hooks بعد قراءة Firestore.
  // لا يجوز رفعها مرة أخرى إلى cloudLocalStorage لأنها تسبب Permission Denied وحلقات مزامنة بلا فائدة.
  if (key.includes("cloud-cache")) return false;
  if (key.includes(":cache:")) return false;
  if (key.startsWith("exam-manager:cloud-storage:")) return false;

  // TENANT_IDENTITY_ISOLATION:
  // School identity belongs to the active tenant route.
  // Do not migrate or hydrate it through generic cloudLocalStorage,
  // otherwise a stale school profile can be copied from one tenant to another.
  if (key === "exam-manager:school-data:v1") return false;

  return (
    key.startsWith("exam-manager:") ||
    key.startsWith("exam_room_assignments") ||
    key.startsWith("school-exam-manager:") ||
    key.startsWith("task-distribution:") ||
    key.includes(":task-distribution:") ||
    key.includes("examRoomAssignments")
  );
}

function safeDispatchExamManagerEvent(eventName: string, detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  managerEventDispatchDepth += 1;
  try {
    if (detail) {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
      return;
    }

    window.dispatchEvent(new Event(eventName));
  } catch {
    // Event refresh must never break the page.
  } finally {
    managerEventDispatchDepth -= 1;
  }
}


function recordCloudStorageSuccess(tenantId: string, action: string) {
  if (typeof window === "undefined") return;
  const iso = new Date().toISOString();
  try {
    withInternalLocalStorageMutation(() => {
      const setter = originalSetItem || window.localStorage.setItem.bind(window.localStorage);
      setter("exam-manager:cloud-storage:last-success-at", iso);
      setter("exam-manager:cloud-storage:last-success-action", action);
      setter("exam-manager:cloud-storage:last-success-tenant", tenantId);
    });
  } catch {
    // Status cache must never break the app.
  }

  try {
    window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail: { tenantId, action, ts: Date.now() } }));
    window.dispatchEvent(new CustomEvent("exam-manager:cloud-storage:changed", { detail: { tenantId, action, ts: Date.now() } }));
  } catch {
    // Ignore event errors.
  }
}

function dispatchStorageRefresh(key: string, oldValue: string | null, newValue: string | null) {
  void oldValue;
  void newValue;
  if (typeof window === "undefined") return;

  // لا نطلق حدث storage العام يدويًا هنا؛ بعض صفحات المتصفح تعتبره حدثًا خاصًا
  // وقد يظهر كـ Uncaught في Console حتى لو استمر البرنامج في العمل.
  // بدله نطلق فقط أحداث البرنامج المعروفة التي تحتاجها الصفحات.
  if (key.startsWith("exam-manager:task-distribution:")) {
    [
      "exam-manager:task-distribution:updated",
      "exam-manager:task-distribution:run-updated",
      "exam-manager:task-distribution:master-table-updated",
    ].forEach((eventName) => {
      safeDispatchExamManagerEvent(eventName, { tenantId: activeTenantId, key, ts: Date.now() });
    });
  }

  if (key === "exam-manager:exam-center-data:v1" || key === "exam-manager:exam-center-logo:v1" || key === "exam-manager:app-logo") {
    safeDispatchExamManagerEvent("exam-manager:changed");
  }

  if (key === "exam-manager:control-head-name:v1" || key === "exam-manager:exam-center-data:v1") {
    safeDispatchExamManagerEvent("exam-manager:control-head-changed");
  }
}

function getCloudDocRef(tenantId: string, key: string) {
  return doc(db, "tenants", tenantId, CLOUD_COLLECTION, encodeDocId(key));
}

function scheduleCloudWrite(tenantId: string, key: string, value: string) {
  if (!tenantId || activeReadOnly || isReadOnlyViewFromBrowser(tenantId) || !shouldSyncLocalStorageKey(key)) return;
  if (wasWriteDeniedForTenant(tenantId)) return;
  if (safeByteLength(value) > MAX_FIRESTORE_VALUE_BYTES) {
    console.warn(`[cloudLocalStorage] skipped large value for key "${key}". Use Firebase Storage for very large logos/files.`);
    return;
  }

  const timerKey = `${tenantId}::${key}`;
  const previous = writeTimers.get(timerKey);
  if (previous) window.clearTimeout(previous);

  const queued: QueuedWrite = { tenantId, key, value };
  const timer = window.setTimeout(() => {
    writeTimers.delete(timerKey);
    void setDoc(
      getCloudDocRef(queued.tenantId, queued.key),
      {
        key: queued.key,
        value: queued.value,
        tenantId: queued.tenantId,
        origin: BRIDGE_ORIGIN,
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now(),
      },
      { merge: true }
    )
      .then(() => recordCloudStorageSuccess(queued.tenantId, "write"))
      .catch((error) => {
        if (isPermissionDeniedError(error)) {
          markWritePermissionDenied(queued.tenantId);
          return;
        }
        console.warn("[cloudLocalStorage] write failed", queued.key, error);
      });
  }, WRITE_DEBOUNCE_MS);

  writeTimers.set(timerKey, timer);
}

function scheduleCloudRemove(tenantId: string, key: string) {
  if (!tenantId || activeReadOnly || isReadOnlyViewFromBrowser(tenantId) || !shouldSyncLocalStorageKey(key)) return;
  if (wasRemoveDeniedForTenant(tenantId)) return;

  const timerKey = `${tenantId}::${key}`;
  const previous = removeTimers.get(timerKey);
  if (previous) window.clearTimeout(previous);

  const timer = window.setTimeout(() => {
    removeTimers.delete(timerKey);
    void deleteDoc(getCloudDocRef(tenantId, key))
      .then(() => recordCloudStorageSuccess(tenantId, "remove"))
      .catch((error) => {
        if (isPermissionDeniedError(error)) {
          markRemovePermissionDenied(tenantId);
          return;
        }
        console.warn("[cloudLocalStorage] remove failed", key, error);
      });
  }, WRITE_DEBOUNCE_MS);

  removeTimers.set(timerKey, timer);
}

function withInternalLocalStorageMutation<T>(fn: () => T): T {
  internalMutationDepth += 1;
  try {
    return fn();
  } finally {
    internalMutationDepth -= 1;
  }
}

function installLocalStoragePatch() {
  if (!canUseBrowserStorage() || patched) return;

  const proto = Object.getPrototypeOf(window.localStorage) as Storage;
  originalSetItem = proto.setItem.bind(window.localStorage);
  originalRemoveItem = proto.removeItem.bind(window.localStorage);

  proto.setItem = function patchedSetItem(key: string, value: string) {
    const oldValue = window.localStorage.getItem(key);
    const newValue = String(value);
    originalSetItem?.(key, value);

    // تستخدم خدمات Firestore المباشرة localStorage كـ cache داخلي فقط.
    // هذا الـ cache لا يجب أن يدخل في جسر cloudLocalStorage حتى لا يحدث Permission Denied أو مزامنة دائرية.
    if (isBridgeBypassEnabled()) return;

    if (internalMutationDepth <= 0 && activeTenantId && shouldSyncLocalStorageKey(key)) {
      // مهم: لو نفس القيمة اتكتبت مرة ثانية لا نطلق أحداث تحديث جديدة.
      // بعض صفحات البرنامج تعيد حفظ نفس بيانات المركز عند استقبال event، وهذا كان يسبب loop.
      if (oldValue !== newValue) {
        scheduleCloudWrite(activeTenantId, key, newValue);

        // لو setItem حصل داخل handler لحدث نحن أطلقناه، لا نطلق حدثًا جديدًا حتى لا يحدث recursive loop.
        if (managerEventDispatchDepth <= 0) {
          dispatchStorageRefresh(key, oldValue, newValue);
        }
      }
    }
  } as Storage["setItem"];

  proto.removeItem = function patchedRemoveItem(key: string) {
    const oldValue = window.localStorage.getItem(key);
    originalRemoveItem?.(key);

    // حذف cache الداخلي لا يجب أن يحذف أي وثيقة في cloudLocalStorage.
    if (isBridgeBypassEnabled()) return;

    if (internalMutationDepth <= 0 && activeTenantId && shouldSyncLocalStorageKey(key) && oldValue != null) {
      scheduleCloudRemove(activeTenantId, key);

      if (managerEventDispatchDepth <= 0) {
        dispatchStorageRefresh(key, oldValue, null);
      }
    }
  } as Storage["removeItem"];

  patched = true;
}

function readCurrentSyncedLocalStorage() {
  const out: Array<{ key: string; value: string }> = [];
  if (!canUseBrowserStorage()) return out;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) || "";
    if (!shouldSyncLocalStorageKey(key)) continue;
    const value = window.localStorage.getItem(key);
    if (value == null) continue;
    out.push({ key, value });
  }

  return out;
}

async function hydrateLocalStorageFromCloud(tenantId: string, readOnly: boolean) {
  if (!canUseBrowserStorage() || !tenantId) return;

  const localBefore = readCurrentSyncedLocalStorage();
  const cloudKeys = new Set<string>();
  const changedKeys: Array<{ key: string; oldValue: string | null; newValue: string | null }> = [];

  const snap = await withSoftTimeout(
    getDocs(collection(db, "tenants", tenantId, CLOUD_COLLECTION)),
    2200,
    "cloud-local-storage-hydration"
  );

  withInternalLocalStorageMutation(() => {
    snap.forEach((item) => {
      const data = item.data() as { key?: unknown; value?: unknown };
      const key = String(data?.key || "").trim();
      if (!shouldSyncLocalStorageKey(key)) return;
      if (typeof data?.value !== "string") return;

      cloudKeys.add(key);
      const oldValue = window.localStorage.getItem(key);
      if (oldValue !== data.value) {
        originalSetItem?.(key, data.value);
        changedKeys.push({ key, oldValue, newValue: data.value });
      }
    });
  });

  // أول دخول من جهاز قديم: ارفع البيانات المحلية التي لا توجد بعد في السحابة.
  // في وضع مشاهدة مشرف المحافظة لا نحاول الكتابة نهائيًا حتى لا تظهر رسائل permission-denied.
  // وإذا رفضت قواعد Firestore أول محاولة، نوقف باقي محاولات الترحيل في نفس الجلسة بدل تكرار عشرات التحذيرات.
  const canAttemptInitialMigration = !readOnly && !isReadOnlyViewFromBrowser(tenantId) && !wasInitialMigrationDeniedForTenant(tenantId);

  if (canAttemptInitialMigration) {
    const itemsToMigrate = localBefore
      .filter((item) => !cloudKeys.has(item.key))
      .filter((item) => safeByteLength(item.value) <= MAX_FIRESTORE_VALUE_BYTES);

    for (const item of itemsToMigrate) {
      try {
        await setDoc(
          getCloudDocRef(tenantId, item.key),
          {
            key: item.key,
            value: item.value,
            tenantId,
            origin: BRIDGE_ORIGIN,
            migratedFromLocalStorage: true,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
          },
          { merge: true }
        );
        recordCloudStorageSuccess(tenantId, "initial-migration");
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          markInitialMigrationPermissionDenied(tenantId);
          // لا نكرر الرسالة لكل مفتاح؛ هذه الحالة تعني أن الحساب الحالي قراءة فقط أو أن قواعد Firestore لم تُنشر بعد.
          break;
        }

        console.warn("[cloudLocalStorage] initial migration failed", item.key, error);
      }
    }
  }

  changedKeys.forEach((change) => dispatchStorageRefresh(change.key, change.oldValue, change.newValue));
  recordCloudStorageSuccess(tenantId, readOnly ? "read-only-hydration" : "hydration");

  try {
    window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: { tenantId, ts: Date.now() } }));
  } catch {}
}

export function useTenantCloudLocalStorageBridge(options: BridgeOptions): BridgeState {
  const tenantId = useMemo(() => String(options.tenantId || "").trim(), [options.tenantId]);
  const enabled = options.enabled !== false;
  const readOnly = Boolean(options.readOnly || isReadOnlyViewFromBrowser(tenantId));
  const [state, setState] = useState<BridgeState>({ ready: true, error: null });

  useEffect(() => {
    if (!enabled || !tenantId) {
      activeTenantId = "";
      setState({ ready: true, error: null });
      return;
    }

    installLocalStoragePatch();
    activeTenantId = tenantId;
    activeReadOnly = readOnly;

    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    // لا نغلق الصفحة أثناء تجهيز التخزين السحابي؛ المزامنة تعمل في الخلفية.
    setState({ ready: true, error: null });

    hydrateLocalStorageFromCloud(tenantId, readOnly)
      .then(() => {
        if (disposed) return;
        setState({ ready: true, error: null });

        if (wasListenerDeniedForTenant(tenantId)) return;

        unsubscribe = onSnapshot(
          collection(db, "tenants", tenantId, CLOUD_COLLECTION),
          (snap) => {
            if (disposed) return;
            if (snap.docChanges().length > 0) recordCloudStorageSuccess(tenantId, "realtime-update");
            snap.docChanges().forEach((change) => {
              const data = change.doc.data() as { key?: unknown; value?: unknown; origin?: unknown };
              const key = String(data?.key || "").trim();
              if (!shouldSyncLocalStorageKey(key)) return;

              if (change.type === "removed") {
                const oldValue = window.localStorage.getItem(key);
                if (oldValue != null) {
                  withInternalLocalStorageMutation(() => originalRemoveItem?.(key));
                  dispatchStorageRefresh(key, oldValue, null);
                }
                return;
              }

              if (typeof data?.value !== "string") return;
              const oldValue = window.localStorage.getItem(key);
              if (oldValue === data.value) return;

              withInternalLocalStorageMutation(() => originalSetItem?.(key, data.value as string));
              dispatchStorageRefresh(key, oldValue, data.value as string);
            });
          },
          (error) => {
            if (isPermissionDeniedError(error)) {
              markListenerPermissionDenied(tenantId);
              return;
            }
            console.warn("[cloudLocalStorage] realtime listener failed", error);
          }
        );
      })
      .catch((error) => {
        if (isPermissionDeniedError(error)) {
          markInitialMigrationPermissionDenied(tenantId);
        } else if (!isNetworkTimeoutError(error)) {
          console.warn("[cloudLocalStorage] hydration failed", error);
        }
        if (!disposed) {
          // لا نوقف البرنامج عند تعطل السحابة؛ نسمح بالعمل المحلي كاحتياطي مؤقت.
          setState({ ready: true, error: error?.message || "cloud-storage-error" });
        }
      });

    return () => {
      disposed = true;
      if (activeTenantId === tenantId) activeTenantId = "";
      if (unsubscribe) unsubscribe();
    };
  }, [enabled, tenantId, readOnly]);

  return state;
}

export const cloudLocalStorageEvents = {
  ready: READY_EVENT,
  updated: UPDATED_EVENT,
};
