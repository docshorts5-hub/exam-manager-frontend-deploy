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
import { Button, Card, LINE } from "../features/system-admin/ui";
import AdminSuperUsersSection from "../features/system-admin/components/AdminSuperUsersSection";
import {
  createAllowUserAction,
  removeAllowUserAction,
} from "../features/system-admin/services/adminUsersService";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

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
    canAccessCapability(authzSnapshot, "SYSTEM_ADMIN") && Boolean(isSuperAdmin) ||
    Boolean(profile?.isPlatformOwner || profile?.platformOwner || user?.isPlatformOwner || user?.platformOwner) ||
    values.some((v) => ["platform_owner", "owner", "super_admin", "superadmin", "مالك_المنصة", "مالك المنصة"].includes(v))
  );
};

export default function AdminSupersPage() {
  const { user, profile, isSuperAdmin, isSuper, logout } = useAuth() as any;
  const navigate = useNavigate();

  const authzSnapshot = useMemo(
    () => buildAuthzSnapshot({ user, profile, isSuperAdmin, isSuper }),
    [user, profile, isSuperAdmin, isSuper]
  );

  const isPlatformOwner = hasOwnerAccess(authzSnapshot, profile, isSuperAdmin, user);

  const [superEmail, setSuperEmail] = useState<string>("");
  const [superName, setSuperName] = useState<string>("");
  const [superRole, setSuperRole] = useState<string>("super");
  const [superGovernorate, setSuperGovernorate] = useState<string>("");
  const [superTenantId, setSuperTenantId] = useState<string>("");
  const [tenantMode, setTenantMode] = useState<"list" | "manual" | "create">("list");
  const [newCenterName, setNewCenterName] = useState<string>("");
  const [newCenterTenantId, setNewCenterTenantId] = useState<string>("");
  const [superEnabled, setSuperEnabled] = useState(true);
  const [supers, setSupers] = useState<any[]>([]);
  const [visibleTenants, setVisibleTenants] = useState<any[]>([]);

  // Commercial scope helper: this page is for platform-owner management of governorate supervisors
  // and diploma exam centers. It should not offer schools as targets for exam-center supervisors.
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
  if (!isPlatformOwner) return <Navigate to="/system" replace />;

  const loadSupers = async () => {
    const superSnap = await getDocs(query(collection(db, "allowlist"), where("role", "==", "super")));
    const examSuperSnap = await getDocs(query(collection(db, "allowlist"), where("role", "==", "exam_super")));
    const examCenterAdminSnap = await getDocs(query(collection(db, "allowlist"), where("role", "==", "exam_center_admin")));
    const diplomaCenterAdminSnap = await getDocs(query(collection(db, "allowlist"), where("role", "==", "diploma_center_admin")));
    const ministrySnap = await getDocs(query(collection(db, "allowlist"), where("role", "==", "ministry_super")));

    const byEmail = new Map<string, any>();
    [
      ...superSnap.docs,
      ...examSuperSnap.docs,
      ...examCenterAdminSnap.docs,
      ...diplomaCenterAdminSnap.docs,
      ...ministrySnap.docs,
    ].forEach((d: any) => {
      byEmail.set(String(d.id || "").toLowerCase(), { email: d.id, ...(d.data() as any) });
    });

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
      .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));
    setVisibleTenants(rows);
  };

  useEffect(() => {
    void loadSupers();
    void loadVisibleTenants();
  }, []);

  const canCreateSuperUser = useMemo(() => {
    const email = String(superEmail || "").trim().toLowerCase();
    const role = String(superRole || "").trim();
    const effectiveExamTenantId =
      tenantMode === "create" ? String(newCenterTenantId || "").trim() : String(superTenantId || "").trim();

    if (!isPlatformOwner) return false;
    if (!email.includes("@")) return false;
    if (!["super", "exam_super", "exam_center_admin", "diploma_center_admin", "ministry_super"].includes(role)) return false;
    if (role === "super" && !String(superGovernorate || "").trim()) return false;

    if (["exam_super", "exam_center_admin", "diploma_center_admin"].includes(role)) {
      if (!String(superGovernorate || "").trim()) return false;
      if (!effectiveExamTenantId) return false;
      if (tenantMode === "list") {
        const selected = visibleTenants.find((t: any) => String(t?.id || "").trim() === effectiveExamTenantId);
        if (!selected || !isExamCenterLike(selected)) return false;
      }
      if (tenantMode === "create" && !String(newCenterName || "").trim()) return false;
    }

    return true;
  }, [
    isPlatformOwner,
    superEmail,
    superRole,
    superGovernorate,
    superTenantId,
    tenantMode,
    newCenterName,
    newCenterTenantId,
    visibleTenants,
  ]);

  const createSuperUser = async () => {
    if (!user || !canCreateSuperUser) return;

    const role = String(superRole || "").trim();
    const governorate = role === "ministry_super" ? MINISTRY_SCOPE : String(superGovernorate || "").trim();
    let targetTenantId = "system";

    if (["exam_super", "exam_center_admin", "diploma_center_admin"].includes(role)) {
      targetTenantId =
        tenantMode === "create" ? String(newCenterTenantId || "").trim() : String(superTenantId || "").trim();

      if (!targetTenantId) {
        alert("يجب اختيار أو إدخال مركز الامتحانات أولًا.");
        return;
      }

      if (tenantMode === "list") {
        const selectedCenter = visibleTenants.find((t: any) => String(t?.id || "").trim() === targetTenantId);
        if (!selectedCenter || !isExamCenterLike(selectedCenter)) {
          alert("يجب اختيار مركز امتحانات دبلوم صحيح، وليس مدرسة.");
          return;
        }
      }

      if (tenantMode === "create") {
        const tenantRef = doc(db, "tenants", targetTenantId);
        const tenantSnap = await getDoc(tenantRef);

        if (tenantSnap.exists()) {
          alert("Tenant ID موجود بالفعل. اختر Tenant ID آخر.");
          return;
        }

        await setDoc(tenantRef, {
          name: String(newCenterName || "").trim(),
          schoolName: String(newCenterName || "").trim(),
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
            schoolNameAr: String(newCenterName || "").trim(),
            centerNameAr: String(newCenterName || "").trim(),
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
      }
    }

    try {
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
        newUserSchoolName: role === "exam_super" || role === "exam_center_admin" || role === "diploma_center_admin" ? String(newCenterName || "").trim() : "",
        selectedTenantConfig: {
          governorate,
          tenantGovernorate: governorate,
          tenantType: role === "exam_super" || role === "exam_center_admin" || role === "diploma_center_admin" ? "exam_center" : "system",
          type: role === "exam_super" || role === "exam_center_admin" || role === "diploma_center_admin" ? "exam_center" : "system",
          isExamCenter: role === "exam_super" || role === "exam_center_admin" || role === "diploma_center_admin",
        },
      });

      setSuperEmail("");
      setSuperName("");
      setSuperRole("super");
      setSuperGovernorate("");
      setSuperTenantId("");
      setTenantMode("list");
      setNewCenterName("");
      setNewCenterTenantId("");
      setSuperEnabled(true);

      await loadSupers();
      alert("تم حفظ السوبر بنجاح.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حفظ السوبر."));
    }
  };

  const removeSuperUser = async (email: string) => {
    if (!user) return;
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

  return (
    <div className="system-shell">
      <header className="system-header">
        <div className="system-header-inner">
          <div className="system-brand">
            <img src={MINISTRY_LOGO_URL} alt="logo" />
            <div className="system-brand-title">وزارة التعليم</div>
          </div>

          <div className="system-program">إدارة سوبر المحافظات </div>

          <div className="system-actions">
            {user?.email ? <span style={{ opacity: 0.75 }}>({String(user.email)})</span> : null}
            <Button variant="ghost" onClick={() => navigate("/system")} style={{ padding: "8px 10px" }}>
              العودة إلى لوحة مالك المنصة
            </Button>
            <Button variant="ghost" onClick={logout} style={{ padding: "8px 10px" }}>
              تسجيل خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="system-main">
        <div
          className="system-glow"
          style={{
            borderRadius: 22,
            padding: 18,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.62), rgba(0,0,0,0.35)), repeating-linear-gradient(135deg, rgba(212,175,55,0.14) 0px, rgba(212,175,55,0.14) 1px, transparent 1px, transparent 22px)",
            border: `1px solid ${LINE}`,
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <Card title="صفحة مستقلة لإدارة سوبر المحافظات وسوبر الامتحانات وسوبر الوزارة">
              <div style={{ color: "#e5e7eb", lineHeight: 1.9 }}>
                هذه الصفحة مستقلة عن لوحة مالك المنصة، ومخصصة فقط لإدارة:
                <br />
                - سوبر المحافظات
                <br />
                - سوبر / رئيس مراكز امتحانات الدبلوم
                <br />
                - سوبر الوزارة
              </div>
            </Card>

            <AdminSuperUsersSection
              superEmail={superEmail}
              setSuperEmail={setSuperEmail}
              superName={superName}
              setSuperName={setSuperName}
              superRole={superRole}
              setSuperRole={setSuperRole}
              superGovernorate={superGovernorate}
              setSuperGovernorate={setSuperGovernorate}
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
          </div>
        </div>
      </main>
    </div>
  );
}
