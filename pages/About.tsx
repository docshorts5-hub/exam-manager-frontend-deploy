// src/pages/About.tsx
import React from "react";

const glass: React.CSSProperties = {
  background: "rgba(20, 28, 45, 0.55)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 15px 50px rgba(0,0,0,0.55)",
  borderRadius: 24,
};

const glowGold = "0 0 25px rgba(255, 190, 0, 0.35), 0 0 60px rgba(255,190,0,0.15)";

export default function About() {
  return (
    <div
      style={{
        direction: "rtl",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 15% 20%, #1b2438 0%, #0d1324 45%, #070b16 100%)",
        color: "#e6edf7",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ================= HEADER ================= */}
      <header
        style={{
          margin: "28px auto 0",
          width: "92%",
          maxWidth: 1450,
          padding: "22px 34px",
          borderRadius: 28,
          background: "linear-gradient(135deg, #7c3aed, #d946ef)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 25px 70px rgba(168,85,247,0.5)",
          animation: "fadeIn 0.8s ease",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              background: "rgba(255,255,255,0.15)",
              display: "grid",
              placeItems: "center",
              fontSize: 26,
              boxShadow: glowGold,
            }}
          >
            ⚙️
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>
              مصمم البرنامج
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              الهندسة البرمجية والتطوير التقني
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: glowGold,
          }}
        >
          v2.5.0 (Beta)
        </div>
      </header>

      {/* ================= LAYOUT ================= */}
      <div
        style={{
          width: "92%",
          maxWidth: 1450,
          margin: "36px auto",
          display: "flex",
          gap: 36,
          flexWrap: "wrap",
        }}
      >
        {/* ============ PROFILE CARD ============ */}
        <div
          style={{
            ...glass,
            width: 360,
            padding: "32px 24px",
            textAlign: "center",
            transition: "0.4s",
            boxShadow: glowGold,
          }}
        >
          <div
            style={{
              width: 150,
              height: 150,
              margin: "0 auto",
              borderRadius: "50%",
              padding: 5,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              boxShadow: glowGold,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: "#0d1324",
                display: "grid",
                placeItems: "center",
                fontSize: 70,
              }}
            >
              👨‍💻
            </div>
          </div>

          <div style={{ marginTop: 20, fontSize: 24, fontWeight: 900, color: "#fff" }}>
            يوسف راشد النعماني
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "6px 18px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              color: "#111",
              fontWeight: 800,
              display: "inline-block",
              boxShadow: glowGold,
            }}
          >
            Full Stack Developer
          </div>

          <p style={{ marginTop: 16, fontSize: 14, opacity: 0.85, lineHeight: 1.8 }}>
            متخصص في بناء الأنظمة الذكية وأتمتة العمليات التعليمية باستخدام أحدث
            تقنيات الويب والذكاء الاصطناعي.
          </p>

          <button
            style={{
              marginTop: 22,
              width: "100%",
              padding: "14px",
              borderRadius: 16,
              border: "none",
              fontWeight: 800,
              background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
              cursor: "pointer",
              boxShadow: glowGold,
              transition: "0.3s",
            }}
          >
            العودة للوحة التحكم
          </button>
        </div>

        {/* ============ RIGHT SIDE ============ */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 18 }}>
            البيانات الوظيفية
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
            }}
          >
            {[
              ["🏫", "المدرسة الحالية", "مدرسة عزان بن تميم"],
              ["🏢", "جهة العمل", "المديرية العامة للتعليم بمحافظة شمال الشرقية"],
              ["📞", "التواصل", "97760020"],
              ["💼", "المسمى الوظيفي", "فني مختبرات مدارس"],
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  ...glass,
                  padding: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "0.3s",
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                    boxShadow: glowGold,
                  }}
                >
                  {item[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, opacity: 0.6 }}>{item[1]}</div>
                  <div style={{ fontWeight: 800 }}>{item[2]}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ============ SYSTEM SECTION ============ */}
          <div style={{ ...glass, marginTop: 40, padding: 30, position: "relative" }}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
              لمحة عن النظام
            </div>

            <p style={{ lineHeight: 1.9, fontSize: 15, opacity: 0.9 }}>
              تم تطوير هذا النظام لتسهيل عمليات توزيع المراقبة المدرسية بشكل عادل
              وذكي، مع مراعاة كافة اللوائح والأنظمة المعمول بها، بالاعتماد على
              خوارزميات ذكية تقلل الأخطاء البشرية.
            </p>

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["Gemini AI", "Supabase", "Tailwind", "TypeScript", "React"].map(
                (tech) => (
                  <div
                    key={tech}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      background: "rgba(255,190,0,0.1)",
                      border: "1px solid rgba(255,190,0,0.4)",
                      fontSize: 13,
                    }}
                  >
                    {tech}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
