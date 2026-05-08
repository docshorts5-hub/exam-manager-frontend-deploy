// src/layout/Sidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";

function linkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: "block",
    padding: "10px 12px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
    color: isActive ? "#fff" : "rgba(255,255,255,.82)",
    background: isActive ? "linear-gradient(135deg,#6366f1,#a855f7)" : "transparent",
    border: isActive ? "1px solid rgba(255,255,255,.18)" : "1px solid transparent",
  };
}

export default function Sidebar() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>نظام إدارة الامتحانات</div>
      <div style={{ color: "rgba(255,255,255,.65)", marginTop: 6, fontSize: 12 }}>
        توزيع ومتابعة الامتحانات
      </div>

      <div style={{ height: 14 }} />

      <nav style={{ display: "grid", gap: 8 }}>
        <NavLink to="/" style={linkStyle}>لوحة التحكم</NavLink>
        <NavLink to="/teachers" style={linkStyle}>المعلمون</NavLink>
        <NavLink to="/exams" style={linkStyle}>جدول الاختبارات</NavLink>
        <NavLink to="/rooms" style={linkStyle}>القاعات</NavLink>
        <NavLink to="/room-blocks" style={linkStyle}>حظر القاعات</NavLink>
        <NavLink to="/TaskDistributionRun" style={linkStyle}>توزيع المهام</NavLink>
        <NavLink to="/distribution/full-table" style={linkStyle}>الجدول الشامل</NavLink>
        <NavLink to="/report" style={linkStyle}>التقارير</NavLink>
        <NavLink to="/archive" style={linkStyle}>الأرشيف</NavLink>
        <NavLink to="/audit" style={linkStyle}>السجلات</NavLink>
        <NavLink to="/sync" style={linkStyle}>المزامنة</NavLink>
        <NavLink to="/unavailability" style={linkStyle}>الغياب</NavLink>
        <NavLink to="/settings" style={linkStyle}>الإعدادات</NavLink>
      </nav>
    </div>
  );
}
