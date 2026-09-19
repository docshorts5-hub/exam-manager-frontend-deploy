import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  loadTenantArray,
  loadTenantSettings,
  replaceTenantArray,
  saveTenantSettings,
} from "../services/tenantData";

type BackupPayload = {
  version: string;
  createdAt: string;
  tenantId: string;
  createdBy?: string;
  mode: "school" | "diploma" | "mixed";
  collections: Record<string, any[]>;
  settings: Record<string, any>;
};

const SCHOOL_COLLECTIONS = [
  "teachers",
  "exams",
  "rooms",
  "roomBlocks",
  "examRoomAssignments",
  "unavailability",
  "archive",
  "activityLogs",
];

const DIPLOMA_COLLECTIONS = [
  "teachers",
  "exams",
  "rooms",
  "roomBlocks",
  "examRoomAssignments",
  "unavailability",
  "schoolControlMembers",
  "schoolControlReports",
  "studentSeatRegister12",
  "archive",
  "activityLogs",
];

const SETTINGS_DOCS = ["profile", "config", "school", "center", "officialSeal", "distribution", "ui"];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeEmail(auth: any) {
  return clean(
    auth?.user?.email ||
      auth?.currentUser?.email ||
      auth?.profile?.email ||
      auth?.userProfile?.email ||
      auth?.allow?.email ||
      "",
  );
}

function getStoredReadOnlyFlag(tenantId: string) {
  try {
    const expiresAt = Number(
      sessionStorage.getItem("governorateSuperViewExpiresAt") ||
        localStorage.getItem("governorateSuperViewExpiresAt") ||
        0,
    );
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

    const flag = [
      sessionStorage.getItem("governorateSuperReadOnly"),
      localStorage.getItem("governorateSuperReadOnly"),
      sessionStorage.getItem("viewAsReadOnly"),
      localStorage.getItem("viewAsReadOnly"),
      sessionStorage.getItem("readOnly"),
      localStorage.getItem("readOnly"),
    ].some((v) => ["1", "true", "yes"].includes(clean(v).toLowerCase()));

    const target = [
      sessionStorage.getItem("governorateSuperViewTenantId"),
      localStorage.getItem("governorateSuperViewTenantId"),
      sessionStorage.getItem("viewAsTenantId"),
      localStorage.getItem("viewAsTenantId"),
      sessionStorage.getItem("effectiveTenantId"),
      localStorage.getItem("effectiveTenantId"),
    ].some((v) => clean(v) === tenantId);

    return flag && target;
  } catch {
    return false;
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function OfficialCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "rgba(255, 252, 242, 0.92)",
        border: "2px solid #d4af37",
        borderRadius: 24,
        boxShadow: "0 14px 34px rgba(92, 64, 18, 0.12)",
        padding: 24,
        marginBottom: 22,
      }}
    >
      <h2 style={{ margin: "0 0 16px", color: "#5f4614", fontSize: 24, fontWeight: 1000 }}>{title}</h2>
      {children}
    </section>
  );
}

function OfficialButton({
  children,
  onClick,
  disabled,
  danger,
  secondary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `2px solid ${danger ? "#b91c1c" : "#d4af37"}`,
        background: disabled
          ? "#e5e7eb"
          : danger
          ? "linear-gradient(135deg,#991b1b,#dc2626)"
          : secondary
          ? "#fffaf0"
          : "linear-gradient(135deg,#f7df88,#d4af37)",
        color: danger ? "#fff" : "#3d2c08",
        borderRadius: 16,
        padding: "12px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 1000,
        boxShadow: disabled ? "none" : "0 10px 22px rgba(128, 93, 20, 0.18)",
        minWidth: 180,
      }}
    >
      {children}
    </button>
  );
}

export default function CloudBackup() {
  const { tenantId } = useParams();
  const location = useLocation();
  const auth = useAuth() as any;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDiplomaBackupPage = location.pathname.includes("cloud-backup12");
  const forcedBackupMode: "school" | "diploma" = isDiplomaBackupPage ? "diploma" : "school";
  const [mode, setMode] = useState<"school" | "diploma" | "mixed">(forcedBackupMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<BackupPayload | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMode(forcedBackupMode);
  }, [forcedBackupMode]);

  const tid = clean(tenantId);
  const email = safeEmail(auth);
  const readOnly = Boolean(auth?.readOnly || auth?.allow?.readOnly || getStoredReadOnlyFlag(tid));

  const collections = useMemo(() => {
    return forcedBackupMode === "diploma" ? DIPLOMA_COLLECTIONS : SCHOOL_COLLECTIONS;
  }, [forcedBackupMode]);

  async function createBackup() {
    if (!tid) return;
    setBusy(true);
    setMessage("جاري تجهيز النسخة الاحتياطية من السحابة...");

    try {
      const collectionsOut: Record<string, any[]> = {};
      const settingsOut: Record<string, any> = {};

      for (const name of collections) {
        const rows = await loadTenantArray<any>(tid, name, {
          cacheFallback: true,
          fastCache: true,
          timeoutMs: 3500,
        });
        collectionsOut[name] = Array.isArray(rows) ? rows : [];
      }

      for (const docId of SETTINGS_DOCS) {
        const data = await loadTenantSettings<any>(tid, docId, {});
        if (data && Object.keys(data).length) settingsOut[docId] = data;
      }

      const payload: BackupPayload = {
        version: "exam-manager-cloud-backup-v1",
        createdAt: new Date().toISOString(),
        tenantId: tid,
        createdBy: email,
        mode: forcedBackupMode,
        collections: collectionsOut,
        settings: settingsOut,
      };

      const safeName = `exam-manager-backup-${tid}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadText(safeName, JSON.stringify(payload, null, 2));
      setPreview(payload);
      setSelectedCollections(
        Object.fromEntries(Object.keys(payload.collections || {}).map((key) => [key, true])),
      );
      setMessage("تم إنشاء النسخة الاحتياطية وتحميلها بنجاح.");
    } catch (error: any) {
      setMessage(`تعذر إنشاء النسخة الاحتياطية: ${error?.message || String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadBackupFile(file: File) {
    setBusy(true);
    setMessage("جاري قراءة ملف النسخة الاحتياطية...");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      if (!parsed || parsed.version !== "exam-manager-cloud-backup-v1") {
        throw new Error("ملف النسخة الاحتياطية غير معروف أو غير مدعوم.");
      }

      setPreview(parsed);
      setSelectedCollections(
        Object.fromEntries(Object.keys(parsed.collections || {}).map((key) => [key, true])),
      );
      setMessage("تم تحميل ملف النسخة الاحتياطية. راجع البيانات قبل الاستعادة.");
    } catch (error: any) {
      setMessage(`تعذر قراءة الملف: ${error?.message || String(error)}`);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function restoreBackup() {
    if (!tid || !preview) return;
    if (readOnly) {
      setMessage("لا يمكن تنفيذ الاستعادة أثناء وضع المشاهدة فقط.");
      return;
    }

    const selected = Object.entries(selectedCollections)
      .filter(([, checked]) => checked)
      .map(([name]) => name);

    if (!selected.length) {
      setMessage("اختر مجموعة واحدة على الأقل للاستعادة.");
      return;
    }

    const ok = window.confirm(
      "سيتم استبدال بيانات المجموعات المختارة داخل هذا المركز/المدرسة. هل تريد المتابعة؟",
    );
    if (!ok) return;

    setBusy(true);
    setMessage("جاري استعادة البيانات إلى السحابة...");

    try {
      for (const name of selected) {
        const rows = preview.collections?.[name] || [];
        await replaceTenantArray(tid, name, rows, {
          by: email,
          audit: {
            entity: name,
            meta: { summary: "cloud backup restore", backupCreatedAt: preview.createdAt },
          },
        });
      }

      for (const [docId, data] of Object.entries(preview.settings || {})) {
        await saveTenantSettings(tid, docId, data as Record<string, any>, { by: email });
      }

      setMessage("تمت الاستعادة بنجاح. يفضل تحديث الصفحة لجلب أحدث البيانات.");
    } catch (error: any) {
      setMessage(`تعذرت الاستعادة: ${error?.message || String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const collectionCounts = preview?.collections
    ? Object.entries(preview.collections).map(([name, rows]) => ({ name, count: Array.isArray(rows) ? rows.length : 0 }))
    : [];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f5eedc", padding: 24, color: "#1f2937" }}>
      <header
        style={{
          background: "linear-gradient(135deg,#fffaf0,#f5eedc)",
          border: "3px solid #d4af37",
          borderRadius: 28,
          padding: 28,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          boxShadow: "0 18px 42px rgba(92, 64, 18, 0.14)",
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 1000, color: "#6b4e16" }}>وزارة التعليم</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#374151" }}>نظام إدارة الامتحانات المطور</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 1000, color: "#111827" }}>النسخ الاحتياطي السحابي</h1>
          <p style={{ margin: "10px 0 0", color: "#6b4e16", fontWeight: 900 }}>
            حفظ واستعادة بيانات المدرسة أو مركز الدبلوم بطريقة آمنة
          </p>
        </div>
        <div
          style={{
            width: 86,
            height: 86,
            border: "2px solid #d4af37",
            borderRadius: 20,
            display: "grid",
            placeItems: "center",
            fontSize: 42,
            background: "#fffaf0",
            boxShadow: "0 12px 26px rgba(92, 64, 18, 0.18)",
          }}
        >
          🇴🇲
        </div>
      </header>

      <OfficialCard title="إنشاء نسخة احتياطية">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <div
            role="status"
            aria-label="نوع النسخة الاحتياطية"
            style={{
              minWidth: 300,
              padding: "12px 14px",
              borderRadius: 16,
              border: "2px solid #d4af37",
              background: "#fffaf0",
              color: "#111827",
              fontWeight: 1000,
              textAlign: "center",
              boxShadow: "inset 0 0 0 1px rgba(212, 175, 55, 0.18)",
            }}
          >
            {isDiplomaBackupPage ? "بيانات مركز الدبلوم فقط" : "بيانات المدرسة فقط"}
          </div>
          <div
            style={{
              background: isDiplomaBackupPage ? "#eff6ff" : "#ecfdf5",
              border: `2px solid ${isDiplomaBackupPage ? "#60a5fa" : "#34d399"}`,
              color: isDiplomaBackupPage ? "#1e3a8a" : "#065f46",
              borderRadius: 16,
              padding: "10px 14px",
              fontWeight: 1000,
              lineHeight: 1.6,
            }}
          >
            {isDiplomaBackupPage
              ? "سيتم إنشاء نسخة من بيانات مركز الدبلوم الحالي فقط."
              : "سيتم إنشاء نسخة من بيانات المدرسة الحالية فقط."}
          </div>
          <OfficialButton onClick={createBackup} disabled={busy || !tid}>إنشاء وتحميل نسخة</OfficialButton>
          <OfficialButton secondary onClick={() => fileInputRef.current?.click()} disabled={busy}>
            رفع ملف نسخة للاستعادة
          </OfficialButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadBackupFile(file);
            }}
          />
        </div>
        <p style={{ marginTop: 14, lineHeight: 1.8, fontWeight: 700 }}>
          النسخة الاحتياطية تحفظ ملف JSON على جهازك، ولا تحذف أي بيانات من السحابة. الاستعادة متاحة فقط للحسابات التي تملك صلاحية تعديل.
        </p>
      </OfficialCard>

      <OfficialCard title="استعادة نسخة احتياطية">
        {readOnly ? (
          <div
            style={{
              background: "#fff7ed",
              border: "2px solid #fb923c",
              borderRadius: 18,
              padding: 16,
              color: "#7c2d12",
              fontWeight: 1000,
            }}
          >
            أنت داخل وضع مشاهدة فقط. يمكن تحميل وقراءة النسخة، لكن الاستعادة والتعديل غير مسموح بهما.
          </div>
        ) : null}

        {!preview ? (
          <p style={{ margin: 0, fontWeight: 800 }}>لم يتم اختيار ملف نسخة احتياطية بعد.</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 18 }}>
              <div style={{ background: "#fffaf0", border: "1px solid #d4af37", borderRadius: 16, padding: 14 }}>
                <b>Tenant ID</b>
                <div>{preview.tenantId}</div>
              </div>
              <div style={{ background: "#fffaf0", border: "1px solid #d4af37", borderRadius: 16, padding: 14 }}>
                <b>تاريخ النسخة</b>
                <div>{new Date(preview.createdAt).toLocaleString("ar")}</div>
              </div>
              <div style={{ background: "#fffaf0", border: "1px solid #d4af37", borderRadius: 16, padding: 14 }}>
                <b>المجموعات</b>
                <div>{collectionCounts.length}</div>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginBottom: 18 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, overflow: "hidden", borderRadius: 18 }}>
                <thead>
                  <tr style={{ background: "#d4af37", color: "#3d2c08" }}>
                    <th style={{ padding: 12, textAlign: "right" }}>استعادة</th>
                    <th style={{ padding: 12, textAlign: "right" }}>المجموعة</th>
                    <th style={{ padding: 12, textAlign: "right" }}>عدد السجلات</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionCounts.map((item, index) => (
                    <tr key={item.name} style={{ background: index % 2 ? "#fffaf0" : "#fff" }}>
                      <td style={{ padding: 12 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedCollections[item.name])}
                          onChange={(e) =>
                            setSelectedCollections((prev) => ({ ...prev, [item.name]: e.target.checked }))
                          }
                        />
                      </td>
                      <td style={{ padding: 12, fontWeight: 900 }}>{item.name}</td>
                      <td style={{ padding: 12 }}>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <OfficialButton danger onClick={restoreBackup} disabled={busy || readOnly}>
              استعادة المجموعات المختارة
            </OfficialButton>
          </>
        )}
      </OfficialCard>

      {message ? (
        <div
          style={{
            background: message.includes("تعذر") || message.includes("تعذرت") ? "#fee2e2" : "#ecfdf5",
            border: `2px solid ${message.includes("تعذر") || message.includes("تعذرت") ? "#ef4444" : "#10b981"}`,
            borderRadius: 18,
            padding: 16,
            fontWeight: 1000,
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
