const WORKSPACE_DB_NAME =
  "exam-manager-tenant-workspaces-v1";

const WORKSPACE_DB_VERSION = 1;

const SNAPSHOT_STORE = "snapshots";
const CONTROL_STORE = "control";

const CORE_DATABASE_NAME = "exam-manager-db";
const CORE_DATABASE_VERSION = 1;

const CORE_STORE_NAMES = [
  "teachers",
  "exams",
  "rooms",
  "unavailability",
  "roomBlocks",
  "runs",
  "tasks",
  "settings",
  "audit",
] as const;

const CONTROL_PHASES = [
  "uninitialized",
  "ready",
  "switching",
  "blocked",
] as const;

const MAX_TENANT_ID_LENGTH = 200;
const MAX_LOCAL_STORAGE_KEYS = 5000;
const MAX_LOCAL_STORAGE_KEY_LENGTH = 500;
const MAX_LOCAL_STORAGE_VALUE_LENGTH = 5_000_000;
const MAX_LOCAL_STORAGE_TOTAL_CHARS = 50_000_000;
const MAX_ROWS_PER_STORE = 100_000;
const MAX_WORKSPACE_SERIALIZED_CHARS = 100_000_000;

const SENSITIVE_LOCAL_STORAGE_PARTS = [
  "token",
  "credential",
  "password",
  "secret",
  "session",
  "firebase",
  "allowlist",
  "effective-role",
  "effectiverole",
  "effective-tenant-id",
  "effectivetenantid",
  "selected-tenant-id",
  "selectedtenantid",
  "tenant-id",
  "tenantid",
  "microsoft-email",
  "email-code-access",
  "email-code-lock",
  "readonly",
  "read-only",
  "viewas",
  "view-as",
  "governoratesuper",
  "governorate-super",
] as const;

const DANGEROUS_OBJECT_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

export const TENANT_WORKSPACE_SCHEMA =
  "tenant-workspace:v1" as const;

type WorkspaceControlPhase =
  (typeof CONTROL_PHASES)[number];

type CoreStoreName =
  (typeof CORE_STORE_NAMES)[number];

export type TenantWorkspacePayload = {
  localStorage: Record<string, string>;
  indexedDb: {
    databaseName: typeof CORE_DATABASE_NAME;
    databaseVersion: typeof CORE_DATABASE_VERSION;
    stores: Record<CoreStoreName, unknown[]>;
  };
};

export type TenantWorkspaceSnapshot = {
  id: string;
  schema: typeof TENANT_WORKSPACE_SCHEMA;
  kind: "tenant" | "quarantine";
  tenantId: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  reason: string | null;
  payloadSha256: string;
  payload: TenantWorkspacePayload;
};

export type TenantWorkspaceControl = {
  key: "active-workspace";
  schema: typeof TENANT_WORKSPACE_SCHEMA;
  phase: WorkspaceControlPhase;
  activeTenantId: string | null;
  targetTenantId: string | null;
  transitionId: string | null;
  reason: string | null;
  updatedAtMs: number;
};

export type TenantWorkspaceControlInput = Omit<
  TenantWorkspaceControl,
  "key" | "schema" | "updatedAtMs"
>;

function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function normalizeTenantId(value: unknown): string {
  const tenantId = String(value || "").trim();

  if (!tenantId || tenantId === "default") {
    throw new Error("INVALID_TENANT_WORKSPACE_ID");
  }

  if (tenantId.length > MAX_TENANT_ID_LENGTH) {
    throw new Error(
      "TENANT_WORKSPACE_ID_TOO_LONG"
    );
  }

  if (/[/\\?#\u0000-\u001f\u007f]/.test(tenantId)) {
    throw new Error(
      "TENANT_WORKSPACE_ID_HAS_INVALID_CHARACTERS"
    );
  }

  return tenantId;
}

function normalizeOptionalTenantId(
  value: unknown
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();

  return raw ? normalizeTenantId(raw) : null;
}

function normalizeReason(
  value: unknown,
  fallback: string | null
): string | null {
  const reason = String(value || "").trim();

  if (!reason) return fallback;

  return reason.slice(0, 1000);
}

function tenantSnapshotId(tenantId: string): string {
  return `tenant:${encodeURIComponent(
    normalizeTenantId(tenantId)
  )}`;
}

function randomTransitionId(): string {
  const runtimeCrypto = globalThis.crypto;

  if (
    runtimeCrypto &&
    typeof runtimeCrypto.randomUUID === "function"
  ) {
    return runtimeCrypto.randomUUID();
  }

  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join("-");
}

function assertJsonCompatible(
  value: unknown,
  path: string,
  seen: WeakSet<object>
): void {
  if (value === null) return;

  const valueType = typeof value;

  if (
    valueType === "string" ||
    valueType === "boolean"
  ) {
    return;
  }

  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(
        `WORKSPACE_NON_FINITE_NUMBER:${path}`
      );
    }

    return;
  }

  if (
    valueType === "undefined" ||
    valueType === "function" ||
    valueType === "symbol" ||
    valueType === "bigint"
  ) {
    throw new Error(
      `WORKSPACE_NON_JSON_VALUE:${path}`
    );
  }

  if (typeof value !== "object") {
    throw new Error(
      `WORKSPACE_UNSUPPORTED_VALUE:${path}`
    );
  }

  if (seen.has(value)) {
    throw new Error(
      `WORKSPACE_CYCLIC_VALUE:${path}`
    );
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        assertJsonCompatible(
          value[index],
          `${path}[${index}]`,
          seen
        );
      }

      return;
    }

    if (!isPlainRecord(value)) {
      throw new Error(
        `WORKSPACE_NON_PLAIN_OBJECT:${path}`
      );
    }

    for (const [key, nestedValue] of Object.entries(
      value
    )) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) {
        throw new Error(
          `WORKSPACE_DANGEROUS_OBJECT_KEY:${path}.${key}`
        );
      }

      assertJsonCompatible(
        nestedValue,
        `${path}.${key}`,
        seen
      );
    }
  } finally {
    seen.delete(value);
  }
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((item) => stableSerialize(item))
      .join(",")}]`;
  }

  if (!isPlainRecord(value)) {
    throw new Error(
      "WORKSPACE_STABLE_SERIALIZATION_FAILED"
    );
  }

  const entries = Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableSerialize(
          value[key]
        )}`
    );

  return `{${entries.join(",")}}`;
}

async function sha256Hex(
  serialized: string
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error(
      "WORKSPACE_CRYPTO_SUBTLE_UNAVAILABLE"
    );
  }

  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function isSensitiveLocalStorageKey(
  key: string
): boolean {
  const normalized = key.trim().toLowerCase();

  return SENSITIVE_LOCAL_STORAGE_PARTS.some(
    (part) => normalized.includes(part)
  );
}

function validateWorkspacePayload(
  value: unknown
): TenantWorkspacePayload {
  if (!isPlainRecord(value)) {
    throw new Error(
      "INVALID_TENANT_WORKSPACE_PAYLOAD"
    );
  }

  const localStorageValue = value.localStorage;

  if (!isPlainRecord(localStorageValue)) {
    throw new Error(
      "INVALID_WORKSPACE_LOCAL_STORAGE"
    );
  }

  const localEntries = Object.entries(
    localStorageValue
  );

  if (
    localEntries.length >
    MAX_LOCAL_STORAGE_KEYS
  ) {
    throw new Error(
      "WORKSPACE_LOCAL_STORAGE_KEY_LIMIT_EXCEEDED"
    );
  }

  let localStorageTotalChars = 0;

  for (const [key, storedValue] of localEntries) {
    if (
      DANGEROUS_OBJECT_KEYS.has(key) ||
      key.length === 0 ||
      key.length > MAX_LOCAL_STORAGE_KEY_LENGTH
    ) {
      throw new Error(
        "INVALID_WORKSPACE_LOCAL_STORAGE_KEY"
      );
    }

    if (typeof storedValue !== "string") {
      throw new Error(
        `INVALID_WORKSPACE_LOCAL_STORAGE_VALUE:${key}`
      );
    }

    if (
      storedValue.length >
      MAX_LOCAL_STORAGE_VALUE_LENGTH
    ) {
      throw new Error(
        `WORKSPACE_LOCAL_STORAGE_VALUE_TOO_LARGE:${key}`
      );
    }

    if (isSensitiveLocalStorageKey(key)) {
      throw new Error(
        `SENSITIVE_WORKSPACE_LOCAL_STORAGE_KEY:${key}`
      );
    }

    localStorageTotalChars +=
      key.length + storedValue.length;

    if (
      localStorageTotalChars >
      MAX_LOCAL_STORAGE_TOTAL_CHARS
    ) {
      throw new Error(
        "WORKSPACE_LOCAL_STORAGE_TOTAL_LIMIT_EXCEEDED"
      );
    }
  }

  const indexedDbValue = value.indexedDb;

  if (!isPlainRecord(indexedDbValue)) {
    throw new Error(
      "INVALID_WORKSPACE_INDEXEDDB"
    );
  }

  if (
    indexedDbValue.databaseName !==
    CORE_DATABASE_NAME
  ) {
    throw new Error(
      "WORKSPACE_CORE_DATABASE_NAME_MISMATCH"
    );
  }

  if (
    indexedDbValue.databaseVersion !==
    CORE_DATABASE_VERSION
  ) {
    throw new Error(
      "WORKSPACE_CORE_DATABASE_VERSION_MISMATCH"
    );
  }

  if (!isPlainRecord(indexedDbValue.stores)) {
    throw new Error(
      "INVALID_WORKSPACE_INDEXEDDB_STORES"
    );
  }

  const storeNames = Object.keys(
    indexedDbValue.stores
  ).sort();

  const expectedStoreNames = [
    ...CORE_STORE_NAMES,
  ].sort();

  if (
    storeNames.length !==
      expectedStoreNames.length ||
    storeNames.some(
      (name, index) =>
        name !== expectedStoreNames[index]
    )
  ) {
    throw new Error(
      "WORKSPACE_CORE_STORE_SET_MISMATCH"
    );
  }

  for (const storeName of CORE_STORE_NAMES) {
    const rows =
      indexedDbValue.stores[storeName];

    if (!Array.isArray(rows)) {
      throw new Error(
        `INVALID_WORKSPACE_STORE_ROWS:${storeName}`
      );
    }

    if (rows.length > MAX_ROWS_PER_STORE) {
      throw new Error(
        `WORKSPACE_STORE_ROW_LIMIT_EXCEEDED:${storeName}`
      );
    }

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];

      if (!isPlainRecord(row)) {
        throw new Error(
          `INVALID_WORKSPACE_STORE_ROW:${storeName}:${index}`
        );
      }

      const rowId = row.id;

      if (
        !(
          typeof rowId === "string" ||
          typeof rowId === "number"
        ) ||
        String(rowId).trim() === ""
      ) {
        throw new Error(
          `INVALID_WORKSPACE_STORE_ROW_ID:${storeName}:${index}`
        );
      }
    }
  }

  assertJsonCompatible(
    value,
    "payload",
    new WeakSet<object>()
  );

  const serialized = stableSerialize(value);

  if (
    serialized.length >
    MAX_WORKSPACE_SERIALIZED_CHARS
  ) {
    throw new Error(
      "WORKSPACE_PAYLOAD_SIZE_LIMIT_EXCEEDED"
    );
  }

  return value as TenantWorkspacePayload;
}

async function calculatePayloadSha256(
  payload: TenantWorkspacePayload
): Promise<string> {
  const validatedPayload =
    validateWorkspacePayload(payload);

  return sha256Hex(
    stableSerialize(validatedPayload)
  );
}

function buildWorkspaceControl(
  input: TenantWorkspaceControlInput
): TenantWorkspaceControl {
  if (
    !CONTROL_PHASES.includes(input.phase)
  ) {
    throw new Error(
      "INVALID_WORKSPACE_CONTROL_PHASE"
    );
  }

  const activeTenantId =
    normalizeOptionalTenantId(
      input.activeTenantId
    );

  const targetTenantId =
    normalizeOptionalTenantId(
      input.targetTenantId
    );

  const transitionId =
    String(input.transitionId || "").trim() ||
    null;

  const reason = normalizeReason(
    input.reason,
    null
  );

  if (input.phase === "uninitialized") {
    if (
      activeTenantId ||
      targetTenantId ||
      transitionId
    ) {
      throw new Error(
        "INVALID_UNINITIALIZED_WORKSPACE_CONTROL"
      );
    }
  }

  if (input.phase === "ready") {
    if (
      !activeTenantId ||
      targetTenantId ||
      transitionId
    ) {
      throw new Error(
        "INVALID_READY_WORKSPACE_CONTROL"
      );
    }
  }

  if (input.phase === "switching") {
    if (!targetTenantId || !transitionId) {
      throw new Error(
        "INVALID_SWITCHING_WORKSPACE_CONTROL"
      );
    }
  }

  if (input.phase === "blocked" && !reason) {
    throw new Error(
      "BLOCKED_WORKSPACE_CONTROL_REQUIRES_REASON"
    );
  }

  return {
    key: "active-workspace",
    schema: TENANT_WORKSPACE_SCHEMA,
    phase: input.phase,
    activeTenantId,
    targetTenantId,
    transitionId,
    reason,
    updatedAtMs: Date.now(),
  };
}

function validateWorkspaceControl(
  value: unknown
): TenantWorkspaceControl {
  if (!isPlainRecord(value)) {
    throw new Error(
      "INVALID_WORKSPACE_CONTROL_RECORD"
    );
  }

  if (
    value.key !== "active-workspace" ||
    value.schema !== TENANT_WORKSPACE_SCHEMA
  ) {
    throw new Error(
      "WORKSPACE_CONTROL_SCHEMA_MISMATCH"
    );
  }

  if (
    !CONTROL_PHASES.includes(
      value.phase as WorkspaceControlPhase
    )
  ) {
    throw new Error(
      "INVALID_WORKSPACE_CONTROL_PHASE"
    );
  }

  if (
    typeof value.updatedAtMs !== "number" ||
    !Number.isFinite(value.updatedAtMs) ||
    value.updatedAtMs <= 0
  ) {
    throw new Error(
      "INVALID_WORKSPACE_CONTROL_TIMESTAMP"
    );
  }

  const rebuilt = buildWorkspaceControl({
    phase: value.phase as WorkspaceControlPhase,
    activeTenantId:
      value.activeTenantId as string | null,
    targetTenantId:
      value.targetTenantId as string | null,
    transitionId:
      value.transitionId as string | null,
    reason: value.reason as string | null,
  });

  return {
    ...rebuilt,
    updatedAtMs: value.updatedAtMs,
  };
}

async function validateTenantSnapshot(
  value: unknown,
  expectedTenantId: string
): Promise<TenantWorkspaceSnapshot> {
  if (!isPlainRecord(value)) {
    throw new Error(
      "INVALID_TENANT_WORKSPACE_SNAPSHOT"
    );
  }

  const safeTenantId =
    normalizeTenantId(expectedTenantId);

  if (
    value.id !== tenantSnapshotId(safeTenantId) ||
    value.schema !== TENANT_WORKSPACE_SCHEMA ||
    value.kind !== "tenant" ||
    value.tenantId !== safeTenantId
  ) {
    throw new Error(
      "TENANT_WORKSPACE_SNAPSHOT_BINDING_MISMATCH"
    );
  }

  const createdAtMs = Number(
    value.createdAtMs
  );

  const updatedAtMs = Number(
    value.updatedAtMs
  );

  if (
    !Number.isFinite(createdAtMs) ||
    !Number.isFinite(updatedAtMs) ||
    createdAtMs <= 0 ||
    updatedAtMs < createdAtMs
  ) {
    throw new Error(
      "INVALID_TENANT_WORKSPACE_TIMESTAMPS"
    );
  }

  const payload =
    validateWorkspacePayload(value.payload);

  const storedDigest = String(
    value.payloadSha256 || ""
  )
    .trim()
    .toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(storedDigest)) {
    throw new Error(
      "INVALID_TENANT_WORKSPACE_DIGEST"
    );
  }

  const calculatedDigest =
    await calculatePayloadSha256(payload);

  if (calculatedDigest !== storedDigest) {
    throw new Error(
      "TENANT_WORKSPACE_DIGEST_MISMATCH"
    );
  }

  return {
    id: value.id,
    schema: TENANT_WORKSPACE_SCHEMA,
    kind: "tenant",
    tenantId: safeTenantId,
    createdAtMs,
    updatedAtMs,
    reason: normalizeReason(value.reason, null),
    payloadSha256: storedDigest,
    payload,
  };
}

function openWorkspaceDatabase():
Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("INDEXEDDB_UNAVAILABLE"));
      return;
    }

    let settled = false;

    const request = indexedDB.open(
      WORKSPACE_DB_NAME,
      WORKSPACE_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (
        !db.objectStoreNames.contains(
          SNAPSHOT_STORE
        )
      ) {
        db.createObjectStore(SNAPSHOT_STORE, {
          keyPath: "id",
        });
      }

      if (
        !db.objectStoreNames.contains(
          CONTROL_STORE
        )
      ) {
        db.createObjectStore(CONTROL_STORE, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      if (settled) {
        db.close();
        return;
      }

      settled = true;

      db.onversionchange = () => {
        db.close();
      };

      resolve(db);
    };

    request.onerror = () => {
      if (settled) return;
      settled = true;

      reject(
        request.error ||
          new Error(
            "TENANT_WORKSPACE_DB_OPEN_FAILED"
          )
      );
    };

    request.onblocked = () => {
      if (settled) return;
      settled = true;

      reject(
        new Error(
          "TENANT_WORKSPACE_DB_OPEN_BLOCKED"
        )
      );
    };
  });
}

async function runStoreRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore
  ) => IDBRequest<T>
): Promise<T> {
  const db = await openWorkspaceDatabase();

  try {
    return await new Promise<T>(
      (resolve, reject) => {
        let result!: T;
        let requestSucceeded = false;
        let settled = false;

        const transaction = db.transaction(
          storeName,
          mode
        );

        const store =
          transaction.objectStore(storeName);

        let request: IDBRequest<T>;

        try {
          request = operation(store);
        } catch (error) {
          try {
            transaction.abort();
          } catch {
            // Transaction may already be inactive.
          }

          reject(error);
          return;
        }

        request.onsuccess = () => {
          result = request.result;
          requestSucceeded = true;
        };

        request.onerror = () => {
          if (settled) return;
          settled = true;

          reject(
            request.error ||
              new Error(
                "TENANT_WORKSPACE_REQUEST_FAILED"
              )
          );
        };

        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;

          if (!requestSucceeded) {
            reject(
              new Error(
                "TENANT_WORKSPACE_REQUEST_DID_NOT_COMPLETE"
              )
            );
            return;
          }

          resolve(result);
        };

        transaction.onerror = () => {
          if (settled) return;
          settled = true;

          reject(
            transaction.error ||
              new Error(
                "TENANT_WORKSPACE_TRANSACTION_FAILED"
              )
          );
        };

        transaction.onabort = () => {
          if (settled) return;
          settled = true;

          reject(
            transaction.error ||
              new Error(
                "TENANT_WORKSPACE_TRANSACTION_ABORTED"
              )
          );
        };
      }
    );
  } finally {
    db.close();
  }
}

async function runAtomicWorkspaceWrite(
  setup: (
    snapshotStore: IDBObjectStore,
    controlStore: IDBObjectStore,
    transaction: IDBTransaction
  ) => void
): Promise<void> {
  const db = await openWorkspaceDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const transaction = db.transaction(
        [SNAPSHOT_STORE, CONTROL_STORE],
        "readwrite"
      );

      const snapshotStore =
        transaction.objectStore(SNAPSHOT_STORE);

      const controlStore =
        transaction.objectStore(CONTROL_STORE);

      try {
        setup(
          snapshotStore,
          controlStore,
          transaction
        );
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          // Transaction may already be inactive.
        }

        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      transaction.onerror = () => {
        if (settled) return;
        settled = true;

        reject(
          transaction.error ||
            new Error(
              "ATOMIC_WORKSPACE_TRANSACTION_FAILED"
            )
        );
      };

      transaction.onabort = () => {
        if (settled) return;
        settled = true;

        reject(
          transaction.error ||
            new Error(
              "ATOMIC_WORKSPACE_TRANSACTION_ABORTED"
            )
        );
      };
    });
  } finally {
    db.close();
  }
}

async function persistTenantSnapshot(
  tenantId: string,
  payload: TenantWorkspacePayload,
  control: TenantWorkspaceControl | null
): Promise<void> {
  const safeTenantId = normalizeTenantId(tenantId);
  const safePayload =
    validateWorkspacePayload(payload);

  const payloadSha256 =
    await calculatePayloadSha256(safePayload);

  const snapshotId =
    tenantSnapshotId(safeTenantId);

  const now = Date.now();

  await runAtomicWorkspaceWrite(
    (
      snapshotStore,
      controlStore,
      transaction
    ) => {
      const getRequest =
        snapshotStore.get(snapshotId);

      getRequest.onerror = () => {
        try {
          transaction.abort();
        } catch {
          // Transaction may already be inactive.
        }
      };

      getRequest.onsuccess = () => {
        const existing =
          getRequest.result as
            | Partial<TenantWorkspaceSnapshot>
            | undefined;

        const existingCreatedAt =
          existing?.id === snapshotId &&
          existing?.schema ===
            TENANT_WORKSPACE_SCHEMA &&
          existing?.kind === "tenant" &&
          existing?.tenantId === safeTenantId &&
          typeof existing?.createdAtMs ===
            "number" &&
          Number.isFinite(existing.createdAtMs) &&
          existing.createdAtMs > 0
            ? existing.createdAtMs
            : now;

        const record: TenantWorkspaceSnapshot = {
          id: snapshotId,
          schema: TENANT_WORKSPACE_SCHEMA,
          kind: "tenant",
          tenantId: safeTenantId,
          createdAtMs: existingCreatedAt,
          updatedAtMs: now,
          reason: null,
          payloadSha256,
          payload: safePayload,
        };

        snapshotStore.put(record);

        if (control) {
          controlStore.put(control);
        }
      };
    }
  );
}

export async function saveTenantWorkspace(
  tenantId: string,
  payload: TenantWorkspacePayload
): Promise<void> {
  await persistTenantSnapshot(
    tenantId,
    payload,
    null
  );
}

export async function commitTenantWorkspaceTransition(
  tenantId: string,
  payload: TenantWorkspacePayload,
  controlInput: TenantWorkspaceControlInput
): Promise<void> {
  const control =
    buildWorkspaceControl(controlInput);

  await persistTenantSnapshot(
    tenantId,
    payload,
    control
  );
}

export async function loadTenantWorkspace(
  tenantId: string
): Promise<TenantWorkspaceSnapshot | null> {
  const safeTenantId = normalizeTenantId(tenantId);

  const record = await runStoreRequest<unknown>(
    SNAPSHOT_STORE,
    "readonly",
    (store) =>
      store.get(
        tenantSnapshotId(safeTenantId)
      )
  );

  if (record === undefined) {
    return null;
  }

  return validateTenantSnapshot(
    record,
    safeTenantId
  );
}

async function createQuarantineRecord(
  payload: TenantWorkspacePayload,
  reason: string
): Promise<TenantWorkspaceSnapshot> {
  const safePayload =
    validateWorkspacePayload(payload);

  const now = Date.now();

  const id = [
    "quarantine",
    now,
    randomTransitionId(),
  ].join(":");

  return {
    id,
    schema: TENANT_WORKSPACE_SCHEMA,
    kind: "quarantine",
    tenantId: null,
    createdAtMs: now,
    updatedAtMs: now,
    reason: normalizeReason(
      reason,
      "unknown-workspace"
    ),
    payloadSha256:
      await calculatePayloadSha256(safePayload),
    payload: safePayload,
  };
}

export async function saveQuarantinedWorkspace(
  payload: TenantWorkspacePayload,
  reason: string
): Promise<string> {
  const record =
    await createQuarantineRecord(
      payload,
      reason
    );

  await runStoreRequest<IDBValidKey>(
    SNAPSHOT_STORE,
    "readwrite",
    (store) => store.put(record)
  );

  return record.id;
}

export async function commitQuarantinedWorkspaceTransition(
  payload: TenantWorkspacePayload,
  reason: string,
  controlInput: TenantWorkspaceControlInput
): Promise<string> {
  const record =
    await createQuarantineRecord(
      payload,
      reason
    );

  const control =
    buildWorkspaceControl(controlInput);

  await runAtomicWorkspaceWrite(
    (snapshotStore, controlStore) => {
      snapshotStore.put(record);
      controlStore.put(control);
    }
  );

  return record.id;
}

export async function readWorkspaceControl():
Promise<TenantWorkspaceControl> {
  const existing = await runStoreRequest<unknown>(
    CONTROL_STORE,
    "readonly",
    (store) =>
      store.get("active-workspace")
  );

  if (existing === undefined) {
    return {
      key: "active-workspace",
      schema: TENANT_WORKSPACE_SCHEMA,
      phase: "uninitialized",
      activeTenantId: null,
      targetTenantId: null,
      transitionId: null,
      reason: null,
      updatedAtMs: Date.now(),
    };
  }

  return validateWorkspaceControl(existing);
}

export async function writeWorkspaceControl(
  input: TenantWorkspaceControlInput
): Promise<void> {
  const record = buildWorkspaceControl(input);

  await runStoreRequest<IDBValidKey>(
    CONTROL_STORE,
    "readwrite",
    (store) => store.put(record)
  );
}

export function createWorkspaceTransitionId():
string {
  return randomTransitionId();
}