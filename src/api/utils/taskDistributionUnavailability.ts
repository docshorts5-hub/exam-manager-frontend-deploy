// src/utils/taskDistributionUnavailability.ts

/**
 * Unavailability rules for Task Distribution.
 * المصدر الفعلي أصبح tenant-scoped مع كاش محلي لكل جهة.
 * الهدف: منع إسناد مهام (مراقبة/احتياط/مراجعة/تصحيح) لمعلم في تاريخ+فترة محددة.
 */

import { getAuditContext } from "../services/auditAuto";
import { loadTenantArray, replaceTenantArray } from "../services/tenantData";

export type UnavailabilityBlock = "INVIGILATION" | "RESERVE" | "REVIEW_FREE" | "CORRECTION_FREE" | "ALL";
export type UnavailabilityPeriod = "AM" | "PM";

export type UnavailabilityRule = {
  id: string;
  teacherId: string;
  teacherName: string;
  dateISO: string; // YYYY-MM-DD
  period: UnavailabilityPeriod;
  blocks: UnavailabilityBlock[]; // إذا كانت تحتوي ALL => تمنع كل الأنواع
  reason?: string;
  createdAt: number;
};

const LEGACY_KEY = "exam-manager:task-distribution:unavailability:v1";
const KEY_PREFIX = "exam-manager:task-distribution:unavailability:";
const KEY_SUFFIX = ":v2";
const SUB_COLLECTION = "unavailability";
export const UNAVAIL_UPDATED_EVENT = "exam-manager:task-distribution:unavailability-updated";

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

function normalizeRule(input: any): UnavailabilityRule | null {
  const id = String(input?.id ?? "").trim();
  const teacherId = String(input?.teacherId ?? "").trim();
  const teacherName = String(input?.teacherName ?? "").trim();
  const dateISO = String(input?.dateISO ?? "").trim();
  const period: UnavailabilityPeriod = String(input?.period ?? "").toUpperCase() === "PM" ? "PM" : "AM";
  const blocksRaw = Array.isArray(input?.blocks) ? input.blocks : ["ALL"];
  const blocks = Array.from(
    new Set(
      blocksRaw
        .map((b: any) => String(b ?? "").trim().toUpperCase())
        .filter(Boolean)
        .filter((b: any) => [
          "INVIGILATION",
          "RESERVE",
          "REVIEW_FREE",
          "CORRECTION_FREE",
          "ALL",
        ].includes(b))
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
        detail: { ts: Date.now(), tenantId: normalizeTenantId(tenantId) },
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

  // ترحيل النسخة القديمة فقط عند الوضع الافتراضي، حتى لا تختلط بيانات جهة بأخرى.
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

export async function syncUnavailabilityFromTenant(tenantId?: string | null): Promise<UnavailabilityRule[]> {
  const resolvedTenantId = normalizeTenantId(tenantId);
  if (!resolvedTenantId) return loadUnavailability(resolvedTenantId);
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
        summary: "Updated tenant-scoped task distribution unavailability",
      },
    },
  });
  saveUnavailability(normalized, resolvedTenantId);
  return normalized;
}

export function buildUnavailabilityIndex(rules: UnavailabilityRule[]) {
  // key formats:
  // teacherId|dateISO|period|TYPE
  const set = new Set<string>();
  for (const r of rules || []) {
    const tid = String(r.teacherId || "").trim();
    const dateISO = String(r.dateISO || "").trim();
    const period = r.period === "PM" ? "PM" : "AM";
    if (!tid || !dateISO) continue;

    const blocks = Array.isArray(r.blocks) && r.blocks.length ? r.blocks : ["ALL"];
    for (const b of blocks) {
      set.add(`${tid}|${dateISO}|${period}|${b}`);
    }
  }
  return set;
}

export function isTeacherUnavailable(args: {
  teacherId: string;
  dateISO: string;
  period: UnavailabilityPeriod;
  taskType: "INVIGILATION" | "RESERVE" | "REVIEW_FREE" | "CORRECTION_FREE";
  index: Set<string>;
}) {
  const tid = String(args.teacherId || "").trim();
  const dateISO = String(args.dateISO || "").trim();
  const period = args.period === "PM" ? "PM" : "AM";
  const t = args.taskType;
  const idx = args.index;
  if (!tid || !dateISO) return false;
  return idx.has(`${tid}|${dateISO}|${period}|ALL`) || idx.has(`${tid}|${dateISO}|${period}|${t}`);
}

export function buildUnavailabilityReasonMap(rules: UnavailabilityRule[]) {
  // key formats: teacherId|dateISO|period|TYPE  => reason string (first non-empty)
  const m = new Map<string, string>();
  for (const r of rules || []) {
    const tid = String(r.teacherId || "").trim();
    const dateISO = String(r.dateISO || "").trim();
    const period = r.period === "PM" ? "PM" : "AM";
    if (!tid || !dateISO) continue;

    const reason = String(r.reason || "").trim();
    const blocks = Array.isArray(r.blocks) && r.blocks.length ? r.blocks : ["ALL"];
    for (const b of blocks) {
      const key = `${tid}|${dateISO}|${period}|${b}`;
      if (!m.has(key)) m.set(key, reason);
    }
  }
  return m;
}
