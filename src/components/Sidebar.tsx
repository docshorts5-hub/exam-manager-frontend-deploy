// src/components/Sidebar.tsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";
const GOLD_GLOW_STRONG = "rgba(212, 175, 55, 0.85)";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation(); // ← لتحديد الصفحة الحالية

  // القائمة بدون أي تحديد ثابت (highlight: true) محذوفة
  const sidebarItems = [
    { title: "لوحة التحكم", icon: "📊", to: "/", active: location.pathname === "/" },
    { title: "لوحة المدير", icon: "🛡️", to: "/admin", active: location.pathname === "/admin" },
    { title: "الكادر التعليمي", icon: "👨‍🏫", to: "/teachers", active: location.pathname === "/teachers" },
    { title: "جدول الامتحانات", icon: "📅", to: "/exams", active: location.pathname === "/exams" },
    { title: "توزيع المهام", icon: "🔄", to: "/distribution", active: location.pathname === "/distribution" },
    { title: "أرشيف التوزيعات", icon: "📁", to: "/archive", active: location.pathname === "/archive" },
    { title: "التقارير والكشوفات", icon: "📈", to: "/report", active: location.pathname === "/report" },
    { title: "قاعدة البيانات", icon: "💾", to: "/sync", active: location.pathname === "/sync" },
  ];

  return (
    <aside
      style={{
        width: "300px",
        background: "rgba(15, 23, 42, 0.94)",
        backdropFilter: "blur(14px)",
        borderLeft: "1px solid rgba(212,175,55,0.3)",
        boxShadow: "0 0 50px rgba(0,0,0,0.8)",
        height: "100vh",
        position: "fixed",
        right: 0,
        top: 0,
        overflowY: "auto",
        padding: "2rem 1.2rem",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* الشعار - دائرة شفافة تمامًا */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          style={{
            width: "110px",
            height: "110px",
            margin: "0 auto",
            borderRadius: "50%",
            border: "3px solid rgba(212,175,55,0.4)", // حدود خفيفة فقط
            background: "transparent", // ← شفافة 100%
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(212,175,55,0.3)",
          }}
        >
          <img
            src={LOGO_URL}
            alt="شعار"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              objectFit: "contain",
            }}
          />
        </div>
        <h3 style={{ margin: "1.2rem 0 0.4rem", fontSize: "1.6rem", color: "#d4af37", fontWeight: 900 }}>
          نظام الامتحانات
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "1rem" }}>
          admin • v2.5 BETA
        </p>
      </div>

      {/* القائمة - تحديد أصفر فقط على الصفحة الحالية */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {sidebarItems.map((item) => (
          <button
            key={item.title}
            onClick={() => navigate(item.to)}
            style={{
              padding: "1.3rem 1.5rem",
              borderRadius: "16px",
              background: item.active
                ? "linear-gradient(145deg, #d4af37, #b8860b)"  // تحديد أصفر للصفحة الحالية فقط
                : "linear-gradient(145deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))",
              border: item.active ? "2px solid #d4af37" : "1px solid rgba(212,175,55,0.3)",
              color: item.active ? "#0f172a" : "#e2e8f0",
              fontWeight: item.active ? 900 : 700,
              fontSize: "1.15rem",
              textAlign: "right",
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              boxShadow: item.active
                ? "0 12px 35px rgba(212,175,55,0.7), inset 0 3px 10px rgba(255,255,255,0.25)"
                : "0 8px 25px rgba(0,0,0,0.6), inset 0 2px 8px rgba(255,255,255,0.12)",
              transform: item.active ? "translateY(-5px) scale(1.03)" : "translateY(0)",
            }}
            onMouseEnter={(e) => {
              if (!item.active) {
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(212,175,55,0.25), rgba(212,175,55,0.08))";
                e.currentTarget.style.boxShadow = "0 16px 50px rgba(212,175,55,0.8), 0 0 40px rgba(212,175,55,0.6)";
                e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                e.currentTarget.style.color = "#d4af37";
              }
            }}
            onMouseLeave={(e) => {
              if (!item.active) {
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))";
                e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.6)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.color = "#e2e8f0";
              }
            }}
          >
            <span style={{ fontSize: "1.6rem" }}>{item.icon}</span>
            {item.title}
          </button>
        ))}
      </nav>

      {/* زر تسجيل الخروج */}
      <div style={{ marginTop: "auto", paddingTop: "2.5rem", borderTop: "1px solid rgba(212,175,55,0.2)" }}>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
          }}
          style={{
            width: "100%",
            padding: "1.3rem",
            background: "linear-gradient(145deg, rgba(239,68,68,0.3), rgba(220,38,38,0.15))",
            color: "#fca5a5",
            border: "1.5px solid #ef4444",
            borderRadius: "16px",
            fontSize: "1.15rem",
            fontWeight: 900,
            cursor: "pointer",
            transition: "all 0.4s ease",
            boxShadow: "0 10px 30px rgba(239,68,68,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.8rem",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 15px 45px rgba(239,68,68,0.7), 0 0 35px rgba(239,68,68,0.6)";
            e.currentTarget.style.transform = "translateY(-4px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 10px 30px rgba(239,68,68,0.4)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🚪</span>
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}