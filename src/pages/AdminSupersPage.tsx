import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import {
  buildAuthzSnapshot,
  canAccessCapability,
} from "../features/authz";
import { getActionErrorMessage } from "../services/functionsRuntimePolicy";
import { MINISTRY_SCOPE } from "../constants/directorates";
import AdminSuperUsersSection from "../features/system-admin/components/AdminSuperUsersSection";
import "./ownerOfficial.theme.css";
import {
  createAllowUserAction,
  removeAllowUserAction,
} from "../features/system-admin/services/adminUsersService";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const EXAM_CENTER_ROLES = [
  "exam_super",
  "exam_center_admin",
  "diploma_center_admin",
  "diploma_super",
  "center_admin",
  "center_super",
  "control_admin",
  "distribution_super",
  "distribution_admin",
];

const TENANT_LINKED_SUPER_ROLES = ["exam_super", "exam_center_admin", "diploma_center_admin"];
const SYSTEM_SCOPE_SUPER_ROLES = ["super", "ministry_super"];
const isTenantLinkedSuperRole = (role: any) => TENANT_LINKED_SUPER_ROLES.includes(String(role || "").trim());
const isSystemScopeSuperRole = (role: any) => SYSTEM_SCOPE_SUPER_ROLES.includes(String(role || "").trim());

const GOVERNORATE_ASSIGNABLE_CENTER_ROLES = ["exam_super"];

const normalizeRoleValue = (value: any) => String(value || "").trim().toLowerCase();

const hasOwnerAccess = (authzSnapshot: any, profile: any, isSuperAdmin: any, user: any) => {
  const values = [
    profile?.role,
    profile?.legacyRole,
    profile?.roleScope,
    profile?.accountType,
    user?.role,
    user?.legacyRole,
  ].map(normalizeRoleValue);

  return (
    canAccessCapability(authzSnapshot, "PLATFORM_OWNER") ||
    (canAccessCapability(authzSnapshot, "SYSTEM_ADMIN") && Boolean(isSuperAdmin)) ||
    Boolean(profile?.isPlatformOwner || profile?.platformOwner || user?.isPlatformOwner || user?.platformOwner) ||
    values.some((v) => ["platform_owner", "owner", "super_admin", "superadmin", "مالك_المنصة", "مالك المنصة"].includes(v))
  );
};

const getGovernorateValue = (...items: any[]) => {
  for (const item of items) {
    if (!item) continue;
    const value =
      typeof item === "string"
        ? item
        : item?.governorate ??
          item?.tenantGovernorate ??
          item?.regionAr ??
          item?.governorateAr ??
          item?.gov ??
          item?.scopeGovernorate ??
          "";
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const sameGovernorate = (a: unknown, b: unknown) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();


const EXAM_SUPER_LINKS_COLLECTION = "governorateExamSupers";

const safeLinkId = (email: any, tenantId: any) => {
  const mail = String(email || "").trim().toLowerCase().replace(/[^a-z0-9@._-]+/gi, "_");
  const tenant = String(tenantId || "").trim().replace(/[^a-z0-9_-]+/gi, "_") || "no_tenant";
  return `${mail}__${tenant}`;
};

const buildExamSuperLinkPayload = (params: {
  email: string;
  role: string;
  name: string;
  tenantId: string;
  centerName: string;
  governorate: string;
  enabled: boolean;
}) => ({
  email: params.email,
  role: "exam_super",
  originalRole: params.role || "exam_super",
  enabled: params.enabled,
  userName: params.name,
  name: params.name,
  tenantId: params.tenantId,
  schoolName: params.centerName,
  tenantName: params.centerName,
  centerName: params.centerName,
  centerNameAr: params.centerName,
  governorate: params.governorate,
  tenantGovernorate: params.governorate,
  regionAr: params.governorate,
  tenantType: "exam_center",
  type: "exam_center",
  entityType: "exam_center",
  isExamCenter: true,
  isDiplomaCenter: true,
  updatedAt: serverTimestamp(),
});

export default function AdminSupersPage() {
  const { user, profile, isSuperAdmin, isSuper, allow, logout } = useAuth() as any;
  const navigate = useNavigate();

  const authzSnapshot = useMemo(
    () => buildAuthzSnapshot({ user, profile: profile || allow, isSuperAdmin, isSuper }),
    [user, profile, allow, isSuperAdmin, isSuper]
  );

  const isPlatformOwner = hasOwnerAccess(authzSnapshot, profile || allow, isSuperAdmin, user);
  const currentRole = String(
    allow?.role ||
      profile?.role ||
      authzSnapshot?.roles?.[0] ||
      ""
  ).trim().toLowerCase();
  const currentGovernorate = getGovernorateValue(allow, profile);
  const isGovernorateSupervisor = !isPlatformOwner && currentRole === "super" && !!currentGovernorate;
  const canAccessThisPage = isPlatformOwner || isGovernorateSupervisor;

  const [superEmail, setSuperEmail] = useState<string>("");
  const [superName, setSuperName] = useState<string>("");
  const [superRole, setSuperRole] = useState<string>(isGovernorateSupervisor ? "exam_super" : "super");
  const [superGovernorate, setSuperGovernorate] = useState<string>(isGovernorateSupervisor ? currentGovernorate : "");
  const [superTenantId, setSuperTenantId] = useState<string>("");
  const [tenantMode, setTenantMode] = useState<"list" | "manual" | "create">("list");
  const [newCenterName, setNewCenterName] = useState<string>("");
  const [newCenterTenantId, setNewCenterTenantId] = useState<string>("");
  const [superEnabled, setSuperEnabled] = useState(true);
  const [supers, setSupers] = useState<any[]>([]);
  const [visibleTenants, setVisibleTenants] = useState<any[]>([]);

  const setScopedSuperRole: React.Dispatch<React.SetStateAction<string>> = (value) => {
    const nextValue = typeof value === "function" ? value(superRole) : value;
    const role = String(nextValue || "").trim();
    if (isGovernorateSupervisor) {
      setSuperRole(GOVERNORATE_ASSIGNABLE_CENTER_ROLES.includes(role) ? role : "exam_super");
      return;
    }
    setSuperRole(role);
  };

  const setScopedSuperGovernorate: React.Dispatch<React.SetStateAction<string>> = (value) => {
    const nextValue = typeof value === "function" ? value(superGovernorate) : value;
    setSuperGovernorate(isGovernorateSupervisor ? currentGovernorate : nextValue);
  };

  useEffect(() => {
    if (!isGovernorateSupervisor) return;
    setSuperGovernorate(currentGovernorate);
    setSuperRole((prev) => (GOVERNORATE_ASSIGNABLE_CENTER_ROLES.includes(prev) ? prev : "exam_super"));
  }, [isGovernorateSupervisor, currentGovernorate]);

  // Commercial scope helper: this page is for platform-owner management of governorate supervisors
  // and diploma exam centers. Regional governorate supervisors can add only exam supers
  // inside their governorate.
  const getTenantKind = (tenant: any): "school" | "exam_center" | "unknown" => {
    const raw = String(
      tenant?.tenantType || tenant?.type || tenant?.kind || tenant?.category || tenant?.entityType || ""
    )
      .trim()
      .toLowerCase();

    if (["exam_center", "exam-centre", "exam_center_admin", "diploma_center", "diploma-centre", "center", "centre"].includes(raw)) {
      return "exam_center";
    }

    if (["school", "tenant", "مدرسة"].includes(raw)) return "school";
    if (tenant?.isExamCenter === true || tenant?.examCenter === true || tenant?.isDiplomaCenter === true) return "exam_center";
    return "unknown";
  };

  const isExamCenterLike = (tenant: any) => {
    const kind = getTenantKind(tenant);
    if (kind === "exam_center") return true;
    if (kind === "school") return false;

    const text = `${tenant?.id || ""} ${tenant?.name || ""} ${tenant?.title || ""}`.toLowerCase();
    return (
      text.includes("exam") ||
      text.includes("diploma") ||
      text.includes("center") ||
      text.includes("centre") ||
      text.includes("دبلوم") ||
      text.includes("امتحان") ||
      text.includes("مركز")
    );
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessThisPage) return <Navigate to="/super-system" replace />;

  const loadSupers = async () => {
    const allowRef = collection(db, "allowlist");
    const byEmail = new Map<string, any>();

    const addRow = (id: string, data: any) => {
      const email = String(data?.email || id || "").trim().toLowerCase();
      if (!email) return;
      const governorate = getGovernorateValue(data);
      if (isGovernorateSupervisor && !sameGovernorate(governorate, currentGovernorate)) return;
      const role = String(data?.role || "").trim();
      if (isGovernorateSupervisor && role !== "exam_super" && role !== "سوبر الامتحانات") return;
      const resolvedRole = String(data?.role || "exam_super").trim() || "exam_super";
      byEmail.set(`${email}__${String(data?.tenantId || "")}`, { email, ...data, role: resolvedRole });
    };

    // المصدر الجديد الآمن: مجموعة مخصصة لسوبر الامتحانات داخل المحافظات.
    // هذه المجموعة تمنع قراءة allowlist بالكامل وتقلل أخطاء permission-denied.
    try {
      const linksQuery = isPlatformOwner
        ? collection(db, EXAM_SUPER_LINKS_COLLECTION)
        : query(collection(db, EXAM_SUPER_LINKS_COLLECTION), where("governorate", "==", currentGovernorate));
      const linksSnap = await getDocs(linksQuery as any);
      linksSnap.docs.forEach((d: any) => addRow(d.id, d.data()));
    } catch (linksError) {
      console.warn("AdminSupersPage exam-super links load skipped", linksError);
    }

    // توافق خلفي: قراءة allowlist للحسابات القديمة التي أُنشئت قبل إضافة مصدر governorateExamSupers.
    try {
      if (isPlatformOwner) {
        const superSnap = await getDocs(query(allowRef, where("role", "==", "super")));
        const ministrySnap = await getDocs(query(allowRef, where("role", "==", "ministry_super")));
        const examSnap = await getDocs(query(allowRef, where("role", "==", "exam_super")));
        [...superSnap.docs, ...ministrySnap.docs, ...examSnap.docs].forEach((d: any) => addRow(d.id, d.data()));
      } else {
        const centerSnap = await getDocs(
          query(
            allowRef,
            where("governorate", "==", currentGovernorate),
            where("role", "==", "exam_super")
          )
        );
        centerSnap.docs.forEach((d: any) => addRow(d.id, d.data()));
      }
    } catch (allowError) {
      console.warn("AdminSupersPage allowlist fallback load skipped", allowError);
    }

    const rows = Array.from(byEmail.values()).sort((a, b) =>
      String(a.email || "").localeCompare(String(b.email || ""))
    );

    setSupers(rows);
  };

  const loadVisibleTenants = async () => {
    const snap = await getDocs(collection(db, "tenants"));
    const rows = snap.docs
      .map((d: any) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: String(data?.name || data?.schoolName || data?.title || d.id),
          governorate: String(data?.governorate || data?.tenantGovernorate || data?.regionAr || ""),
          tenantType: String(data?.tenantType || data?.type || data?.kind || data?.category || data?.entityType || ""),
          isExamCenter: data?.isExamCenter === true || data?.examCenter === true || data?.isDiplomaCenter === true,
          enabled: data?.enabled !== false,
        };
      })
      .filter((row: any) => isExamCenterLike(row))
      .filter((row: any) => !isGovernorateSupervisor || sameGovernorate(row.governorate, currentGovernorate))
      .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));
    setVisibleTenants(rows);
  };

  useEffect(() => {
    void loadSupers();
    void loadVisibleTenants();
  }, [isPlatformOwner, isGovernorateSupervisor, currentGovernorate]);

  const canCreateSuperUser = useMemo(() => {
    const email = String(superEmail || "").trim().toLowerCase();
    const role = String(superRole || "").trim();
    const effectiveGovernorate = isGovernorateSupervisor ? currentGovernorate : String(superGovernorate || "").trim();
    const effectiveExamTenantId =
      tenantMode === "create" ? String(newCenterTenantId || "").trim() : String(superTenantId || "").trim();

    if (!canAccessThisPage) return false;
    if (!email.includes("@")) return false;

    if (isGovernorateSupervisor) {
      if (!GOVERNORATE_ASSIGNABLE_CENTER_ROLES.includes(role)) return false;
      if (!effectiveGovernorate) return false;
      if (!effectiveExamTenantId) return false;
      if (tenantMode === "list") {
        const selected = visibleTenants.find((t: any) => String(t?.id || "").trim() === effectiveExamTenantId);
        if (!selected || !isExamCenterLike(selected) || !sameGovernorate(selected.governorate, effectiveGovernorate)) return false;
      }
      if (tenantMode === "create" && !String(newCenterName || "").trim()) return false;
      return true;
    }

    if (!isPlatformOwner) return false;
    if (!["super", "exam_super", "exam_center_admin", "diploma_center_admin", "ministry_super"].includes(role)) return false;
    if (role === "super" && !effectiveGovernorate) return false;

    if (isTenantLinkedSuperRole(role)) {
      if (!effectiveGovernorate) return false;
      if (!effectiveExamTenantId) return false;
      if (tenantMode === "list") {
        const selected = visibleTenants.find((t: any) => String(t?.id || "").trim() === effectiveExamTenantId);
        if (!selected || !isExamCenterLike(selected)) return false;
      }
      if (tenantMode === "create" && !String(newCenterName || "").trim()) return false;
    }

    return true;
  }, [
    canAccessThisPage,
    isPlatformOwner,
    isGovernorateSupervisor,
    currentGovernorate,
    superEmail,
    superRole,
    superGovernorate,
    superTenantId,
    tenantMode,
    newCenterName,
    newCenterTenantId,
    visibleTenants,
  ]);

  const createOrValidateExamCenterTenant = async (role: string, governorate: string) => {
    let targetTenantId = tenantMode === "create" ? String(newCenterTenantId || "").trim() : String(superTenantId || "").trim();
    if (!isTenantLinkedSuperRole(role)) return "";

    if (!targetTenantId) {
      alert("يجب اختيار أو إدخال مركز الامتحانات أولًا.");
      return "";
    }

    if (tenantMode === "list") {
      const selectedCenter = visibleTenants.find((t: any) => String(t?.id || "").trim() === targetTenantId);
      if (!selectedCenter || !isExamCenterLike(selectedCenter)) {
        alert("يجب اختيار مركز امتحانات دبلوم صحيح، وليس مدرسة.");
        return "";
      }
      if (isGovernorateSupervisor && !sameGovernorate(selectedCenter.governorate, governorate)) {
        alert("لا يمكنك ربط مسؤول مركز دبلوم بمركز خارج محافظتك.");
        return "";
      }
      return targetTenantId;
    }

    if (tenantMode === "manual") {
      const tenantRef = doc(db, "tenants", targetTenantId);
      const tenantSnap = await getDoc(tenantRef);

      if (!tenantSnap.exists()) {
        alert("Tenant ID غير موجود. اختر مركزًا من القائمة أو أنشئ مركزًا جديدًا.");
        return "";
      }

      const tenantData = tenantSnap.data() as any;
      if (!isExamCenterLike({ id: tenantSnap.id, ...tenantData })) {
        alert("Tenant ID المحدد ليس مركز امتحانات دبلوم.");
        return "";
      }

      if (isGovernorateSupervisor && !sameGovernorate(getGovernorateValue(tenantData), governorate)) {
        alert("لا يمكنك ربط مسؤول مركز دبلوم بمركز خارج محافظتك.");
        return "";
      }

      return targetTenantId;
    }

    if (tenantMode === "create") {
      const tenantRef = doc(db, "tenants", targetTenantId);
      const tenantSnap = await getDoc(tenantRef);

      if (tenantSnap.exists()) {
        alert("Tenant ID موجود بالفعل. اختر Tenant ID آخر.");
        return "";
      }

      const centerName = String(newCenterName || "").trim();

      await setDoc(tenantRef, {
        name: centerName,
        schoolName: centerName,
        centerName,
        centerNameAr: centerName,
        governorate,
        tenantGovernorate: governorate,
        regionAr: governorate,
        tenantType: "exam_center",
        type: "exam_center",
        entityType: "exam_center",
        isExamCenter: true,
        isDiplomaCenter: true,
        enabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "tenants", targetTenantId, "meta", "config"),
        {
          schoolName: centerName,
          schoolNameAr: centerName,
          centerName,
          centerNameAr: centerName,
          regionAr: governorate,
          governorate,
          tenantGovernorate: governorate,
          tenantType: "exam_center",
          type: "exam_center",
          entityType: "exam_center",
          isExamCenter: true,
          isDiplomaCenter: true,
          enabled: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await loadVisibleTenants();
      return targetTenantId;
    }

    return targetTenantId;
  };

  const createSuperUser = async () => {
    if (!user || !canCreateSuperUser) return;

    const role = String(superRole || "").trim();
    const governorate = isGovernorateSupervisor
      ? currentGovernorate
      : role === "ministry_super"
        ? MINISTRY_SCOPE
        : String(superGovernorate || "").trim();

    const tenantLinkedRole = isTenantLinkedSuperRole(role);
    const targetTenantId = tenantLinkedRole ? await createOrValidateExamCenterTenant(role, governorate) : "";
    if (tenantLinkedRole && !targetTenantId) return;

    const selectedCenter = tenantLinkedRole
      ? visibleTenants.find((t: any) => String(t?.id || "").trim() === targetTenantId)
      : null;
    const targetCenterName = tenantLinkedRole
      ? tenantMode === "create"
        ? String(newCenterName || "").trim()
        : String(selectedCenter?.name || selectedCenter?.schoolName || selectedCenter?.title || targetTenantId || "").trim()
      : "";

    try {
      const normalizedEmail = String(superEmail || "").trim().toLowerCase();

      if (isSystemScopeSuperRole(role)) {
        const systemPayload = {
          email: normalizedEmail,
          name: String(superName || "").trim(),
          userName: String(superName || "").trim(),
          role,
          enabled: superEnabled,
          active: superEnabled,
          scopeType: role === "ministry_super" ? "ministry" : "governorate",
          governorate,
          tenantGovernorate: governorate,
          regionAr: governorate,
          tenantId: "",
          tenantName: "",
          schoolName: "",
          tenantType: "system",
          type: "system",
          isGovernorateSuper: role === "super",
          isMinistrySuper: role === "ministry_super",
          createdBy: user?.email || "",
          updatedAt: serverTimestamp(),
        };

        await setDoc(
          doc(db, "allowlist", normalizedEmail),
          {
            ...systemPayload,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else if (isGovernorateSupervisor) {
        const nameValue = String(superName || "").trim();
        const linkPayload = buildExamSuperLinkPayload({
          email: normalizedEmail,
          role,
          name: nameValue,
          tenantId: targetTenantId,
          centerName: targetCenterName,
          governorate,
          enabled: superEnabled,
        });

        await setDoc(
          doc(db, "allowlist", normalizedEmail),
          {
            ...linkPayload,
            role: "exam_super",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, EXAM_SUPER_LINKS_COLLECTION, safeLinkId(normalizedEmail, targetTenantId)),
          {
            ...linkPayload,
            createdBy: user?.email || "",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await createAllowUserAction({
          user,
          authzSnapshot,
          isSuper,
          profile,
          users: [],
          newUserEmail: superEmail,
          newUserTenantId: targetTenantId,
          newUserRole: role,
          newUserGovernorate: governorate,
          newUserEnabled: superEnabled,
          newUserName: superName,
          newUserSchoolName: isTenantLinkedSuperRole(role) ? targetCenterName : "",
          selectedTenantConfig: {
            governorate,
            tenantGovernorate: governorate,
            tenantType: isTenantLinkedSuperRole(role) ? "exam_center" : "system",
            type: isTenantLinkedSuperRole(role) ? "exam_center" : "system",
            isExamCenter: isTenantLinkedSuperRole(role),
          },
        });
      }

      setSuperEmail("");
      setSuperName("");
      setSuperRole(isGovernorateSupervisor ? "exam_super" : "super");
      setSuperGovernorate(isGovernorateSupervisor ? currentGovernorate : "");
      setSuperTenantId("");
      setTenantMode("list");
      setNewCenterName("");
      setNewCenterTenantId("");
      setSuperEnabled(true);

      await loadSupers();
      alert(isGovernorateSupervisor ? "تم حفظ سوبر الامتحانات داخل محافظتك بنجاح." : "تم حفظ السوبر بنجاح.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حفظ المستخدم."));
    }
  };

  const removeSuperUser = async (email: string) => {
    if (!user) return;
    if (!isPlatformOwner) {
      alert("حذف المستخدمين من هذه الصفحة متاح لمالك المنصة فقط.");
      return;
    }

    const ok = window.confirm(`هل تريد حذف السوبر: ${email} ؟`);
    if (!ok) return;

    try {
      await removeAllowUserAction({ user, users: [], authzSnapshot, email });
      await loadSupers();
      alert("تم حذف السوبر بنجاح.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حذف السوبر."));
    }
  };


  const OFFICIAL_GOLD = "#b8942e";
  const OFFICIAL_GOLD_DARK = "#7a5a13";
  const OFFICIAL_LINE = "rgba(122,90,19,0.42)";
  const OFFICIAL_INK = "#1f2933";
  const OFFICIAL_MUTED = "#5f5748";
  const OFFICIAL_PAPER = "#fffaf0";
  const OFFICIAL_PANEL = "#fffdf7";

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${OFFICIAL_LINE}`,
    background: "#fffdf7",
    color: OFFICIAL_INK,
    borderRadius: 10,
    padding: "12px 14px",
    outline: "none",
    boxShadow: "inset 0 1px 2px rgba(122,90,19,0.08)",
    fontWeight: 700,
  };

  const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 8,
    color: OFFICIAL_INK,
    fontWeight: 900,
  };

  const officialCardStyle: React.CSSProperties = {
    background: OFFICIAL_PANEL,
    border: `1px solid ${OFFICIAL_LINE}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 26px rgba(92, 64, 12, 0.10)",
  };

  const navButtonStyle: React.CSSProperties = {
    border: `1px solid rgba(122,90,19,0.35)`,
    background: "rgba(255,253,247,0.88)",
    color: OFFICIAL_INK,
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer",
  };

  const officialButtonStyle: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${OFFICIAL_GOLD_DARK}`,
    background: canCreateSuperUser
      ? "linear-gradient(180deg, #d9bd61, #b8942e)"
      : "#d8d2c2",
    color: canCreateSuperUser ? "#201707" : "#7a7364",
    borderRadius: 12,
    padding: "13px 16px",
    fontWeight: 950,
    cursor: canCreateSuperUser ? "pointer" : "not-allowed",
    boxShadow: canCreateSuperUser ? "0 8px 18px rgba(122,90,19,0.20)" : "none",
  };

  const OfficialCard = ({
    title,
    subtitle,
    children,
  }: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section style={officialCardStyle}>
      <div style={{ borderBottom: `2px solid ${OFFICIAL_GOLD}`, paddingBottom: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: OFFICIAL_GOLD_DARK, fontSize: 20, fontWeight: 950 }}>{title}</h2>
        {subtitle ? <div style={{ marginTop: 6, color: OFFICIAL_MUTED, fontWeight: 700, lineHeight: 1.7 }}>{subtitle}</div> : null}
      </div>
      {children}
    </section>
  );

  const scopedCenterRows = supers.filter((row: any) =>
    sameGovernorate(row?.governorate, currentGovernorate) && String(row?.role || "") === "exam_super"
  );

  const renderGovernorateSupervisorCenterForm = () => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(420px, 0.8fr)", gap: 20, alignItems: "start" }}>
      <OfficialCard
        title="قائمة سوبر الامتحانات داخل المحافظة"
        subtitle="تعرض هذه القائمة حسابات مسؤولي مراكز الدبلوم المرتبطة فقط بمحافظة مشرف المحافظة."
      >
        <div style={{ overflowX: "auto", border: `1px solid rgba(122,90,19,0.22)`, borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: OFFICIAL_INK, background: "#fffdf7" }}>
            <thead>
              <tr style={{ background: "#efe2b8", borderBottom: `1px solid ${OFFICIAL_LINE}` }}>
                <th style={{ padding: 12, textAlign: "right" }}>البريد الإلكتروني</th>
                <th style={{ padding: 12, textAlign: "right" }}>الاسم</th>
                <th style={{ padding: 12, textAlign: "right" }}>نوع الصلاحية</th>
                <th style={{ padding: 12, textAlign: "right" }}>المحافظة</th>
                <th style={{ padding: 12, textAlign: "right" }}>مركز الدبلوم</th>
                <th style={{ padding: 12, textAlign: "right" }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {scopedCenterRows.length ? (
                scopedCenterRows.map((row: any) => (
                  <tr key={String(row.email || row.id)} style={{ borderBottom: `1px solid rgba(122,90,19,0.16)` }}>
                    <td style={{ padding: 12, fontWeight: 900 }}>{String(row.email || "—")}</td>
                    <td style={{ padding: 12 }}>{String(row.name || row.userName || "—")}</td>
                    <td style={{ padding: 12 }}>سوبر الامتحانات</td>
                    <td style={{ padding: 12 }}>{currentGovernorate}</td>
                    <td style={{ padding: 12 }}>{String(row.centerName || row.tenantName || row.schoolName || row.tenantId || "—")}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{
                        display: "inline-flex",
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: row.enabled === false ? "#fee2e2" : "#dcfce7",
                        color: row.enabled === false ? "#991b1b" : "#166534",
                        border: row.enabled === false ? "1px solid #fecaca" : "1px solid #bbf7d0",
                        fontWeight: 900,
                      }}>
                        {row.enabled === false ? "معطل" : "مفعل"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: 18, color: OFFICIAL_MUTED, textAlign: "center", fontWeight: 800 }}>
                    لا يوجد سوبر امتحانات مضاف داخل محافظة {currentGovernorate} حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </OfficialCard>

      <OfficialCard
        title="إضافة سوبر الامتحانات / مسؤول مركز دبلوم"
        subtitle="نوع الصلاحية والمحافظة مثبتان تلقائيًا حسب نطاق مشرف المحافظة."
      >
        <div style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle}>
            البريد الإلكتروني
            <input
              style={fieldStyle}
              value={superEmail}
              onChange={(e) => setSuperEmail(e.target.value)}
              placeholder="super@example.com"
            />
          </label>

          <label style={labelStyle}>
            الاسم
            <input
              style={fieldStyle}
              value={superName}
              onChange={(e) => setSuperName(e.target.value)}
              placeholder="اسم المستخدم"
            />
          </label>

          <label style={labelStyle}>
            نوع الصلاحية
            <select
              style={{ ...fieldStyle, background: "#f7efd6", cursor: "not-allowed" }}
              value="exam_super"
              onChange={() => setScopedSuperRole("exam_super")}
              disabled
            >
              <option value="exam_super">سوبر الامتحانات</option>
            </select>
          </label>

          <label style={labelStyle}>
            المحافظة / النطاق
            <select
              style={{ ...fieldStyle, background: "#f7efd6", cursor: "not-allowed" }}
              value={currentGovernorate}
              disabled
              onChange={() => setScopedSuperGovernorate(currentGovernorate)}
            >
              <option value={currentGovernorate}>{currentGovernorate}</option>
            </select>
            <span style={{ color: OFFICIAL_GOLD_DARK, fontSize: 13, fontWeight: 850 }}>
              يتم تثبيت المحافظة تلقائيًا حسب محافظة مشرف المحافظة.
            </span>
          </label>

          <label style={labelStyle}>
            طريقة ربط مركز الدبلوم
            <select
              style={fieldStyle}
              value={tenantMode}
              onChange={(e) => setTenantMode(e.target.value as "list" | "manual" | "create")}
            >
              <option value="list">اختيار مركز موجود داخل المحافظة</option>
              <option value="create">إنشاء مركز دبلوم جديد داخل المحافظة</option>
              <option value="manual">إدخال Tenant ID يدويًا داخل المحافظة</option>
            </select>
          </label>

          {tenantMode === "list" ? (
            <label style={labelStyle}>
              مركز الدبلوم
              <select style={fieldStyle} value={superTenantId} onChange={(e) => setSuperTenantId(e.target.value)}>
                <option value="">اختر مركز دبلوم داخل المحافظة</option>
                {visibleTenants.map((tenant: any) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} — {tenant.id}
                  </option>
                ))}
              </select>
              {!visibleTenants.length ? (
                <span style={{ color: "#9f1239", fontSize: 13, fontWeight: 800 }}>
                  لا توجد مراكز دبلوم مسجلة داخل محافظتك. استخدم خيار إنشاء مركز جديد.
                </span>
              ) : null}
            </label>
          ) : null}

          {tenantMode === "manual" ? (
            <label style={labelStyle}>
              Tenant ID لمركز دبلوم داخل المحافظة
              <input
                style={fieldStyle}
                value={superTenantId}
                onChange={(e) => setSuperTenantId(e.target.value)}
                placeholder="مثال: exam-center-001"
              />
            </label>
          ) : null}

          {tenantMode === "create" ? (
            <>
              <label style={labelStyle}>
                اسم مركز الدبلوم الجديد
                <input
                  style={fieldStyle}
                  value={newCenterName}
                  onChange={(e) => setNewCenterName(e.target.value)}
                  placeholder="اسم مركز الدبلوم"
                />
              </label>
              <label style={labelStyle}>
                Tenant ID للمركز الجديد
                <input
                  style={fieldStyle}
                  value={newCenterTenantId}
                  onChange={(e) => setNewCenterTenantId(e.target.value)}
                  placeholder="مثال: diploma-center-north-01"
                />
              </label>
            </>
          ) : null}

          <label style={{ ...labelStyle, gridTemplateColumns: "auto 1fr", alignItems: "center", display: "grid" }}>
            <input checked={superEnabled} onChange={(e) => setSuperEnabled(e.target.checked)} type="checkbox" />
            مفعل
          </label>

          <button type="button" onClick={createSuperUser} disabled={!canCreateSuperUser} style={officialButtonStyle}>
            حفظ سوبر الامتحانات
          </button>

          <div style={{ color: OFFICIAL_MUTED, lineHeight: 1.9, fontSize: 13, background: "#fbf4df", border: `1px solid rgba(122,90,19,0.22)`, borderRadius: 12, padding: 12, fontWeight: 750 }}>
            قواعد الصفحة:<br />
            1) نوع الصلاحية ثابت: سوبر الامتحانات فقط.<br />
            2) المحافظة ثابتة تلقائيًا على محافظة مشرف المحافظة.<br />
            3) لا يمكن ربط الحساب بمركز خارج نفس المحافظة.
          </div>
        </div>
      </OfficialCard>
    </div>
  );

  return (
    <div
      className="owner-official-page"
      dir="rtl"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top right, rgba(184,148,46,0.16), transparent 34%), linear-gradient(180deg, #f3ead1 0%, #fbf7ea 46%, #efe4c5 100%)",
        color: OFFICIAL_INK,
        padding: 22,
      }}
    >
      <header
        style={{
          maxWidth: 1480,
          margin: "0 auto 18px",
          background: "linear-gradient(180deg, #fffdf7, #f3ead1)",
          border: `3px solid ${OFFICIAL_GOLD}`,
          borderRadius: 22,
          padding: 18,
          boxShadow: "0 16px 34px rgba(92, 64, 12, 0.14)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 18, alignItems: "center" }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, border: `2px solid rgba(184,148,46,0.48)`, background: "#fffaf0", display: "grid", placeItems: "center", overflow: "hidden" }}>
            <img src={MINISTRY_LOGO_URL} alt="وزارة التعليم" style={{ width: 72, height: 72, objectFit: "contain" }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ color: OFFICIAL_GOLD_DARK, fontSize: 20, fontWeight: 950 }}>سلطنة عمان</div>
            <h1 style={{ margin: "6px 0 4px", fontSize: 34, color: "#111827", fontWeight: 950 }}>
              وزارة التعليم
            </h1>
            <div style={{ color: OFFICIAL_INK, fontSize: 24, fontWeight: 950 }}>
              {isGovernorateSupervisor ? "إضافة رئيس / مسؤول مركز دبلوم داخل المحافظة" : "إدارة سوبر المحافظات"}
            </div>
            <div style={{ marginTop: 10, color: OFFICIAL_MUTED, fontWeight: 850, lineHeight: 1.8 }}>
              المحافظة الحالية: <span style={{ color: OFFICIAL_GOLD_DARK }}>{currentGovernorate || "—"}</span>
              {isGovernorateSupervisor ? " — لا يمكن اختيار محافظة أخرى، وجميع العمليات داخل نطاق المحافظة فقط." : null}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, justifyItems: "end", minWidth: 210 }}>
            {user?.email ? (
              <div style={{ color: OFFICIAL_MUTED, fontWeight: 850, direction: "ltr", textAlign: "left" }}>
                {String(user.email)}
              </div>
            ) : null}
            <button type="button" onClick={() => navigate(isGovernorateSupervisor ? "/super-system" : "/system")} style={navButtonStyle}>
              {isGovernorateSupervisor ? "العودة إلى مشرف المحافظة" : "العودة إلى لوحة مالك المنصة"}
            </button>
            <button type="button" onClick={logout} style={navButtonStyle}>
              تسجيل خروج
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1480, margin: "0 auto" }}>
        <section
          style={{
            ...officialCardStyle,
            marginBottom: 18,
            background: OFFICIAL_PAPER,
          }}
        >
          <div style={{ display: "grid", gap: 8, color: OFFICIAL_INK, lineHeight: 1.9, fontWeight: 800 }}>
            <div style={{ fontSize: 19, color: OFFICIAL_GOLD_DARK, fontWeight: 950 }}>
              {isGovernorateSupervisor ? "بيان صلاحيات الصفحة" : "صفحة مستقلة لإدارة الصلاحيات الإشرافية"}
            </div>
            {isGovernorateSupervisor ? (
              <>
                <div>هذه الصفحة مخصصة لإضافة أو ربط سوبر الامتحانات / مسؤول مركز دبلوم داخل محافظة مشرف المحافظة فقط.</div>
                <div>نوع الصلاحية يظهر كخيار واحد فقط: <b>سوبر الامتحانات</b>.</div>
                <div>المحافظة / النطاق تظهر تلقائيًا حسب محافظة مشرف المحافظة ولا يمكن تعديلها.</div>
              </>
            ) : (
              <div>
                هذه الصفحة مخصصة لمالك المنصة لإدارة سوبر المحافظات وسوبر الامتحانات وسوبر الوزارة.
              </div>
            )}
          </div>
        </section>

        {isGovernorateSupervisor ? (
          renderGovernorateSupervisorCenterForm()
        ) : (
          <section style={officialCardStyle}>
            <AdminSuperUsersSection
              superEmail={superEmail}
              setSuperEmail={setSuperEmail}
              superName={superName}
              setSuperName={setSuperName}
              superRole={superRole}
              setSuperRole={setScopedSuperRole}
              superGovernorate={superGovernorate}
              setSuperGovernorate={setScopedSuperGovernorate}
              superTenantId={superTenantId}
              setSuperTenantId={setSuperTenantId}
              tenantMode={tenantMode}
              setTenantMode={setTenantMode}
              newCenterName={newCenterName}
              setNewCenterName={setNewCenterName}
              newCenterTenantId={newCenterTenantId}
              setNewCenterTenantId={setNewCenterTenantId}
              visibleTenants={visibleTenants}
              superEnabled={superEnabled}
              setSuperEnabled={setSuperEnabled}
              createSuperUser={createSuperUser}
              canCreateSuperUser={canCreateSuperUser}
              supers={supers}
              removeSuperUser={removeSuperUser}
            />
          </section>
        )}
      </main>
    </div>
  );

}
