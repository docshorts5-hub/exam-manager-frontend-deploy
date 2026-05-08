import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCan, type Capability } from "../auth/permissions";
import { isPlatformOwner, resolvePrimaryRoleLabel } from "../features/authz";

const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";
const LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const TITLES: Record<string, string> = {
  "/": "لوحة التحكم",
  "/teachers": "بيانات الكادرالتعليمي",
  "/exams": "جدول الامتحانات",
  "/rooms": "القاعات",
  "/room-blocks": "حظر القاعات",
  "/TaskDistributionRun": "توزيع المهام",
  "/TaskDistributionResults": "جدول التوزيع الشامل",
  "/settings": "الإعدادات",
  "/report": "التقارير والكشوفات",
  "/run-details": "تفاصيل التوزيع",
  "/archive": "الأرشيف",
  "/audit": "سجل التدقيق",
  "/sync": "المزامنة",
  "/unavailability": "عدم التوفر",
};

type SidebarItem = {
  to: string;
  label: string;
  icon: string;
  capability?: Capability;
  requireOwner?: boolean;
};

export default function AppLayout() {
  const auth = useAuth() as any;
  const { can, snapshot } = useCan();
  const location = useLocation();
  const title = TITLES[location.pathname] ?? "النظام";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const isOwner = isPlatformOwner(snapshot);
  const displayName =
    String(auth?.userProfile?.displayName || "").trim() ||
    (auth?.userProfile?.email ? String(auth.userProfile.email).split("@")[0] : "") ||
    "مستخدم";
  const roleLabel = auth?.primaryRoleLabel || resolvePrimaryRoleLabel(snapshot);

  const SIDEBAR_WIDTH = sidebarCollapsed ? 80 : 260;

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const items: SidebarItem[] = [
      { to: "/", label: "لوحة التحكم", icon: "▦" },
      { to: "/run-details", label: "لوحة المدير", icon: "🛡️", capability: "SYSTEM_ADMIN" },
      { to: "/teachers", label: "الكادر التعليمي", icon: "👥", capability: "TEACHERS_MANAGE" },
      { to: "/exams", label: "جدول الامتحانات", icon: "📅", capability: "EXAMS_MANAGE" },
      { to: "/distribution", label: "توزيع المهام", icon: "🔀", capability: "DISTRIBUTION_RUN" },
      { to: "/archive", label: "أرشيف التوزيعات", icon: "📦", capability: "ARCHIVE_MANAGE" },
      { to: "/report", label: "التقارير والكشوفات", icon: "📊", capability: "REPORTS_VIEW" },
      { to: "/sync", label: "قاعدة البيانات", icon: "🗄️", capability: "SYNC_ADMIN" },
      { to: "/migrate", label: "ترحيل البيانات", icon: "🧩", requireOwner: true },
    ];

    return items.filter((item) => {
      if (item.requireOwner) return isOwner;
      if (!item.capability) return true;
      return can(item.capability);
    });
  }, [can, isOwner]);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes goldShine {
        0% { left: -100%; }
        100% { left: 100%; }
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "row-reverse",
        background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        color: "#fff",
        direction: "rtl",
      }}
    >
      <aside
        style={{
          width: SIDEBAR_WIDTH,
          transition: "width 0.35s ease",
          background: "rgba(2,6,23,0.85)",
          backdropFilter: "blur(14px)",
          borderLeft: isOwner ? `1px solid ${GOLD_GLOW}` : "1px solid rgba(255,255,255,.06)",
          padding: "20px 14px",
          position: "fixed",
          inset: "0 0 0 auto",
          boxSizing: "border-box",
          zIndex: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: sidebarCollapsed ? "center" : "space-between", alignItems: "center" }}>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: GOLD_DARK }}>نظام الامتحانات</div>
              <div style={{ fontSize: 12, opacity: 0.75, color: isOwner ? "#f8dd7a" : "#cbd5e1" }}>
                {isOwner ? "واجهة مالك المنصة" : "واجهة تشغيلية"}
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.05)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {sidebarCollapsed ? "⇤" : "⇥"}
          </button>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 18,
            background: isOwner ? "linear-gradient(135deg, rgba(212,175,55,.16), rgba(255,255,255,.04))" : "rgba(255,255,255,.05)",
            border: isOwner ? `1px solid ${GOLD_GLOW}` : "1px solid rgba(255,255,255,.08)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: isOwner ? `linear-gradient(135deg, ${GOLD_DARK}, #e8c670)` : "linear-gradient(135deg, #7c3aed, #60a5fa)",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              color: isOwner ? "#020617" : "#fff",
              fontSize: 20,
              boxShadow: isOwner ? `0 0 15px ${GOLD_GLOW}` : "0 0 12px rgba(96,165,250,.35)",
            }}
          >
            {displayName.slice(0, 1).toUpperCase() || "U"}
          </div>
          {!sidebarCollapsed && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, color: isOwner ? GOLD_DARK : "#fff" }}>{displayName}</div>
              <div style={{ fontSize: 13, opacity: 0.85, color: isOwner ? "#e8c670" : "#cbd5e1" }}>{roleLabel}</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {sidebarItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  padding: sidebarCollapsed ? "16px" : "14px 18px",
                  borderRadius: 16,
                  background: active ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.05)",
                  border: active ? `1px solid rgba(212,175,55,0.5)` : "1px solid rgba(255,255,255,0.08)",
                  color: active ? GOLD_DARK : "#e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  textDecoration: "none",
                  fontWeight: active ? 800 : 600,
                  transition: "all 0.3s ease",
                  boxShadow: active ? `0 0 15px ${GOLD_GLOW}` : "none",
                }}
              >
                <span style={{ fontSize: 24 }}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <button
          style={{
            padding: "14px 18px",
            borderRadius: 16,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            gap: 14,
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
            cursor: "pointer",
          }}
          onClick={() => (typeof auth?.logout === "function" ? auth.logout() : window.location.assign("/login"))}
        >
          <span style={{ fontSize: 22 }}>🚪</span>
          {!sidebarCollapsed && <span>تسجيل خروج</span>}
        </button>
      </aside>

      <div
        style={{
          marginRight: SIDEBAR_WIDTH,
          width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
          transition: "all 0.35s ease",
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
          padding: "26px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1000,
            background: "rgba(2,6,23,0.96)",
            backdropFilter: "blur(20px)",
            border: isScrolled ? `1px solid ${GOLD_GLOW}` : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 24,
            padding: "18px 22px",
            boxShadow: isScrolled ? `0 0 18px ${GOLD_GLOW}` : "0 12px 24px rgba(0,0,0,.25)",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={LOGO_URL} alt="logo" style={{ width: 48, height: 48, borderRadius: 14, objectFit: "cover" }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: GOLD_DARK }}>{title}</div>
                <div style={{ fontSize: 13, opacity: 0.75, color: "#cbd5e1" }}>
                  {isOwner ? "صلاحيات كاملة بصفة مالك المنصة" : roleLabel}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "8px 12px", borderRadius: 14, background: "rgba(255,255,255,.06)", border: `1px solid ${isOwner ? GOLD_GLOW : "rgba(255,255,255,.08)"}` }}>
                {isOwner ? "مالك المنصة" : roleLabel}
              </span>
            </div>
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
