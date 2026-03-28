import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
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
  const { user } = useAuth() as any;
  const { tenantId: tenantFromContext } = useTenant() as any;
  const tenantId = String(tenantFromContext || user?.tenantId || "default").trim() || "default";

  const [email, setEmail] = useState("");
  const [tenant, setTenant] = useState(tenantId);
  const [role, setRole] = useState("user");
  const [governorate, setGovernorate] = useState("");
  const [enabled, setEnabled] = useState(true);

  const { busy, msg, cloudCount, saveAllow, runBackup, toggleAutoBackup } = useSuperAdminCenter(tenantId, user);

  return (
    <div style={page}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>مركز تحكم Super Admin</div>
          <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800, fontSize: 13 }}>
            Tenant الحالي: <b>{tenantId}</b> • نسخ سحابية: <b>{cloudCount}</b>
          </div>
          {msg && <div style={{ marginTop: 10, fontWeight: 900 }}>{msg}</div>}
        </div>

        <SuperAdminCenterAllowlistSection
          email={email}
          setEmail={setEmail}
          tenant={tenant}
          setTenant={setTenant}
          role={role}
          setRole={setRole}
          governorate={governorate}
          setGovernorate={setGovernorate}
          enabled={enabled}
          setEnabled={setEnabled}
          busy={!!busy}
          onSave={() => saveAllow({ email, enabled, tenantId: tenant, role, governorate })}
        />

        <SuperAdminCenterBackupSection
          busy={!!busy}
          onRunBackup={runBackup}
          onToggleAutoBackup={toggleAutoBackup}
        />
      </div>
    </div>
  );
}
