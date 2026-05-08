import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import { callFn } from "../services/functionsClient";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  resolveHomePath,
  resolvePrimaryRoleLabel,
  resolveRoleBadgeStyle,
} from "../features/authz";
import { useI18n } from "../i18n/I18nProvider";

// ضع صورة الخلفية في هذا المسار:
// src/assets/login-bg.png

// Default to disabling Cloud Functions unless explicitly enabled.
const DISABLE_FUNCTIONS =
  String(import.meta.env.VITE_DISABLE_FUNCTIONS ?? "true") === "true";

type AllowlistDoc = {
  email: string;
  enabled: boolean;
  role: "super_admin" | "ministry_super" | "super" | "exam_super" | "tenant_admin" | "admin" | "user";
  tenantId: string;
};

type Lang = "ar" | "en";

const STR = {
  ar: {
    title: "نظام الامتحانات المدرسية المطور",
    subtitle: "تسجيل دخول أمن للمستخدمين المصرح لهم فقط",
    ministry: "سلطنة عمان - وزارة التعليم",
    signIn: "Google تسجيل الدخول بواسطة",
    signedInAs: "تم تسجيل الدخول:",
    status: "الحالة:",
    active: "مفعّل ✅",
    inactive: "غير مفعّل",
    inactiveHint: "(غير موجود في allowlist أو enabled=false)",
    tenant: "الجهة:",
    role: "الصلاحية:",
    refresh: "تحديث الصلاحيات",
    logout: "تسجيل خروج",
    loading: "جاري المعالجة...",
    okGo: "الانتقال للنظام",
    footer: "© جميع الحقوق محفوظة",
    developer: "المطور المعتمد",
    teacher: "الأستاذ: يوسف النعماني",
    errPopupClosed: "تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية.",
    errNotAllowed: "تم تسجيل الدخول لكن حسابك غير مفعّل من مدير النظام.",
    errGeneric: "حدث خطأ. تأكد من إعدادات Firebase وجرّب مرة أخرى.",
  },
  en: {
    title: "Enhanced School Exam System",
    subtitle: "Secure login for authorized users only",
    ministry: "Sultanate of Oman - Ministry of Education",
    signIn: "Sign in with Google",
    signedInAs: "Signed in as:",
    status: "Status:",
    active: "Active ✅",
    inactive: "Inactive",
    inactiveHint: "(Not in allowlist or enabled=false)",
    tenant: "Tenant:",
    role: "Role:",
    refresh: "Refresh permissions",
    logout: "Sign out",
    loading: "Processing...",
    okGo: "Go to app",
    footer: "© All rights reserved",
    developer: "Certified Developer",
    teacher: "Teacher: Youssef Al-Numani",
    errPopupClosed: "Login popup closed before completing.",
    errNotAllowed: "Signed in, but your account is not enabled by the admin.",
    errGeneric: "Something went wrong. Check Firebase setup and try again.",
  },
} as const;

async function fetchAllowlist(email: string): Promise<AllowlistDoc | null> {
  const key = String(email || "").trim().toLowerCase();
  const ref = doc(db, "allowlist", key);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data() as Partial<AllowlistDoc>;

  if (!data.email) data.email = key;
  if (typeof data.enabled !== "boolean") data.enabled = false;

  const r = String((data as any).role ?? "user").trim().toLowerCase();

  if (email.trim().toLowerCase() === "3asal2030@gmail.com") {
    (data as any).role = "super_admin";
    (data as any).enabled = true;
  } else if (r === "super_admin" || r === "super admin" || r === "superadmin") {
    (data as any).role = "super_admin";
  } else if (r === "ministry_super" || r === "ministry super" || r === "ministry-super") {
    (data as any).role = "ministry_super";
  } else if (r === "super") {
    (data as any).role = "super";
  } else if (r === "exam_super" || r === "exam super" || r === "exam-super" || r === "super_exam" || r === "super-exam") {
    (data as any).role = "exam_super";
  } else if (r === "tenant_admin" || r === "tenant admin" || r === "tenant-admin") {
    (data as any).role = "tenant_admin";
  } else if (r === "admin") {
    (data as any).role = "admin"; // legacy compatibility
  } else {
    (data as any).role = "user";
  }

  if (!data.tenantId) data.tenantId = "default";

  return data as AllowlistDoc;
}

function resolveAllowlistHomePath(user: User | null, allow: AllowlistDoc | null): string {
  if (allow?.enabled && allow?.role === "exam_super" && allow?.tenantId) {
    return `/t/${allow.tenantId}/dashboard12`;
  }

  return resolveHomePath(
    buildAuthzSnapshot({
      user,
      profile: allow,
      tenantId: allow?.tenantId ?? null,
      isSuperAdmin: allow?.role === "super_admin",
      isSuper: allow?.role === "super",
    })
  );
}

function translateRoleLabel(label: string, lang: Lang): string {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "سوبر الوزارة": { ar: "سوبر الوزارة", en: "Ministry Super" },
    "سوبر المحافظات": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "مشرف نطاق": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "مدير جهة": { ar: "أدمن المدرسة", en: "School Admin" },
    "مدير": { ar: "أدمن المدرسة", en: "School Admin" },
    "سوبر الامتحانات": { ar: "سوبر الامتحانات", en: "Exam Super" },
    "مستخدم تشغيلي": { ar: "مستخدم تشغيلي", en: "Operational User" },
    "مستخدم": { ar: "مستخدم", en: "User" },
  };
  return map[label]?.[lang] || label;
}

export default function Login() {
  const navigate = useNavigate();
  const { lang, setLang } = useI18n();
  const t = STR[lang as Lang] || STR.ar;

  const [fbUser, setFbUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AllowlistDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const enabled = !!profile?.enabled;

  const authzSnapshot = useMemo(
    () =>
      buildAuthzSnapshot({
        user: fbUser,
        profile,
        tenantId: profile?.tenantId ?? null,
        isSuperAdmin: profile?.role === "super_admin",
        isSuper: profile?.role === "super",
      }),
    [fbUser, profile]
  );

  const roleBadgeBase = resolveRoleBadgeStyle(authzSnapshot);
  const roleBadge = {
    ...roleBadgeBase,
    label: translateRoleLabel(roleBadgeBase.label, lang as Lang),
  };

  const tenantId = profile?.tenantId ?? "";

  const isAllowed = useMemo(() => {
    if (!fbUser?.email) return false;
    return !!profile?.enabled;
  }, [fbUser, profile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      setError("");
      setProfile(null);

      if (u?.email) {
        try {
          const allow = await fetchAllowlist(u.email);
          setProfile(allow);
        } catch {
          setError(t.errGeneric);
        }
      }
    });

    return () => unsub();
  }, [t.errGeneric]);

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    setProfile(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const res = await signInWithPopup(auth, provider);
      const email = res.user.email;

      if (!email) {
        setError(t.errGeneric);
        await signOut(auth);
        setBusy(false);
        return;
      }

      const allow = await fetchAllowlist(email);
      setProfile(allow);

      if (!DISABLE_FUNCTIONS) {
        try {
          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await res.user.getIdToken(true);
        } catch {
          // ignore
        }
      }

      if (!allow?.enabled) {
        setError(t.errNotAllowed);
      } else {
        navigate(resolveAllowlistHomePath(res.user, allow), { replace: true });
      }
    } catch (e: any) {
      if (e?.code === "auth/popup-closed-by-user") {
        setError(t.errPopupClosed);
      } else {
        setError(t.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  };

  const refreshPermissions = async () => {
    if (!fbUser?.email) return;

    setBusy(true);
    setError("");

    try {
      const allow = await fetchAllowlist(fbUser.email);
      setProfile(allow);

      if (!DISABLE_FUNCTIONS) {
        try {
          try {
            const bootstrap = callFn<any, any>("bootstrapOwner");
            await bootstrap({});
          } catch {
            // ignore
          }

          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await fbUser.getIdToken(true);
        } catch {
          // ignore
        }
      }

      if (allow?.enabled) {
        navigate(resolveAllowlistHomePath(fbUser, allow), { replace: true });
      }
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError("");

    try {
      await signOut(auth);
      setFbUser(null);
      setProfile(null);
    } finally {
      setBusy(false);
    }
  };

  const renderDeveloperWithHighlight = () => {
    if (lang === "ar") {
      const parts = t.developer.split("المطور");
      if (parts.length === 2) {
        return (
          <>
            <span
              style={{
                color: "#f6e05e",
                background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 900,
              }}
            >
              المطور
            </span>
            {parts[1]}
          </>
        );
      }
      return t.developer;
    }

    const parts = t.developer.split("Developer");
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span
            style={{
              color: "#f6e05e",
              background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 900,
            }}
          >
            Developer
          </span>
        </>
      );
    }
    return t.developer;
  };

  const renderSubtitleWithRedText = () => {
    if (lang === "ar") {
      const parts = t.subtitle.split("فقط");
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <span
              style={{
                color: "#f56565",
                fontWeight: 900,
                fontSize: "18px",
                marginInline: "4px",
              }}
            >
              فقط
            </span>
            {parts[1]}
          </>
        );
      }
      return t.subtitle;
    }

    const parts = t.subtitle.split("only");
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span
            style={{
              color: "#f56565",
              fontWeight: 900,
              fontSize: "18px",
              marginInline: "4px",
            }}
          >
            only
          </span>
          {parts[1]}
        </>
      );
    }
    return t.subtitle;
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      backgroundImage: 'url("https://i.imgur.com/kt5xtnx.jpeg")',
      backgroundSize: "520px auto",
      backgroundPosition: "center top",
      backgroundRepeat: "repeat",
      backgroundAttachment: "scroll",
      backgroundColor: "#05070b",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      direction: lang === "ar" ? "rtl" : "ltr",
      fontFamily: "'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: "#f7fafc",
      position: "relative",
      overflow: "hidden",
    },
    backgroundPattern: {
      position: "absolute",
      inset: 0,
      background: `
        radial-gradient(circle at top, rgba(246, 173, 85, 0.04), transparent 24%),
        radial-gradient(circle at 80% 20%, rgba(66, 153, 225, 0.03), transparent 20%)
      `,
      opacity: 1,
      zIndex: 0,
      pointerEvents: "none",
    },
    card: {
      width: "100%",
      maxWidth: "520px",
      borderRadius: "24px",
      background: "rgba(8, 14, 24, 0.84)",
      boxShadow: `
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
      `,
      border: "1px solid rgba(255, 255, 255, 0.15)",
      padding: "45px 35px 40px",
      position: "relative",
      overflow: "hidden",
      backdropFilter: "blur(14px)",
      zIndex: 1,
    },
    cardGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "5px",
      background: "linear-gradient(90deg, #2b6cb0, #4299e1, #2b6cb0)",
      borderRadius: "24px 24px 0 0",
      zIndex: 2,
    },
    header: {
      textAlign: "center",
      marginBottom: "35px",
    },
    logoContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: "20px",
    },
    logo: {
      width: "110px",
      height: "110px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, #2c5282, #2b6cb0)",
      border: "3px solid rgba(66, 153, 225, 0.4)",
      padding: "10px",
      boxShadow: "0 12px 35px rgba(0, 0, 0, 0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    logoImage: {
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      objectFit: "cover",
    },
    title: {
      fontSize: "26px",
      fontWeight: 900,
      margin: "0 0 8px 0",
      background: "linear-gradient(90deg, #f6e05e, #f6ad55, #f6e05e)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      lineHeight: 1.3,
    },
    ministryText: {
      fontSize: "16px",
      color: "#cbd5e1",
      margin: "0 0 15px 0",
      fontWeight: 700,
      position: "relative",
      paddingBottom: "10px",
    },
    ministryUnderline: {
      position: "absolute",
      bottom: 0,
      left: "25%",
      right: "25%",
      height: "2px",
      background: "linear-gradient(90deg, transparent, #4299e1, transparent)",
    },
    subtitle: {
      fontSize: "14px",
      color: "#a0aec0",
      margin: 0,
      fontWeight: 600,
      lineHeight: 1.5,
      padding: "0 10px",
    },
    googleBtn: {
      width: "100%",
      border: "none",
      borderRadius: "16px",
      padding: "18px 24px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 800,
      fontSize: "18px",
      color: "#1a202c",
      background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
      boxShadow: "0 12px 30px rgba(246, 173, 85, 0.3)",
      opacity: busy ? 0.7 : 1,
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "15px",
    },
    googleIcon: {
      fontSize: "24px",
      fontWeight: "bold",
      color: "#1a202c",
    },
    infoBox: {
      marginTop: "25px",
      borderRadius: "16px",
      padding: "22px",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      background: "rgba(17, 24, 39, 0.7)",
      backdropFilter: "blur(5px)",
    },
    infoSection: {
      marginBottom: "22px",
    },
    infoRow: {
      display: "flex",
      alignItems: "flex-start",
      marginBottom: "14px",
      paddingBottom: "14px",
      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
      flexWrap: "wrap",
    },
    infoLabel: {
      color: "#a0aec0",
      fontSize: "14px",
      fontWeight: 600,
      minWidth: "100px",
      textAlign: lang === "ar" ? "right" : "left",
      marginBottom: "5px",
    },
    infoValue: {
      color: "#f7fafc",
      fontSize: "14px",
      fontWeight: 700,
      flex: 1,
      wordBreak: "break-word",
    },
    badge: {
      padding: "6px 14px",
      borderRadius: "20px",
      fontSize: "13px",
      fontWeight: 800,
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
    },
    badgeActive: {
      background: "linear-gradient(90deg, #38a169, #2f855a)",
      color: "#ffffff",
    },
    badgeInactive: {
      background: "linear-gradient(90deg, #e53e3e, #c53030)",
      color: "#ffffff",
    },
    hintText: {
      fontSize: "12px",
      color: "#a0aec0",
      fontStyle: "italic",
      marginTop: "6px",
      paddingLeft: lang === "ar" ? "0" : "100px",
      paddingRight: lang === "ar" ? "100px" : "0",
    },
    actions: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "20px",
    },
    actionBtn: {
      flex: 1,
      minWidth: "130px",
      borderRadius: "12px",
      padding: "13px 18px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 800,
      fontSize: "14px",
      border: "none",
      transition: "all 0.3s ease",
      textAlign: "center",
    },
    primaryBtn: {
      background: "linear-gradient(90deg, #4299e1, #3182ce)",
      color: "#ffffff",
    },
    secondaryBtn: {
      background: "rgba(255, 255, 255, 0.08)",
      color: "#e2e8f0",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
    },
    footer: {
      marginTop: "35px",
      textAlign: "center",
      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
      paddingTop: "22px",
    },
    copyright: {
      fontSize: "14px",
      color: "#a0aec0",
      margin: "0 0 10px 0",
      fontWeight: 600,
    },
    developerInfo: {
      fontSize: "14px",
      color: "#e2e8f0",
      margin: "8px 0",
      lineHeight: 1.6,
    },
    teacherName: {
      fontWeight: 900,
      background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      fontSize: "15px",
    },
    error: {
      marginTop: "18px",
      padding: "14px",
      borderRadius: "12px",
      background: "linear-gradient(90deg, rgba(229, 62, 62, 0.15), rgba(197, 48, 48, 0.15))",
      border: "1px solid rgba(229, 62, 62, 0.3)",
      color: "#fed7d7",
      fontSize: "13px",
      textAlign: "center",
      fontWeight: 700,
    },
    langSwitch: {
      position: "absolute",
      top: "25px",
      [lang === "ar" ? "left" : "right"]: "25px",
      background: "rgba(255, 255, 255, 0.08)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      color: "#e2e8f0",
      padding: "10px 20px",
      borderRadius: "30px",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.3s ease",
      backdropFilter: "blur(5px)",
      zIndex: 3,
    },
    loading: {
      display: "inline-block",
      width: "22px",
      height: "22px",
      border: "3px solid rgba(255, 255, 255, 0.3)",
      borderTop: "3px solid #f6e05e",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundPattern}></div>

      <button
        style={styles.langSwitch}
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      >
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div style={styles.card}>
        <div style={styles.cardGlow}></div>

        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <div style={styles.logo}>
              <img
                src="https://i.imgur.com/vdDhSMh.png"
                alt="شعار النظام"
                style={styles.logoImage}
              />
            </div>
          </div>

          <h1 style={styles.title}>{t.title}</h1>

          <div style={styles.ministryText}>
            {t.ministry}
            <div style={styles.ministryUnderline}></div>
          </div>

          <p style={styles.subtitle}>{renderSubtitleWithRedText()}</p>
        </div>

        <button style={styles.googleBtn} onClick={handleGoogle} disabled={busy}>
          {busy ? (
            <span style={styles.loading}></span>
          ) : (
            <>
              <span style={styles.googleIcon}>G</span>
              {t.signIn}
            </>
          )}
        </button>

        {(fbUser || error || profile) && (
          <div style={styles.infoBox}>
            <div style={styles.infoSection}>
              {fbUser?.email && (
                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>{t.signedInAs}</div>
                  <div style={styles.infoValue}>{fbUser.email}</div>
                </div>
              )}

              <div style={styles.infoRow}>
                <div style={styles.infoLabel}>{t.status}</div>
                <div>
                  <span
                    style={{
                      ...styles.badge,
                      ...(enabled ? styles.badgeActive : styles.badgeInactive),
                    }}
                  >
                    {enabled ? t.active : t.inactive}
                  </span>

                  {!enabled && <div style={styles.hintText}>{t.inactiveHint}</div>}
                </div>
              </div>

              {tenantId && tenantId !== "default" && (
                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>{t.tenant}</div>
                  <div style={styles.infoValue}>{tenantId}</div>
                </div>
              )}

              {profile?.role && (
                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>{t.role}</div>
                  <div style={styles.infoValue}>{roleBadge.label}</div>
                </div>
              )}
            </div>

            <div style={styles.actions}>
              {fbUser && (
                <>
                  <button
                    style={{ ...styles.actionBtn, ...styles.secondaryBtn }}
                    onClick={refreshPermissions}
                    disabled={busy}
                  >
                    {t.refresh}
                  </button>

                  <button
                    style={{ ...styles.actionBtn, ...styles.secondaryBtn }}
                    onClick={logout}
                    disabled={busy}
                  >
                    {t.logout}
                  </button>

                  {isAllowed && (
                    <button
                      style={{ ...styles.actionBtn, ...styles.primaryBtn }}
                      onClick={() =>
                        navigate(resolveAllowlistHomePath(fbUser, profile), {
                          replace: true,
                        })
                      }
                      disabled={busy}
                    >
                      {t.okGo}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.footer}>
          <div style={styles.copyright}>{t.footer}</div>
          <div style={styles.developerInfo}>
            <div>{renderDeveloperWithHighlight()}</div>
            <div>
              {t.teacher.split(":")[0]}:{" "}
              <span style={styles.teacherName}>{t.teacher.split(":")[1]}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        * {
          box-sizing: border-box;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        img {
          max-width: 100%;
        }

        #root {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
