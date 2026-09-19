import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import {
  deleteCloudBackup,
  fetchCloudBackup,
  listCloudBackups,
  shouldBackupLocalStorageKey,
  shouldRestoreLocalStorageKey,
  validateBackupFile,
} from "../utils/dbBackupManager";

type TestStatus = "pass" | "fail" | "skip" | "wait";
type NoticeTone = "info" | "success" | "error" | "warning" | "restore" | "delete";
type PendingBackupAction = { kind: "restore" | "delete"; backupId: string; title: string; message: string } | null;

type HealthTest = {
  id: string;
  title: string;
  status: TestStatus;
  details: string;
};

type CloudBackupRow = {
  id: string;
  createdAt?: unknown;
  createdAtMs?: unknown;
  createdAtISO?: unknown;
  exportedAt?: unknown;
  updatedAt?: unknown;
  note?: unknown;
  byEmail?: unknown;
  createdBy?: unknown;
  sizeBytes?: unknown;
  size?: unknown;
  recordsCount?: unknown;
  collectionsCount?: unknown;
  backupType?: unknown;
  totalRecords?: unknown;
  totalChunks?: unknown;
  source?: unknown;
  retentionRole?: unknown;
  retentionAnchorISO?: unknown;
  retentionDemotedAtISO?: unknown;
  retentionExpiresAtISO?: unknown;
  retentionUpdatedAtISO?: unknown;
  [key: string]: unknown;
};

const GOLD = "#b58b16";
const DARK = "#1f2937";
const BEIGE = "#f7efe0";
const CARD = "rgba(255, 252, 242, 0.92)";
const LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

function getStorageValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function isReadOnlyViewForTenant(tenantId: string): boolean {
  const targetTenantId = String(tenantId || "").trim();
  if (!targetTenantId) return false;

  const flags = [
    getStorageValue("governorateSuperReadOnly"),
    getStorageValue("viewAsReadOnly"),
    getStorageValue("readOnly"),
  ].some((value) => ["1", "true", "yes"].includes(value.toLowerCase()));

  if (!flags) return false;

  const expiresAt = Number(getStorageValue("governorateSuperViewExpiresAt") || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) return false;

  return [
    getStorageValue("governorateSuperViewTenantId"),
    getStorageValue("viewAsTenantId"),
    getStorageValue("effectiveTenantId"),
    getStorageValue("selectedTenantId"),
    getStorageValue("tenantId"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .includes(targetTenantId);
}

function errorMessage(error: unknown) {
  const anyError = error as { code?: unknown; message?: unknown };
  const code = String(anyError?.code || "").trim();
  const message = String(anyError?.message || error || "").trim();
  return code ? `${code}: ${message}` : message || "Unknown error";
}

function statusLabel(status: TestStatus, lang: "ar" | "en") {
  if (lang === "ar") {
    return status === "pass" ? "ناجح" : status === "fail" ? "فشل" : status === "skip" ? "تم التجاوز" : "جاري الفحص";
  }
  return status === "pass" ? "Passed" : status === "fail" ? "Failed" : status === "skip" ? "Skipped" : "Checking";
}

function statusColor(status: TestStatus) {
  if (status === "pass") return "#166534";
  if (status === "fail") return "#991b1b";
  if (status === "skip") return "#854d0e";
  return "#374151";
}

function inferNoticeTone(message: string): NoticeTone {
  const text = String(message || "").toLowerCase();
  if (!text) return "info";
  if (text.includes("تعذر") || text.includes("فشل") || text.includes("failed") || text.includes("could not") || text.includes("error")) return "error";
  if (text.includes("لا يمكن") || text.includes("تحذير") || text.includes("warning") || text.includes("read-only")) return "warning";
  if (text.includes("استعاد") || text.includes("restore") || text.includes("restored")) return "restore";
  if (text.includes("حذف") || text.includes("delete") || text.includes("deleted")) return "delete";
  if (text.includes("تم") || text.includes("success")) return "success";
  return "info";
}

function noticeTheme(tone: NoticeTone) {
  if (tone === "restore") {
    return {
      icon: "↩️",
      titleAr: "استعادة النسخة",
      titleEn: "Restore backup",
      border: "rgba(22, 101, 52, 0.35)",
      background: "linear-gradient(135deg, #ecfdf5, #dcfce7)",
      color: "#14532d",
      accent: "#16a34a",
    };
  }
  if (tone === "delete") {
    return {
      icon: "🗑️",
      titleAr: "حذف النسخة",
      titleEn: "Delete backup",
      border: "rgba(185, 28, 28, 0.35)",
      background: "linear-gradient(135deg, #fff1f2, #fee2e2)",
      color: "#7f1d1d",
      accent: "#dc2626",
    };
  }
  if (tone === "error") {
    return {
      icon: "⚠️",
      titleAr: "تنبيه خطأ",
      titleEn: "Error notice",
      border: "rgba(153, 27, 27, 0.35)",
      background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
      color: "#7f1d1d",
      accent: "#991b1b",
    };
  }
  if (tone === "warning") {
    return {
      icon: "⚡",
      titleAr: "تنبيه مهم",
      titleEn: "Important notice",
      border: "rgba(180, 83, 9, 0.35)",
      background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
      color: "#78350f",
      accent: "#d97706",
    };
  }
  if (tone === "success") {
    return {
      icon: "✅",
      titleAr: "تم بنجاح",
      titleEn: "Success",
      border: "rgba(22, 101, 52, 0.3)",
      background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
      color: "#14532d",
      accent: "#15803d",
    };
  }
  return {
    icon: "ℹ️",
    titleAr: "معلومة",
    titleEn: "Information",
    border: "rgba(37, 99, 235, 0.32)",
    background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
    color: "#1e3a8a",
    accent: "#2563eb",
  };
}

function numberFromUnknown(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function timestampMsFromUnknown(value: unknown): number {
  if (!value) return 0;

  const maybeTimestamp = value as { toMillis?: unknown; seconds?: unknown; nanoseconds?: unknown };
  if (typeof maybeTimestamp.toMillis === "function") {
    try {
      const ms = maybeTimestamp.toMillis();
      return Number.isFinite(Number(ms)) ? Number(ms) : 0;
    } catch {
      return 0;
    }
  }

  if (typeof maybeTimestamp.seconds === "number") {
    return maybeTimestamp.seconds * 1000;
  }

  const rawNumber = numberFromUnknown(value);
  if (rawNumber > 0) return rawNumber;

  const parsed = new Date(String(value || "")).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatBackupDate(value: unknown, lang: "ar" | "en"): string {
  const ms = timestampMsFromUnknown(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleString(lang === "ar" ? "ar" : "en");
}

function getBackupCreatedValue(item: CloudBackupRow): unknown {
  return item.createdAtMs || item.createdAtISO || item.createdAt || item.exportedAt || item.updatedAt || "";
}

function getBackupSortTime(item: CloudBackupRow): number {
  return timestampMsFromUnknown(getBackupCreatedValue(item));
}

function mergeBackupRows(rows: CloudBackupRow[]): CloudBackupRow[] {
  const byId = new Map<string, CloudBackupRow>();

  rows.forEach((row) => {
    const id = String(row?.id || "").trim();
    if (!id) return;
    const old = byId.get(id) || ({ id } as CloudBackupRow);
    byId.set(id, { ...old, ...row, id });
  });

  return Array.from(byId.values()).sort((a, b) => getBackupSortTime(b) - getBackupSortTime(a));
}

function isFullProgramBackup(item?: CloudBackupRow | null): boolean {
  if (!item) return false;
  return String(item.backupType || "") === "full-program" || String(item.source || "") === "firestoreBackups";
}

function getBackupSizeLabel(item: CloudBackupRow): string {
  const size = numberFromUnknown(item.sizeBytes || item.size);
  if (size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
    return `${Math.round(size / 1024 / 102.4) / 10} MB`;
  }

  const totalRecords = numberFromUnknown(item.totalRecords || item.recordsCount);
  const totalChunks = numberFromUnknown(item.totalChunks || item.collectionsCount);
  if (totalRecords || totalChunks) return `${totalRecords} records / ${totalChunks} chunks`;
  return "—";
}

const STANDARD_BACKUP_RETENTION_DAYS = 21;
const LATEST_BACKUP_RETENTION_MONTHS = 6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type BackupRetentionInfo = {
  backupId: string;
  role: "latest" | "standard";
  anchorMs: number;
  expiresMs: number;
  anchorISO: string;
  expiresAtISO: string;
  demotedAtISO?: string;
  expired: boolean;
};

function isoFromMs(ms: number) {
  return new Date(ms).toISOString();
}

function addMonthsMs(ms: number, months: number) {
  const d = new Date(ms);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // If adding months overflows into the following month, keep the last valid day.
  // Example: Jan 31 + 1 month -> Feb 28/29 instead of Mar 3.
  if (d.getDate() < day) d.setDate(0);
  return d.getTime();
}

function parseBackupIdTimeMs(id: string): number {
  const match = String(id || "").match(/(\d{12,})/);
  if (!match) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getBackupCreatedMs(item: CloudBackupRow): number {
  return getBackupSortTime(item) || parseBackupIdTimeMs(String(item?.id || ""));
}

function computeBackupRetentionInfo(item: CloudBackupRow, latestBackupId: string, nowMs = Date.now()): BackupRetentionInfo {
  const backupId = String(item?.id || "").trim();
  const createdMs = getBackupCreatedMs(item) || nowMs;
  const isLatest = !!backupId && backupId === latestBackupId;

  if (isLatest) {
    const expiresMs = addMonthsMs(createdMs, LATEST_BACKUP_RETENTION_MONTHS);
    return {
      backupId,
      role: "latest",
      anchorMs: createdMs,
      expiresMs,
      anchorISO: isoFromMs(createdMs),
      expiresAtISO: isoFromMs(expiresMs),
      expired: nowMs >= expiresMs,
    };
  }

  const storedDemotionMs = timestampMsFromUnknown(item.retentionDemotedAtISO);
  const canStoreDemotion = isFullProgramBackup(item);
  const anchorMs = storedDemotionMs || (canStoreDemotion ? nowMs : createdMs);
  const expiresMs = anchorMs + STANDARD_BACKUP_RETENTION_DAYS * MS_PER_DAY;

  return {
    backupId,
    role: "standard",
    anchorMs,
    expiresMs,
    anchorISO: isoFromMs(anchorMs),
    demotedAtISO: isoFromMs(anchorMs),
    expiresAtISO: isoFromMs(expiresMs),
    expired: nowMs >= expiresMs,
  };
}

function formatRetentionDate(iso: string, lang: "ar" | "en") {
  const ms = timestampMsFromUnknown(iso);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(lang === "ar" ? "ar" : "en", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getBackupRetentionLabel(item: CloudBackupRow, latestBackupId: string, lang: "ar" | "en") {
  if (!String(item?.id || "").trim()) return "—";
  const info = computeBackupRetentionInfo(item, latestBackupId);
  const expiry = formatRetentionDate(info.expiresAtISO, lang);

  if (lang === "ar") {
    return info.role === "latest"
      ? `آخر نسخة: محفوظة 6 أشهر حتى ${expiry}`
      : `نسخة سابقة: تحذف بعد 3 أسابيع في ${expiry}`;
  }

  return info.role === "latest"
    ? `Latest backup: kept for 6 months until ${expiry}`
    : `Previous backup: deleted after 3 weeks on ${expiry}`;
}

function readLocalStorageSummary() {
  if (typeof window === "undefined") return { total: 0, synced: 0, cache: 0 };
  let total = 0;
  let synced = 0;
  let cache = 0;

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) || "";
      total += 1;
      if (key.includes("cloud-cache") || key.includes(":cache:")) cache += 1;
      if (shouldBackupLocalStorageKey(key)) {
        synced += 1;
      }
    }
  } catch {
    // ignore
  }

  return { total, synced, cache };
}

const FULL_BACKUP_COLLECTIONS = [
  "teachers",
  "exams",
  "rooms",
  "roomBlocks",
  "examRoomAssignments",
  "studentSeatRegister12",
  "schoolControlMembers",
  "schoolControlReports",
  "candidateViolationReports12",
  "candidateWrittenWarnings12",
  "unavailability",
  "archive",
  "cloudLocalStorage",
  "settings",
];

// Firestore has a hard document/field size limit close to 1 MiB.
// Keep every saved payload well below that limit and split any single oversized row.
const FULL_BACKUP_CHUNK_LIMIT = 420_000;
const FULL_BACKUP_LARGE_TEXT_PART_CHARS = 180_000;

type PreparedBackupChunk =
  | {
      storageKind: "rows";
      rows: any[];
      recordCount: number;
      payloadBytes: number;
    }
  | {
      storageKind: "rowPart";
      sourceRowId: string;
      rowJsonPart: string;
      partIndex: number;
      totalParts: number;
      recordCount: number;
      payloadBytes: number;
    };

function safeDocIdPart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function collectTenantLocalStorageSnapshot(tenantId: string) {
  if (typeof window === "undefined") return [] as Array<{ key: string; value: string }>;

  const target = String(tenantId || "").trim();
  const rows: Array<{ key: string; value: string }> = [];

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) || "";
      if (shouldBackupLocalStorageKey(key, target)) {
        rows.push({ key, value: String(window.localStorage.getItem(key) || "") });
      }
    }
  } catch {
    // ignore local storage export errors
  }

  return rows;
}

function textByteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    try {
      return unescape(encodeURIComponent(value)).length;
    } catch {
      return String(value || "").length;
    }
  }
}

function splitLargeJsonText(value: string): string[] {
  const text = String(value || "");
  if (!text) return [""];

  const parts: string[] = [];
  for (let start = 0; start < text.length; start += FULL_BACKUP_LARGE_TEXT_PART_CHARS) {
    parts.push(text.slice(start, start + FULL_BACKUP_LARGE_TEXT_PART_CHARS));
  }
  return parts.length ? parts : [""];
}

function getRowBackupId(row: any, index: number): string {
  const direct = String(row?.id || row?.key || row?.data?.id || row?.data?.key || "").trim();
  return safeDocIdPart(direct) || `row-${index + 1}`;
}

function splitRowsForBackup(rows: any[]): PreparedBackupChunk[] {
  const chunks: PreparedBackupChunk[] = [];
  let current: any[] = [];
  let currentSize = 2;

  const flushCurrent = () => {
    if (!current.length) return;
    const rowsJson = JSON.stringify(current);
    chunks.push({
      storageKind: "rows",
      rows: current,
      recordCount: current.length,
      payloadBytes: textByteLength(rowsJson),
    });
    current = [];
    currentSize = 2;
  };

  rows.forEach((row, index) => {
    const rowJson = JSON.stringify(row);
    const rowSize = textByteLength(rowJson) + 8;

    // A single row can be larger than Firestore's per-field limit.
    // In that case, save the row JSON in separate safe parts instead of one huge rowsJson field.
    if (rowSize > FULL_BACKUP_CHUNK_LIMIT) {
      flushCurrent();
      const parts = splitLargeJsonText(rowJson);
      const sourceRowId = getRowBackupId(row, index);
      parts.forEach((part, partIndex) => {
        chunks.push({
          storageKind: "rowPart",
          sourceRowId,
          rowJsonPart: part,
          partIndex: partIndex + 1,
          totalParts: parts.length,
          recordCount: partIndex === 0 ? 1 : 0,
          payloadBytes: textByteLength(part),
        });
      });
      return;
    }

    if (current.length && currentSize + rowSize > FULL_BACKUP_CHUNK_LIMIT) {
      flushCurrent();
    }

    current.push(row);
    currentSize += rowSize;
  });

  flushCurrent();

  return chunks.length
    ? chunks
    : [
        {
          storageKind: "rows",
          rows: [],
          recordCount: 0,
          payloadBytes: 2,
        },
      ];
}

function buildBackupChunkData(chunk: PreparedBackupChunk) {
  if (chunk.storageKind === "rowPart") {
    return {
      storageKind: "rowPart",
      splitLargeRow: true,
      sourceRowId: chunk.sourceRowId,
      partIndex: chunk.partIndex,
      totalParts: chunk.totalParts,
      rowJsonPart: chunk.rowJsonPart,
      recordCount: chunk.recordCount,
      payloadBytes: chunk.payloadBytes,
    };
  }

  const rowsJson = JSON.stringify(chunk.rows);
  return {
    storageKind: "rows",
    rowsJson,
    recordCount: chunk.recordCount,
    payloadBytes: textByteLength(rowsJson),
  };
}

async function readTenantCollectionRows(tenantId: string, collectionName: string) {
  const snap = await getDocs(collection(db, "tenants", tenantId, collectionName));
  return snap.docs.map((item) => ({ id: item.id, data: item.data() }));
}

async function listFirestoreBackupDocs(tenantId: string): Promise<CloudBackupRow[]> {
  const snap = await getDocs(collection(db, "tenants", tenantId, "backups"));
  return snap.docs.map((item) => ({ id: item.id, source: "firestoreBackups", ...item.data() } as CloudBackupRow));
}

async function deleteFirestoreBackupDoc(tenantId: string, backupId: string) {
  const chunksSnap = await getDocs(collection(db, "tenants", tenantId, "backups", backupId, "chunks"));
  for (const chunkDoc of chunksSnap.docs) {
    await deleteDoc(doc(db, "tenants", tenantId, "backups", backupId, "chunks", chunkDoc.id));
  }
  await deleteDoc(doc(db, "tenants", tenantId, "backups", backupId));
}

async function updateFirestoreBackupRetention(tenantId: string, item: CloudBackupRow, info: BackupRetentionInfo) {
  const backupId = String(item?.id || "").trim();
  if (!tenantId || !backupId || !isFullProgramBackup(item)) return;

  const payload: Record<string, any> = {
    retentionPolicyVersion: "v1",
    retentionRole: info.role,
    retentionAnchorISO: info.anchorISO,
    retentionExpiresAtISO: info.expiresAtISO,
    retentionUpdatedAtISO: new Date().toISOString(),
  };

  if (info.role === "latest") {
    payload.retentionLabelAr = "آخر نسخة - تحفظ لمدة ستة أشهر";
    payload.retentionLabelEn = "Latest backup - kept for six months";
    payload.retentionDemotedAtISO = null;
  } else {
    payload.retentionLabelAr = "نسخة سابقة - تحذف بعد ثلاثة أسابيع";
    payload.retentionLabelEn = "Previous backup - deleted after three weeks";
    payload.retentionDemotedAtISO = String(item.retentionDemotedAtISO || info.demotedAtISO || info.anchorISO);
  }

  await setDoc(doc(db, "tenants", tenantId, "backups", backupId), payload, { merge: true });
}

async function deleteAnyCloudBackup(tenantId: string, item: CloudBackupRow) {
  const backupId = String(item?.id || "").trim();
  if (!tenantId || !backupId) return;

  if (isFullProgramBackup(item)) {
    await deleteFirestoreBackupDoc(tenantId, backupId);
    return;
  }

  try {
    await deleteCloudBackup(tenantId, backupId);
  } catch {
    await deleteFirestoreBackupDoc(tenantId, backupId);
  }
}

type RestoredFullBackupRows = Record<string, Array<{ id: string; data: any }>>;

function extractRowsFromFullBackupChunks(chunks: Array<Record<string, any>>): RestoredFullBackupRows {
  const result: RestoredFullBackupRows = {};
  const rowParts: Record<string, Array<{ partIndex: number; text: string }>> = {};

  chunks.forEach((chunk) => {
    const collectionName = String(chunk.collectionName || "").trim();
    if (!collectionName) return;

    if (!result[collectionName]) result[collectionName] = [];

    if (String(chunk.storageKind || "") === "rowPart") {
      const sourceRowId = String(chunk.sourceRowId || "row").trim();
      const key = `${collectionName}::${sourceRowId}`;
      if (!rowParts[key]) rowParts[key] = [];
      rowParts[key].push({ partIndex: Number(chunk.partIndex || 0), text: String(chunk.rowJsonPart || "") });
      return;
    }

    const rowsJson = String(chunk.rowsJson || "[]");
    try {
      const rows = JSON.parse(rowsJson);
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          if (row && typeof row === "object") {
            result[collectionName].push({ id: String(row.id || row.key || "").trim(), data: row.data });
          }
        });
      }
    } catch {
      // Ignore malformed chunk instead of breaking the full restore.
    }
  });

  Object.entries(rowParts).forEach(([key, parts]) => {
    const [collectionName, sourceRowId] = key.split("::");
    const joined = parts
      .sort((a, b) => a.partIndex - b.partIndex)
      .map((part) => part.text)
      .join("");

    try {
      const row = JSON.parse(joined);
      if (!result[collectionName]) result[collectionName] = [];
      result[collectionName].push({ id: String(row?.id || row?.key || sourceRowId || "").trim(), data: row?.data });
    } catch {
      // Ignore malformed large row part.
    }
  });

  return result;
}

async function restoreFullProgramBackupFromFirestore(tenantId: string, backupId: string) {
  const backupSnap = await getDoc(doc(db, "tenants", tenantId, "backups", backupId));
  if (!backupSnap.exists()) throw new Error("Backup metadata was not found.");

  const chunksSnap = await getDocs(collection(db, "tenants", tenantId, "backups", backupId, "chunks"));
  const chunks = chunksSnap.docs.map((item) => item.data() as Record<string, any>);
  const rowsByCollection = extractRowsFromFullBackupChunks(chunks);

  const localRows = rowsByCollection.__meta__?.find((row) => row.id === "localStorage")?.data;
  if (typeof window !== "undefined" && Array.isArray(localRows)) {
    localRows.forEach((item) => {
      const key = String(item?.key || "").trim();
      if (!key || !shouldRestoreLocalStorageKey(key, tenantId)) return;
      window.localStorage.setItem(key, String(item?.value || ""));
    });
  }

  for (const [collectionName, rows] of Object.entries(rowsByCollection)) {
    if (collectionName === "__meta__") continue;
    for (const row of rows) {
      const rowId = String(row.id || "").trim();
      if (!rowId || row.data === undefined || row.data === null) continue;
      await setDoc(doc(db, "tenants", tenantId, collectionName, rowId), row.data, { merge: false });
    }
  }
}

export default function CloudStorageHealth() {
  const navigate = useNavigate();
  const { tenantId } = useParams();
  const auth = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const tid = String(tenantId || "").trim();
  const readOnly = useMemo(() => {
    return Boolean(
      auth?.readOnly ||
        auth?.allow?.readOnly ||
        auth?.profile?.readOnly ||
        auth?.userProfile?.readOnly ||
        isReadOnlyViewForTenant(tid)
    );
  }, [auth, tid]);

  const [running, setRunning] = useState(false);
  const [tests, setTests] = useState<HealthTest[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");
  const [fullBackupBusy, setFullBackupBusy] = useState(false);
  const [fullBackupProgress, setFullBackupProgress] = useState<string>("");
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRow[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupActionId, setBackupActionId] = useState<string>("");
  const [pendingBackupAction, setPendingBackupAction] = useState<PendingBackupAction>(null);
  const localSummary = useMemo(() => readLocalStorageSummary(), [lastCheckedAt, actionMessage]);

  async function enforceCloudBackupRetentionPolicy(items: CloudBackupRow[]) {
    const sortedItems = mergeBackupRows(items || []);
    if (!tid || !sortedItems.length) return sortedItems;

    const latestBackupId = String(sortedItems[0]?.id || "").trim();
    if (!latestBackupId) return sortedItems;

    // لا نحذف تلقائيًا أثناء وضع المشاهدة فقط، حتى لا يكسر مشرف المحافظة وضع العرض فقط.
    if (readOnly) return sortedItems;

    const nowMs = Date.now();
    const keptRows: CloudBackupRow[] = [];
    let deletedCount = 0;
    let updatedCount = 0;

    for (const item of sortedItems) {
      const backupId = String(item?.id || "").trim();
      if (!backupId) continue;

      const retention = computeBackupRetentionInfo(item, latestBackupId, nowMs);

      if (retention.expired) {
        try {
          await deleteAnyCloudBackup(tid, item);
          deletedCount += 1;
        } catch {
          keptRows.push(item);
        }
        continue;
      }

      const rowWithRetention: CloudBackupRow = {
        ...item,
        retentionRole: retention.role,
        retentionAnchorISO: retention.anchorISO,
        retentionExpiresAtISO: retention.expiresAtISO,
        retentionDemotedAtISO: retention.role === "standard" ? String(item.retentionDemotedAtISO || retention.demotedAtISO || retention.anchorISO) : "",
      };

      keptRows.push(rowWithRetention);

      try {
        if (isFullProgramBackup(item)) {
          await updateFirestoreBackupRetention(tid, item, retention);
          updatedCount += 1;
        }
      } catch {
        // لا نوقف تحميل الصفحة إذا فشل تحديث بيانات سياسة الاحتفاظ.
      }
    }

    if (deletedCount > 0) {
      setActionMessage(
        tr(
          `تم حذف ${deletedCount} نسخة سحابية منتهية المدة حسب سياسة الاحتفاظ: النسخ السابقة 3 أسابيع، وآخر نسخة 6 أشهر.`,
          `Deleted ${deletedCount} expired cloud backup(s) according to the retention policy: previous backups 3 weeks, latest backup 6 months.`
        )
      );
    } else if (updatedCount > 0) {
      // تحديث صامت للمدة فقط، بدون إزعاج المستخدم برسالة جديدة كل مرة.
    }

    return mergeBackupRows(keptRows);
  }

  async function refreshCloudBackupVersions() {
    if (!tid) return;
    setBackupsLoading(true);

    const allItems: CloudBackupRow[] = [];
    const errors: string[] = [];

    try {
      const legacyItems = await listCloudBackups(tid, 100);
      if (Array.isArray(legacyItems)) allItems.push(...(legacyItems as CloudBackupRow[]));
    } catch (error) {
      errors.push(errorMessage(error));
    }

    try {
      const firestoreItems = await listFirestoreBackupDocs(tid);
      allItems.push(...firestoreItems);
    } catch (error) {
      errors.push(errorMessage(error));
    }

    const merged = await enforceCloudBackupRetentionPolicy(allItems);
    setCloudBackups(merged);

    if (errors.length && !merged.length) {
      setActionMessage(
        tr(
          `تعذر قراءة نسخ السحابة: ${errors.join(" | ")}`,
          `Could not read cloud backups: ${errors.join(" | ")}`
        )
      );
    }

    setBackupsLoading(false);
  }

  function requestRestoreCloudBackupVersion(backupId: string) {
    if (!backupId) return;
    setPendingBackupAction({
      kind: "restore",
      backupId,
      title: tr("تأكيد استعادة النسخة", "Confirm backup restore"),
      message: tr(
        "سيتم استعادة هذه النسخة إلى التخزين المحلي للبرنامج على هذا الجهاز. تأكد أنك تريد استبدال البيانات الحالية قبل المتابعة.",
        "This backup will be restored into the app local storage on this device. Make sure you want to replace the current local data before continuing."
      ),
    });
  }

  function requestDeleteCloudBackupVersion(backupId: string) {
    if (!backupId) return;
    if (readOnly) {
      setActionMessage(tr("لا يمكن حذف النسخ أثناء وضع المشاهدة فقط.", "Backups cannot be deleted in read-only mode."));
      return;
    }
    setPendingBackupAction({
      kind: "delete",
      backupId,
      title: tr("تأكيد حذف النسخة", "Confirm backup deletion"),
      message: tr(
        "سيتم حذف هذه النسخة السحابية نهائيًا من هذا المركز/المدرسة فقط. لا يمكن التراجع عن الحذف بعد التأكيد.",
        "This cloud backup will be permanently deleted for this tenant only. This action cannot be undone after confirmation."
      ),
    });
  }

  async function confirmPendingBackupAction() {
    const action = pendingBackupAction;
    if (!action) return;
    setPendingBackupAction(null);
    if (action.kind === "restore") {
      await restoreCloudBackupVersion(action.backupId);
      return;
    }
    await deleteCloudBackupVersion(action.backupId);
  }

  async function restoreCloudBackupVersion(backupId: string) {
    if (!tid || !backupId) return;
    setBackupActionId(backupId);
    try {
      const selectedBackup = cloudBackups.find((item) => String(item.id || "") === backupId);

      if (isFullProgramBackup(selectedBackup)) {
        await restoreFullProgramBackupFromFirestore(tid, backupId);
        window.dispatchEvent(new Event("exam-manager:cloud-storage:changed"));
        setActionMessage(
          tr(
            "تمت استعادة النسخة الكاملة من السحابة. يفضل تحديث الصفحة بعد الاستعادة.",
            "Full cloud backup restored. It is recommended to refresh the page."
          )
        );
      } else {
        const cloudFile = await fetchCloudBackup(tid, backupId);
        validateBackupFile(cloudFile);
        const manager = await import("../utils/dbBackupManager");
        if (typeof manager.importDatabase !== "function") {
          throw new Error(tr("دالة الاستعادة غير متاحة في مدير النسخ.", "Restore function is not available."));
        }
        manager.importDatabase(cloudFile, { prefix: "exam-manager" });
        window.dispatchEvent(new Event("exam-manager:cloud-storage:changed"));
        setActionMessage(
          tr(
            "تمت استعادة النسخة السحابية محليًا. يفضل تحديث الصفحة بعد الاستعادة.",
            "Cloud backup restored locally. It is recommended to refresh the page."
          )
        );
      }
    } catch (error) {
      setActionMessage(tr(`تعذرت الاستعادة: ${errorMessage(error)}`, `Restore failed: ${errorMessage(error)}`));
    } finally {
      setBackupActionId("");
    }
  }

  async function deleteCloudBackupVersion(backupId: string) {
    if (!tid || !backupId) return;
    if (readOnly) {
      setActionMessage(tr("لا يمكن حذف النسخ أثناء وضع المشاهدة فقط.", "Backups cannot be deleted in read-only mode."));
      return;
    }

    setBackupActionId(backupId);
    try {
      const selectedBackup = cloudBackups.find((item) => String(item.id || "") === backupId);
      if (isFullProgramBackup(selectedBackup)) {
        await deleteFirestoreBackupDoc(tid, backupId);
      } else {
        try {
          await deleteCloudBackup(tid, backupId);
        } catch {
          await deleteFirestoreBackupDoc(tid, backupId);
        }
      }
      await refreshCloudBackupVersions();
      setActionMessage(tr("تم حذف النسخة السحابية بنجاح.", "Cloud backup deleted successfully."));
    } catch (error) {
      setActionMessage(tr(`تعذر حذف النسخة: ${errorMessage(error)}`, `Delete failed: ${errorMessage(error)}`));
    } finally {
      setBackupActionId("");
    }
  }

  function clearInternalCloudCache() {
    if (typeof window === "undefined") return;
    let removed = 0;
    const keys: string[] = [];

    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i) || "";
        if (
          key.includes("cloud-cache") ||
          key.includes("cloud-storage:last-error") ||
          key.includes("cloud-storage:last-warning") ||
          key.includes("cloudLocalStorage:pending")
        ) {
          keys.push(key);
        }
      }

      keys.forEach((key) => {
        window.localStorage.removeItem(key);
        removed += 1;
      });

      window.dispatchEvent(new Event("exam-manager:cloud-storage:changed"));
      setLastCheckedAt(new Date().toLocaleString(lang === "ar" ? "ar" : "en"));
      setActionMessage(
        tr(
          `تم تنظيف ${removed} مفتاح كاش داخلي بدون حذف بيانات البرنامج.`,
          `Cleared ${removed} internal cache key(s) without deleting app data.`
        )
      );
    } catch (error) {
      setActionMessage(tr(`تعذر تنظيف الكاش: ${errorMessage(error)}`, `Could not clear cache: ${errorMessage(error)}`));
    }
  }

  function forceReloadFromCloud() {
    clearInternalCloudCache();
    setActionMessage(tr("تم تنظيف الكاش وسيتم تحديث الصفحة الآن لجلب أحدث بيانات من السحابة.", "Cache cleared. The page will refresh to load the latest cloud data."));
    window.setTimeout(() => window.location.reload(), 450);
  }

  async function copyDiagnosticReport() {
    const report = {
      tenantId: tid,
      readOnly,
      lastCheckedAt,
      localStorage: readLocalStorageSummary(),
      tests: tests.map((test) => ({ id: test.id, status: test.status, details: test.details })),
      generatedAt: new Date().toISOString(),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setActionMessage(tr("تم نسخ تقرير الفحص. أرسله عند ظهور أي مشكلة.", "Diagnostic report copied. Share it when an issue appears."));
    } catch {
      setActionMessage(tr("تعذر النسخ التلقائي. يمكنك استخدام نتائج الفحص الظاهرة في الصفحة.", "Automatic copy failed. You can use the visible check results."));
    }
  }


  async function createFullProgramCloudBackup() {
    if (!tid) {
      setActionMessage(tr("لا يوجد نطاق مركز/مدرسة في الرابط.", "No tenant/school scope was found in the URL."));
      return;
    }

    if (readOnly) {
      setActionMessage(tr("لا يمكن إنشاء نسخة سحابية كاملة أثناء وضع المشاهدة فقط.", "Full cloud backup cannot be created in read-only mode."));
      return;
    }

    const ok = window.confirm(
      tr(
        "سيتم إنشاء نسخة كاملة من بيانات هذا المركز/المدرسة فقط ورفعها إلى السحابة. هل تريد المتابعة؟",
        "A full backup for this tenant only will be created and uploaded to the cloud. Continue?"
      )
    );
    if (!ok) return;

    const createdAt = new Date().toISOString();
    const backupId = `full-program-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const backupRef = doc(db, "tenants", tid, "backups", backupId);
    const createdBy = String(
      auth?.user?.email ||
        auth?.currentUser?.email ||
        auth?.profile?.email ||
        auth?.userProfile?.email ||
        auth?.allow?.email ||
        ""
    ).trim();

    setFullBackupBusy(true);
    setFullBackupProgress(tr("جاري تجهيز النسخة الكاملة...", "Preparing full backup..."));
    setActionMessage("");

    const collectionSummaries: Array<{ name: string; count: number; chunks: number; status: string; error?: string }> = [];
    let totalRecords = 0;
    let totalChunks = 0;

    try {
      let tenantRoot: Record<string, any> | null = null;
      let tenantConfig: Record<string, any> | null = null;

      try {
        const tenantSnap = await getDoc(doc(db, "tenants", tid));
        tenantRoot = tenantSnap.exists() ? tenantSnap.data() : null;
      } catch (error) {
        collectionSummaries.push({ name: "tenantRoot", count: 0, chunks: 0, status: "read-failed", error: errorMessage(error) });
      }

      try {
        const configSnap = await getDoc(doc(db, "tenants", tid, "meta", "config"));
        tenantConfig = configSnap.exists() ? configSnap.data() : null;
      } catch (error) {
        collectionSummaries.push({ name: "meta/config", count: 0, chunks: 0, status: "read-failed", error: errorMessage(error) });
      }

      const localRows = collectTenantLocalStorageSnapshot(tid);
      const metaRows = [
        { id: "tenantRoot", data: tenantRoot },
        { id: "metaConfig", data: tenantConfig },
        { id: "localStorage", data: localRows },
      ];
      const metaChunks = splitRowsForBackup(metaRows);

      for (let index = 0; index < metaChunks.length; index += 1) {
        await setDoc(doc(db, "tenants", tid, "backups", backupId, "chunks", `meta-${String(index + 1).padStart(3, "0")}`), {
          backupId,
          tenantId: tid,
          chunkType: "meta",
          collectionName: "__meta__",
          index: index + 1,
          ...buildBackupChunkData(metaChunks[index]),
          createdAt: serverTimestamp(),
          createdAtISO: createdAt,
        });
      }
      totalChunks += metaChunks.length;
      totalRecords += metaRows.length;
      collectionSummaries.push({ name: "__meta__", count: metaRows.length, chunks: metaChunks.length, status: "ok" });

      for (const collectionName of FULL_BACKUP_COLLECTIONS) {
        setFullBackupProgress(tr(`جاري نسخ: ${collectionName}`, `Backing up: ${collectionName}`));
        try {
          const rows = await readTenantCollectionRows(tid, collectionName);
          const chunks = splitRowsForBackup(rows);
          const safeCollectionId = safeDocIdPart(collectionName) || "collection";

          for (let index = 0; index < chunks.length; index += 1) {
            await setDoc(
              doc(
                db,
                "tenants",
                tid,
                "backups",
                backupId,
                "chunks",
                `${safeCollectionId}-${String(index + 1).padStart(3, "0")}`
              ),
              {
                backupId,
                tenantId: tid,
                chunkType: "collection",
                collectionName,
                index: index + 1,
                ...buildBackupChunkData(chunks[index]),
                createdAt: serverTimestamp(),
                createdAtISO: createdAt,
              }
            );
          }

          totalChunks += chunks.length;
          totalRecords += rows.length;
          collectionSummaries.push({ name: collectionName, count: rows.length, chunks: chunks.length, status: "ok" });
        } catch (error) {
          collectionSummaries.push({ name: collectionName, count: 0, chunks: 0, status: "read-failed", error: errorMessage(error) });
        }
      }

      await setDoc(
        backupRef,
        {
          version: "exam-manager-full-cloud-backup-v1",
          backupType: "full-program",
          tenantId: tid,
          scope: "tenant-isolated",
          separatedByTenantId: true,
          createdAt: serverTimestamp(),
          createdAtISO: createdAt,
          createdBy,
          retentionPolicyVersion: "v1",
          retentionRole: "latest",
          retentionAnchorISO: createdAt,
          retentionDemotedAtISO: null,
          retentionExpiresAtISO: isoFromMs(addMonthsMs(new Date(createdAt).getTime(), LATEST_BACKUP_RETENTION_MONTHS)),
          retentionUpdatedAtISO: createdAt,
          retentionLabelAr: "آخر نسخة - تحفظ لمدة ستة أشهر",
          retentionLabelEn: "Latest backup - kept for six months",
          totalCollections: FULL_BACKUP_COLLECTIONS.length,
          totalRecords,
          totalChunks,
          collectionSummaries,
          note: tr(
            "نسخة كاملة مستقلة لهذا المركز/المدرسة فقط. لا تختلط مع أي tenant آخر.",
            "Full isolated backup for this tenant only. It is not mixed with any other tenant."
          ),
        },
        { merge: true }
      );

      setLastCheckedAt(new Date().toLocaleString(lang === "ar" ? "ar" : "en"));
      setActionMessage(
        tr(
          `تم إنشاء النسخة الكاملة ورفعها للسحابة بنجاح. رقم النسخة: ${backupId} — السجلات: ${totalRecords} — الأجزاء: ${totalChunks}`,
          `Full backup uploaded successfully. Backup ID: ${backupId} — records: ${totalRecords} — chunks: ${totalChunks}`
        )
      );
      const optimisticRow: CloudBackupRow = {
        id: backupId,
        source: "firestoreBackups",
        backupType: "full-program",
        tenantId: tid,
        createdAtISO: createdAt,
        createdBy,
        retentionRole: "latest",
        retentionAnchorISO: createdAt,
        retentionDemotedAtISO: null,
        retentionExpiresAtISO: isoFromMs(addMonthsMs(new Date(createdAt).getTime(), LATEST_BACKUP_RETENTION_MONTHS)),
        retentionUpdatedAtISO: createdAt,
        retentionLabelAr: "آخر نسخة - تحفظ لمدة ستة أشهر",
        retentionLabelEn: "Latest backup - kept for six months",
        totalRecords,
        totalChunks,
        note: tr("نسخة كاملة مستقلة", "Full isolated backup"),
      };
      setCloudBackups((prev) => mergeBackupRows([optimisticRow, ...prev]));
      await refreshCloudBackupVersions();
    } catch (error) {
      setActionMessage(tr(`تعذر إنشاء النسخة الكاملة: ${errorMessage(error)}`, `Could not create full backup: ${errorMessage(error)}`));
    } finally {
      setFullBackupBusy(false);
      setFullBackupProgress("");
    }
  }

  async function runHealthCheck() {
    if (!tid) return;
    setRunning(true);
    setTests([
      { id: "local", title: tr("فحص التخزين المحلي", "Local storage check"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "config", title: tr("قراءة إعدادات المركز", "Read tenant config"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "cloudLocalStorageRead", title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "cloudLocalStorageWrite", title: tr("اختبار الكتابة السحابية", "Cloud write test"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
    ]);

    const next: HealthTest[] = [];

    try {
      const summary = readLocalStorageSummary();
      next.push({
        id: "local",
        title: tr("فحص التخزين المحلي", "Local storage check"),
        status: "pass",
        details: tr(
          `المفاتيح المحلية: ${summary.total} — مفاتيح البرنامج: ${summary.synced} — كاش داخلي: ${summary.cache}`,
          `Local keys: ${summary.total} — app keys: ${summary.synced} — internal cache: ${summary.cache}`
        ),
      });
    } catch (error) {
      next.push({ id: "local", title: tr("فحص التخزين المحلي", "Local storage check"), status: "fail", details: errorMessage(error) });
    }

    try {
      const snap = await getDoc(doc(db, "tenants", tid, "meta", "config"));
      next.push({
        id: "config",
        title: tr("قراءة إعدادات المركز", "Read tenant config"),
        status: "pass",
        details: snap.exists()
          ? tr("تمت قراءة إعدادات المركز بنجاح.", "Tenant config was read successfully.")
          : tr("تم الوصول للمسار، لكن وثيقة الإعدادات غير موجودة بعد.", "Path is readable, but the config document does not exist yet."),
      });
    } catch (error) {
      next.push({ id: "config", title: tr("قراءة إعدادات المركز", "Read tenant config"), status: "fail", details: errorMessage(error) });
    }

    try {
      await getDocs(query(collection(db, "tenants", tid, "cloudLocalStorage"), limit(1)));
      next.push({
        id: "cloudLocalStorageRead",
        title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"),
        status: "pass",
        details: tr("تمت قراءة مسار cloudLocalStorage بنجاح.", "cloudLocalStorage path was read successfully."),
      });
    } catch (error) {
      next.push({ id: "cloudLocalStorageRead", title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"), status: "fail", details: errorMessage(error) });
    }

    if (readOnly) {
      next.push({
        id: "cloudLocalStorageWrite",
        title: tr("اختبار الكتابة السحابية", "Cloud write test"),
        status: "skip",
        details: tr("تم تجاوز اختبار الكتابة لأنك داخل المركز بوضع مشاهدة فقط.", "Write test skipped because this tenant is opened in read-only mode."),
      });
    } else {
      const healthRef = doc(db, "tenants", tid, "cloudLocalStorage", `health-check-${Date.now()}`);
      try {
        await setDoc(
          healthRef,
          {
            key: "health-check",
            value: "ok",
            tenantId: tid,
            source: "CloudStorageHealth",
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now(),
          },
          { merge: true }
        );
        await deleteDoc(healthRef);
        next.push({
          id: "cloudLocalStorageWrite",
          title: tr("اختبار الكتابة السحابية", "Cloud write test"),
          status: "pass",
          details: tr("تم اختبار الكتابة والحذف بنجاح.", "Write and delete test passed."),
        });
      } catch (error) {
        next.push({ id: "cloudLocalStorageWrite", title: tr("اختبار الكتابة السحابية", "Cloud write test"), status: "fail", details: errorMessage(error) });
      }
    }

    setTests(next);
    setLastCheckedAt(new Date().toLocaleString(lang === "ar" ? "ar" : "en"));
    setRunning(false);
  }

  useEffect(() => {
    void runHealthCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, readOnly, lang]);

  useEffect(() => {
    void refreshCloudBackupVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, lang]);

  const failedCount = tests.filter((test) => test.status === "fail").length;
  const passedCount = tests.filter((test) => test.status === "pass").length;

  return (
    <main
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        padding: 28,
        background: `linear-gradient(180deg, ${BEIGE} 0%, #fffaf0 50%, #f2e3bd 100%)`,
        color: DARK,
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          border: `4px solid ${GOLD}`,
          borderRadius: 28,
          background: CARD,
          padding: 28,
          boxShadow: "0 18px 45px rgba(100, 75, 15, 0.18)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              border: `2px solid ${GOLD}`,
              background: "#fffaf0",
              color: DARK,
              padding: "12px 20px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {tr("العودة", "Back")}
          </button>

          <div style={{ textAlign: "center", flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 42, fontWeight: 1000, color: DARK }}>
              {tr("فحص التخزين السحابي", "Cloud Storage Health Check")}
            </h1>
            <p style={{ margin: "12px 0 0", fontWeight: 800, color: "#6b4e09" }}>
              {tr("فحص القراءة والكتابة والمشاهدة فقط داخل نطاق المركز الحالي", "Check read, write, and read-only status for the current tenant")}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "center" }}>
               <div style={{ fontWeight: 1000, color: "#6b4e09" }}>{tr("سلطنة عمان", "Ministry of Education")}</div>
              <div style={{ fontWeight: 1000, color: "#6b4e09" }}>{tr("وزارة التعليم", "Ministry of Education")}</div>
              <div style={{ fontWeight: 800 }}>{tid || tr("لا يوجد نطاق", "No tenant")}</div>
            </div>
            <img
              src={LOGO_URL}
              alt="logo"
              style={{ width: 82, height: 82, objectFit: "contain", border: `2px solid ${GOLD}`, borderRadius: 18, background: "#fffaf0", padding: 8 }}
            />
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("النتائج الناجحة", "Passed")}</div>
          <div style={numberStyle("#166534")}>{passedCount}</div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("الأخطاء", "Failed")}</div>
          <div style={numberStyle("#991b1b")}>{failedCount}</div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("نسخ السحابة", "Cloud versions")}</div>
          <div style={numberStyle("#1d4ed8")}>{backupsLoading ? "..." : cloudBackups.length}</div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("وضع الدخول", "Access mode")}</div>
          <div style={{ fontWeight: 1000, color: readOnly ? "#854d0e" : "#166534", fontSize: 22 }}>
            {readOnly ? tr("مشاهدة فقط", "Read-only") : tr("تشغيل وتعديل", "Read & write")}
          </div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("آخر فحص", "Last check")}</div>
          <div style={{ fontWeight: 900 }}>{lastCheckedAt || "—"}</div>
        </div>
      </section>

      <section style={panelStyle()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, color: "#6b4e09", fontSize: 26 }}>{tr("نتيجة الفحص", "Check results")}</h2>
            <p style={{ margin: "6px 0 0", color: "#4b5563", fontWeight: 700 }}>
              {tr("هذه الصفحة لا تغير بيانات البرنامج، باستثناء اختبار مؤقت يتم حذفه مباشرة.", "This page does not change app data except a temporary test document that is deleted immediately.")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={running}
              style={actionButtonStyle(running ? "#9ca3af" : GOLD, running)}
            >
              {running ? tr("جاري الفحص...", "Checking...") : tr("إعادة الفحص", "Run again")}
            </button>
            <button type="button" onClick={clearInternalCloudCache} style={actionButtonStyle("#2563eb", false)}>
              {tr("تنظيف الكاش", "Clear cache")}
            </button>
            <button type="button" onClick={forceReloadFromCloud} style={actionButtonStyle("#166534", false)}>
              {tr("تحديث من السحابة", "Reload from cloud")}
            </button>
            <button
              type="button"
              onClick={() => void createFullProgramCloudBackup()}
              disabled={fullBackupBusy || readOnly || !tid}
              style={actionButtonStyle(fullBackupBusy || readOnly || !tid ? "#9ca3af" : "#7c3aed", fullBackupBusy || readOnly || !tid)}
              title={tr("يرفع نسخة كاملة مستقلة لهذا المركز/المدرسة فقط", "Uploads a full isolated backup for this tenant only")}
            >
              {fullBackupBusy ? tr("جاري رفع النسخة...", "Uploading backup...") : tr("نسخة كاملة للسحابة", "Full cloud backup")}
            </button>
            <button
              type="button"
              onClick={() => void refreshCloudBackupVersions()}
              disabled={backupsLoading}
              style={actionButtonStyle(backupsLoading ? "#9ca3af" : "#1d4ed8", backupsLoading)}
            >
              {backupsLoading ? tr("جاري تحديث النسخ...", "Refreshing versions...") : tr("تحديث النسخ", "Refresh versions")}
            </button>
            <button type="button" onClick={() => void copyDiagnosticReport()} style={actionButtonStyle("#374151", false)}>
              {tr("نسخ تقرير الفحص", "Copy report")}
            </button>
          </div>
        </div>

        {fullBackupProgress ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(124, 58, 237, 0.35)",
              background: "#f5f3ff",
              color: "#4c1d95",
              fontWeight: 1000,
            }}
          >
            {fullBackupProgress}
          </div>
        ) : null}

        {actionMessage ? (() => {
          const theme = noticeTheme(inferNoticeTone(actionMessage));
          return (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: "14px 16px",
                borderRadius: 18,
                border: `2px solid ${theme.border}`,
                background: theme.background,
                color: theme.color,
                fontWeight: 900,
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.10)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  insetInlineStart: 0,
                  width: 7,
                  background: theme.accent,
                }}
              />
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.7)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  border: `1px solid ${theme.border}`,
                }}
              >
                {theme.icon}
              </span>
              <div style={{ lineHeight: 1.75 }}>
                <div style={{ fontSize: 15, color: theme.accent, fontWeight: 1000 }}>
                  {lang === "ar" ? theme.titleAr : theme.titleEn}
                </div>
                <div>{actionMessage}</div>
              </div>
              <button
                type="button"
                onClick={() => setActionMessage("")}
                aria-label={tr("إغلاق الإشعار", "Close notice")}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "rgba(255,255,255,0.76)",
                  color: theme.color,
                  borderRadius: 12,
                  padding: "8px 11px",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          );
        })() : null}

        <div style={{ display: "grid", gap: 12 }}>
          {tests.map((test) => (
            <article key={test.id} style={{ ...rowStyle(), borderColor: statusColor(test.status) }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, color: DARK }}>{test.title}</h3>
                <p style={{ margin: "8px 0 0", color: "#4b5563", fontWeight: 700, lineHeight: 1.8 }}>{test.details}</p>
              </div>
              <strong
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 110,
                  borderRadius: 999,
                  padding: "8px 14px",
                  color: "white",
                  background: statusColor(test.status),
                }}
              >
                {statusLabel(test.status, lang)}
              </strong>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...panelStyle(), marginTop: 20 }}>
        <h2 style={{ marginTop: 0, color: "#6b4e09" }}>{tr("النسخة الكاملة السحابية", "Full cloud backup")}</h2>
        <p style={{ margin: "0 0 14px", color: "#374151", fontWeight: 800, lineHeight: 1.8 }}>
          {tr(
            "ينشئ هذا الزر نسخة كاملة من بيانات هذا المركز/المدرسة فقط ويرفعها داخل مسار tenant الحالي في السحابة، لذلك تبقى كل مدرسة أو مركز دبلوم منفصلًا عن الآخر.",
            "This creates a full backup for this tenant only and uploads it under the current tenant path, keeping each school or diploma center separated."
          )}
        </p>
        <div style={{ ...miniBoxStyle(), marginBottom: 14, borderColor: "rgba(124, 58, 237, 0.28)", background: "#f5f3ff" }}>
          {tr(
            "سياسة الاحتفاظ التلقائي: كل النسخ السابقة تبقى 3 أسابيع ثم تحذف من السحابة، وآخر نسخة تم إنشاؤها تبقى 6 أشهر. عند إنشاء نسخة جديدة تصبح النسخة التي قبلها نسخة سابقة وتبدأ مدة 3 أسابيع لها.",
            "Automatic retention policy: previous backups are kept for 3 weeks then deleted from the cloud, while the latest created backup is kept for 6 months. When a new backup is created, the one before it becomes a previous backup and its 3-week retention starts."
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void createFullProgramCloudBackup()}
            disabled={fullBackupBusy || readOnly || !tid}
            style={actionButtonStyle(fullBackupBusy || readOnly || !tid ? "#9ca3af" : "#7c3aed", fullBackupBusy || readOnly || !tid)}
          >
            {fullBackupBusy ? tr("جاري رفع النسخة الكاملة...", "Uploading full backup...") : tr("إنشاء نسخة كاملة ورفعها للسحابة", "Create and upload full backup")}
          </button>
          <div style={{ ...miniBoxStyle(), flex: "1 1 260px" }}>
            {tr("مسار الحفظ", "Save path")}: <b>{tid ? `tenants/${tid}/backups` : "—"}</b>
          </div>
        </div>
      </section>

      <section style={{ ...panelStyle(), marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: "#6b4e09", fontSize: 26 }}>
              {tr("النسخ الموجودة في السحابة", "Cloud backup versions")}
            </h2>
            <p style={{ margin: "6px 0 0", color: "#4b5563", fontWeight: 800 }}>
              {tr(
                `عدد النسخ الموجودة في السحابة: ${cloudBackups.length}`,
                `Cloud backup versions count: ${cloudBackups.length}`
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshCloudBackupVersions()}
            disabled={backupsLoading}
            style={actionButtonStyle(backupsLoading ? "#9ca3af" : "#1d4ed8", backupsLoading)}
          >
            {backupsLoading ? tr("جاري التحديث...", "Refreshing...") : tr("تحديث النسخ", "Refresh versions")}
          </button>
        </div>

        {!cloudBackups.length ? (
          <div style={miniBoxStyle()}>
            {backupsLoading
              ? tr("جاري تحميل النسخ السحابية...", "Loading cloud backups...")
              : tr("لا توجد نسخ احتياطية محفوظة في السحابة حتى الآن.", "No cloud backups are stored yet.")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                border: `2px solid rgba(181, 139, 22, 0.45)`,
                borderRadius: 18,
                overflow: "hidden",
                background: "#fffaf0",
              }}
            >
              <thead>
                <tr style={{ background: "linear-gradient(135deg,#f7df88,#d4af37)", color: "#2f2206" }}>
                  <th style={tableHeadStyle()}>{tr("رقم", "No.")}</th>
                  <th style={tableHeadStyle()}>{tr("معرف النسخة", "Backup ID")}</th>
                  <th style={tableHeadStyle()}>{tr("تاريخ النسخة", "Created at")}</th>
                  <th style={tableHeadStyle()}>{tr("نوع النسخة / ملاحظات", "Type / note")}</th>
                  <th style={tableHeadStyle()}>{tr("الحجم / السجلات", "Size / records")}</th>
                  <th style={tableHeadStyle()}>{tr("الإجراءات", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {cloudBackups.map((item, index) => {
                  const backupId = String(item.id || "");
                  const busyRow = backupActionId === backupId;
                  const typeLabel = String(item.backupType || item.note || item.createdBy || item.byEmail || "—");
                  return (
                    <tr key={backupId || index} style={{ background: index % 2 ? "#fffaf0" : "#ffffff" }}>
                      <td style={tableCellStyle()}>{index + 1}</td>
                      <td style={{ ...tableCellStyle(), direction: "ltr", textAlign: "left", fontFamily: "monospace" }}>
                        {backupId || "—"}
                      </td>
                      <td style={tableCellStyle()}>{formatBackupDate(getBackupCreatedValue(item), lang)}</td>
                      <td style={tableCellStyle()}>
                        <div>{typeLabel}</div>
                        <div style={{ marginTop: 6, color: "#5b21b6", fontWeight: 900, fontSize: 12, lineHeight: 1.55 }}>
                          {getBackupRetentionLabel(item, String(cloudBackups[0]?.id || ""), lang)}
                        </div>
                      </td>
                      <td style={tableCellStyle()}>{getBackupSizeLabel(item)}</td>
                      <td style={tableCellStyle()}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                          <button
                            type="button"
                            onClick={() => requestRestoreCloudBackupVersion(backupId)}
                            disabled={busyRow || !backupId}
                            style={smallButtonStyle("#166534", busyRow || !backupId)}
                          >
                            {busyRow ? tr("انتظر...", "Wait...") : tr("استعادة", "Restore")}
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteCloudBackupVersion(backupId)}
                            disabled={busyRow || readOnly || !backupId}
                            style={smallButtonStyle("#b91c1c", busyRow || readOnly || !backupId)}
                          >
                            {tr("حذف", "Delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ ...panelStyle(), marginTop: 20 }}>
        <h2 style={{ marginTop: 0, color: "#6b4e09" }}>{tr("ملخص التخزين المحلي", "Local storage summary")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={miniBoxStyle()}>{tr(`كل المفاتيح: ${localSummary.total}`, `All keys: ${localSummary.total}`)}</div>
          <div style={miniBoxStyle()}>{tr(`مفاتيح البرنامج: ${localSummary.synced}`, `App keys: ${localSummary.synced}`)}</div>
          <div style={miniBoxStyle()}>{tr(`الكاش الداخلي: ${localSummary.cache}`, `Internal cache: ${localSummary.cache}`)}</div>
        </div>
      </section>

      {pendingBackupAction ? (() => {
        const isDelete = pendingBackupAction.kind === "delete";
        const theme = noticeTheme(isDelete ? "delete" : "restore");
        return (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setPendingBackupAction(null)}
          >
            <div
              style={{
                width: "min(560px, 96vw)",
                borderRadius: 26,
                border: `3px solid ${theme.border}`,
                background: "#fffaf0",
                boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
                overflow: "hidden",
                color: DARK,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                style={{
                  padding: "20px 22px",
                  background: theme.background,
                  borderBottom: `2px solid ${theme.border}`,
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.72)",
                    border: `2px solid ${theme.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  {theme.icon}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: theme.color, fontSize: 24, fontWeight: 1000 }}>
                    {pendingBackupAction.title}
                  </h3>
                  <p style={{ margin: "6px 0 0", color: theme.color, fontWeight: 850 }}>
                    {isDelete ? tr("عملية حذف نهائية", "Permanent delete action") : tr("عملية استعادة بيانات", "Data restore action")}
                  </p>
                </div>
              </div>

              <div style={{ padding: 22 }}>
                <p style={{ margin: 0, color: "#374151", fontWeight: 900, lineHeight: 1.9 }}>
                  {pendingBackupAction.message}
                </p>
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "#f8f4e8",
                    border: "1px solid rgba(181,139,22,0.32)",
                    color: "#4b5563",
                    fontWeight: 800,
                    direction: "ltr",
                    textAlign: "left",
                    overflowWrap: "anywhere",
                  }}
                >
                  {pendingBackupAction.backupId}
                </div>
              </div>

              <div
                style={{
                  padding: "16px 22px 22px",
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setPendingBackupAction(null)}
                  style={{
                    border: "2px solid rgba(107,114,128,0.35)",
                    background: "#ffffff",
                    color: "#374151",
                    borderRadius: 14,
                    padding: "11px 18px",
                    fontWeight: 1000,
                    cursor: "pointer",
                  }}
                >
                  {tr("إلغاء", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmPendingBackupAction()}
                  style={{
                    border: `2px solid ${theme.accent}`,
                    background: theme.accent,
                    color: "white",
                    borderRadius: 14,
                    padding: "11px 20px",
                    fontWeight: 1000,
                    cursor: "pointer",
                    boxShadow: `0 12px 24px ${isDelete ? "rgba(220,38,38,0.22)" : "rgba(22,163,74,0.22)"}`,
                  }}
                >
                  {isDelete ? tr("تأكيد الحذف", "Confirm delete") : tr("تأكيد الاستعادة", "Confirm restore")}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </main>
  );
}

function actionButtonStyle(background: string, disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    background,
    color: "white",
    padding: "13px 18px",
    borderRadius: 14,
    fontWeight: 1000,
    cursor: disabled ? "default" : "pointer",
    boxShadow: "0 8px 18px rgba(31, 41, 55, 0.16)",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    background: CARD,
    border: `2px solid rgba(181, 139, 22, 0.45)`,
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 12px 28px rgba(100, 75, 15, 0.12)",
  };
}

function labelStyle(): React.CSSProperties {
  return { color: "#6b4e09", fontWeight: 900, marginBottom: 8 };
}

function numberStyle(color: string): React.CSSProperties {
  return { color, fontSize: 38, fontWeight: 1000, lineHeight: 1 };
}

function panelStyle(): React.CSSProperties {
  return {
    background: CARD,
    border: `3px solid rgba(181, 139, 22, 0.52)`,
    borderRadius: 26,
    padding: 24,
    boxShadow: "0 16px 38px rgba(100, 75, 15, 0.14)",
  };
}

function rowStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    background: "#fffaf0",
    border: "2px solid #d1d5db",
    borderRadius: 18,
    padding: 18,
    flexWrap: "wrap",
  };
}

function tableHeadStyle(): React.CSSProperties {
  return {
    padding: "12px 10px",
    textAlign: "center",
    fontWeight: 1000,
    borderBottom: "2px solid rgba(80, 60, 16, 0.22)",
    whiteSpace: "nowrap",
  };
}

function tableCellStyle(): React.CSSProperties {
  return {
    padding: "12px 10px",
    borderBottom: "1px solid rgba(181, 139, 22, 0.22)",
    color: DARK,
    fontWeight: 850,
    verticalAlign: "middle",
    textAlign: "center",
  };
}

function smallButtonStyle(background: string, disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    background: disabled ? "#9ca3af" : background,
    color: "#ffffff",
    padding: "8px 12px",
    borderRadius: 12,
    fontWeight: 1000,
    cursor: disabled ? "default" : "pointer",
    boxShadow: disabled ? "none" : "0 8px 16px rgba(31, 41, 55, 0.14)",
  };
}

function miniBoxStyle(): React.CSSProperties {
  return {
    background: "#fffaf0",
    border: `1px solid rgba(181, 139, 22, 0.45)`,
    borderRadius: 16,
    padding: 14,
    fontWeight: 900,
    color: DARK,
  };
}
