// src/utils/taskDistributionUnavailability.ts

import { getAuditContext } from "../services/auditAuto";
import { loadTenantArray, replaceTenantArray } from "../services/tenantData";

export type UnavailabilityBlock =
  | "INVIGILATION"
  | "RESERVE"
  | "REVIEW_FREE"
  | "CORRECTION_FREE"
  | "ALL";

export type UnavailabilityPeriod = "AM" | "PM";

export type UnavailabilityTaskType =
  | "INVIGILATION"
  | "RESERVE"
  | "DUTY_INVIGILATOR"
  | "REVIEW_FREE"
  | "CORRECTION_FREE";

export type UnavailabilityRule = {
  id: string;
  teacherId: string;
  teacherName: string;
  dateISO: string;
  period: UnavailabilityPeriod;
  blocks: UnavailabilityBlock[];
  reason?: string;
  createdAt: number;
};

const LEGACY_KEY = "exam-manager:task-distribution:unavailability:v1";
const KEY_PREFIX = "exam-manager:task-distribution:unavailability:";
const KEY_SUFFIX = ":v2";
const SUB_COLLECTION = "unavailability";

export const UNAVAIL_UPDATED_EVENT = "exam-manager:task-distribution:unavailability-updated";

function getCurrentLang(): "ar" | "en" {
  try {
    const htmlLang =
      typeof document !== "undefined"
        ? String(document.documentElement?.lang || "").trim().toLowerCase()
        : "";

    if (htmlLang === "en") return "en";
  } catch {}

  try {
    const raw =
      typeof localStorage !== "undefined"
        ? String(localStorage.getItem("lang") || localStorage.getItem("i18n-lang") || "")
            .trim()
            .toLowerCase()
        : "";

    if (raw === "en") return "en";
  } catch {}

  return "ar";
}

function tenantUnavailabilityAuditSummary() {
  return getCurrentLang() === "en"
    ? "Updated tenant-scoped task distribution unavailability"
    : "تم تحديث عدم التوفر لتوزيع المهام على مستوى الجهة";
}

function normalizeTenantId(input?: string | null): string {
  const direct = String(input ?? "").trim();

  if (direct) return direct;

  try {
    const auditTenantId = String(getAuditContext()?.tenantId ?? "").trim();

    if (auditTenantId) return auditTenantId;
  } catch {}

  try {
    const supportTenantId = String(localStorage.getItem("supportTenantId") ?? "").trim();

    if (supportTenantId) return supportTenantId;
  } catch {}

  return "default";
}

function storageKeyForTenant(tenantId?: string | null) {
  return `${KEY_PREFIX}${normalizeTenantId(tenantId)}${KEY_SUFFIX}`;
}

function normalizeUnavailablePeriod(value: any): UnavailabilityPeriod {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[\.\s_-]+/g, "");
  if (
    raw.includes("الثانية") ||
    raw.includes("ثانيه") ||
    lower.includes("second") ||
    compact === "pm" ||
    compact === "bm" ||
    compact === "p2" ||
    compact === "period2" ||
    compact === "2" ||
    compact === "p"
  ) return "PM";
  return "AM";
}

function normalizeRule(input: any): UnavailabilityRule | null {
  const id = String(input?.id ?? "").trim();
  const teacherId = String(input?.teacherId ?? "").trim();
  const teacherName = String(input?.teacherName ?? "").trim();
  const dateISO = String(input?.dateISO ?? "").trim();

  const period: UnavailabilityPeriod = normalizeUnavailablePeriod(input?.period);

  const blocksRaw = Array.isArray(input?.blocks) ? input.blocks : ["ALL"];

  const blocks = Array.from(
    new Set(
      blocksRaw
        .map((b: any) => String(b ?? "").trim().toUpperCase())
        .filter(Boolean)
        .filter((b: any) =>
          ["INVIGILATION", "RESERVE", "REVIEW_FREE", "CORRECTION_FREE", "ALL"].includes(b)
        )
    )
  ) as UnavailabilityBlock[];

  if (!id || !teacherId || !teacherName || !dateISO) return null;

  return {
    id,
    teacherId,
    teacherName,
    dateISO,
    period,
    blocks: blocks.length ? blocks : ["ALL"],
    reason: String(input?.reason ?? "").trim() || undefined,
    createdAt: Number(input?.createdAt ?? 0) || Date.now(),
  };
}

function normalizeRules(rules: any[]): UnavailabilityRule[] {
  return (Array.isArray(rules) ? rules : [])
    .map(normalizeRule)
    .filter(Boolean) as UnavailabilityRule[];
}

function emitUpdated(tenantId?: string | null) {
  try {
    window.dispatchEvent(
      new CustomEvent(UNAVAIL_UPDATED_EVENT, {
        detail: {
          ts: Date.now(),
          tenantId: normalizeTenantId(tenantId),
        },
      })
    );
  } catch {}
}

function readLocalRules(tenantId?: string | null): UnavailabilityRule[] {
  const scopedKey = storageKeyForTenant(tenantId);

  try {
    const raw = localStorage.getItem(scopedKey);

    if (raw) return normalizeRules(JSON.parse(raw));
  } catch {}

  const resolvedTenantId = normalizeTenantId(tenantId);

  if (tenantId && resolvedTenantId !== "default") return [];

  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);

    if (!legacyRaw) return [];

    const migrated = normalizeRules(JSON.parse(legacyRaw));

    if (migrated.length) {
      localStorage.setItem(scopedKey, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}

  return [];
}

export function loadUnavailability(tenantId?: string | null): UnavailabilityRule[] {
  return readLocalRules(tenantId);
}

export function saveUnavailability(rules: UnavailabilityRule[], tenantId?: string | null) {
  const scopedKey = storageKeyForTenant(tenantId);

  try {
    localStorage.setItem(scopedKey, JSON.stringify(normalizeRules(rules || [])));
  } catch {}

  emitUpdated(tenantId);
}

export function addUnavailability(rule: UnavailabilityRule, tenantId?: string | null) {
  const rules = loadUnavailability(tenantId);
  rules.unshift(rule);
  saveUnavailability(rules, tenantId);
}

export function deleteUnavailability(id: string, tenantId?: string | null) {
  const rules = loadUnavailability(tenantId).filter((r) => r.id !== id);
  saveUnavailability(rules, tenantId);
}

export async function syncUnavailabilityFromTenant(
  tenantId?: string | null
): Promise<UnavailabilityRule[]> {
  const resolvedTenantId = normalizeTenantId(tenantId);

  if (!resolvedTenantId) {
    return loadUnavailability(resolvedTenantId);
  }

  try {
    const rows = await loadTenantArray<any>(resolvedTenantId, SUB_COLLECTION);
    const normalized = normalizeRules(rows || []);
    saveUnavailability(normalized, resolvedTenantId);
    return normalized;
  } catch {
    return loadUnavailability(resolvedTenantId);
  }
}

export async function persistUnavailabilityToTenant(args: {
  tenantId?: string | null;
  rules: UnavailabilityRule[];
  by?: string | null;
}) {
  const resolvedTenantId = normalizeTenantId(args.tenantId);
  const normalized = normalizeRules(args.rules || []);

  await replaceTenantArray<UnavailabilityRule>(resolvedTenantId, SUB_COLLECTION, normalized, {
    by: String(args.by ?? "").trim() || undefined,
    audit: {
      action: "save",
      entity: "unavailability",
      meta: {
        count: normalized.length,
        summary: tenantUnavailabilityAuditSummary(),
      },
    },
  });

  saveUnavailability(normalized, resolvedTenantId);

  return normalized;
}

export function buildUnavailabilityIndex(rules: UnavailabilityRule[]) {
  const set = new Set<string>();

  for (const r of rules || []) {
    const tid = String(r.teacherId || "").trim();
    const dateISO = String(r.dateISO || "").trim();
    const period = normalizeUnavailablePeriod(r.period);

    if (!tid || !dateISO) continue;

    const blocks = Array.isArray(r.blocks) && r.blocks.length ? r.blocks : ["ALL"];

    for (const b of blocks) {
      set.add(`${tid}|${dateISO}|${period}|${b}`);
    }
  }

  return set;
}

function normalizeUnavailableTaskType(taskType: UnavailabilityTaskType): UnavailabilityBlock {
  if (taskType === "DUTY_INVIGILATOR") {
    return "INVIGILATION";
  }

  return taskType;
}

export function isTeacherUnavailable(args: {
  teacherId: string;
  dateISO: string;
  period: UnavailabilityPeriod;
  taskType: UnavailabilityTaskType;
  index: Set<string>;
}) {
  const tid = String(args.teacherId || "").trim();
  const dateISO = String(args.dateISO || "").trim();
  const period = normalizeUnavailablePeriod(args.period);
  const taskType = normalizeUnavailableTaskType(args.taskType);
  const idx = args.index;

  if (!tid || !dateISO) return false;

  return (
    idx.has(`${tid}|${dateISO}|${period}|ALL`) ||
    idx.has(`${tid}|${dateISO}|${period}|${taskType}`)
  );
}

export function buildUnavailabilityReasonMap(rules: UnavailabilityRule[]) {
  const m = new Map<string, string>();

  for (const r of rules || []) {
    const tid = String(r.teacherId || "").trim();
    const dateISO = String(r.dateISO || "").trim();
    const period = normalizeUnavailablePeriod(r.period);

    if (!tid || !dateISO) continue;

    const reason = String(r.reason || "").trim();
    const blocks = Array.isArray(r.blocks) && r.blocks.length ? r.blocks : ["ALL"];

    for (const b of blocks) {
      const key = `${tid}|${dateISO}|${period}|${b}`;

      if (!m.has(key)) {
        m.set(key, reason);
      }
    }
  }

  return m;
}