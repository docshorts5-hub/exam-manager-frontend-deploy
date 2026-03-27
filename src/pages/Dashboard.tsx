import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { subscribeTenantArray } from "../services/tenantData";
import { buildSmartAlerts } from "../services/smartAlerts.service";
import { useI18n } from "../i18n/I18nProvider";
import { tenantPath } from "../config/tenantRoutes";

const SUBS = {
  teachers: "teachers",
  exams: "exams",
  rooms: "rooms",
  roomBlocks: "roomBlocks",
} as const;

const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";

export default function Dashboard() {
  const navigate = useNavigate();
  const { effectiveTenantId, userProfile } = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const tenantId = String(effectiveTenantId || "").trim();
  const go = (path: string) => {
    const p = String(path || "").trim();
    if (!p) return;
    if (!tenantId) {
      navigate("/");
      return;
    }
    navigate(tenantPath(tenantId, p));
  };

  const displayName =
    (userProfile?.displayName || "").trim() ||
    (userProfile?.email ? String(userProfile.email).split("@")[0] : "") ||
    tr("مستخدم", "User");

  const [counts, setCounts] = useState({
    teachers: 0,
    exams: 0,
    rooms: 0,
    blocks: 0,
  });
  const [alertsModel, setAlertsModel] = useState({
    teachers: [] as any[],
    exams: [] as any[],
    rooms: [] as any[],
    roomBlocks: [] as any[],
    examRoomAssignments: [] as any[],
  });

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .dash3DBar {
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        background: linear-gradient(145deg, #111827, #0b1220);
        border: 1px solid rgba(255,215,0,0.18);
        box-shadow:
          0 18px 40px rgba(0,0,0,0.65),
          inset 0 2px 0 rgba(255,255,255,0.05);
      }
      .dash3DBar::before {
        content: "";
        position: absolute;
        top: 0;
        left: -120%;
        width: 60%;
        height: 100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
        transform: skewX(-12deg);
        animation: dashShine 10s infinite;
        pointer-events: none;
      }
      @keyframes dashShine {
        0%, 88% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
        90% { opacity: 1; }
        100% { transform: translateX(240%) skewX(-12deg); opacity: 0.9; }
      }
      .dashStat {
        background: linear-gradient(145deg, rgba(212,175,55,0.14), rgba(212,175,55,0.06));
        border: 1px solid rgba(212,175,55,0.35);
        border-radius: 14px;
        padding: 10px 16px;
        color: ${GOLD_DARK};
        box-shadow:
          0 10px 22px rgba(0,0,0,0.55),
          inset 0 1px 0 rgba(255,255,255,0.05);
      }
      .dashGoldSep {
        width: 2px;
        align-self: stretch;
        background: rgba(184,134,11,0.95);
        box-shadow: 0 0 10px rgba(184,134,11,0.35);
        border-radius: 999px;
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const unsubs = [
      subscribeTenantArray<any>(tenantId, SUBS.teachers, (teachers) => {
        setCounts((prev) => ({ ...prev, teachers: teachers.length }));
        setAlertsModel((prev) => ({ ...prev, teachers }));
      }),
      subscribeTenantArray<any>(tenantId, SUBS.exams, (exams) => {
        setCounts((prev) => ({ ...prev, exams: exams.length }));
        setAlertsModel((prev) => ({ ...prev, exams }));
      }),
      subscribeTenantArray<any>(tenantId, SUBS.rooms, (rooms) => {
        setCounts((prev) => ({ ...prev, rooms: rooms.length }));
        setAlertsModel((prev) => ({ ...prev, rooms }));
      }),
      subscribeTenantArray<any>(tenantId, SUBS.roomBlocks, (roomBlocks) => {
        setCounts((prev) => ({ ...prev, blocks: roomBlocks.length }));
        setAlertsModel((prev) => ({ ...prev, roomBlocks }));
      }),
      subscribeTenantArray<any>(tenantId, "examRoomAssignments", (examRoomAssignments) => {
        setAlertsModel((prev) => ({ ...prev, examRoomAssignments }));
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [tenantId]);

  const quickCards = useMemo(
    () => [
      { num: "01", title: tr("بيانات الكادر التعليمي", "Teachers Data"), sub: tr("إدارة الكادر التعليمي والأنصبة", "Manage teachers and workloads"), to: "/teachers", accent: "#60a5fa", icon: "👨‍🏫" },
      { num: "02", title: tr("جدول الامتحانات", "Exam Schedule"), sub: tr("المواعيد والقاعات والمواضيع", "Dates, rooms, and subjects"), to: "/exams", accent: "#34d399", icon: "📅" },
      { num: "03", title: tr("توزيع المهام", "Task Distribution"), sub: tr("التوزيع الذكي مراقبة واحتياط", "Smart assignment for invigilation and reserve"), to: "/task-distribution/run", accent: "#fbbf24", icon: "🔄" },
      { num: "04", title: tr("التقارير والكشوفات", "Reports & Sheets"), sub: tr("الكشوفات اليومية والرسمية", "Daily and formal reports"), to: "/task-distribution/print", accent: "#f87171", icon: "📊" },
    ],
    [lang]
  );


  const smartAlerts = useMemo(() => buildSmartAlerts(alertsModel), [alertsModel]);

  const longRows = useMemo(
    () => [
      { title: tr("بيانات المدرسة", "School Profile"), sub: tr("الهوية والشعار والإعدادات", "Identity, logo, and settings"), to: "/settings1", icon: "🏫", accent: "#ef4444" },
      { title: tr("مكتبة الصور", "Gallery"), sub: tr("إدارة الشعارات والملفات", "Manage logos and files"), to: "/gallery", icon: "🖼️", accent: "#0ea5e9" },
      { title: tr("مصمم البرنامج", "About Developer"), sub: tr("معلومات المطور والإصدارات", "Developer info and versions"), to: "/about", icon: "🛠️", accent: "#ec4899" },
      { title: tr("قاعدة البيانات", "Database"), sub: tr("النسخ الاحتياطي والاستيراد", "Backup and import tools"), to: "/sync", icon: "💾", accent: "#6366f1" },
      { title: tr("أرشيف التوزيعات", "Distribution Archive"), sub: tr("السجلات المحفوظة والتاريخ", "Saved history and snapshots"), to: "/archive", icon: "📁", accent: "#94a3b8" },
    ],
    [lang]
  );

  return (
    <div
      style={{
        direction: isRTL ? "rtl" : "ltr",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        color: GOLD_DARK,
        padding: window.innerWidth < 768 ? "16px" : "32px",
        boxSizing: "border-box",
      }}
    >
      <div className="dash3DBar" style={{ padding: 16, marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => go("/task-distribution")}
              style={{
                padding: "12px 20px",
                borderRadius: 16,
                background: "linear-gradient(135deg, #4f46e5dd, #7c3aeddd)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.12)",
                fontWeight: 800,
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 14px 0 rgba(0,0,0,0.22), 0 18px 45px rgba(79,70,229,0.35)",
              }}
            >
              <span style={{ fontSize: 20 }}>▦</span>
              {tr("توزيع المهام", "Task Distribution")}
            </button>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,215,0,0.28)",
                background: "rgba(255,215,0,0.08)",
                color: "#ffd700",
                fontWeight: 800,
              }}
            >
              {tr("مرحباً", "Welcome")}, <b>{displayName}</b>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="dashStat">{tr("الكادر التعليمي", "Teachers")} <strong>{counts.teachers}</strong></div>
            <div className="dashGoldSep" />
            <div className="dashStat">{tr("الامتحانات", "Exams")} <strong>{counts.exams}</strong></div>
            <div className="dashGoldSep" />
            <div className="dashStat">{tr("القاعات", "Rooms")} <strong>{counts.rooms}</strong></div>
            <div className="dashGoldSep" />
            <div className="dashStat">{tr("حظر قاعات", "Room blocks")} <strong>{counts.blocks}</strong></div>
          </div>
        </div>
      </div>

      <div style={{
        display: "grid",
        gap: 14,
        marginBottom: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: GOLD_DARK, textShadow: `0 0 14px ${GOLD_GLOW}` }}>{tr("التنبيهات الذكية المباشرة", "Live smart alerts")}</h2>
          <button onClick={() => go("/audit")} style={{ padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(255,215,0,0.25)", background: "rgba(255,215,0,0.08)", color: "#ffd700", fontWeight: 800, cursor: "pointer" }}>{tr("سجل العمليات", "Audit log")}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {smartAlerts.map((alert) => {
            const tone = alert.level === "critical" ? "#ef4444" : alert.level === "warning" ? "#f59e0b" : alert.level === "success" ? "#22c55e" : "#38bdf8";
            return (
              <button key={alert.id} onClick={() => go(alert.route || "/analytics")} style={{ textAlign: isRTL ? "right" : "left", background: "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(2,6,23,0.96))", border: `1px solid ${tone}55`, borderRadius: 24, padding: 18, color: "#f8e7a8", boxShadow: "0 14px 34px rgba(0,0,0,0.45)", cursor: "pointer" }}>
                <div style={{ color: tone, fontWeight: 900, marginBottom: 8 }}>{alert.title}</div>
                <div style={{ color: "#e5e7eb", lineHeight: 1.8 }}>{alert.message}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28, marginBottom: 56 }}>
        {quickCards.map((card) => (
          <button
            key={card.to}
            onClick={() => go(card.to)}
            style={{
              height: 180,
              borderRadius: 32,
              padding: "32px 36px",
              background: `linear-gradient(145deg, ${card.accent}22, ${card.accent}0a)`,
              border: `1px solid ${card.accent}55`,
              boxShadow: `0 20px 55px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 30px ${card.accent}40`,
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              position: "relative",
              overflow: "hidden",
              backdropFilter: "blur(10px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-16px) scale(1.06)";
              e.currentTarget.style.boxShadow = `0 40px 90px rgba(0,0,0,0.75), 0 0 80px ${card.accent}80`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = `0 20px 55px rgba(0,0,0,0.6), 0 0 30px ${card.accent}40`;
            }}
          >
            <div style={{ position: "absolute", top: 20, right: isRTL ? 32 : undefined, left: !isRTL ? 32 : undefined, fontSize: 90, fontWeight: 900, opacity: 0.09, color: GOLD_DARK }}>
              {card.num}
            </div>

            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", textAlign: isRTL ? "right" : "left" }}>
              <div>
                <div style={{ fontSize: 44, marginBottom: 12, color: GOLD_DARK, textShadow: `0 0 12px ${GOLD_GLOW}` }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 23, fontWeight: 800, marginBottom: 10, color: GOLD_DARK, textShadow: `0 0 10px ${GOLD_GLOW}` }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 15, color: "#e8c670", opacity: 0.9 }}>{card.sub}</div>
              </div>
              <div style={{ alignSelf: isRTL ? "flex-end" : "flex-start", fontSize: 40, opacity: 0.55, color: GOLD_DARK }}>{isRTL ? "←" : "→"}</div>
            </div>
          </button>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: 24, fontWeight: 900, textAlign: "center", marginBottom: 28, color: GOLD_DARK, textShadow: `0 0 14px ${GOLD_GLOW}` }}>
          {tr("الإعدادات والسجلات", "Settings & Records")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(390px, 1fr))", gap: 24 }}>
          {longRows.map((item) => (
            <button
              key={item.title}
              onClick={() => go(item.to)}
              style={{
                height: 120,
                borderRadius: 26,
                padding: "0 32px",
                background: "rgba(30,41,59,0.68)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 16px 45px rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                gap: 28,
                cursor: "pointer",
                transition: "all 0.32s ease",
                backdropFilter: "blur(12px)",
                flexDirection: isRTL ? "row" : "row",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-9px)";
                e.currentTarget.style.boxShadow = "0 30px 80px rgba(0,0,0,0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 16px 45px rgba(0,0,0,0.55)";
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 20,
                  background: `${item.accent}22`,
                  color: item.accent,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 32,
                  border: `1px solid ${item.accent}60`,
                  boxShadow: `0 10px 25px ${item.accent}40`,
                }}
              >
                {item.icon}
              </div>
              <div style={{ flex: 1, textAlign: isRTL ? "right" : "left" }}>
                <div style={{ fontWeight: 700, fontSize: 18.5, color: GOLD_DARK, textShadow: `0 0 9px ${GOLD_GLOW}` }}>{item.title}</div>
                <div style={{ fontSize: 14.5, color: "#e8c670", opacity: 0.9, marginTop: 6 }}>{item.sub}</div>
              </div>
              <div style={{ fontSize: 32, opacity: 0.6, color: GOLD_DARK }}>{isRTL ? "←" : "→"}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 120 }} />
    </div>
  );
}
