import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import { useCan } from "../auth/permissions";
import {
  deleteTenantMember,
  listTenantMembers,
  upsertTenantMember,
  type TenantMemberRecord,
  type TenantMemberRole,
} from "../services/distributionCollaboration.service";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#071225",
  color: "#f5e7b2",
  direction: "rtl",
  padding: 18,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.22)",
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  padding: 16,
  boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  background: "rgba(2,6,23,.58)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#f8fafc",
  outline: "none",
};

const btn = (kind: "brand" | "soft" | "danger"): React.CSSProperties => ({
  borderRadius: 12,
  border: "1px solid rgba(212,175,55,0.30)",
  cursor: "pointer",
  padding: "10px 14px",
  fontWeight: 900,
  color: kind === "danger" ? "#fecaca" : "#f5e7b2",
  background:
    kind === "brand"
      ? "rgba(212,175,55,0.18)"
      : kind === "danger"
      ? "rgba(239,68,68,0.12)"
      : "rgba(255,255,255,0.05)",
});

const roleOptions: { value: TenantMemberRole; label: string }[] = [
  { value: "tenant_admin", label: "مدير الجهة" },
  { value: "manager", label: "مدير" },
  { value: "staff", label: "تشغيل" },
  { value: "viewer", label: "مشاهد" },
];

export default function TeamMembers() {
  const auth = useAuth() as any;
  const { can } = useCan();
  const { tenantId: tenantFromContext } = useTenant() as any;
  const tenantId = String(tenantFromContext || auth?.effectiveTenantId || auth?.userProfile?.tenantId || "default").trim() || "default";

  const [items, setItems] = useState<TenantMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    roles: ["staff"] as TenantMemberRole[],
    enabled: true,
  });

  const canManage = can("USERS_MANAGE");

  async function refresh() {
    setLoading(true);
    try {
      const rows = await listTenantMembers(tenantId);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) =>
      [x.email, x.displayName, (x.roles || []).join(" ")].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [items, search]);

  const onSubmit = async () => {
    if (!canManage) return;
    setSaving(true);
    setMessage("");
    try {
      await upsertTenantMember({
        tenantId,
        email: form.email,
        displayName: form.displayName,
        roles: form.roles,
        enabled: form.enabled,
        actorEmail: auth?.user?.email || "",
      });
      setForm({ email: "", displayName: "", roles: ["staff"], enabled: true });
      setMessage("تم حفظ العضو وربطه بالجهة.");
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || "تعذر حفظ العضو.");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (item: TenantMemberRecord, nextRole: TenantMemberRole) => {
    await upsertTenantMember({
      tenantId,
      email: item.email,
      displayName: item.displayName,
      roles: [nextRole],
      enabled: item.enabled,
      actorEmail: auth?.user?.email || "",
    });
    await refresh();
  };

  const updateEnabled = async (item: TenantMemberRecord, enabled: boolean) => {
    await upsertTenantMember({
      tenantId,
      email: item.email,
      displayName: item.displayName,
      roles: item.roles,
      enabled,
      actorEmail: auth?.user?.email || "",
    });
    await refresh();
  };

  return (
    <div style={page}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>فريق العمل والصلاحيات</h1>
            <div style={{ marginTop: 8, opacity: 0.8, fontWeight: 700 }}>
              نظام متعدد المستخدمين: دعوة الأعضاء وربطهم بهذه الجهة مع صلاحيات تشغيل واضحة.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ opacity: 0.75, fontSize: 13 }}>Tenant: {tenantId}</span>
            <button style={btn("soft")} onClick={refresh}>تحديث</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 420px) 1fr", gap: 16, alignItems: "start" }}>
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>إضافة عضو</div>
            {!canManage ? (
              <div style={{ color: "#fecaca", fontWeight: 800 }}>لا تملك صلاحية إدارة المستخدمين في هذه الجهة.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <input style={input} value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="البريد الإلكتروني" />
                <input style={input} value={form.displayName} onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))} placeholder="الاسم الظاهر" />
                <select
                  style={input}
                  value={form.roles[0]}
                  onChange={(e) => setForm((s) => ({ ...s, roles: [e.target.value as TenantMemberRole] }))}
                >
                  {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                  <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.checked }))} />
                  <span>مُفعّل</span>
                </label>
                <button style={btn("brand")} disabled={saving} onClick={onSubmit}>{saving ? "جارٍ الحفظ..." : "حفظ العضو"}</button>
                {message ? <div style={{ fontWeight: 800, opacity: 0.9 }}>{message}</div> : null}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>أعضاء الجهة</div>
              <input style={{ ...input, width: 280 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث" />
            </div>
            {loading ? <div>جارٍ التحميل...</div> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                  <thead>
                    <tr style={{ textAlign: "right", opacity: 0.8 }}>
                      <th style={{ padding: "0 10px" }}>الاسم</th>
                      <th style={{ padding: "0 10px" }}>البريد</th>
                      <th style={{ padding: "0 10px" }}>الدور</th>
                      <th style={{ padding: "0 10px" }}>الحالة</th>
                      <th style={{ padding: "0 10px" }}>المصدر</th>
                      <th style={{ padding: "0 10px" }}>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.email} style={{ background: "rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: 12, borderTopRightRadius: 14, borderBottomRightRadius: 14 }}>{item.displayName || "—"}</td>
                        <td style={{ padding: 12 }}>{item.email}</td>
                        <td style={{ padding: 12 }}>
                          <select style={input} value={item.roles?.[0] || "viewer"} onChange={(e) => updateRole(item, e.target.value as TenantMemberRole)} disabled={!canManage}>
                            {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="checkbox" checked={!!item.enabled} onChange={(e) => updateEnabled(item, e.target.checked)} disabled={!canManage} />
                            <span>{item.enabled ? "مفعل" : "موقوف"}</span>
                          </label>
                        </td>
                        <td style={{ padding: 12 }}>{item.source === "both" ? "محلي + سحابي" : item.source === "cloud" ? "سحابي" : "محلي"}</td>
                        <td style={{ padding: 12, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }}>
                          <button style={btn("danger")} disabled={!canManage} onClick={() => deleteTenantMember(tenantId, item.email).then(refresh)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length ? <div style={{ opacity: 0.8, fontWeight: 800 }}>لا يوجد أعضاء بعد.</div> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
