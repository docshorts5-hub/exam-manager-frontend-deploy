import React, { useMemo, useRef, useState, useEffect } from "react";

import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import { useI18n } from "../i18n/I18nProvider";
import { query, orderBy, limit as fbLimit, getDocs } from "firebase/firestore";
import { listCloudArchive, syncArchiveCloudState } from "../services/cloudArchive.service";
import { callFn } from "../services/functionsClient";
import { createTenantRepo } from "../services/tenantRepo";

import { STORES, clear, ensureDefaults, exportAll, getAll, importAll } from "../api/db";
import { resetAllData } from "../services/dataRepo";
import { useAppData } from "../context/AppDataContext";

import {
  listArchivedRuns,
  mergeArchivedRuns,
  type ArchivedDistributionRun,
} from "../utils/taskDistributionStorage";

// ✅ Cloud backups module (chunking-safe)
import {
  listCloudBackups,
  fetchCloudBackup,
  uploadBackupToCloud,
  deleteCloudBackup,
  buildBackupFile,
  validateBackupFile,
  type DbBackupFile,
} from "../utils/dbBackupManager";

import { useAutoCloudBackup } from "../hooks/useAutoCloudBackup";
import { autoRestoreArchiveFromCloud } from "../utils/autoRestore";
import SyncArchiveSection from "../features/sync/components/SyncArchiveSection";
import SyncCloudBackupsSection from "../features/sync/components/SyncCloudBackupsSection";
import SyncStatusBanner from "../features/sync/components/SyncStatusBanner";

function safeStorageValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function firstNonEmptySync(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function tenantIdFromSyncPathname(pathname: string): string {
  try {
    const parts = String(pathname || "")
      .split("/")
      .map((part) => decodeURIComponent(part || "").trim())
      .filter(Boolean);

    const tIndex = parts.findIndex((part) => part === "t");
    if (tIndex >= 0 && parts[tIndex + 1]) return parts[tIndex + 1];

    const tenantKeys = ["tenant", "tenantId", "school", "schoolId", "center", "centerId"];
    for (const key of tenantKeys) {
      const index = parts.findIndex((part) => part === key);
      if (index >= 0 && parts[index + 1]) return parts[index + 1];
    }
  } catch {
    return "";
  }
  return "";
}

type SyncBusy = null | "export" | "import" | "reset" | "sync" | "cloud" | "cloud-import";

type BackupV1 = {
  meta: {
    schema: 1;
    app: "exam-manager";
    exportedAt: number;
    tenantId: string;
  };
  data: any;
  archiveLocal: ArchivedDistributionRun[];
  archiveCloud: ArchivedDistributionRun[];
};

const BACKUP_SCHEMA = 1 as const;
const GOLD = "#b8860b";
const GREEN = "#047857";
const RED = "#b91c1c";
const BLUE = "#1d4ed8";
const SLATE = "#475569";

const OFFICIAL_PAGE_BG =
  "linear-gradient(180deg, #f7efe0 0%, #efe3cc 48%, #f8f1e5 100%)";
const OFFICIAL_CARD_BG = "linear-gradient(180deg, #fffdf7 0%, #f5ead6 100%)";
const OFFICIAL_SOFT_BG = "linear-gradient(180deg, #fffaf0 0%, #f1e1c2 100%)";
const OFFICIAL_BORDER = "rgba(184,134,11,0.42)";
const OFFICIAL_TEXT = "#000000";
const OFFICIAL_MUTED = "#000000";

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function readJsonFile(file: File): Promise<any> {
  const text = await file.text();
  return JSON.parse(text);
}

function isBackupV1(x: any): x is BackupV1 {
  return (
    !!x &&
    x.meta &&
    x.meta.schema === BACKUP_SCHEMA &&
    x.meta.app === "exam-manager" &&
    typeof x.meta.exportedAt === "number" &&
    typeof x.meta.tenantId === "string" &&
    x.data
  );
}

async function hasActiveWork(): Promise<boolean> {
  const runs = await getAll<any>(STORES.runs).catch(() => []);
  const tasks = await getAll<any>(STORES.tasks).catch(() => []);

  const isActive = (v: any) => {
    const s = String(v ?? "").toUpperCase();
    return ["RUNNING", "IN_PROGRESS", "ACTIVE", "STARTED"].includes(s);
  };

  return (
    runs.some((r) => isActive(r?.status) || isActive(r?.state) || r?.active === true) ||
    tasks.some((t) => isActive(t?.status) || isActive(t?.state) || t?.active === true)
  );
}

async function fetchCloudArchiveViaFn(tenantId: string): Promise<ArchivedDistributionRun[]> {
  return await listCloudArchive(tenantId, 500);
}

async function exportBackupBoth(tenantId: string): Promise<BackupV1> {
  const data = await exportAll();
  const archiveLocal = listArchivedRuns(tenantId);

  let archiveCloud: any[] = [];
  try {
    archiveCloud = await fetchCloudArchiveViaFn(tenantId);
  } catch {
    archiveCloud = [];
  }

  return {
    meta: {
      schema: 1,
      app: "exam-manager",
      exportedAt: Date.now(),
      tenantId,
    },
    data,
    archiveLocal,
    archiveCloud,
  };
}

async function importDbReplace(data: any) {
  await Promise.all([
    clear(STORES.teachers),
    clear(STORES.exams),
    clear(STORES.rooms),
    clear(STORES.unavailability),
    clear(STORES.roomBlocks),
    clear(STORES.runs),
    clear(STORES.tasks),
    clear(STORES.settings),
    clear(STORES.audit),
  ]);
  await importAll(data);
  await ensureDefaults();
}

async function mergeCloudArchive(tenantId: string, items: ArchivedDistributionRun[]) {
  await syncArchiveCloudState(tenantId, items);
}

async function syncArchiveWithCloud(tenantId: string) {
  const local = listArchivedRuns(tenantId);
  const res = await syncArchiveCloudState(tenantId, local);

  if (res.cloud.length) {
    mergeArchivedRuns(tenantId, res.cloud, 200);
  }

  return {
    uploaded: res.uploaded,
    downloaded: res.downloaded,
    cloudReadable: res.cloudReadable,
  };
}

function glassCard(
  border = OFFICIAL_BORDER,
  background = OFFICIAL_CARD_BG
): React.CSSProperties {
  return {
    border: `3px solid ${border}`,
    borderRadius: 22,
    background,
    boxShadow: "0 12px 26px rgba(120, 88, 28, 0.12)",
    backdropFilter: "none",
  };
}

function statusTone(ok: boolean) {
  return ok ? GREEN : RED;
}

function HeroBadge({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        ...glassCard("rgba(184,134,11,0.34)", OFFICIAL_SOFT_BG),
        padding: 16,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ color: OFFICIAL_MUTED, fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, fontSize: 20, lineHeight: 1.3 }}>{value}</div>
    </div>
  );
}

function ActionCard(props: {
  title: string;
  subtitle: string;
  points: string[];
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
  danger?: boolean;
}) {
  const accent = props.accent || GOLD;
  return (
    <div
      style={{
        ...glassCard(props.danger ? "rgba(185,28,28,0.36)" : `${accent}66`, OFFICIAL_CARD_BG),
        padding: 22,
        display: "grid",
        gap: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          insetInlineEnd: -30,
          top: -40,
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: props.danger ? "rgba(185,28,28,0.08)" : `${accent}12`,
          filter: "blur(2px)",
        }}
      />
      <div style={{ position: "relative", display: "grid", gap: 8 }}>
        <div style={{ fontSize: 19, fontWeight: 950, color: props.danger ? "#7f1d1d" : OFFICIAL_TEXT }}>
          {props.title}
        </div>
        <div style={{ color: OFFICIAL_MUTED, fontSize: 13, lineHeight: 1.85 }}>
          {props.subtitle}
        </div>
      </div>
      <div style={{ position: "relative", display: "grid", gap: 8 }}>
        {props.points.map((p) => (
          <div
            key={p}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "start",
              color: OFFICIAL_TEXT,
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <span style={{ color: props.danger ? "#fca5a5" : accent }}>•</span>
            <span>{p}</span>
          </div>
        ))}
      </div>
      <button
        style={{
          borderRadius: 14,
          padding: "12px 14px",
          border: `2px solid ${props.danger ? "rgba(185,28,28,0.55)" : `${accent}88`}`,
          background: props.danger ? "#fee2e2" : `${accent}18`,
          color: props.danger ? "#7f1d1d" : OFFICIAL_TEXT,
          fontWeight: 900,
          cursor: props.disabled ? "not-allowed" : "pointer",
          opacity: props.disabled ? 0.6 : 1,
        }}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.buttonLabel}
      </button>
    </div>
  );
}

export default function Sync() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth() as any;
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const { tenantId: tenantFromContext } = useTenant() as any;
  const routeParams = useParams() as any;
  const { reloadAll } = useAppData() as any;

  const routeTenantId = firstNonEmptySync(
    routeParams?.tenantId,
    routeParams?.tenant,
    routeParams?.id,
    routeParams?.schoolId,
    routeParams?.centerId,
    routeParams?.diplomaCenterId,
    routeParams?.examCenterId,
    tenantIdFromSyncPathname(location?.pathname || "")
  );
  const tenantId = firstNonEmptySync(
    routeTenantId,
    tenantFromContext,
    user?.tenantId,
    user?.effectiveTenantId,
    user?.selectedTenantId,
    user?.lastTenantId,
    user?.centerId,
    user?.schoolId,
    safeStorageValue("effectiveTenantId"),
    safeStorageValue("selectedTenantId"),
    safeStorageValue("lastTenantId"),
    safeStorageValue("tenantId"),
    safeStorageValue("centerId"),
    safeStorageValue("schoolId")
  );
  const isDiploma12Sync = React.useMemo(
    () => {
      const path = String(location?.pathname || "");
      return path.includes("/sync12") || path.includes("/dashboard12") || path.includes("/cloud-backup12") || path.includes("/cloud-health12");
    },
    [location?.pathname],
  );
  const cloudHealthRoute = isDiploma12Sync ? "cloud-health12" : "cloud-health";
  const cloudBackupRoute = isDiploma12Sync ? "cloud-backup12" : "cloud-backup";
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState<SyncBusy>(null);
  const [msg, setMsg] = useState<string>("");

  const [cloudStatus, setCloudStatus] = useState<{ ok: boolean; note: string }>({
    ok: false,
    note: tr("لم يتم الفحص بعد", "Not checked yet"),
  });

  const [cloudBackups, setCloudBackups] = useState<any[]>([]);

  const autoCloud = useAutoCloudBackup({
    tenantId,
    uid: user?.uid,
    email: user?.email,
    intervalMs: 10 * 60 * 1000,
    defaultEnabled: true,
  });

  useEffect(() => {
    if (!tenantId) return;
    autoRestoreArchiveFromCloud(tenantId).catch(() => {});
  }, [tenantId]);

  const refreshCloudBackups = async () => {
    if (!tenantId) {
      setCloudBackups([]);
      return;
    }

    try {
      const items = await listCloudBackups(tenantId, 50);
      setCloudBackups(items);
    } catch {
      setCloudBackups([]);
    }
  };

  useEffect(() => {
    refreshCloudBackups();
  }, [tenantId]);

  const checkCloud = async () => {
    if (!tenantId) {
      setCloudStatus({
        ok: false,
        note: tr("تعذر تحديد نطاق المركز/المدرسة من الرابط أو الحساب.", "Could not resolve tenant scope from the route or account."),
      });
      return;
    }

    try {
      const list = callFn<any, any>("tenantListDocs");
      await list({ tenantId, sub: "archive", limit: 1, orderBy: "createdAt", orderDir: "desc" });
      setCloudStatus({ ok: true, note: "Cloud Functions: OK (tenantListDocs)" });
      return;
    } catch (e: any) {
      const code = String(e?.code || "");
      const m = String(e?.message || "");
      if (code === "FUNCTIONS_DISABLED" || m.includes("FUNCTIONS_DISABLED")) {
        setCloudStatus({
          ok: false,
          note: tr(
            "Cloud Functions معطّلة (ضع VITE_DISABLE_FUNCTIONS=false في .env)",
            "Cloud Functions are disabled (set VITE_DISABLE_FUNCTIONS=false in .env)"
          ),
        });
        return;
      }
      if (code === "unauthenticated" || m.includes("AUTH_REQUIRED")) {
        setCloudStatus({
          ok: false,
          note: tr("غير مسجل دخول (AUTH_REQUIRED)", "Not signed in (AUTH_REQUIRED)"),
        });
        return;
      }

      try {
        const repo = createTenantRepo(tenantId);
        const q = query(repo.archive as any, (orderBy as any)("createdAt", "desc"), fbLimit(1));
        await getDocs(q as any);
        setCloudStatus({ ok: true, note: "Firestore Read: OK (fallback)" });
      } catch (e2: any) {
        const m2 = String(e2?.message || "");
        if (m2.toLowerCase().includes("permission") || m2.toLowerCase().includes("insufficient")) {
          setCloudStatus({
            ok: false,
            note: tr(
              "Firestore Read مرفوض (permission-denied). استخدم tenantListDocs.",
              "Firestore Read denied (permission-denied). Use tenantListDocs."
            ),
          });
        } else {
          setCloudStatus({
            ok: false,
            note:
              lang === "ar"
                ? `Cloud غير متاح (${m2 || "cloud-unavailable"})`
                : `Cloud unavailable (${m2 || "cloud-unavailable"})`,
          });
        }
      }
    }
  };

  useEffect(() => {
    checkCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const filename = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `backup_${tenantId}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
      d.getHours()
    )}-${pad(d.getMinutes())}.json`;
  }, [tenantId]);

  const onExport = async () => {
    try {
      setBusy("export");
      setMsg("");
      const payload = await exportBackupBoth(tenantId);
      downloadJson(filename, payload);
      setMsg(
        lang === "ar"
          ? `✅ تم تصدير النسخة الاحتياطية (IndexedDB + أرشيف محلي + أرشيف سحابي: ${payload.archiveCloud?.length || 0}).`
          : `✅ Backup exported successfully (IndexedDB + local archive + cloud archive: ${payload.archiveCloud?.length || 0}).`
      );
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل التصدير: ${e?.message || "خطأ غير معروف"}`
          : `❌ Export failed: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const onSyncArchive = async () => {
    try {
      setBusy("sync");
      setMsg("");
      const ok = window.confirm(
        tr(
          "سيتم رفع كل الأرشيف المحلي إلى السحابة، ثم تنزيل أي نسخ ناقصة من السحابة (بدون حذف الموجود).\nهل تريد المتابعة؟",
          "All local archive items will be uploaded to the cloud, then any missing cloud copies will be downloaded (without deleting existing items).\nDo you want to continue?"
        )
      );
      if (!ok) return;

      const res = await syncArchiveWithCloud(tenantId);
      await reloadAll();

      const note =
        res.downloaded === 0
          ? tr(
              " (تنبيه: قد تكون قراءة السحابة غير متاحة بسبب الصلاحيات) ",
              " (Note: cloud reading may be unavailable due to permissions) "
            )
          : "";

      setMsg(
        lang === "ar"
          ? `✅ تمت مزامنة الأرشيف. تم رفع: ${res.uploaded} • تم تنزيل: ${res.downloaded}${note}`
          : `✅ Archive synced successfully. Uploaded: ${res.uploaded} • Downloaded: ${res.downloaded}${note}`
      );
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل مزامنة الأرشيف: ${e?.message || "خطأ غير معروف"}`
          : `❌ Archive sync failed: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const onPickImport = () => fileRef.current?.click();

  const onImportFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;

    try {
      if (await hasActiveWork()) {
        alert(
          tr(
            "⚠️ لا يمكن الاستيراد الآن: يوجد تشغيل/توزيع نشط. أوقفه أولاً ثم أعد المحاولة.",
            "⚠️ Import is not allowed now: there is an active run/distribution. Stop it first, then try again."
          )
        );
        return;
      }

      const json = await readJsonFile(f);

      if (!isBackupV1(json)) {
        const schema = json?.meta?.schema;
        if (schema && schema !== BACKUP_SCHEMA) {
          throw new Error(
            lang === "ar"
              ? `هذه النسخة غير مدعومة (schema=${schema}).`
              : `This backup is not supported (schema=${schema}).`
          );
        }
        throw new Error(tr("ملف النسخة غير صالح أو غير مدعوم.", "The backup file is invalid or unsupported."));
      }

      const d = json.data || {};
      const stats = {
        teachers: (d.teachers || []).length,
        exams: (d.exams || []).length,
        rooms: (d.rooms || []).length,
        tasks: (d.tasks || []).length,
        runs: (d.runs || []).length,
        settings: (d.settings || []).length,
        audit: (d.audit || []).length,
        archiveLocal: (json.archiveLocal || []).length,
        archiveCloud: (json.archiveCloud || []).length,
      };

      const ok = window.confirm(
        lang === "ar"
          ? `⚠️ تنبيه مهم:\nسيتم **استبدال** بيانات البرنامج الأساسية (IndexedDB).\n\nسيتم **دمج** الأرشيف (لا حذف للأرشيف):\n- أرشيف محلي: +${stats.archiveLocal}\n- أرشيف سحابي: +${stats.archiveCloud}\n\nملخص البيانات التي ستُستبدل:\n- الكادر التعليمي: ${stats.teachers}\n- الامتحانات: ${stats.exams}\n- القاعات: ${stats.rooms}\n- المهام: ${stats.tasks}\n- التشغيلات: ${stats.runs}\n- الإعدادات: ${stats.settings}\n- السجل (Audit): ${stats.audit}\n\nهل تريد المتابعة؟`
          : `⚠️ Important warning:\nThe core program data (IndexedDB) will be **replaced**.\n\nThe archive will be **merged** (archive items will not be deleted):\n- Local archive: +${stats.archiveLocal}\n- Cloud archive: +${stats.archiveCloud}\n\nSummary of data to be replaced:\n- Teachers: ${stats.teachers}\n- Exams: ${stats.exams}\n- Rooms: ${stats.rooms}\n- Tasks: ${stats.tasks}\n- Runs: ${stats.runs}\n- Settings: ${stats.settings}\n- Audit Log: ${stats.audit}\n\nDo you want to continue?`
      );
      if (!ok) return;

      setBusy("import");
      setMsg("");

      await importDbReplace(json.data);
      mergeArchivedRuns(tenantId, json.archiveLocal || [], 200);
      await mergeCloudArchive(tenantId, json.archiveCloud || []);

      await reloadAll();
      setMsg(
        tr(
          "✅ تم الاستيراد بنجاح: تم استبدال بيانات البرنامج ودمج الأرشيف (محلي/سحابي). ",
          "✅ Import completed successfully: program data was replaced and the archive was merged (local/cloud). "
        )
      );
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل الاستيراد: ${e?.message || "خطأ غير معروف"}`
          : `❌ Import failed: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const onReset = async () => {
    const ok = window.confirm(
      tr(
        "⚠️ سيتم حذف بيانات البرنامج الأساسية (IndexedDB) فقط.\nلن نحذف الأرشيف المحلي أو السحابي من هذه الصفحة.\nهل أنت متأكد؟",
        "⚠️ Only the core program data (IndexedDB) will be deleted.\nLocal or cloud archive items will not be deleted from this page.\nAre you sure?"
      )
    );
    if (!ok) return;

    try {
      setBusy("reset");
      setMsg("");
      await resetAllData();
      await ensureDefaults();
      await reloadAll();
      setMsg(
        tr(
          "✅ تم حذف بيانات البرنامج الأساسية وإعادة الإعدادات الافتراضية.",
          "✅ Core program data was deleted and default settings were restored."
        )
      );
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل الحذف: ${e?.message || "خطأ غير معروف"}`
          : `❌ Delete failed: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const onCloudBackupNow = async () => {
    try {
      setBusy("cloud");
      setMsg("");

      if (!navigator.onLine) {
        throw new Error(tr("أنت غير متصل بالإنترنت.", "You are offline."));
      }

      const file: DbBackupFile = buildBackupFile({
        tenantId,
        byUid: user?.uid,
        byEmail: user?.email,
        note: lang === "ar" ? "نسخة سحابية (لقطة localStorage)" : "cloud-backup (localStorage snapshot)",
        prefix: "exam-manager",
      });

      validateBackupFile(file);

      const id = await uploadBackupToCloud({ tenantId, file });
      await refreshCloudBackups();

      setMsg(
        lang === "ar"
          ? `✅ تم رفع نسخة سحابية: ${id}`
          : `✅ Cloud backup uploaded: ${id}`
      );
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل النسخ السحابي: ${e?.message || "خطأ غير معروف"}`
          : `❌ Cloud backup failed: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const onImportFromCloud = async (backupId: string) => {
    try {
      if (await hasActiveWork()) {
        alert(
          tr(
            "⚠️ لا يمكن الاستيراد الآن: يوجد تشغيل/توزيع نشط. أوقفه أولاً ثم أعد المحاولة.",
            "⚠️ Import is not allowed now: there is an active run/distribution. Stop it first, then try again."
          )
        );
        return;
      }

      setBusy("cloud-import");
      setMsg("");

      const cloudFile = await fetchCloudBackup(tenantId, backupId);
      validateBackupFile(cloudFile);

      const ok = window.confirm(
        lang === "ar"
          ? `⚠️ سيتم استيراد نسخة السحابة إلى localStorage (مفاتيح exam-manager).\nلن نحذف مفاتيح خارج exam-manager.\n\nهل تريد المتابعة؟`
          : `⚠️ The cloud backup will be imported into localStorage (exam-manager keys).\nKeys outside exam-manager will not be deleted.\n\nDo you want to continue?`
      );
      if (!ok) return;

      const { importDatabase } = await import("../utils/dbBackupManager");
      importDatabase(cloudFile, { prefix: "exam-manager" });

      await reloadAll();

      setMsg(tr("✅ تم الاستيراد من السحابة بنجاح.", "✅ Imported from the cloud successfully."));
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل الاستيراد من السحابة: ${e?.message || "خطأ غير معروف"}`
          : `❌ Cloud import failed: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const onDeleteCloudBackup = async (backupId: string) => {
    const ok = window.confirm(
      tr(
        "⚠️ هل تريد حذف هذه النسخة السحابية نهائيًا؟",
        "⚠️ Do you want to permanently delete this cloud backup?"
      )
    );
    if (!ok) return;

    try {
      setBusy("cloud");
      setMsg("");
      await deleteCloudBackup(tenantId, backupId);
      await refreshCloudBackups();
      setMsg(tr("✅ تم حذف النسخة السحابية.", "✅ Cloud backup deleted."));
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل حذف النسخة: ${e?.message || "خطأ غير معروف"}`
          : `❌ Delete backup failed: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const pruneCloudBackups = async (keepLast = 10) => {
    const ok = window.confirm(
      lang === "ar"
        ? `⚠️ سيتم حذف النسخ السحابية القديمة وترك آخر ${keepLast} نسخ فقط. هل تريد المتابعة؟`
        : `⚠️ Old cloud backups will be deleted and only the last ${keepLast} backups will be kept. Do you want to continue?`
    );
    if (!ok) return;

    try {
      setBusy("cloud");
      setMsg("");

      const items = await listCloudBackups(tenantId, 200);
      if (!items.length) {
        setMsg(tr("لا توجد نسخ سحابية للحذف.", "There are no cloud backups to delete."));
        return;
      }

      const toDelete = items.slice(keepLast);
      if (!toDelete.length) {
        setMsg(
          lang === "ar"
            ? `✅ لا يوجد نسخ قديمة (عدد النسخ ≤ ${keepLast}).`
            : `✅ There are no old backups (number of backups ≤ ${keepLast}).`
        );
        return;
      }

      let deleted = 0;
      for (const b of toDelete) {
        await deleteCloudBackup(tenantId, b.id);
        deleted++;
      }

      await refreshCloudBackups();
      setMsg(
        lang === "ar"
          ? `✅ تم حذف ${deleted} نسخة قديمة وترك آخر ${keepLast} نسخ.`
          : `✅ Deleted ${deleted} old backups and kept the latest ${keepLast}.`
      );
    } catch (e: any) {
      setMsg(
        lang === "ar"
          ? `❌ فشل حذف النسخ القديمة: ${e?.message || "خطأ غير معروف"}`
          : `❌ Failed to delete old backups: ${e?.message || "Unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  };

  const cloudTone = statusTone(cloudStatus.ok);
  const syncModeLabel = autoCloud.enabled
    ? tr("النسخ التلقائي مفعل", "Auto backup enabled")
    : tr("النسخ التلقائي متوقف", "Auto backup disabled");
  const syncModeColor = autoCloud.enabled ? GREEN : SLATE;

  return (
    <div
      className="syncOfficialPage"
      style={{
        minHeight: "100vh",
        background: OFFICIAL_PAGE_BG,
        color: OFFICIAL_TEXT,
        direction: lang === "ar" ? "rtl" : "ltr",
        padding: 20,
      }}
    >
      <style>{`
        .syncOfficialPage,
        .syncOfficialPage * {
          box-sizing: border-box;
        }

        .syncOfficialPage button,
        .syncOfficialPage label {
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
        }

        .syncOfficialPage button:hover:not(:disabled),
        .syncOfficialPage label:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(120, 88, 28, 0.16) !important;
        }

        .syncOfficialPage input,
        .syncOfficialPage select,
        .syncOfficialPage textarea {
          background: #fffdf7 !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          border: 3px solid rgba(184,134,11,.50) !important;
          border-radius: 12px !important;
        }

        /* Force all visible text in this page and imported sync sections to black */
        .syncOfficialPage,
        .syncOfficialPage *,
        .syncOfficialPage *::before,
        .syncOfficialPage *::after {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
        }

        /* Keep buttons official and readable with black text */
        .syncOfficialPage button,
        .syncOfficialPage label,
        .syncOfficialPage a,
        .syncOfficialPage [role="button"] {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          border-width: 3px !important;
          border-style: solid !important;
        }

        /* Beige official table/cell theme for tables coming from child components */
        .syncOfficialPage table {
          width: 100%;
          border-collapse: separate !important;
          border-spacing: 6px !important;
          background: #f3ead7 !important;
          color: #000000 !important;
          border: 4px solid #b8860b !important;
          border-radius: 16px !important;
          padding: 6px !important;
        }

        .syncOfficialPage th,
        .syncOfficialPage td,
        .syncOfficialPage [role="cell"],
        .syncOfficialPage [role="gridcell"],
        .syncOfficialPage [role="columnheader"],
        .syncOfficialPage [data-cell],
        .syncOfficialPage .cell,
        .syncOfficialPage .tableCell {
          background: #fff8ec !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          border-width: 4px !important;
          border-style: solid !important;
          border-color: #b8860b !important;
          border-radius: 12px !important;
          padding: 8px 10px !important;
          box-shadow: none !important;
        }

        .syncOfficialPage th,
        .syncOfficialPage [role="columnheader"] {
          background: #e7d5b8 !important;
          font-weight: 950 !important;
        }

        .syncOfficialPage tr > :nth-child(1),
        .syncOfficialPage [role="row"] > :nth-child(1) { border-color: #b8860b !important; }
        .syncOfficialPage tr > :nth-child(2),
        .syncOfficialPage [role="row"] > :nth-child(2) { border-color: #2f855a !important; }
        .syncOfficialPage tr > :nth-child(3),
        .syncOfficialPage [role="row"] > :nth-child(3) { border-color: #2563eb !important; }
        .syncOfficialPage tr > :nth-child(4),
        .syncOfficialPage [role="row"] > :nth-child(4) { border-color: #7c3aed !important; }
        .syncOfficialPage tr > :nth-child(5),
        .syncOfficialPage [role="row"] > :nth-child(5) { border-color: #dc2626 !important; }
        .syncOfficialPage tr > :nth-child(6),
        .syncOfficialPage [role="row"] > :nth-child(6) { border-color: #0891b2 !important; }
        .syncOfficialPage tr > :nth-child(7),
        .syncOfficialPage [role="row"] > :nth-child(7) { border-color: #ca8a04 !important; }
        .syncOfficialPage tr > :nth-child(8),
        .syncOfficialPage [role="row"] > :nth-child(8) { border-color: #16a34a !important; }
        .syncOfficialPage tr > :nth-child(9),
        .syncOfficialPage [role="row"] > :nth-child(9) { border-color: #9333ea !important; }
        .syncOfficialPage tr > :nth-child(10),
        .syncOfficialPage [role="row"] > :nth-child(10) { border-color: #ea580c !important; }
        .syncOfficialPage tr > :nth-child(11),
        .syncOfficialPage [role="row"] > :nth-child(11) { border-color: #0f766e !important; }
        .syncOfficialPage tr > :nth-child(12),
        .syncOfficialPage [role="row"] > :nth-child(12) { border-color: #be123c !important; }

        /* Colored and slightly thicker borders for card-like cells inside imported sections */
        .syncOfficialPage section,
        .syncOfficialPage article,
        .syncOfficialPage [class*="card"],
        .syncOfficialPage [class*="Card"] {
          border-width: 3px !important;
        }
      `}</style>
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "grid", gap: 20 }}>
        <div
          style={{
            ...glassCard("rgba(184,134,11,0.55)", "linear-gradient(180deg, #fffdf7 0%, #f5ead6 100%)"),
            padding: 26,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -60,
              left: -40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(184,134,11,0.08)",
              filter: "blur(8px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -70,
              right: -30,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(29,78,216,0.06)",
              filter: "blur(10px)",
            }}
          />
          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "#ecfdf5",
                    border: "2px solid rgba(4,120,87,0.28)",
                    color: "#065f46",
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  {tr("مركز الحماية والنسخ الاحتياطي للنظام", "System Protection and Backup Center")}
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(28px, 4.8vw, 54px)",
                    lineHeight: 1.04,
                    fontWeight: 950,
                    color: OFFICIAL_TEXT,
                  }}
                >
                  {tr("قاعدة البيانات / النسخ الاحتياطي / المزامنة السحابية", "Database / Backup / Cloud Sync")}
                </h1>

                <div
                  style={{
                    maxWidth: 980,
                    color: OFFICIAL_MUTED,
                    fontSize: 15,
                    lineHeight: 1.95,
                  }}
                >
                  {tr(
                    "لوحة تنفيذية فائقة التنظيم لإدارة النسخ الاحتياطية، الاستيراد والاستعادة، مزامنة الأرشيف، وفحص جاهزية السحابة. تم تطويرها لتمنح المسؤول رؤية أوضح وتحكمًا أعلى بثقة أكبر.",
                    "A highly organized executive dashboard for managing backups, import and restore, archive sync, and checking cloud readiness. Built to give administrators clearer visibility and more confident control."
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={{
                    borderRadius: 14,
                    padding: "11px 14px",
                    border: "2px solid rgba(184,134,11,0.42)",
                    background: "#fff8ec",
                    color: OFFICIAL_TEXT,
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                  onClick={() => nav(-1)}
                  disabled={!!busy}
                >
                  {tr("رجوع", "Back")}
                </button>

                <button
                  style={{
                    borderRadius: 14,
                    padding: "11px 14px",
                    border: `2px solid ${cloudTone}66`,
                    background: `${cloudTone}14`,
                    color: OFFICIAL_TEXT,
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                  onClick={checkCloud}
                  disabled={!!busy}
                >
                  {tr("فحص السحابة", "Check Cloud")}
                </button>
              </div>
            </div>

            <div
              style={{
                ...glassCard("rgba(4,120,87,0.30)", "linear-gradient(180deg, #f0fdf4 0%, #e1f6ea 100%)"),
                padding: 16,
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ color: "#065f46", fontWeight: 950, fontSize: 17 }}>
                {tr("ربط صفحة النسخ الحالية مع مركز السحابة الجديد", "Connect this backup page with the new cloud center")}
              </div>
              <div style={{ color: OFFICIAL_MUTED, lineHeight: 1.85, fontSize: 13 }}>
                {tr(
                  "هذه الصفحة القديمة تبقى لإدارة النسخ والاستيراد، وتم ربطها الآن بصفحات السحابة الجديدة للفحص والصيانة والنسخ الاحتياطي السحابي المباشر.",
                  "This legacy page remains for backup and import management, and is now connected to the new cloud pages for health checks, maintenance, and direct cloud backup."
                )}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={{
                    borderRadius: 14,
                    padding: "11px 15px",
                    border: "2px solid rgba(4,120,87,0.38)",
                    background: "#dcfce7",
                    color: "#065f46",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                  onClick={() => nav(`/t/${encodeURIComponent(tenantId)}/${cloudHealthRoute}`)}
                >
                  {tr("فتح فحص التخزين السحابي", "Open Cloud Health Check")}
                </button>
                <button
                  style={{
                    borderRadius: 14,
                    padding: "11px 15px",
                    border: "2px solid rgba(29,78,216,0.35)",
                    background: "#dbeafe",
                    color: "#1e3a8a",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                  onClick={() => nav(`/t/${encodeURIComponent(tenantId)}/${cloudBackupRoute}`)}
                >
                  {tr("فتح النسخ الاحتياطي السحابي الجديد", "Open New Cloud Backup")}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.9fr)",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <HeroBadge label={tr("الجهة الحالية", "Current Tenant")} value={tenantId || "—"} />
                <HeroBadge
                  label={tr("حالة السحابة", "Cloud Status")}
                  value={
                    <span style={{ color: cloudTone }}>
                      {cloudStatus.ok ? tr("✅ متاح", "✅ Available") : tr("❌ غير متاح", "❌ Unavailable")}
                    </span>
                  }
                />
                <HeroBadge label={tr("النسخ السحابية", "Cloud Backups")} value={cloudBackups.length} />
                <HeroBadge
                  label={tr("الوضع التلقائي", "Auto Mode")}
                  value={<span style={{ color: syncModeColor }}>{syncModeLabel}</span>}
                />
              </div>

              <div
                style={{
                  ...glassCard("rgba(184,134,11,0.34)", OFFICIAL_SOFT_BG),
                  padding: 18,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, fontSize: 16 }}>
                  {tr("لوحة الحالة التنفيذية", "Executive Status Panel")}
                </div>
                <div style={{ color: OFFICIAL_MUTED, lineHeight: 1.85, fontSize: 13 }}>
                  {cloudStatus.note}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: `${cloudTone}16`,
                      border: `1px solid ${cloudTone}33`,
                      color: cloudTone,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {cloudStatus.ok ? tr("السحابة جاهزة", "Cloud Ready") : tr("السحابة تحتاج انتباهًا", "Cloud Needs Attention")}
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: `${syncModeColor}16`,
                      border: `1px solid ${syncModeColor}33`,
                      color: syncModeColor,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {syncModeLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          <ActionCard
            title={tr("تصدير نسخة احتياطية (JSON)", "Export Backup (JSON)")}
            subtitle={tr(
              "إنشاء ملف احتياطي متكامل يحفظ بيانات النظام الأساسية مع الأرشيف المحلي والسحابي المتاح.",
              "Create a complete backup file that preserves the core system data together with available local and cloud archive data."
            )}
            points={[
              tr("يشمل بيانات البرنامج الأساسية من IndexedDB", "Includes the core program data from IndexedDB"),
              tr("يشمل الأرشيف المحلي من LocalStorage", "Includes the local archive from LocalStorage"),
              tr("يشمل الأرشيف السحابي إذا كان متاحًا", "Includes the cloud archive if available"),
            ]}
            buttonLabel={busy === "export" ? tr("جاري التصدير…", "Exporting…") : tr("تصدير النسخة الاحتياطية", "Export Backup")}
            onClick={onExport}
            disabled={!!busy}
            accent={GOLD}
          />

          <ActionCard
            title={tr("استيراد نسخة احتياطية (JSON)", "Import Backup (JSON)")}
            subtitle={tr(
              "استعادة نسخة محفوظة سابقًا مع استبدال بيانات البرنامج الأساسية ودمج الأرشيف بأمان.",
              "Restore a previously saved backup while replacing core program data and safely merging the archive."
            )}
            points={[
              tr("يستبدل بيانات البرنامج الأساسية", "Replaces the core program data"),
              tr("يدمج الأرشيف المحلي والسحابي دون حذف الموجود", "Merges local and cloud archive data without deleting existing items"),
              tr("يمنع الاستيراد أثناء وجود تشغيل أو توزيع نشط", "Prevents import while an active run or distribution exists"),
            ]}
            buttonLabel={busy === "import" ? tr("جاري الاستيراد…", "Importing…") : tr("استيراد نسخة احتياطية", "Import Backup")}
            onClick={onPickImport}
            disabled={!!busy}
            accent={BLUE}
          />

          <ActionCard
            title={tr("منطقة الخطر", "Danger Zone")}
            subtitle={tr(
              "إعادة ضبط بيانات البرنامج الأساسية فقط مع الحفاظ على الأرشيف المحلي والسحابي دون حذف.",
              "Reset only the core program data while keeping local and cloud archives without deletion."
            )}
            points={[
              tr("يحذف بيانات التشغيل الأساسية من IndexedDB", "Deletes the core operational data from IndexedDB"),
              tr("يبقي الأرشيف المحلي والسحابي كما هو", "Keeps the local and cloud archive unchanged"),
              tr("يعيد القيم الافتراضية المطلوبة للنظام", "Restores the default values required by the system"),
            ]}
            buttonLabel={busy === "reset" ? tr("جاري الحذف…", "Deleting…") : tr("حذف بيانات البرنامج الأساسية", "Delete Core Program Data")}
            onClick={onReset}
            disabled={!!busy}
            danger
          />
        </div>

        <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onImportFile} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
          <div style={{ ...glassCard(), padding: 18 }}>
            <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, fontSize: 19, marginBottom: 8 }}>
              {tr("مزامنة الأرشيف والنسخ السحابية", "Archive Sync and Cloud Backups")}
            </div>
            <div
              style={{
                color: OFFICIAL_MUTED,
                lineHeight: 1.8,
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {tr(
                "الأقسام التالية مرتبطة مباشرة بمنطق النظام الحالي: مزامنة الأرشيف، النسخ السحابية اليدوية، الاستيراد من السحابة، والتنظيف الذكي للنسخ القديمة.",
                "The following sections are directly connected to the current system logic: archive sync, manual cloud backups, cloud import, and smart cleanup of old backups."
              )}
            </div>

            <SyncArchiveSection
              card={{ ...glassCard(), padding: 14 }}
              btn={(kind?: "soft" | "danger" | "brand") => {
                const border =
                  kind === "danger"
                    ? "rgba(185,28,28,0.45)"
                    : kind === "brand"
                    ? "rgba(184,134,11,0.55)"
                    : "rgba(71,85,105,0.25)";
                const bg =
                  kind === "danger"
                    ? "#fee2e2"
                    : kind === "brand"
                    ? "#fff3cd"
                    : "#f8fafc";
                return {
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: `1px solid ${border}`,
                  fontWeight: 900,
                  cursor: "pointer",
                  color: kind === "danger" ? "#7f1d1d" : OFFICIAL_TEXT,
                  background: bg,
                };
              }}
              busy={busy ?? ""}
              onSyncArchive={onSyncArchive}
            />
          </div>

          <div style={{ ...glassCard(), padding: 18 }}>
            <SyncCloudBackupsSection
              card={{ ...glassCard(), padding: 14 }}
              btn={(kind?: "soft" | "danger" | "brand") => {
                const border =
                  kind === "danger"
                    ? "rgba(185,28,28,0.45)"
                    : kind === "brand"
                    ? "rgba(29,78,216,0.45)"
                    : "rgba(71,85,105,0.25)";
                const bg =
                  kind === "danger"
                    ? "#fee2e2"
                    : kind === "brand"
                    ? "#dbeafe"
                    : "#f8fafc";
                return {
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: `1px solid ${border}`,
                  fontWeight: 900,
                  cursor: "pointer",
                  color: kind === "danger" ? "#7f1d1d" : OFFICIAL_TEXT,
                  background: bg,
                };
              }}
              tenantId={tenantId}
              busy={busy ?? ""}
              autoCloud={autoCloud}
              cloudBackups={cloudBackups}
              onCloudBackupNow={onCloudBackupNow}
              refreshCloudBackups={refreshCloudBackups}
              pruneCloudBackups={pruneCloudBackups}
              onImportFromCloud={onImportFromCloud}
              onDeleteCloudBackup={onDeleteCloudBackup}
            />
          </div>
        </div>

        {msg ? (
          <div
            style={{
              ...glassCard("rgba(184,134,11,0.34)", OFFICIAL_CARD_BG),
              padding: 16,
            }}
          >
            <SyncStatusBanner
              card={{
                background: "transparent",
                border: "none",
                borderRadius: 0,
                padding: 0,
                boxShadow: "none",
              } as React.CSSProperties}
              message={msg}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}