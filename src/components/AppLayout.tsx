// src/components/AppLayout.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permissions";
import { isPlatformOwner, resolvePrimaryRoleLabel } from "../features/authz";

type Crumb = { label: string; to?: string };

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  direction: "rtl",
  paddingBottom: 60,
  background: `
    radial-gradient(circle at 20% 80%, rgba(255, 215, 0, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(0, 191, 255, 0.15) 0%, transparent 50%),
    linear-gradient(135deg, #0c0e1a 0%, #0f172a 50%, #1e293b 100%)
  `,
  color: "#e2e8f0",
};

const shineKeyframes = `
@keyframes shine {
  0% { transform: translateX(-130%); opacity: 0; }
  10% { opacity: 1; }
  55% { transform: translateX(130%); opacity: 1; }
  100% { transform: translateX(130%); opacity: 0; }
}
`;

const headerStyle = (shrink: boolean): React.CSSProperties => ({
  position: "sticky",
  top: 0,
  zIndex: 50,
  overflow: "hidden",
  background: "linear-gradient(135deg, #f5d76e 0%, #d4af37 35%, #b8860b 100%)",
  borderBottom: "1px solid rgba(255,255,255,0.25)",
  boxShadow: shrink
    ? "0 10px 30px rgba(0,0,0,0.45)"
    : "0 18px 45px rgba(0,0,0,0.35)",
  transition: "all 0.28s ease",
});

const headerInnerStyle = (shrink: boolean): React.CSSProperties => ({
  maxWidth: 1200,
  margin: "0 auto",
  padding: shrink ? "10px 16px" : "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  transition: "all 0.28s ease",
});

const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const logoStyle = (shrink: boolean): React.CSSProperties => ({
  width: shrink ? 38 : 44,
  height: shrink ? 38 : 44,
  borderRadius: 14,
  background: "rgba(255,255,255,0.25)",
  border: "1px solid rgba(255,255,255,0.35)",
  boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
  objectFit: "contain",
  transition: "all 0.28s ease",
});

const appNameStyle = (shrink: boolean): React.CSSProperties => ({
  fontSize: shrink ? 16 : 18,
  fontWeight: 1000,
  color: "#0b1220",
  letterSpacing: 0.2,
  textShadow: "0 1px 0 rgba(255,255,255,0.35)",
  transition: "all 0.28s ease",
});

const appSubStyle = (shrink: boolean): React.CSSProperties => ({
  fontSize: shrink ? 11 : 12,
  fontWeight: 900,
  color: "rgba(11,18,32,0.75)",
  transition: "all 0.28s ease",
});

const modeBadgeStyle = (isSupport: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 14,
  background: isSupport ? "rgba(220,38,38,0.15)" : "rgba(11,18,32,0.18)",
  border: "1px solid rgba(11,18,32,0.25)",
  fontSize: 12,
  fontWeight: 900,
  color: "#0b1220",
});

const headerBadgeStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 14,
  background: "rgba(11,18,32,0.18)",
  border: "1px solid rgba(11,18,32,0.22)",
  color: "#0b1220",
  fontWeight: 900,
  fontSize: 12,
};

const shineOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)",
  transform: "translateX(-100%)",
  animation: "shine 4.5s infinite",
};

const shineSoftGlowStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 55%), radial-gradient(circle at 80% 40%, rgba(255,255,255,0.15), transparent 60%)",
  opacity: 0.75,
};

const topBtnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  fontWeight: 900,
  fontSize: 12,
  border: "1px solid rgba(11,18,32,0.22)",
  background: "rgba(11,18,32,0.18)",
  color: "#0b1220",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const breadWrap: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "12px 16px 0 16px",
};

const breadBox: React.CSSProperties = {
  borderRadius: 16,
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(2,6,23,0.35)",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const crumbLink: React.CSSProperties = {
  color: "#e2e8f0",
  textDecoration: "none",
  fontWeight: 900,
  opacity: 0.9,
};

const crumbCurrent: React.CSSProperties = {
  fontWeight: 1000,
  color: "#fbbf24",
};

function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <div style={breadWrap}>
      <div style={breadBox}>
        {items.map((c, idx) => (
          <React.Fragment key={`${c.label}-${idx}`}>
            {idx > 0 && <span style={{ opacity: 0.6 }}>←</span>}
            {c.to ? (
              <Link to={c.to} style={crumbLink}>
                {c.label}
              </Link>
            ) : (
              <span style={crumbCurrent}>{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function AppLayout({
  title,
  subtitle,
  breadcrumbs,
  children,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs: Crumb[];
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const auth = useAuth() as any;
  const { effectiveTenantId, isSupportMode } = auth;
  const { snapshot } = useCan();
  const isOwner = isPlatformOwner(snapshot);
  const primaryRoleLabel = auth?.primaryRoleLabel || resolvePrimaryRoleLabel(snapshot);

  // shrink header on scroll
  const [shrink, setShrink] = useState(false);
  useEffect(() => {
    const onScroll = () => setShrink(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true } as any);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll as any);
  }, [location.pathname]);

  const tenantLabel = useMemo(() => {
    const t = String(effectiveTenantId ?? "").trim();
    if (!t) return "-";
    if (isOwner && isSupportMode) return `${t} (وضع الدعم)`;
    return t;
  }, [effectiveTenantId, isOwner, isSupportMode]);

  const goSettings = () => {
    const t = String(effectiveTenantId ?? "").trim();
    if (!t) return;
    navigate(`/t/${t}/settings`);
  };

  const doLogout = async () => {
    const ok = window.confirm("هل تريد تسجيل الخروج؟");
    if (!ok) return;

    try {
      // نحاول نستدعي أي دالة خروج موجودة في AuthContext
      const auth: any = useAuth() as any;
      const fn = auth?.logout || auth?.signOut || auth?.signout;

      if (typeof fn === "function") {
        await fn();
        navigate("/login");
        return;
      }

      // fallback: فقط نوديه لصفحة تسجيل الدخول
      navigate("/login");
    } catch (e: any) {
      alert(`تعذر تسجيل الخروج: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle(shrink)}>
        <style>{shineKeyframes}</style>
        <div style={shineSoftGlowStyle} />
        <div style={shineOverlayStyle} />

        <div style={headerInnerStyle(shrink)}>
          <div style={brandStyle}>
            <img
              src={"/logo.png"} // ضع شعارك في public/logo.png
              alt="Logo"
              style={logoStyle(shrink)}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <div style={appNameStyle(shrink)}>{title}</div>
              <div style={appSubStyle(shrink)}>{subtitle ?? ""}</div>
            </div>

            <div style={modeBadgeStyle(isSupportMode)}>
              {isSupportMode ? "🛠 وضع الدعم" : "👤 مستخدم"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={headerBadgeStyle}>
              Tenant: <b>{tenantLabel}</b>
            </div>

            <button style={topBtnStyle} onClick={goSettings}>
              ⚙️ الإعدادات
            </button>
            <button style={topBtnStyle} onClick={doLogout}>
              🚪 خروج
            </button>
          </div>
        </div>
      </header>

      <Breadcrumbs items={breadcrumbs} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 16px 24px 16px" }}>
        {children}
      </div>
    </div>
  );
}
