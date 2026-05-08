import React, { useEffect, useMemo } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../auth/AuthContext";

const LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

export default function BrandedHeader({
  pageTitle,
  hint,
}: {
  pageTitle: string;
  hint?: string;
}) {
  const { lang, isRTL } = useI18n();
  const auth = useAuth() as any;

  const appName =
    lang === "ar" ? "نظام إدارة الامتحانات المطور" : "Advanced Exam Management System";

  const sessionSchoolName = useMemo(() => {
    return (
      String(auth?.effectiveAllow?.schoolName || "").trim() ||
      String(auth?.profile?.schoolName || "").trim() ||
      String(auth?.userProfile?.schoolName || "").trim() ||
      String(auth?.profile?.name || "").trim() ||
      String(auth?.userProfile?.displayName || "").trim() ||
      "المدرسة غير محددة"
    );
  }, [
    auth?.effectiveAllow?.schoolName,
    auth?.profile?.schoolName,
    auth?.userProfile?.schoolName,
    auth?.profile?.name,
    auth?.userProfile?.displayName,
  ]);

  const sessionEmail = useMemo(() => {
    return (
      String(auth?.user?.email || "").trim() ||
      String(auth?.effectiveAllow?.email || "").trim() ||
      String(auth?.profile?.email || "").trim() ||
      "لا يوجد بريد إلكتروني"
    );
  }, [auth?.user?.email, auth?.effectiveAllow?.email, auth?.profile?.email]);

  const sessionGovernorate = useMemo(() => {
    return (
      String(auth?.effectiveAllow?.governorate || "").trim() ||
      String(auth?.profile?.governorate || "").trim() ||
      "غير محددة"
    );
  }, [auth?.effectiveAllow?.governorate, auth?.profile?.governorate]);

  useEffect(() => {
    const id = "branded-header-animations";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      @keyframes goldGlow {
        0% { box-shadow: 0 0 14px rgba(184,134,11,0.55), 0 14px 28px rgba(0,0,0,0.55); }
        50% { box-shadow: 0 0 32px rgba(255,215,0,0.65), 0 16px 34px rgba(0,0,0,0.62); }
        100% { box-shadow: 0 0 14px rgba(184,134,11,0.55), 0 14px 28px rgba(0,0,0,0.55); }
      }

      @keyframes shineSweep {
        0% { transform: translateX(-120%) skewX(-12deg); }
        100% { transform: translateX(220%) skewX(-12deg); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 900, marginBottom: 14 }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          background: "linear-gradient(180deg, #6e5200 0%, #7a5c00 35%, #4a3600 100%)",
          border: "1px solid rgba(255, 215, 128, 0.35)",
          borderBottom: "3px solid rgba(0,0,0,0.35)",
          padding: "16px 18px",
          animation: "goldGlow 4s infinite",
          boxShadow:
            "0 10px 18px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -6px 10px rgba(0,0,0,0.35)",
          direction: isRTL ? "rtl" : "ltr",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "-120%",
            width: "55%",
            height: "100%",
            background:
              "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
            animation: "shineSweep 5.5s infinite",
            pointerEvents: "none",
            opacity: 0.9,
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              justifyContent: isRTL ? "flex-start" : "flex-start",
            }}
          >
            <img
              src={LOGO_URL}
              alt="logo"
              style={{
                width: 90,
                height: 90,
                objectFit: "contain",
                filter: "drop-shadow(0 0 14px rgba(255,215,0,0.7))",
                flex: "0 0 auto",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />

            <div
              style={{
                display: "grid",
                gap: 4,
                minWidth: 220,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              <div
                style={{
                  fontSize: 35,
                  fontWeight: 900,
                  letterSpacing: 0.2,
                  color: "#fff1c4",
                  textShadow: "0 2px 0 rgba(0,0,0,0.35)",
                }}
              >
                {appName}
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#ffffff",
                  textShadow: "0 2px 0 rgba(0,0,0,0.35)",
                }}
              >
                {pageTitle}
              </div>

              {hint ? (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 13,
                    color: "#ffecbd",
                    opacity: 0.96,
                    textShadow: "0 2px 0 rgba(0,0,0,0.35)",
                  }}
                >
                  {hint}
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              minWidth: 290,
              display: "grid",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(0,0,0,0.20)",
              border: "1px solid rgba(255, 232, 176, 0.24)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#fff7db",
                lineHeight: 1.3,
              }}
            >
              {sessionSchoolName}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#f8f1cf",
                opacity: 0.95,
                wordBreak: "break-word",
              }}
            >
              {sessionEmail}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                width: "fit-content",
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff1c4",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              <span>{lang === "ar" ? "المحافظة" : "Governorate"}</span>
              <span style={{ opacity: 0.88 }}>{sessionGovernorate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
