import React from "react";

type Props = {
  email: string;
  setEmail: (value: string) => void;
  tenant: string;
  setTenant: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
  governorate: string;
  setGovernorate: (value: string) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  busy: boolean;
  onSave: () => void;
};

const card: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,255,255,0.03)",
};

export default function SuperAdminCenterAllowlistSection(props: Props) {
  const {
    email,
    setEmail,
    tenant,
    setTenant,
    role,
    setRole,
    governorate,
    setGovernorate,
    enabled,
    setEnabled,
    busy,
    onSave,
  } = props;

  return (
    <div style={card}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>إدارة المستخدمين (allowlist)</div>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" style={{ padding: 10, borderRadius: 10 }} />
        <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="tenantId" style={{ padding: 10, borderRadius: 10 }} />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="role (user/super/...)" style={{ padding: 10, borderRadius: 10 }} />
        <input value={governorate} onChange={(e) => setGovernorate(e.target.value)} placeholder="governorate" style={{ padding: 10, borderRadius: 10 }} />

        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>

        <button disabled={busy} onClick={onSave} style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
          حفظ المستخدم
        </button>
      </div>
    </div>
  );
}
