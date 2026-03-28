// src/tools/MigrateToTenant.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { canAccessCapability, isPlatformOwner } from "../features/authz";
import { callFn } from "../services/functionsClient";

type Step = "idle" | "running" | "done" | "error";

type CollName =
  | "teachers"
  | "exams"
  | "rooms"
  | "unavailability"
  | "roomBlocks"
  | "runs"
  | "tasks"
  | "settings";

const COLLECTIONS: CollName[] = [
  "teachers",
  "exams",
  "rooms",
  "unavailability",
  "roomBlocks",
  "runs",
  "tasks",
  "settings",
];

// Define CountsMap type
type CountsMap = Record<string, { root: number; tenant: number }>;

// ✅ Use Callable Functions (no CORS)
async function callAdminMigrate(payload: any) {
  const fn = callFn<any, any>("adminMigrateRootToTenant");
  return await fn(payload ?? {});
}

async function getCountsFromServer(tenantId: string): Promise<CountsMap> {
  const fn = callFn<any, any>("adminMigrationCounts");
  const res = await fn({ tenantId, collections: COLLECTIONS });
  return (res?.counts ?? {}) as CountsMap;
}

async function migrateCollection(params: {
  tenantId: string;
  name: CollName;
  deleteSource: boolean;
  onProgress?: (msg: string) => void;
}) {
  const { tenantId, name, deleteSource, onProgress } = params;

  const res = await callAdminMigrate({
    tenantId,
    collections: [name],
    deleteAfter: deleteSource,
  });
  const moved = Number(res?.moved?.[name] ?? 0);

  onProgress?.(
    `✅ ${name}: اكتمل النقل (${moved}) إلى tenants/${tenantId}/${name}${deleteSource ? " مع حذف القديم" : ""}`,
  );
  return { moved };
}

export default function MigrateToTenant() {
  const { tenantId, authzSnapshot } = useAuth() as any;
  const isPlatformOwnerUser = isPlatformOwner(authzSnapshot);
  const canManageTenants = canAccessCapability(authzSnapshot, "TENANTS_MANAGE");
  const t = useMemo(() => String(tenantId ?? "").trim(), [tenantId]);

  const [step, setStep] = useState<Step>("idle");
  const [deleteSource, setDeleteSource] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [counts, setCounts] = useState<CountsMap | null>(null);

  const push = (s: string) => setLog((x) => [...x, s]);

  const refreshCounts = async () => {
    if (!t) {
      push("❌ لا يوجد tenantId فعّال");
      return;
    }
    setStep("running");
    try {
      const next: CountsMap = {};
      const serverCounts = await getCountsFromServer(t);
      for (const name of COLLECTIONS) {
        next[name] = serverCounts[name] ?? { root: 0, tenant: 0 };
      }
      setCounts(next);
      setStep("done");
      push("✅ تم تحديث العدّادات");
    } catch (e: any) {
      setStep("error");
      push(`❌ خطأ في تحديث العدّادات: ${e?.message || e}`);
    }
  };

  const runAll = async () => {
    if (!t) {
      push("❌ لا يوجد tenantId فعّال");
      return;
    }
    setStep("running");
    setLog([]);
    try {
      push(`Tenant الحالي: ${t}`);
      push(deleteSource ? "⚠️ وضع الحذف مفعّل: سيتم حذف البيانات القديمة بعد النسخ" : "🟦 وضع النسخ فقط: لن يتم حذف القديم");
      push("—");

      for (const name of COLLECTIONS) {
        await migrateCollection({ tenantId: t, name, deleteSource, onProgress: push });
      }

      push("—");
      push("✅ اكتملت عملية النقل لكل الـ collections");
      setStep("done");
      await refreshCounts();
    } catch (e: any) {
      setStep("error");
      push(`❌ خطأ أثناء النقل: ${e?.message || e}`);
    }
  };

  if (!(isPlatformOwnerUser || canManageTenants)) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui", direction: "rtl", color: "#e5e7eb" }}>
        <h2>Migration Tool</h2>
        <p>هذه الصفحة متاحة فقط لمالك المنصة أو لمن يملك صلاحية إدارة الجهات.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui",
        direction: "rtl",
        color: "#e5e7eb",
        maxWidth: 980,
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          padding: 18,
          backdropFilter: "blur(10px)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>أداة ترحيل البيانات (Migration)</h2>
        <p style={{ marginTop: 0, opacity: 0.9, lineHeight: 1.9 }}>
          تنقل البيانات من Root Collections (مثل <code>teachers</code>) إلى مسار <code>tenants/{t || "{tenantId}"}/...</code>.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "10px 12px", borderRadius: 14 }}>
            <strong>Tenant الحالي:</strong> {t || "(غير موجود)"}
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "10px 12px", borderRadius: 14 }}>
            <input type="checkbox" checked={deleteSource} onChange={(e) => setDeleteSource(e.target.checked)} />
            <span>حذف المصدر بعد النسخ</span>
          </label>

          <button
            onClick={refreshCounts}
            disabled={step === "running"}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.06)",
              color: "#e5e7eb",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            تحديث العدّادات
          </button>
          <button
            onClick={runAll}
            disabled={step === "running"}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg,#f59e0b,#fbbf24,#f59e0b)",
              color: "#111827",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            تشغيل النقل الآن
          </button>
        </div>

        {counts && (
          <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12, background: "rgba(0,0,0,0.22)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>العدّادات</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>Collection</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>Root</th>
                  <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>Tenant</th>
                </tr>
              </thead>
              <tbody>
                {COLLECTIONS.map((c) => (
                  <tr key={c}>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{c}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{counts[c]?.root ?? 0}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{counts[c]?.tenant ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>السجل</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "rgba(0,0,0,0.40)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 12,
              minHeight: 160,
              color: "#e5e7eb",
            }}
          >
            {log.length ? log.join("\n") : "(لا يوجد)"}
          </pre>
        </div>

        <div style={{ marginTop: 14, opacity: 0.9, lineHeight: 1.9 }}>
          <b>ملاحظة:</b> الترحيل والعدّادات يتمان عبر Cloud Functions (Server-side)، لذلك لن يتأثران بقيود Firestore Rules على Root Collections.
        </div>
      </div>
    </div>
  );
}