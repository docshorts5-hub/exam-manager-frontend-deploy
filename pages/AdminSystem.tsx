// src/pages/AdminSystem.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./adminSystem.theme.css";
import AdminTenantsSection from "../features/system-admin/components/AdminTenantsSection";
import AdminUsersSection from "../features/system-admin/components/AdminUsersSection";
import AdminOwnerToolsSection from "../features/system-admin/components/AdminOwnerToolsSection";
import { Button, Card, GOLD, Input, LINE } from "../features/system-admin/ui";

// شعار وزارة التعليم
const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const USE_FUNCTIONS = !Boolean((import.meta as any).env?.DEV);

import { auth } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, canAccessCapability, canManageAdminSystemRole, resolvePrimaryRoleLabel } from "../features/authz";
import { callFn } from "../services/functionsClient";
import { getActionErrorMessage } from "../services/functionsRuntimePolicy";
import { useAdminTenants } from "../features/system-admin/hooks/useAdminTenants";
import { useAdminUsers } from "../features/system-admin/hooks/useAdminUsers";
import type { AllowUser } from "../features/system-admin/types";
import { createTenantAction, deleteTenantAction, saveTenantConfigAction, toggleTenantEnabledAction } from "../features/system-admin/services/adminTenantsService";
import { createAllowUserAction, inviteSingleOwnerAction, loadOwnerForTenantAction, removeAllowUserAction, updateAllowUserAction } from "../features/system-admin/services/adminUsersService";
import { isValidTenantId, normalizeRoleClient, resolveTenantGovernorate } from "../features/system-admin/services/adminSystemShared";

export default function AdminSystem() {
  const { user, profile, isSuperAdmin, isSuper, canSupport, startSupportForTenant, logout } = useAuth() as any;
  const navigate = useNavigate();

  const authzSnapshot = useMemo(() => buildAuthzSnapshot({ user, profile, isSuperAdmin, isSuper }), [user, profile, isSuperAdmin, isSuper]);
  const roleLabel = resolvePrimaryRoleLabel(authzSnapshot);
  const isPlatformOwner = canAccessCapability(authzSnapshot, "PLATFORM_OWNER");
  const canManageUsers = canAccessCapability(authzSnapshot, "USERS_MANAGE");


  const {
    visibleTenants,
    selectedTenantId,
    setSelectedTenantId,
    selectedTenantConfig,
    setSelectedTenantConfig,
    loadingConfig,
    newTenantName,
    setNewTenantName,
    newTenantIdRaw,
    setNewTenantIdRaw,
    newTenantId,
    newTenantEnabled,
    setNewTenantEnabled,
    canSaveTenant,
  } = useAdminTenants({ isPlatformOwner, isSuper, profile });

  const [ownerTenantId, setOwnerTenantId] = useState<string>("");
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [ownerDoc, setOwnerDoc] = useState<any | null>(null);
  const [ownerDocLoading, setOwnerDocLoading] = useState(false);

  const {
    newUserEmail,
    setNewUserEmail,
    newUserName,
    setNewUserName,
    newUserSchoolName,
    setNewUserSchoolName,
    newUserTenantId,
    setNewUserTenantId,
    newUserRole,
    setNewUserRole,
    newUserGovernorate,
    setNewUserGovernorate,
    newUserEnabled,
    setNewUserEnabled,
    users,
    filteredUsers,
    editDrafts,
    setDraft,
    clearDraft,
    search,
    setSearch,
  } = useAdminUsers();

  const [supportError, setSupportError] = useState<string>("");

  const [refreshingPerms, setRefreshingPerms] = useState(false);
  async function refreshMyPermissions() {
    try {
      setRefreshingPerms(true);
      if (USE_FUNCTIONS) {
        const fn = callFn<any, any>("syncMyClaims");
        await fn({});
      }
    } catch {
      // ignore
    } finally {
      try {
        await auth.currentUser?.getIdToken(true);
      } catch {
        // ignore
      }
      setRefreshingPerms(false);
    }
  }

  const canCreateUser = useMemo(() => {
    const em = newUserEmail.trim().toLowerCase();
    if (!canManageUsers) return false;
    if (!em.includes("@")) return false;
    if (!newUserTenantId) return false;
    return true;
  }, [canManageUsers, newUserEmail, newUserTenantId]);

  const canAssignNewUserRole = useMemo(() => canManageAdminSystemRole(authzSnapshot, normalizeRoleClient(newUserRole, newUserGovernorate)), [authzSnapshot, newUserRole, newUserGovernorate]);


  const createTenant = async () => {
    if (!user || !canSaveTenant) return;
    try {
      await createTenantAction({ user, tenantId: newTenantId, tenantName: newTenantName, enabled: newTenantEnabled });
      setNewTenantName("");
      setNewTenantIdRaw("");
      setNewTenantEnabled(true);
      setSelectedTenantId(newTenantId);
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر إنشاء المدرسة"));
    }
  };

  const saveTenantConfig = async () => {
    if (!user || !selectedTenantId) return;
    try {
      await saveTenantConfigAction({ user, tenantId: selectedTenantId, config: selectedTenantConfig });
      alert("تم حفظ إعدادات المدرسة.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حفظ إعدادات المدرسة."));
    }
  };

  const toggleTenantEnabled = async (tenantId: string, enabled: boolean) => {
    if (!user) return;
    try {
      await toggleTenantEnabledAction({ user, tenantId, enabled });
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر تحديث حالة المدرسة."));
    }
  };

  // حذف مدرسة + بياناتها
  const deleteTenant = async (tenantId: string) => {
    if (!user) return;
    if (tenantId === "system") {
      alert("لا يمكن حذف Tenant النظام.");
      return;
    }
    const ok = window.confirm(`هل أنت متأكد أنك تريد حذف المدرسة (Tenant): ${tenantId}؟

سيتم حذف بيانات المدرسة بالكامل.`);
    if (!ok) return;
    const alsoDeleteUsers = window.confirm(`هل تريد أيضاً حذف المستخدمين المرتبطين بهذه المدرسة من allowlist؟
(ينصح بنعم حتى لا يبقى مستخدمون مع Tenant غير موجود)`);
    try {
      setSupportError("");
      await deleteTenantAction({ user, tenantId, alsoDeleteUsers });
      setSelectedTenantId((prev) => (prev === tenantId ? "" : prev));
      alert("تم حذف المدرسة بنجاح.");
    } catch (e: any) {
      console.error(e);
      setSupportError(getActionErrorMessage(e, "تعذر حذف المدرسة"));
      alert("تعذر حذف المدرسة. تأكد من صلاحياتك ثم جرّب مرة أخرى.");
    }
  };

  const createAllowUser = async () => {
    if (!user) return;
    if (!canCreateUser || !canAssignNewUserRole) return;
    try {
      await createAllowUserAction({
        user,
        authzSnapshot,
        isSuper,
        profile,
        users,
        newUserEmail,
        newUserTenantId,
        newUserRole,
        newUserGovernorate,
        newUserEnabled,
        newUserName,
        newUserSchoolName,
        selectedTenantConfig,
      });
      setNewUserEmail("");
      setNewUserName("");
      setNewUserSchoolName("");
      setNewUserRole("user");
      setNewUserEnabled(true);
      setNewUserGovernorate("");
      await refreshMyPermissions();
      alert("تم إنشاء/تحديث المستخدم بنجاح.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حفظ المستخدم."));
    }
  };

  const updateUser = async (email: string, patch: Partial<AllowUser>) => {
    if (!user) return;
    try {
      await updateAllowUserAction({ user, users, authzSnapshot, isSuper, resolveTenantGovernorate, email, patch });
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر تعديل المستخدم."));
    }
  };

  const removeUser = async (email: string) => {
    if (!user) return;
    const ok = window.confirm(`هل تريد حذف المستخدم: ${email} ؟`);
    if (!ok) return;
    try {
      await removeAllowUserAction({ user, users, authzSnapshot, email });
      await refreshMyPermissions();
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حذف المستخدم."));
    }
  };

  const loadOwnerForTenant = async (tid: string) => {
    const id = String(tid || "").trim();
    if (!id) return;
    setOwnerDocLoading(true);
    try {
      setOwnerDoc(await loadOwnerForTenantAction(id));
    } finally {
      setOwnerDocLoading(false);
    }
  };

  const inviteSingleOwner = async () => {
    if (!user) return;
    try {
      await inviteSingleOwnerAction({ user, ownerTenantId, ownerEmail });
      alert("تمت إضافة المالك للقائمة المسموح بها. اطلب منه تسجيل الدخول مرة واحدة ليتم إنشاء meta/owner تلقائياً.");
      await loadOwnerForTenant(ownerTenantId);
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر دعوة المالك."));
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

          <div className="system-program">نظام إدارة الامتحانات المطور</div>

          <div className="system-actions">
            <span style={{ opacity: 0.85 }}>{roleLabel}</span>
            {user?.email ? <span style={{ opacity: 0.75 }}>({String(user.email)})</span> : null}
            <Button variant="ghost" onClick={() => navigate("/system/supers")} style={{ padding: "8px 10px" }}>
              إدارة سوبر المحافظات
            </Button>
            <Button variant="ghost" onClick={() => navigate("/super-system")} style={{ padding: "8px 10px" }}>
              صفحة السوبر (المحافظات)
            </Button>
            <Button variant="ghost" onClick={() => navigate("/super")} style={{ padding: "8px 10px" }}>
              العودة إلى صفحة Super
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            <Card
              title="لوحة مالك المنصة - إدارة المدارس والمستخدمين"
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ opacity: 0.85 }}>{isPlatformOwner ? "صلاحيات المالك الكاملة مفعلة" : roleLabel}</div>
                  <Button variant="ghost" onClick={refreshMyPermissions} disabled={refreshingPerms}>
                    {refreshingPerms ? "..." : "تحديث الصلاحيات"}
                  </Button>
                </div>
              }
            >
              <div style={{ color: "#e5e7eb", lineHeight: 1.9 }}>
                {isPlatformOwner ? (
                  <>
                    أنت الآن داخل <b style={{ color: GOLD }}>لوحة مالك المنصة</b>، لذلك يمكنك إدارة جميع المدارس وجميع المستخدمين والصلاحيات العليا عبر النظام بالكامل.
                    <br />
                  </>
                ) : null}
                هنا تستطيع إنشاء مدارس جديدة (Tenants) وربط المستخدمين بها بشكل صحيح.
                <br />
                <b style={{ color: GOLD }}>مهم:</b> tenantId يجب أن يكون إنجليزي صغير + أرقام + "-" فقط.
              </div>
            </Card>

            <AdminTenantsSection
              visibleTenants={visibleTenants}
              selectedTenantId={selectedTenantId}
              setSelectedTenantId={setSelectedTenantId}
              supportError={supportError}
              canSupport={canSupport}
              startSupportForTenant={startSupportForTenant}
              navigate={navigate}
              setSupportError={setSupportError}
              deleteTenant={deleteTenant}
              selectedTenantConfig={selectedTenantConfig}
              setSelectedTenantConfig={setSelectedTenantConfig}
              loadingConfig={loadingConfig}
              saveTenantConfig={saveTenantConfig}
              newTenantName={newTenantName}
              setNewTenantName={setNewTenantName}
              newTenantIdRaw={newTenantIdRaw}
              setNewTenantIdRaw={setNewTenantIdRaw}
              newTenantId={newTenantId}
              isValidTenantId={isValidTenantId}
              newTenantEnabled={newTenantEnabled}
              setNewTenantEnabled={setNewTenantEnabled}
              createTenant={createTenant}
              canSaveTenant={canSaveTenant}
              toggleTenantEnabled={toggleTenantEnabled}
            />

            <AdminUsersSection
              authzSnapshot={authzSnapshot}
              visibleTenants={visibleTenants}
              newUserEmail={newUserEmail}
              setNewUserEmail={setNewUserEmail}
              newUserName={newUserName}
              setNewUserName={setNewUserName}
              newUserSchoolName={newUserSchoolName}
              setNewUserSchoolName={setNewUserSchoolName}
              newUserTenantId={newUserTenantId}
              setNewUserTenantId={setNewUserTenantId}
              newUserRole={newUserRole}
              setNewUserRole={setNewUserRole}
              newUserGovernorate={newUserGovernorate}
              setNewUserGovernorate={setNewUserGovernorate}
              newUserEnabled={newUserEnabled}
              setNewUserEnabled={setNewUserEnabled}
              createAllowUser={createAllowUser}
              canCreateUser={canCreateUser}
              canAssignNewUserRole={canAssignNewUserRole}
              search={search}
              setSearch={setSearch}
              filteredUsers={filteredUsers}
              editDrafts={editDrafts}
              setDraft={setDraft}
              updateUser={updateUser}
              clearDraft={clearDraft}
              removeUser={removeUser}
            />

            <AdminOwnerToolsSection
              ownerTenantId={ownerTenantId}
              setOwnerTenantId={setOwnerTenantId}
              ownerEmail={ownerEmail}
              setOwnerEmail={setOwnerEmail}
              inviteSingleOwner={inviteSingleOwner}
              loadOwnerForTenant={loadOwnerForTenant}
              ownerDocLoading={ownerDocLoading}
              ownerDoc={ownerDoc}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
