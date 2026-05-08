// src/pages/Onboarding.tsx
import React, { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { isPlatformOwner, resolveHomePath } from "../features/authz";

const APP_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

export default function Onboarding() {
  const { user, allow, refreshAllow, authzSnapshot, primaryRoleLabel } = useAuth() as any;
  const navigate = useNavigate();

  const email = useMemo(() => String(user?.email || "").toLowerCase(), [user?.email]);

  const [name, setName] = useState<string>(String(allow?.name ?? "").trim());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);

    const clean = name.trim();

    const owner = isPlatformOwner(authzSnapshot);

    // ✅ مالك المنصة: لا نجبره (لكن لو فتح الصفحة بإرادته نسمح له يحفظ)
    if (!owner) {
      if (clean.length < 2) {
        setMsg("❌ الرجاء كتابة الاسم أو اسم المدرسة (حرفين على الأقل).");
        return;
      }
    } else {
      // للسوبر أدمن: لو تركه فارغ ما نحفظ
      if (!clean) {
        navigate(resolveHomePath(authzSnapshot), { replace: true });
        return;
      }
    }

    if (!email) {
      setMsg("❌ لا يوجد بريد مستخدم. أعد تسجيل الدخول.");
      return;
    }

    setSaving(true);
    try {
      // ✅ نكتب فقط الحقول المسموحة في Rules
      await setDoc(
        doc(db, "users", user!.uid),
        {
          email,
          displayName: clean,
          status: "active",
          updatedAt: serverTimestamp(),
          source: "manual",
        },
        { merge: true }
      );

      // ✅ تحديث بيانات allowlist داخل AuthContext (مرتين لتفادي تأخير القراءة)
      if (typeof refreshAllow === "function") {
        await refreshAllow();
        await refreshAllow();
      }

      navigate(resolveHomePath(authzSnapshot), { replace: true });
    } catch (e: any) {
      setMsg(`❌ فشل الحفظ: ${e?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoWrap}>
            <img
              src={APP_LOGO_URL}
              alt="logo"
              style={styles.logo}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <span style={styles.logoFallback}>★</span>
          </div>

          <div>
            <div style={styles.title}>نظام إدارة الامنحانات المطور </div>
            <div style={styles.subtitle}>سلطنة عمان - وزارة التعليم</div>
          </div>
        </div>

        <div style={styles.hr} />

        <div style={styles.text}>
          {isPlatformOwner(authzSnapshot) ? (
            <>
              يمكنك (اختياريًا) إدخال الاسم/اسم المدرسة ليظهر في صفحة مدير النظام.
            </>
          ) : (
            <>
              قبل استخدام النظام لأول مرة، يجب إدخال <b>الاسم أو اسم المدرسة</b> (إجباري).
              <br />
              سيتم حفظه ويظهر في صفحة مدير النظام.
            </>
          )}
        </div>

        <label style={styles.label}>الاسم / اسم المدرسة</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: مدرسة النور / أحمد سالم"
          style={styles.input}
          autoFocus
        />

        <button onClick={submit} disabled={saving} style={{ ...styles.btn, opacity: saving ? 0.7 : 1 }}>
          {saving ? "جاري الحفظ..." : isPlatformOwner(authzSnapshot) ? "حفظ" : "حفظ والمتابعة"}
        </button>

        {msg && <div style={styles.msg}>{msg}</div>}

        <div style={styles.small}>
          البريد: <b>{email || "-"}</b> — Tenant: <b>{allow?.tenantId ?? "-"}</b>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    direction: "rtl",
    display: "grid",
    placeItems: "center",
    padding: 18,
    background: "linear-gradient(135deg,#0b1020,#0a1a2a,#070b14)",
    fontFamily: "Cairo, system-ui, sans-serif",
    color: "#e5e7eb",
  },
  card: {
    width: "min(720px, 96vw)",
    borderRadius: 22,
    background: "rgba(17,24,39,0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.55)",
    padding: 18,
  },
  header: { display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-start" },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(212,175,55,0.25)",
    boxShadow: "0 0 18px rgba(212,175,55,0.25)",
    display: "grid",
    placeItems: "center",
    position: "relative",
    flex: "0 0 auto",
  },
  logo: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  logoFallback: { position: "absolute", color: "#d4af37", fontWeight: 900 },

  title: { fontSize: 20, fontWeight: 900, color: "#d4af37" },
  subtitle: { fontSize: 13, opacity: 0.85 },

  hr: { height: 1, background: "rgba(255,255,255,0.10)", margin: "14px 0" },
  text: { lineHeight: 1.9, opacity: 0.95, marginBottom: 12, textAlign: "center" },

  label: {
    display: "block",
    marginBottom: 8,
    fontWeight: 900,
    color: "#cbd5e1",
    textAlign: "right",
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.55)",
    color: "#e5e7eb",
    outline: "none",
    fontSize: 16,
  },
  btn: {
    marginTop: 14,
    width: "100%",
    padding: "14px 14px",
    borderRadius: 16,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    background: "linear-gradient(135deg,#f59e0b,#fbbf24,#f59e0b)",
    color: "#111827",
    boxShadow: "0 14px 40px rgba(245,158,11,0.35)",
    fontSize: 16,
  },
  msg: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontWeight: 800,
    lineHeight: 1.7,
    textAlign: "center",
  },
  small: { marginTop: 12, opacity: 0.85, fontSize: 13, textAlign: "center" },
};
