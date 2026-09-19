function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeStorageGet(key: string): string {
  if (!canUseBrowserStorage()) return "";

  try {
    return String(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function isTruth(value: string): boolean {
  return ["1", "true", "yes", "readonly", "read-only"].includes(String(value || "").trim().toLowerCase());
}

export function isTenantReadOnlyView(tenantId: string | null | undefined): boolean {
  const targetTenantId = String(tenantId || "").trim();
  if (!targetTenantId) return false;

  const readOnlyFlag = [
    safeStorageGet("governorateSuperReadOnly"),
    safeStorageGet("viewAsReadOnly"),
    safeStorageGet("readOnly"),
    safeStorageGet("exam-manager:viewAsReadOnly"),
    safeStorageGet("exam-manager:readonly"),
  ].some(isTruth);

  if (!readOnlyFlag) return false;

  const expiresAt = Number(safeStorageGet("governorateSuperViewExpiresAt") || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
    return false;
  }

  const candidateTenantIds = [
    safeStorageGet("governorateSuperViewTenantId"),
    safeStorageGet("viewAsTenantId"),
    safeStorageGet("effectiveTenantId"),
    safeStorageGet("selectedTenantId"),
    safeStorageGet("tenantId"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return candidateTenantIds.includes(targetTenantId);
}

export function assertTenantWritable(tenantId: string | null | undefined, operation = "tenant write"): void {
  if (!isTenantReadOnlyView(tenantId)) return;

  const error = Object.assign(new Error(`READ_ONLY_TENANT_WRITE_BLOCKED:${operation}`), {
    code: "READ_ONLY_TENANT_WRITE_BLOCKED",
    operation,
    tenantId: String(tenantId || "").trim(),
  });

  throw error;
}