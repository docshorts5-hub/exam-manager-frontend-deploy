// src/components/AppShell.tsx

import React from "react";

type Props = {
  title?: string;
  children: React.ReactNode;
};

export default function AppShell({ title, children }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",            // خلفية داكنة ثابتة نظيفة (حذف التدرج البنفسجي/الأزرق تماماً)
        direction: "rtl",                 // RTL لكل التطبيق
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header بسيط واختياري (ذهبي متناسق مع تصميمك) */}
      {title && (
        <header
          style={{
            padding: "16px 32px",
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(12px)",
            color: "#d4af37",               // لون ذهبي غامق
            fontSize: 22,
            fontWeight: 900,
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            borderBottom: "1px solid rgba(212,175,55,0.15)",
          }}
        >
          {title || "نظام إدارة الامتحانات المطور"}
        </header>
      )}

      {/* المحتوى الرئيسي (Dashboard وكل الصفحات الأخرى) */}
      <main style={{ flex: 1, padding: "24px 32px", boxSizing: "border-box" }}>
        {children}
      </main>
    </div>
  );
}
