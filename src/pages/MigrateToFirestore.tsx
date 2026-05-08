// src/pages/MigrateToFirestore.tsx
import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { upsertTenantDoc } from "../services/tenantDb";

const TEACHERS_KEY = "exam-manager:teachers:v1";
const EXAMS_KEY = "exam-manager:exams:v1";
const ROOMS_KEY = "exam-manager:rooms:v1";
const ROOM_BLOCKS_KEY = "exam-manager:room-blocks:v1";

// أسماء subcollections داخل tenants
const SUBS = {
  teachers: "teachers",
  exams: "exams",
  rooms: "rooms",
  roomBlocks: "roomBlocks",
};

function readArray(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// يحاول إيجاد id داخل العنصر
function getItemId(item: any): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  return item.id || item._id || item.uuid || item.key;
}

export default function MigrateToFirestore() {
  const { user, allow, effectiveTenantId } = useAuth() as any;

  const canSee = !!user && !!effectiveTenantId; // لو أنت تستخدم حماية routes فهذا يكفي

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const counts = useMemo(() => {
    const teachers = readArray(TEACHERS_KEY).length;
    const exams = readArray(EXAMS_KEY).length;
    const rooms = readArray(ROOMS_KEY).length;
    const blocks = readArray(ROOM_BLOCKS_KEY).length;
    return { teachers, exams, rooms, blocks };
  }, []);

  if (!canSee) return <Navigate to="/login" replace />;

  const migrate = async () => {
    setMsg("");
    setBusy(true);

    try {
      const tenantId = String(effectiveTenantId);

      const teachers = readArray(TEACHERS_KEY);
      const exams = readArray(EXAMS_KEY);
      const rooms = readArray(ROOMS_KEY);
      const blocks = readArray(ROOM_BLOCKS_KEY);

      const by = user?.email || "";

      // ✅ ترحيل معلمين
      for (const t of teachers) {
        await upsertTenantDoc(tenantId, SUBS.teachers, { ...t, id: getItemId(t) }, { by });
      }

      // ✅ ترحيل الامتحانات
      for (const e of exams) {
        await upsertTenantDoc(tenantId, SUBS.exams, { ...e, id: getItemId(e) }, { by });
      }

      // ✅ ترحيل القاعات
      for (const r of rooms) {
        await upsertTenantDoc(tenantId, SUBS.rooms, { ...r, id: getItemId(r) }, { by });
      }

      // ✅ ترحيل حظر القاعات
      for (const b of blocks) {
        await upsertTenantDoc(tenantId, SUBS.roomBlocks, { ...b, id: getItemId(b) }, { by });
      }

      setMsg("✅ تم ترحيل البيانات بنجاح إلى Firestore داخل tenants/{tenantId}/...");
    } catch (e: any) {
      setMsg(`❌ فشل الترحيل: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", padding: 24, color: "#e5e7eb" }}>
      <h2 style={{ marginTop: 0 }}>ترحيل البيانات إلى Firestore (المسار B)</h2>

      <div style={{ opacity: 0.9, marginBottom: 14 }}>
        Tenant الحالي: <b>{String(effectiveTenantId)}</b> — الحساب: <b>{user?.email}</b>
      </div>

      <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div>الكادر التعليمي  (localStorage): <b>{counts.teachers}</b></div>
        <div>الامتحانات (localStorage): <b>{counts.exams}</b></div>
        <div>القاعات (localStorage): <b>{counts.rooms}</b></div>
        <div>حظر القاعات (localStorage): <b>{counts.blocks}</b></div>
      </div>

      <button
        onClick={migrate}
        disabled={busy}
        style={{
          marginTop: 14,
          padding: "12px 14px",
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          fontWeight: 900,
          background: "linear-gradient(135deg,#f59e0b,#fbbf24,#f59e0b)",
          color: "#111827",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "جاري الترحيل..." : "بدء الترحيل إلى Firestore"}
      </button>

      {msg && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 16, opacity: 0.85, lineHeight: 1.8 }}>
        <b>ملاحظة:</b> هذه العملية تنسخ البيانات من localStorage إلى Firestore.
        بعد الترحيل سنعدّل صفحات الكادر التعليمي/الامتحانات لتقرأ من Firestore بدل localStorage.
      </div>
    </div>
  );
}
