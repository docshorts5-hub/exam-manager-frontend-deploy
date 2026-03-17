import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import {
  buildBackupFile,
  deleteCloudBackup,
  fetchCloudBackup,
  importDatabase,
  listCloudBackups,
  previewImport,
  type DbBackupFile,
} from "../utils/dbBackupManager";
import { useAutoCloudBackup } from "../hooks/useAutoCloudBackup";

const card: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,255,255,0.03)",
};

export default function SyncManager() {
  const { user } = useAuth() as any;
  const { tenantId: tenantFromContext } = useTenant() as any;
  const tenantId = String(tenantFromContext || user?.tenantId || "default").trim() || "default";

  const [cloud, setCloud] = useState<any[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const auto = useAutoCloudBackup({
    tenantId,
    uid: user?.uid,
    email: user?.email,
    intervalMs: 10 * 60 * 1000,
    defaultEnabled: false,
  });

  const refresh = async () => {
    if (!tenantId) return;
    try {
      setBusy("refresh");
      const items = await listCloudBackups(tenantId, 50);
      setCloud(items);
    } catch (e: any) {
      setCloud([]);
      setMsg(e?.message || "Failed to load cloud backups");
    } finally {
      setBusy("");
    }
  };

  useEffect(() => { refresh(); }, [tenantId]);

  const exportJson = () => {
    const file = buildBackupFile({
      tenantId,
      byUid: user?.uid,
      byEmail: user?.email,
      note: "download-json",
    });
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_${tenantId}_${new Date().toISOString().slice(0, 19).replace(/[:]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("✅ تم تصدير ملف JSON");
  };

  const importJsonFile = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as DbBackupFile;
    const pv = previewImport(parsed);
    const ok = window.confirm(`سيتم استيراد ${pv.willSet} عنصر. هل تريد المتابعة؟`);
    if (!ok) return;
    setBusy("import-json");
    try {
      importDatabase(parsed);
      setMsg("✅ تم الاستيراد من ملف JSON بنجاح");
    } finally {
      setBusy("");
    }
  };

  const importFromCloud = async (backupId: string) => {
    const ok = window.confirm("سيتم استيراد النسخة السحابية على الجهاز. هل تريد المتابعة؟");
    if (!ok) return;
    setBusy("import-cloud");
    try {
      const file = await fetchCloudBackup(tenantId, backupId);
      const pv = previewImport(file);
      const ok2 = window.confirm(`سيتم استيراد ${pv.willSet} عنصر. تأكيد نهائي؟`);
      if (!ok2) return;
      importDatabase(file);
      setMsg("✅ تم الاستيراد من السحابة بنجاح");
    } catch (e: any) {
      setMsg(e?.message || "Import failed");
    } finally {
      setBusy("");
    }
  };

  const removeCloud = async (backupId: string) => {
    const ok = window.confirm("حذف هذه النسخة من السحابة؟");
    if (!ok) return;
    setBusy("delete");
    try {
      await deleteCloudBackup(tenantId, backupId);
      setCloud((x) => x.filter((it) => it?.id !== backupId));
      setMsg("✅ تم حذف النسخة من السحابة");
    } finally {
      setBusy("");
    }
  };

  const backupNow = async () => {
    setBusy("backup-now");
    try {
      const id = await auto.runNow("manual");
      setMsg("✅ تم رفع النسخة للسحابة: " + id);
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Backup failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: 18, direction: "rtl", background: "#0b1020", color: "#f5e7b2" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 }}>

        <div style={card}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>مزامنة / نسخ احتياطي</div>
          <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800, fontSize: 13 }}>
            Tenant: <b>{tenantId}</b>
          </div>
          {msg && <div style={{ marginTop: 10, fontWeight: 900 }}>{msg}</div>}
        </div>

        <div style={{ ...card, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button disabled={!!busy} onClick={exportJson} style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
              تصدير (Download JSON)
            </button>

            <label style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer", border: "1px solid rgba(212,175,55,0.25)" }}>
              استيراد (Upload JSON)
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJsonFile(f);
                }}
              />
            </label>

            <button disabled={!!busy} onClick={backupNow} style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
              نسخ سحابي الآن
            </button>

            <button disabled={!!busy} onClick={refresh} style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
              تحديث النسخ السحابية
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={auto.enabled}
                onChange={(e) => auto.toggle(e.target.checked)}
              />
              تفعيل النسخ السحابي التلقائي كل 10 دقائق
            </label>
            <div style={{ opacity: 0.85, fontWeight: 800 }}>
              آخر نسخة: {auto.lastBackupISO || "—"} • الحالة: {auto.status.state} {auto.status.message ? `(${auto.status.message})` : ""}
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>النسخ السحابية</div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {cloud.length === 0 ? (
              <div style={{ opacity: 0.85 }}>لا توجد نسخ سحابية بعد.</div>
            ) : (
              cloud.map((b: any) => (
                <div key={b.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 950 }}>
                    {b?.meta?.createdAtISO || b?.createdAtISO || b.id}
                  </div>
                  <div style={{ opacity: 0.85, marginTop: 4, fontWeight: 800, fontSize: 12 }}>
                    {b?.meta?.note ? `ملاحظة: ${b.meta.note}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button disabled={!!busy} onClick={() => importFromCloud(b.id)} style={{ padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}>
                      استيراد من السحابة
                    </button>
                    <button disabled={!!busy} onClick={() => removeCloud(b.id)} style={{ padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}>
                      حذف
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
