import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCan, type Capability } from "../auth/permissions";
import { isPlatformOwner, resolvePrimaryRoleLabel } from "../features/authz";
import { useTenant } from "../tenant/TenantContext";

type MenuItem = {
  to: string;
  label: string;
  icon: string;
  capability?: Capability;
  requireOwner?: boolean;
  matchPrefix?: boolean;
  absolute?: boolean;
};

function Icon({ name }: { name: string }) {
  const common: React.SVGProps<SVGSVGElement> = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (name) {
    case "grid":
      return <svg {...common}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "users-cog":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8l.8 1.4 1.6.3-1.1 1.2.2 1.6L19 12l-1.5.5.2-1.6-1.1-1.2 1.6-.3L19 8z" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "wand":
      return <svg {...common}><path d="M15 4l5 5" /><path d="M13 6l5 5" /><path d="M2 22l10-10" /><path d="M4 20l10-10" /><path d="M11 3l1-1" /><path d="M21 13l1-1" /><path d="M3 11l-1 1" /><path d="M13 21l-1 1" /></svg>;
    case "archive":
      return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>;
    case "file":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
    case "db":
      return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" /><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></svg>;
    case "check-square":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 12l2 2 4-4" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case "chev":
      return <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>;
    case "logout":
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

function stripTenantPrefix(pathname: string) {
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts[0] === "t" && parts[1]) {
    const rest = parts.slice(2).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname;
}

function isActivePath(pathname: string, item: MenuItem) {
  const current = stripTenantPrefix(pathname);
  if (item.to === "/") return current === "/" || pathname === "/";
  if (item.matchPrefix) return current === item.to || current.startsWith(item.to + "/");
  return current === item.to || pathname === item.to;
}

function resolveTenantPath(tenantId: string, to: string, absolute?: boolean) {
  if (absolute) return to;
  const safeTenantId = String(tenantId || "").trim();
  if (!safeTenantId) return to;
  if (to === "/") return `/t/${safeTenantId}`;
  return `/t/${safeTenantId}${to.startsWith("/") ? to : `/${to}`}`;
}

export default function RightSidebar() {
  const nav = useNavigate();
  const loc = useLocation();
  const auth = useAuth() as any;
  const { tenantId: tenantFromContext } = useTenant() as any;
  const { can, snapshot } = useCan();
  const [collapsed, setCollapsed] = useState(false);

  const isOwner = isPlatformOwner(snapshot);
  const tenantId = String(tenantFromContext || auth?.effectiveTenantId || auth?.userProfile?.tenantId || snapshot?.tenantId || "").trim();
  const displayName = String(auth?.userProfile?.displayName || auth?.user?.displayName || auth?.user?.email || "مستخدم").trim();
  const primaryRoleLabel = auth?.primaryRoleLabel || resolvePrimaryRoleLabel(snapshot);

  const menu = useMemo<MenuItem[]>(() => ([
    { to: "/", label: "لوحة التحكم", icon: "grid" },
    { to: "/run-details", label: "لوحة المدير", icon: "shield", capability: "SYSTEM_ADMIN" },
    { to: "/teachers", label: "الكادر التعليمي", icon: "users", capability: "TEACHERS_MANAGE" },
    { to: "/team-members", label: "فريق العمل والصلاحيات", icon: "users-cog", capability: "USERS_MANAGE" },
    { to: "/exams", label: "جدول الامتحانات", icon: "calendar", capability: "EXAMS_MANAGE" },
    { to: "/task-distribution", label: "توزيع المهام", icon: "wand", capability: "DISTRIBUTION_RUN", matchPrefix: true },
    { to: "/task-distribution/run", label: "تشغيل التوزيع", icon: "wand", capability: "DISTRIBUTION_RUN" },
    { to: "/task-distribution/results", label: "نتائج التوزيع", icon: "file", capability: "REPORTS_VIEW" },
    { to: "/task-distribution/versions", label: "إصدارات واعتماد التوزيع", icon: "check-square", capability: "ARCHIVE_MANAGE" },
    { to: "/task-distribution/print", label: "طباعة التوزيع", icon: "file", capability: "REPORTS_VIEW" },
    { to: "/archive", label: "أرشيف التوزيعات", icon: "archive", capability: "ARCHIVE_MANAGE" },
    { to: "/report", label: "التقارير والكشوفات", icon: "file", capability: "REPORTS_VIEW" },
    { to: "/sync", label: "قاعدة البيانات", icon: "db", capability: "SYNC_ADMIN" },
    { to: "/system/migrate", label: "ترحيل البيانات", icon: "db", requireOwner: true, absolute: true },
  ]), []);

  const items = menu.filter((item) => {
    if (item.requireOwner) return isOwner;
    if (!item.capability) return true;
    return can(item.capability);
  });

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? 60 : 230,
    transition: "width 0.22s ease",
    height: "100vh",
    position: "fixed",
    top: 0,
    right: 0,
    background: "linear-gradient(180deg, rgba(10,16,32,.96), rgba(8,12,24,.96))",
    borderRight: "1px solid rgba(255,255,255,.08)",
    boxShadow: "-4px 0 30px rgba(0,0,0,0.5)",
    direction: "rtl",
    display: "flex",
    flexDirection: "column",
    padding: "1rem 0.875rem",
    gap: 12,
    zIndex: 1000,
    overflowY: "auto",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: collapsed ? "center" : "space-between",
    alignItems: "center",
    gap: 10,
  };

  const iconBtn: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.06)",
    color: "rgba(255,255,255,.92)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };

  const titleBox: React.CSSProperties = {
    display: "grid",
    gap: 4,
    placeItems: collapsed ? "center" : "start",
    padding: "0.5rem 0.625rem",
    color: "#fff",
  };

  const profile: React.CSSProperties = {
    padding: 12,
    borderRadius: 18,
    border: isOwner ? "1px solid rgba(212,175,55,.38)" : "1px solid rgba(255,255,255,.10)",
    background: isOwner ? "linear-gradient(135deg, rgba(212,175,55,.12), rgba(255,255,255,.05))" : "rgba(255,255,255,.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    gap: 12,
    color: "#fff",
  };

  const avatar: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: isOwner ? "linear-gradient(135deg, #d4af37, #fbbf24)" : "linear-gradient(135deg, #7c3aed, #60a5fa)",
    color: isOwner ? "#18181b" : "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    flexShrink: 0,
  };

  const itemStyle = (active: boolean): React.CSSProperties => ({
    width: "100%",
    padding: collapsed ? "12px" : "12px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.08)",
    background: active ? "linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.05))" : "rgba(255,255,255,.04)",
    color: active ? "#fff" : "rgba(255,255,255,.88)",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    gap: 12,
    textDecoration: "none",
    fontWeight: 800,
    cursor: "pointer",
    outline: "none",
  });

  const doLogout = async () => {
    try {
      const fn = auth?.logout || auth?.signOut || auth?.signout;
      if (typeof fn === "function") {
        await fn();
        return;
      }
      nav("/login");
    } catch {
      nav("/login");
    }
  };

  return (
    <aside style={sidebarStyle}>
      <div style={topRow}>
        <button type="button" style={iconBtn} onClick={() => setCollapsed((v) => !v)}>
          <Icon name="chev" />
        </button>
        {!collapsed && <button type="button" style={iconBtn}><Icon name="bell" /></button>}
      </div>

      <div style={titleBox}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>نظام الامتحانات</div>
        {!collapsed && <div style={{ fontSize: 12, opacity: 0.7 }}>{isOwner ? "منصة المالك" : "وزارة التعليم"}</div>}
      </div>

      <div style={profile}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={avatar}>{displayName.slice(0, 1).toUpperCase() || "U"}</div>
          {!collapsed && (
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 900 }}>{displayName}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{primaryRoleLabel}</div>
            </div>
          )}
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {items.map((m) => {
          const active = isActivePath(loc.pathname, m);
          return (
            <button key={m.to} type="button" style={itemStyle(active)} onClick={() => nav(resolveTenantPath(tenantId, m.to, m.absolute))} title={m.label}>
              {!collapsed && <span style={{ fontSize: 14 }}>{m.label}</span>}
              <span style={{ opacity: 0.95, flexShrink: 0 }}><Icon name={m.icon} /></span>
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <button type="button" style={{ ...itemStyle(false), marginTop: 8, background: "rgba(255,60,60,0.08)", borderColor: "rgba(255,60,60,0.16)" }} onClick={doLogout}>
        {!collapsed && <span>تسجيل خروج</span>}
        <Icon name="logout" />
      </button>
    </aside>
  );
}
