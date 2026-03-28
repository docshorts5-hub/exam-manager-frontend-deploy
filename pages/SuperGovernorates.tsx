import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import "./adminSystem.theme.css";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, isPlatformOwner } from "../features/authz";
import { callFn } from "../services/functionsClient";
import { DIRECTORATES, MINISTRY_SCOPE, normalizeText, isSameDirectorate } from "../constants/directorates";

type AllowlistRow = {
  email: string;
  enabled: boolean;
  role: string;
  tenantId?: string;
  governorate?: string;
  name?: string;
  userName?: string;
};

type TenantLite = {
  id: string;
  name?: string;
  governorate?: string;
  wilayat?: string;
  enabled?: boolean;
};

export default function SuperGovernorates() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { user, startSupportForTenant } = auth;
  const authzSnapshot = buildAuthzSnapshot(auth);

  if (!user) return <Navigate to="/login" replace />;
  if (!isPlatformOwner(authzSnapshot)) return <Navigate to="/super" replace />;

  // ===== Supers list =====
  const [supers, setSupers] = useState<AllowlistRow[]>([]);
  const [selectedSuper, setSelectedSuper] = useState<AllowlistRow | null>(null);
  const [tenants, setTenants] = useState<TenantLite[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  // ===== Add super form =====
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // Keep it as plain string to avoid TS literal-union friction.
  const [governorate, setGovernorate] = useState<string>(String(DIRECTORATES?.[0] ?? MINISTRY_SCOPE ?? ""));
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const GOV_OPTIONS = useMemo<string[]>(() => {
    // DIRECTORATES is exported as a readonly tuple (as const). Spreading creates a mutable array.
    const list = [...(DIRECTORATES as readonly string[])].map((x) => String(x));
    const m = String(MINISTRY_SCOPE);
    if (!list.includes(m)) list.unshift(m);
    return list;
  }, []);

  useEffect(() => {
    const qy = query(
      collection(db, "allowlist"),
      where("role", "in", ["super", "super_regional", "regional_super"]),
      orderBy("email")
    );
    return onSnapshot(
      qy,
      (snap) => {
        const rows: AllowlistRow[] = [];
        snap.forEach((d) => rows.push(d.data() as AllowlistRow));
        setSupers(rows);
      },
      () => {
        // ignore; rules or missing index
      }
    );
  }, []);

  // Fallback: some databases store "super" only; the above query uses "in".
  // If "in" needs an index and fails silently, we also subscribe to role==super.
  useEffect(() => {
    if (supers.length > 0) return;
    const qy = query(collection(db, "allowlist"), where("role", "==", "super"), orderBy("email"));
    return onSnapshot(
      qy,
      (snap) => {
        const rows: AllowlistRow[] = [];
        snap.forEach((d) => rows.push(d.data() as AllowlistRow));
        setSupers(rows);
      },
      () => {}
    );
  }, [supers.length]);

  // اختيار السوبر فقط — تحميل المدارس سيتم تلقائياً (Realtime) عبر onSnapshot.
  const loadTenantsFor = async (s: AllowlistRow) => {
    setSelectedSuper(s);
  };

  // ✅ ربط مباشر بين صفحة السوبر (/super-system) وصفحة السوبر أدمن (/system/supers)
  // أي إنشاء/تعديل/حذف مدرسة من السوبر يظهر فوراً هنا بدون Refresh.
  useEffect(() => {
    if (!selectedSuper) return;

    const gov = String(selectedSuper.governorate || "").trim();
    if (!gov) {
      setTenants([]);
      return;
    }

    setLoadingTenants(true);
    setMsg("");

    const qy = query(collection(db, "tenants"), orderBy("createdAt", "desc"));
    let alive = true;

    const unsub = onSnapshot(
      qy,
      async (snap) => {
        try {
          const mapped = await Promise.all(
            snap.docs.map(async (docSnap) => {
              const id = docSnap.id;
              let cfg: any = null;
              try {
                const cfgRef = doc(db, "tenants", id, "meta", "config");
                const cfgSnap = await getDoc(cfgRef);
                if (cfgSnap.exists()) cfg = cfgSnap.data();
              } catch {
                cfg = null;
              }

              const tGov = String(cfg?.governorate || "").trim();
              return {
                id,
                name: cfg?.schoolNameAr || cfg?.schoolName || (docSnap.data() as any)?.name,
                governorate: tGov,
                wilayat: cfg?.wilayat,
                enabled: cfg?.enabled,
              } as TenantLite;
            })
          );

          const out: TenantLite[] = [];
          for (const t of mapped) {
            if (gov === MINISTRY_SCOPE || normalizeText(gov) === normalizeText(MINISTRY_SCOPE)) {
              out.push(t);
            } else {
              if (isSameDirectorate(String(t.governorate || ""), gov)) out.push(t);
            }
          }

          if (alive) {
            setTenants(out);
            setLoadingTenants(false);
          }
        } catch {
          if (alive) {
            setMsg("تعذر تحميل المدارس.");
            setLoadingTenants(false);
          }
        }
      },
      () => {
        if (alive) {
          setMsg("تعذر تحميل المدارس.");
          setLoadingTenants(false);
        }
      }
    );

    return () => {
      alive = false;
      try {
        unsub();
      } catch {
        // ignore
      }
    };
  }, [selectedSuper?.email, selectedSuper?.governorate]);

  const addOrUpdateSuper = async () => {
    setMsg("");
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      setMsg("أدخل بريد إلكتروني صحيح.");
      return;
    }
    if (!governorate) {
      setMsg("اختر المحافظة.");
      return;
    }
    setBusy(true);
    try {
      // Cloud Function enforces policy (only Super Admin can create supers)
      const upsert = callFn<any, any>("adminUpsertAllowlistUser");
      await upsert({
        email: e,
        enabled,
        role: "super",
        tenantId: "default",
        name: name.trim() || e,
        governorate,
      });
      setEmail("");
      setName("");
      setMsg("تم حفظ السوبر بنجاح ✅");
    } catch {
      setMsg("فشل حفظ السوبر. تأكد من الصلاحيات ثم حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  const enterSupport = async (tenantId: string) => {
    setBusy(true);
    setMsg("");
    try {
      await startSupportForTenant(tenantId);
      navigate(`/t/${tenantId}`, { replace: true });
    } catch {
      setMsg("فشل الدخول للدعم. جرّب تحديث الصلاحيات ثم أعد المحاولة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="system-shell">
      <header className="system-header">
        <div className="system-header-inner">
          <div className="system-brand">
            <div className="system-brand-title">إدارة السوبر للمحافظات</div>
          </div>
          <div className="system-program">لوحة السوبر أدمن</div>
          <div className="system-actions">
            <button
              className="btn"
              onClick={() => navigate("/system")}
              style={{ padding: "10px 14px", borderRadius: 12 }}
            >
              العودة للنظام
            </button>
          </div>
        </div>
      </header>

      <main className="system-main">
        <div className="system-glow" style={{ borderRadius: 18, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px 0" }}>إضافة/تحديث سوبر (مديرية)</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 10, alignItems: "center" }}>
            <input
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              placeholder="الاسم"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select value={governorate} onChange={(e) => setGovernorate(e.target.value)}>
              {GOV_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                مفعّل
              </label>
              <button
                className="btn"
                onClick={addOrUpdateSuper}
                disabled={busy}
                style={{ padding: "10px 14px", borderRadius: 12 }}
              >
                حفظ
              </button>
            </div>
          </div>
          {msg && <div style={{ marginTop: 10, opacity: 0.95 }}>{msg}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
          <div className="system-glow" style={{ borderRadius: 18, padding: 16 }}>
            <h3 style={{ margin: "0 0 12px 0" }}>قائمة السوبر (حسب المحافظة)</h3>
            {supers.length === 0 ? (
              <div style={{ opacity: 0.8 }}>لا يوجد سوبر بعد.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {supers.map((s) => (
                  <button
                    key={s.email}
                    className="btn"
                    onClick={() => loadTenantsFor(s)}
                    style={{
                      textAlign: "start",
                      padding: 12,
                      borderRadius: 14,
                      opacity: selectedSuper?.email === s.email ? 1 : 0.92,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{s.userName || s.name || s.email}</div>
                    <div style={{ opacity: 0.9, fontSize: 13 }}>
                      {s.email} — {s.governorate || "(بدون محافظة)"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="system-glow" style={{ borderRadius: 18, padding: 16 }}>
            <h3 style={{ margin: "0 0 12px 0" }}>مدارس السوبر</h3>
            {!selectedSuper ? (
              <div style={{ opacity: 0.8 }}>اختر سوبر لعرض المدارس التابعة له.</div>
            ) : loadingTenants ? (
              <div style={{ opacity: 0.8 }}>جاري التحميل...</div>
            ) : tenants.length === 0 ? (
              <div style={{ opacity: 0.8 }}>لا توجد مدارس مطابقة لمحافظة هذا السوبر.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    className="btn"
                    onClick={() => enterSupport(t.id)}
                    disabled={busy}
                    style={{ textAlign: "start", padding: 12, borderRadius: 14 }}
                    title="الدخول للدعم"
                  >
                    <div style={{ fontWeight: 900 }}>{t.name || t.id}</div>
                    <div style={{ opacity: 0.9, fontSize: 13 }}>
                      {t.governorate || ""}{t.wilayat ? ` — ${t.wilayat}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
