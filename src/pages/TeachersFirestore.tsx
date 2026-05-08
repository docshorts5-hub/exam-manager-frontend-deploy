// src/pages/TeachersFirestore.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { onSnapshot, collection } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { canAccessCapability } from "../features/authz";
import { deleteTenantDoc, upsertTenantDoc } from "../services/tenantDb";

type Teacher = {
  id: string;
  name?: string;
  subject?: string;
  notes?: string;
};

export default function TeachersFirestore() {
  const { user, allow, effectiveTenantId, authzSnapshot } = useAuth() as any;

  if (!user) return <Navigate to="/login" replace />;
  if (!effectiveTenantId) return <div style={{ padding: 24 }}>لا يوجد Tenant.</div>;

  const canWrite = canAccessCapability(authzSnapshot, "TEACHERS_MANAGE") || canAccessCapability(authzSnapshot, "TENANT_WRITE");

  const [items, setItems] = useState<Teacher[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const colRef = collection(db, "tenants", String(effectiveTenantId), "teachers");
    const unsub = onSnapshot(
      colRef,  // 1st argument: the reference to the collection
      (snap) => {  // 2nd argument: success callback
        const list: Teacher[] = [];
        snap.forEach((d) => list.push(d.data() as any));
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setItems(list);
      },
      (err) => setMsg(`❌ خطأ قراءة الكادر التعليمي : ${err?.message ?? String(err)}`)  // 3rd argument: error callback
    );
    return () => unsub();
  }, [effectiveTenantId]);

  const addTeacher = async () => {
    setMsg("");
    if (!canWrite) return setMsg("❌ ليس لديك صلاحية الإضافة.");
    if (!name.trim()) return setMsg("❌ أدخل اسم المعلم.");

    try {
      await upsertTenantDoc(String(effectiveTenantId), "teachers", {
        name: name.trim(),
        subject: subject.trim(),
        notes: notes.trim(),
      } as any, { by: user.email });

      setName(""); setSubject(""); setNotes("");
      setMsg("✅ تم الحفظ.");
    } catch (e: any) {
      setMsg(`❌ فشل الحفظ: ${e?.message ?? String(e)}`);
    }
  };

  const remove = async (id: string) => {
    setMsg("");
    if (!canWrite) return setMsg("❌ ليس لديك صلاحية الحذف.");
    const ok = window.confirm("تأكيد حذف المعلم؟");
    if (!ok) return;

    try {
      await deleteTenantDoc(`tenants/${String(effectiveTenantId)}/teachers/${id}`);
      setMsg("✅ تم الحذف.");
    } catch (e: any) {
      setMsg(`❌ فشل الحذف: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", padding: 24, color: "#e5e7eb" }}>
      <h2 style={{ marginTop: 0 }}>الكادر التعلمي  (Firestore)</h2>

      <div style={{ opacity: 0.9, marginBottom: 12 }}>
        Tenant: <b>{String(effectiveTenantId)}</b> — Role: <b>{allow?.role ?? "-"}</b>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المعلم" style={inp} />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="المادة" style={inp} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" style={inp} />
        <button onClick={addTeacher} style={btn} disabled={!canWrite}>حفظ</button>
      </div>

      {msg && <div style={box}>{msg}</div>}

      <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>القائمة</div>

        {items.length === 0 ? (
          <div style={{ opacity: 0.85 }}>لا يوجد معلمين.</div>
        ) : (
          items.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <div style={{ fontWeight: 900 }}>{t.name || "-"}</div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>{t.subject || ""}</div>
              </div>
              <button onClick={() => remove(t.id)} style={danger} disabled={!canWrite}>حذف</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(2,6,23,0.55)",
  color: "#e5e7eb",
  outline: "none",
};

const btn: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontWeight: 900,
  background: "linear-gradient(135deg,#f59e0b,#fbbf24,#f59e0b)",
  color: "#111827",
};

const danger: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.14)",
  color: "#fecaca",
  fontWeight: 900,
  cursor: "pointer",
};

const box: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.1)",
};