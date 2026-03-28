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
import { buildAuthzSnapshot, canAccessCapability, isPlatformOwner, resolveHomePath, resolvePrimaryRoleLabel, resolveRoleBadgeStyle } from "../features/authz";
import { useI18n } from "../i18n/I18nProvider";

// Default to disabling Cloud Functions unless explicitly enabled.
const DISABLE_FUNCTIONS = String(import.meta.env.VITE_DISABLE_FUNCTIONS ?? "true") === "true";
type AllowlistDoc = {
  email: string;
  enabled: boolean;
  role: "super_admin" | "super" | "admin" | "user";
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
    subtitle: "Secure login for Egyptian users only",
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
    // ✅ Primary owner is always Super Admin and always enabled
    (data as any).role = "super_admin";
    (data as any).enabled = true;
  } else if (r === "super_admin" || r === "super admin" || r === "superadmin") {
    (data as any).role = "super_admin";
  } else if (r === "super") {
    (data as any).role = "super";
  } else if (r === "admin" || r === "tenant_admin" || r === "tenant admin") {
    (data as any).role = "admin";
  } else {
    (data as any).role = "user";
  }
  if (!data.tenantId) data.tenantId = "default";

  return data as AllowlistDoc;
}


function resolveAllowlistHomePath(user: User | null, allow: AllowlistDoc | null): string {
  return resolveHomePath(buildAuthzSnapshot({
    user,
    profile: allow,
    tenantId: allow?.tenantId ?? null,
    isSuperAdmin: allow?.role === "super_admin",
    isSuper: allow?.role === "super",
  }));
}

function translateRoleLabel(label: string, lang: Lang): string {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "مشرف نطاق": { ar: "مشرف نطاق", en: "Domain Supervisor" },
    "مدير جهة": { ar: "مدير جهة", en: "Tenant Admin" },
    "مدير": { ar: "مدير", en: "Manager" },
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
  const [error, setError] = useState<string>("");

  const enabled = !!profile?.enabled;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot({
    user: fbUser,
    profile,
    tenantId: profile?.tenantId ?? null,
    isSuperAdmin: profile?.role === "super_admin",
    isSuper: profile?.role === "super",
  }), [fbUser, profile]);
  const roleLabel = translateRoleLabel(resolvePrimaryRoleLabel(authzSnapshot), lang as Lang);
  const roleBadgeBase = resolveRoleBadgeStyle(authzSnapshot);
  const roleBadge = { ...roleBadgeBase, label: translateRoleLabel(roleBadgeBase.label, lang as Lang) };
  const isAdminLike = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN") || canAccessCapability(authzSnapshot, "SETTINGS_MANAGE");
  const tenantId = profile?.tenantId ?? "";

  const isAllowed = useMemo(() => {
    if (!fbUser?.email) return false;
    return !!profile && !!profile.enabled;
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
  }, []);

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    setProfile(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

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

      // ✅ Bootstrap/refresh custom claims for existing allowlist entries
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

      // ✅ Bootstrap/refresh custom claims
      if (!DISABLE_FUNCTIONS) {
        try {
          // ✅ One-time owner bootstrap (safe) — succeeds only for configured email.
          try {
            const bootstrap = callFn<any, any>("bootstrapOwner");
            await bootstrap({});
          } catch {
            // ignore (not allowed / already bootstrapped)
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

  // دالة لتسليط الضوء على كلمة "المطور" في تذييل الصفحة
  const renderDeveloperWithHighlight = () => {
    if (lang === "ar") {
      // نص عربي: "المطور المعتمد"
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
                fontWeight: "900",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)"
              }}
            >
              المطور
            </span>
            {parts[1]}
          </>
        );
      }
      return t.developer;
    } else {
      // نص إنجليزي: "Certified Developer"
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
                fontWeight: "900",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)"
              }}
            >
              Developer
            </span>
          </>
        );
      }
      return t.developer;
    }
  };

  // دالة لتسليط الضوء على كلمة "فقط" أو "only" باللون الأحمر وتكبير الخط
  const renderSubtitleWithRedText = () => {
    if (lang === "ar") {
      // نص عربي: "تسجيل دخول أمن المستخدمين المصري لهم فقط"
      const parts = t.subtitle.split("فقط");
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <span 
              style={{ 
                color: "#f56565",
                fontWeight: "900",  // غامق جداً
                fontSize: "18px",   // خط أكبر من بقية النص
                textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                marginRight: "3px",
                marginLeft: "3px",
                display: "inline-block",
                transform: "translateY(2px)", // لتعديل المحاذاة قليلاً
              }}
            >
              فقط
            </span>
            {parts[1]}
          </>
        );
      }
      return t.subtitle;
    } else {
      // نص إنجليزي: "Secure login for Egyptian users only"
      const parts = t.subtitle.split("only");
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <span 
              style={{ 
                color: "#f56565",
                fontWeight: "900",  // غامق جداً
                fontSize: "18px",   // خط أكبر من بقية النص
                textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                marginLeft: "4px",
                marginRight: "4px",
                display: "inline-block",
                transform: "translateY(2px)", // لتعديل المحاذاة قليلاً
              }}
            >
              only
            </span>
            {parts[1]}
          </>
        );
      }
      return t.subtitle;
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a365d 0%, #2d3748 100%)",
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
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%234a5568' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
      opacity: 0.3,
      zIndex: 0,
    },
    card: {
      width: "100%",
      maxWidth: "520px",
      borderRadius: "24px",
      background: "rgba(26, 32, 44, 0.95)",
      boxShadow: `
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
      `,
      border: "1px solid rgba(255, 255, 255, 0.15)",
      padding: "45px 35px 40px",
      position: "relative",
      overflow: "hidden",
      backdropFilter: "blur(10px)",
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
      fontWeight: "900",
      margin: "0 0 8px 0",
      background: "linear-gradient(90deg, #f6e05e, #f6ad55, #f6e05e)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      letterSpacing: "0.5px",
      lineHeight: 1.3,
      textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
    },
    ministryText: {
      fontSize: "16px",
      color: "#cbd5e1",
      margin: "0 0 15px 0",
      fontWeight: "700",
      background: "linear-gradient(90deg, #a0aec0, #cbd5e1)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      letterSpacing: "0.3px",
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
      margin: "0",
      fontWeight: "600",
      opacity: "0.9",
      lineHeight: 1.5,
      padding: "0 10px",
    },
    googleBtn: {
      width: "100%",
      border: "none",
      borderRadius: "16px",
      padding: "18px 24px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: "800",
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
      position: "relative",
      overflow: "hidden",
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
      fontWeight: "600",
      minWidth: "100px",
      textAlign: lang === "ar" ? "right" : "left",
      marginBottom: "5px",
    },
    infoValue: {
      color: "#f7fafc",
      fontSize: "14px",
      fontWeight: "700",
      flex: 1,
      wordBreak: "break-word",
    },
    badge: {
      padding: "6px 14px",
      borderRadius: "20px",
      fontSize: "13px",
      fontWeight: "800",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      letterSpacing: "0.5px",
    },
    badgeActive: {
      background: "linear-gradient(90deg, #38a169, #2f855a)",
      color: "#ffffff",
      boxShadow: "0 4px 15px rgba(56, 161, 105, 0.25)",
    },
    badgeInactive: {
      background: "linear-gradient(90deg, #e53e3e, #c53030)",
      color: "#ffffff",
      boxShadow: "0 4px 15px rgba(229, 62, 62, 0.25)",
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
      flex: "1",
      minWidth: "130px",
      borderRadius: "12px",
      padding: "13px 18px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: "800",
      fontSize: "14px",
      border: "none",
      transition: "all 0.3s ease",
      textAlign: "center",
      letterSpacing: "0.5px",
    },
    primaryBtn: {
      background: "linear-gradient(90deg, #4299e1, #3182ce)",
      color: "#ffffff",
      boxShadow: "0 6px 20px rgba(66, 153, 225, 0.3)",
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
      fontWeight: "600",
    },
    developerInfo: {
      fontSize: "14px",
      color: "#e2e8f0",
      margin: "8px 0",
      lineHeight: 1.6,
    },
    teacherName: {
      fontWeight: "900",
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
      fontWeight: "700",
      backdropFilter: "blur(5px)",
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
      fontWeight: "700",
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
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
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
                onError={(e) => {
                  e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjQ1IiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfNDNfNzMpIi8+CjxwYXRoIGQ9Ik0zNSAzMEw1MCAxNUw2NSAzMEw2NSA3MEw1MCA4NUwzNSA3MFYzMFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOCIvPgo8cGF0aCBkPSJNNDUgNDBMNTAgMzVMNTUgNDBMNTUgNjVMNTAgNzBMNDUgNjVWNDBaIiBmaWxsPSIjRkZGIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfNDNfNzMiIHgxPSI1MCIgeTE9IjUiIHgyPSI1MCIgeTI9Ijk1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiM0Mjk5RTEiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMzhCMkFDIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+";
                }}
              />
            </div>
          </div>
          
          <h1 style={styles.title}>
            {t.title}
          </h1>
          
          <div style={styles.ministryText}>
            {t.ministry}
            <div style={styles.ministryUnderline}></div>
          </div>
          
          <p style={styles.subtitle}>
            {renderSubtitleWithRedText()}
          </p>
        </div>

        <button 
          style={styles.googleBtn} 
          onClick={handleGoogle} 
          disabled={busy}
          onMouseEnter={(e) => {
            if (!busy) {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 15px 35px rgba(246, 173, 85, 0.4)";
            }
          }}
          onMouseLeave={(e) => {
            if (!busy) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 12px 30px rgba(246, 173, 85, 0.3)";
            }
          }}
        >
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
                      ...(enabled ? styles.badgeActive : styles.badgeInactive)
                    }}
                  >
                    {enabled ? t.active : t.inactive}
                  </span>
                  {!enabled && (
                    <div style={styles.hintText}>
                      {t.inactiveHint}
                    </div>
                  )}
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
                    onMouseEnter={(e) => {
                      if (!busy) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!busy) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.2)";
                      }
                    }}
                  >
                    {t.refresh}
                  </button>

                  <button 
                    style={{ ...styles.actionBtn, ...styles.secondaryBtn }}
                    onClick={logout}
                    disabled={busy}
                    onMouseEnter={(e) => {
                      if (!busy) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!busy) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.2)";
                      }
                    }}
                  >
                    {t.logout}
                  </button>

                  {isAllowed && (
                    <button
                      style={{ ...styles.actionBtn, ...styles.primaryBtn }}
                      onClick={() => navigate(resolveAllowlistHomePath(fbUser, profile), { replace: true })}
                      disabled={busy}
                      onMouseEnter={(e) => {
                        if (!busy) {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 10px 30px rgba(66, 153, 225, 0.4)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!busy) {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 6px 20px rgba(66, 153, 225, 0.3)";
                        }
                      }}
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