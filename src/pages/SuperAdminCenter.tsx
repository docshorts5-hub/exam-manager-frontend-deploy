import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import { buildAuthzSnapshot, canAccessCapability, isPlatformOwner } from "../features/authz";
import { useSuperAdminCenter } from "../features/super-admin/hooks/useSuperAdminCenter";
import SuperAdminCenterAllowlistSection from "../features/super-admin/components/SuperAdminCenterAllowlistSection";
import SuperAdminCenterBackupSection from "../features/super-admin/components/SuperAdminCenterBackupSection";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0b1020",
  color: "#f5e7b2",
  direction: "rtl",
  padding: 18,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,255,255,0.03)",
};


export default function SuperAdminCenter() {
  const auth = useAuth() as any;
  const { user, profile, allow } = auth;
  const { tenantId: tenantFromContext } = useTenant() as any;

  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const owner = isPlatformOwner(authzSnapshot);
  const canManageUsers = canAccessCapability(authzSnapshot, "USERS_MANAGE");

  const currentGovernorate = String(
    allow?.governorate || profile?.governorate || user?.governorate || ""
  ).trim();

  const tenantId = String(tenantFromContext || user?.tenantId || "default").trim() || "default";

  const allowedRoles = owner
    ? ["user", "admin", "tenant_admin", "exam_super", "super", "ministry_super", "platform_owner"]
    : ["user", "admin", "tenant_admin", "exam_super"];

  const [email, setEmail] = useState("");
  const [tenant, setTenant] = useState(tenantId);
  const [role, setRoleState] = useState(owner ? "user" : "tenant_admin");
  const [governorate, setGovernorateState] = useState(owner ? "" : currentGovernorate);
  const [enabled, setEnabled] = useState(true);

  const safeRole = allowedRoles.includes(role) ? role : allowedRoles[0];
  const safeGovernorate = owner ? governorate : currentGovernorate;

  const setRole = (nextRole: string) => {
    if (!allowedRoles.includes(nextRole)) return;
    setRoleState(nextRole);
  };

  const setGovernorate = (nextGovernorate: string) => {
    if (!owner) {
      setGovernorateState(currentGovernorate);
      return;
    }
    setGovernorateState(nextGovernorate);
  };

  const { busy, msg, cloudCount, saveAllow, runBackup, toggleAutoBackup } = useSuperAdminCenter(tenantId, user);

  if (!user) return <Navigate to="/login" replace />;
  if (!canManageUsers) return <Navigate to="/" replace />;

  return (
    <div style={page}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>مركز تحكم Super Admin</div>
          <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800, fontSize: 13 }}>
            Tenant الحالي: <b>{tenantId}</b>
            {owner ? <> • نسخ سحابية: <b>{cloudCount}</b></> : null}
          </div>
          {msg && <div style={{ marginTop: 10, fontWeight: 900 }}>{msg}</div>}
        </div>

        <SuperAdminCenterAllowlistSection
          email={email}
          setEmail={setEmail}
          tenant={tenant}
          setTenant={setTenant}
          role={safeRole}
          setRole={setRole}
          governorate={safeGovernorate}
          setGovernorate={setGovernorate}
          enabled={enabled}
          setEnabled={setEnabled}
          busy={!!busy}
          onSave={() =>
            saveAllow({
              email,
              enabled,
              tenantId: tenant,
              role: safeRole,
              governorate: safeGovernorate,
            })
          }
        />

        {!owner && !currentGovernorate ? (
          <div style={card}>
            لا يمكن حفظ مستخدم جديد قبل تحديد محافظة مشرف المحافظة في حسابك.
          </div>
        ) : null}

        {owner ? (
          <SuperAdminCenterBackupSection
            busy={!!busy}
            onRunBackup={runBackup}
            onToggleAutoBackup={toggleAutoBackup}
          />
        ) : null}
      </div>
    </div>
  );
}
