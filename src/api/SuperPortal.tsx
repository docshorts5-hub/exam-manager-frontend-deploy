import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canAccessCapability, isPlatformOwner, resolvePrimaryRoleLabel, resolveRoleBadgeStyle } from "../features/authz";
import { buildSuperPortalCards } from "../features/super-admin/services/superPortalService";
import SuperPortalCard from "../features/super-admin/components/SuperPortalCard";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

export default function SuperPortal() {
  const navigate = useNavigate();
  const { profile, authzSnapshot, logout, primaryRoleLabel } = useAuth() as any;

  const displayName = useMemo(() => {
    return profile?.userName || profile?.name || profile?.email || "";
  }, [profile]);

  const roleLabel = primaryRoleLabel || resolvePrimaryRoleLabel(authzSnapshot);
  const roleBadge = resolveRoleBadgeStyle(authzSnapshot);
  const owner = isPlatformOwner(authzSnapshot);
  const canAccessSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");
  const isScopeAdmin = Boolean(profile?.role === "super" || profile?.role === "super_admin");

  const cards = useMemo(
    () => buildSuperPortalCards({ owner, isScopeAdmin, navigate }),
    [owner, isScopeAdmin, navigate],
  );

  if (!canAccessSystem) return <Navigate to="/" replace />;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(184, 134, 11, 0.18), transparent 55%), radial-gradient(900px 520px at 80% 15%, rgba(184, 134, 11, 0.12), transparent 60%), linear-gradient(180deg, #060606 0%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        direction: "rtl",
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          borderRadius: 28,
          border: "6px solid #d4af37",
          background: "rgba(0,0,0,0.55)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
          backdropFilter: "blur(10px)",
          padding: 28,
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 18,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ color: "#d4af37", fontWeight: 800, fontSize: 26, lineHeight: 1.2 }}>وزارة التعليم</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 34, lineHeight: 1.2 }}>نظام إدارة الامتحانات المطور</div>
            <div style={{ color: "rgba(255,255,255,0.82)", marginTop: 8, fontSize: 16 }}>
              تم تسجيل الدخول بصلاحيات <b style={{ color: "#d4af37" }}>{roleBadge.label}</b>.
              {owner ? " لديك وصول كامل بصفة مالك المنصة." : " اختر طريقة الدخول المتاحة لك ضمن نطاقك."}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
            <img
              src={MINISTRY_LOGO_URL}
              alt="وزارة التعليم"
              style={{ width: "80px", height: "80px", filter: "drop-shadow(0 8px 18px rgba(212,175,55,0.25))" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            marginTop: 18,
          }}
        >
          {cards.map((card) => <SuperPortalCard key={card.key} card={card} />)}
        </div>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(212, 175, 55, 0.35)",
              border: "1px solid rgba(212,175,55,0.5)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 16px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
            }}
          >
            تسجيل الخروج
          </button>
        </div>

        <div style={{ marginTop: 18, color: "rgba(255,255,255,0.70)", fontSize: 14 }}>
          مرحبًا <span style={{ color: "#d4af37", fontWeight: 800 }}>{displayName}</span>.
          <span style={{ marginInlineStart: 8 }}>{roleLabel}</span>
        </div>
      </div>
    </div>
  );
}
