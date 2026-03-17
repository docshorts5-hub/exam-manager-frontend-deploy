import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { canAccessCapability, isPlatformOwner } from "../features/authz";
import type { SuperProgramTenantRow as TenantRow } from "../features/super-admin/types";
import { buildProgramEnterState } from "../features/super-admin/services/superProgramEnterService";

export default function SuperProgramEnter() {
  const navigate = useNavigate();
  const { profile, authzSnapshot, startSupportForTenant, primaryRoleLabel } = useAuth() as any;
  const owner = isPlatformOwner(authzSnapshot);
  const canAccessSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [busyTenant, setBusyTenant] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const qRef = query(collection(db, "tenants"), orderBy("createdAt", "desc"));
        const snap = await getDocs(qRef);
        const baseList: TenantRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const list = await Promise.all(
          baseList.map(async (tenant) => {
            try {
              const cfg = await getDoc(doc(db, "tenants", tenant.id, "meta", "config"));
              const governorate = cfg.exists() ? String((cfg.data() as any)?.governorate ?? "").trim() : "";
              return { ...tenant, governorate } as TenantRow;
            } catch {
              return tenant;
            }
          }),
        );
        if (!alive) return;
        const state = buildProgramEnterState({
          tenants: list,
          owner,
          canAccessSystem,
          userGovernorate: String((profile as any)?.governorate ?? ""),
          primaryRoleLabel,
        });
        setTenants(state.visibleTenants);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "تعذر تحميل قائمة المدارس");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [owner, canAccessSystem, profile, primaryRoleLabel]);

  const enabledTenants = useMemo(() => tenants.filter((t) => t.enabled !== false), [tenants]);
  const accessDescription = useMemo(
    () =>
      buildProgramEnterState({
        tenants: [],
        owner,
        canAccessSystem,
        userGovernorate: String((profile as any)?.governorate ?? ""),
        primaryRoleLabel,
      }).accessDescription,
    [owner, canAccessSystem, profile, primaryRoleLabel],
  );

  if (!canAccessSystem) return <Navigate to="/" replace />;

  const onPick = async (tenantId: string) => {
    try {
      setBusyTenant(tenantId);
      setError("");
      await startSupportForTenant?.(tenantId, "الدخول للبرنامج");
      navigate(`/t/${tenantId}`, { replace: true });
    } catch (e: any) {
      setError(e?.message || "فشل تفعيل وضع الدعم");
    } finally {
      setBusyTenant("");
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(184, 134, 11, 0.18), transparent 55%), radial-gradient(900px 520px at 80% 15%, rgba(184, 134, 11, 0.12), transparent 60%), linear-gradient(180deg, #060606 0%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "min(860px, 100%)",
          borderRadius: 26,
          border: "1px solid rgba(212, 175, 55, 0.22)",
          background: "rgba(0,0,0,0.58)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
          backdropFilter: "blur(10px)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ color: "#d4af37", fontWeight: 900, fontSize: 26 }}>اختر مدرسة للدخول</div>
            <div style={{ color: "rgba(255,255,255,0.80)", marginTop: 6, lineHeight: 1.7 }}>
              سيتم تفعيل وضع الدعم لهذه المدرسة ثم فتح البرنامج. {accessDescription}
            </div>
          </div>

          <button
            onClick={() => navigate(owner ? "/super" : "/super-system")}
            style={{
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(212,175,55,0.30)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            رجوع
          </button>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 14,
              border: "1px solid rgba(255, 80, 80, 0.35)",
              background: "rgba(255,0,0,0.08)",
              color: "rgba(255,255,255,0.92)",
              padding: "10px 12px",
              textAlign: "right",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {loading ? (
            <div style={{ color: "rgba(255,255,255,0.75)", padding: 10 }}>جاري تحميل المدارس…</div>
          ) : enabledTenants.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.75)", padding: 10 }}>لا توجد مدارس بعد.</div>
          ) : (
            enabledTenants.map((tenant) => {
              const title = tenant.schoolName || tenant.name || tenant.id;
              const sub = tenant.id;
              const busy = busyTenant === tenant.id;
              return (
                <button
                  key={tenant.id}
                  onClick={() => onPick(tenant.id)}
                  disabled={!!busyTenant}
                  style={{
                    textAlign: "right",
                    width: "100%",
                    borderRadius: 18,
                    border: "1px solid rgba(212,175,55,0.22)",
                    background: busy
                      ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.35))"
                      : "linear-gradient(180deg, rgba(212,175,55,0.10), rgba(0,0,0,0.35))",
                    boxShadow: "0 12px 26px rgba(0,0,0,0.55)",
                    padding: "14px 16px",
                    cursor: busyTenant ? "not-allowed" : "pointer",
                    opacity: busyTenant && !busy ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 900, fontSize: 22, lineHeight: 1.2 }}>{title}</div>
                      <div style={{ color: "#d4af37", marginTop: 4, fontWeight: 800 }}>{sub}</div>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.82)", fontWeight: 900 }}>{busy ? "جارٍ فتح…" : ""}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button
            onClick={() => navigate("/system")}
            style={{
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(212,175,55,0.30)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            فتح لوحة السوبر
          </button>

          <button
            onClick={() => navigate(owner ? "/super" : "/super-system")}
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(212,175,55,0.25)",
              color: "#d4af37",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
