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
import { buildAuthzSnapshot, canAccessCapability, isPlatformOwner } from "../features/authz";
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
  tenantType?: string;
  type?: string;
  entityType?: string;
  isExamCenter?: boolean;
  isDiplomaCenter?: boolean;
};

const getTenantKind = (tenant: Partial<TenantLite> | any): "exam_center" | "school" => {
  const raw = String(
    tenant?.tenantType ||
      tenant?.entityType ||
      tenant?.type ||
      tenant?.kind ||
      ""
  ).toLowerCase();

  if (
    raw.includes("exam") ||
    raw.includes("center") ||
    raw.includes("diploma") ||
    tenant?.isExamCenter === true ||
    tenant?.isDiplomaCenter === true
  ) {
    return "exam_center";
  }

  return "school";
};

const isSchoolTenant = (tenant: Partial<TenantLite> | any) => getTenantKind(tenant) === "school";

const normalizeRoleValue = (value: any) => String(value || "").trim().toLowerCase();

const hasOwnerAccess = (auth: any, authzSnapshot: any) => {
  const profile = auth?.profile || {};
  const user = auth?.user || {};
  const values = [
    profile?.role,
    profile?.legacyRole,
    profile?.roleScope,
    profile?.accountType,
    user?.role,
    user?.legacyRole,
  ].map(normalizeRoleValue);

  return (
    isPlatformOwner(authzSnapshot) ||
    canAccessCapability(authzSnapshot, "PLATFORM_OWNER") ||
    (canAccessCapability(authzSnapshot, "SYSTEM_ADMIN") && Boolean(auth?.isSuperAdmin)) ||
    Boolean(profile?.isPlatformOwner || profile?.platformOwner || user?.isPlatformOwner || user?.platformOwner) ||
    values.some((v) => ["platform_owner", "owner", "super_admin", "superadmin", "مالك_المنصة", "مالك المنصة"].includes(v))
  );
};

export default function SuperGovernorates() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { user, startSupportForTenant } = auth;
  const authzSnapshot = buildAuthzSnapshot(auth);

  if (!user) return <Navigate to="/login" replace />;
  if (!hasOwnerAccess(auth, authzSnapshot)) return <Navigate to="/super" replace />;

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
    // صفحة سوبر المحافظات مخصصة للمحافظات فقط، وليس لنطاق الوزارة.
    return [...(DIRECTORATES as readonly string[])].map((x) => String(x)).filter(Boolean);
  }, []);

  const isValidGovernorateSuper = (gov: string) => {
    const normalized = normalizeText(String(gov || ""));
    return (
      !!normalized &&
      normalized !== normalizeText(String(MINISTRY_SCOPE || "")) &&
      GOV_OPTIONS.some((x) => normalizeText(x) === normalized)
    );
  };

  useEffect(() => {
    const qy = query(
      collection(db, "allowlist"),
      where("role", "==", "super"),
      orderBy("email")
    );
    return onSnapshot(
      qy,
      (snap) => {
        const rows: AllowlistRow[] = [];
        snap.forEach((d) => {
          const row = d.data() as AllowlistRow;
          if (String(row.role || "") === "super" && isValidGovernorateSuper(String(row.governorate || ""))) {
            rows.push(row);
          }
        });
        setSupers(rows);
      },
      () => {
        // ignore; rules or missing index
      }
    );
  }, []);

  // Fallback آمن: إعادة الاشتراك عند عدم وصول بيانات من الاشتراك الأول.
  useEffect(() => {
    if (supers.length > 0) return;
    const qy = query(collection(db, "allowlist"), where("role", "==", "super"), orderBy("email"));
    return onSnapshot(
      qy,
      (snap) => {
        const rows: AllowlistRow[] = [];
        snap.forEach((d) => {
          const row = d.data() as AllowlistRow;
          if (String(row.role || "") === "super" && isValidGovernorateSuper(String(row.governorate || ""))) {
            rows.push(row);
          }
        });
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

              const rootData = (docSnap.data() as any) || {};
              const merged = { ...rootData, ...(cfg || {}) };
              const tGov = String(
                merged?.governorate ||
                  merged?.tenantGovernorate ||
                  merged?.regionAr ||
                  ""
              ).trim();

              return {
                id,
                name:
                  merged?.schoolNameAr ||
                  merged?.schoolName ||
                  merged?.nameAr ||
                  merged?.name ||
                  id,
                governorate: tGov,
                wilayat: merged?.wilayat,
                enabled: merged?.enabled,
                tenantType: merged?.tenantType,
                type: merged?.type,
                entityType: merged?.entityType,
                isExamCenter: merged?.isExamCenter,
                isDiplomaCenter: merged?.isDiplomaCenter,
              } as TenantLite;
            })
          );

          const out: TenantLite[] = [];
          for (const t of mapped) {
            // هذه الصفحة خاصة بمدارس سوبر المحافظات فقط.
            // مراكز امتحانات الدبلوم لها مسار منفصل ولا تظهر هنا.
            if (!isSchoolTenant(t)) continue;

            if (gov === MINISTRY_SCOPE || normalizeText(gov) === normalizeText(MINISTRY_SCOPE)) {
              out.push(t);
            } else if (isSameDirectorate(String(t.governorate || ""), gov)) {
              out.push(t);
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
    if (!governorate || !isValidGovernorateSuper(governorate)) {
      setMsg("اختر محافظة صحيحة. هذه الصفحة مخصصة لسوبر المحافظات فقط.");
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
        tenantId: "system",
        name: name.trim() || e,
        userName: name.trim() || e,
        governorate: String(governorate).trim(),
        tenantGovernorate: String(governorate).trim(),
        roleScope: "governorate",
      });
      setEmail("");
      setName("");
      setMsg("تم حفظ السوبر بنجاح ✅");
    } catch {
      setMsg("فشل حفظ سوبر المحافظات. تأكد من الصلاحيات وصحة المحافظة ثم حاول مرة أخرى.");
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
          <h3 style={{ margin: "0 0 12px 0" }}>إضافة/تحديث سوبر المحافظات</h3>

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
            <h3 style={{ margin: "0 0 12px 0" }}>قائمة سوبر المحافظات</h3>
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
            <h3 style={{ margin: "0 0 12px 0" }}>مدارس سوبر المحافظات</h3>
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
