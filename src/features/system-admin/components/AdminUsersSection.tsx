
import React from "react";
import {
  DIRECTORATES,
  MINISTRY_SCOPE,
  PRIMARY_SUPER_ADMIN_EMAIL,
} from "../../../constants/directorates";
import { canManageAdminSystemRole } from "../../authz";
import { Button, Card, GOLD, Input } from "../ui";

const norm = (v: any) => String(v || "").trim().toLowerCase();

const isSchoolRole = (role: string) => ["tenant_admin", "admin", "user", "exam_super"].includes(norm(role));
const isGovRole = (role: string) => ["super", "super_regional", "regional_super"].includes(norm(role));
const isMinistryRole = (role: string) => norm(role) === "ministry_super";
const isExamSuperRole = (role: string) => norm(role) === "exam_super";
const isOwnerRole = (role: string) => norm(role) === "super_admin";

function roleLabel(role: string) {
  const r = norm(role);
  if (r === "super_admin") return "مالك المنصة / Super Admin";
  if (r === "ministry_super") return "سوبر الوزارة";
  if (r === "super" || r === "super_regional" || r === "regional_super") return "سوبر المحافظات";
  if (r === "exam_super") return "سوبر الامتحانات";
  if (r === "tenant_admin" || r === "admin") return "أدمن المدرسة";
  return "مستخدم";
}

export default function AdminUsersSection(props: any) {
  const {
    authzSnapshot,
    visibleTenants,
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
    createAllowUser,
    canCreateUser,
    canAssignNewUserRole,
    search,
    setSearch,
    filteredUsers,
    editDrafts,
    setDraft,
    updateUser,
    clearDraft,
    removeUser,
  } = props;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 440px) 1fr", gap: 14, alignItems: "start" }}>
      <Card title="إضافة/ربط مستخدم بالمدرسة أو الصلاحيات العليا">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>البريد الإلكتروني (مفتاح الوثيقة)</div>
            <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@school.com" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ marginBottom: 6, opacity: 0.85 }}>الاسم</div>
              <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="اسم المستخدم" />
            </div>
            <div>
              <div style={{ marginBottom: 6, opacity: 0.85 }}>اسم المدرسة (اختياري)</div>
              <Input value={newUserSchoolName} onChange={(e) => setNewUserSchoolName(e.target.value)} placeholder="اسم المدرسة" />
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>الدور</div>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb" }}
            >
              <option value="tenant_admin">أدمن المدرسة</option>
              <option value="admin">أدمن المدرسة (legacy)</option>
              <option value="user">مستخدم</option>
              <option value="exam_super">سوبر الامتحانات</option>
              <option value="super">سوبر المحافظات</option>
              <option value="ministry_super">سوبر الوزارة</option>
            </select>
          </div>

          {isSchoolRole(newUserRole) ? (
            <div>
              <div style={{ marginBottom: 6, opacity: 0.85 }}>{isExamSuperRole(newUserRole) ? "اختر مركز الامتحانات (Tenant)" : "اختر المدرسة (Tenant)"}</div>
              <select
                value={newUserTenantId}
                onChange={(e) => setNewUserTenantId(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb" }}
              >
                <option value="">-- اختر --</option>
                {visibleTenants.map((t: any) => <option key={t.id} value={t.id}>{(t.name || t.id)} ({t.id})</option>)}
              </select>
            </div>
          ) : null}

          {isGovRole(newUserRole) ? (
            <div>
              <div style={{ marginBottom: 6, opacity: 0.85 }}>المحافظة</div>
              <select
                value={newUserGovernorate}
                onChange={(e) => setNewUserGovernorate(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb" }}
              >
                <option value="">اختر المحافظة</option>
                {DIRECTORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          ) : null}

          {isExamSuperRole(newUserRole) ? <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.8 }}>سيتم ربط البريد بمركز الامتحانات المختار وإعطاؤه صلاحيات التعديل والإضافة والحذف والطباعة داخل صفحات المركز.</div> : null}

          {isMinistryRole(newUserRole) ? <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.8 }}>النطاق سيتم تثبيته تلقائيًا على: <b style={{ color: GOLD }}>{MINISTRY_SCOPE}</b></div> : null}

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={newUserEnabled} onChange={(e) => setNewUserEnabled(e.target.checked)} />
            <span>مُفعّل</span>
          </label>

          <Button onClick={createAllowUser} disabled={!canCreateUser || !canAssignNewUserRole}>حفظ المستخدم</Button>
        </div>
      </Card>

      <Card title="قائمة المستخدمين (allowlist)" right={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث: email / tenant / governorate / role..." style={{ width: 360 }} />}>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
            <thead>
              <tr style={{ textAlign: "right", opacity: 0.9 }}>
                <th style={{ padding: "0 10px" }}>Email</th>
                <th style={{ padding: "0 10px" }}>الدور</th>
                <th style={{ padding: "0 10px" }}>Tenant</th>
                <th style={{ padding: "0 10px" }}>المحافظة / النطاق</th>
                <th style={{ padding: "0 10px" }}>الحالة</th>
                <th style={{ padding: "0 10px" }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u: any) => {
                const key = String(u.email || "").toLowerCase().trim();
                const isPrimaryRow = key === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
                const draft = editDrafts[key] || {};
                const view = { ...u, ...draft } as any;

                if (isPrimaryRow) {
                  view.role = "super_admin";
                  view.enabled = true;
                  view.tenantId = "";
                  view.schoolName = "";
                  view.tenantName = "";
                  view.tenantGovernorate = "";
                }

                const currentRole = norm(view.role || "");
                if (!isSchoolRole(currentRole) || isOwnerRole(currentRole)) {
                  view.tenantId = "";
                  view.schoolName = "";
                  view.tenantName = "";
                  view.tenantGovernorate = "";
                }
                const dirty = Object.keys(draft).length > 0;
                const canManageRowRole = canManageAdminSystemRole(authzSnapshot, currentRole as any);
                const showTenantSelect = isSchoolRole(currentRole) && !isOwnerRole(currentRole);

                return (
                  <tr key={u.email} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <td style={{ padding: "12px 10px", borderTopLeftRadius: 14, borderBottomLeftRadius: 14, verticalAlign: "top" }}>
                      <div style={{ fontWeight: 900, color: "#e5e7eb" }}>{u.email}</div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>{u.userName || u.name || u.schoolName || u.tenantName || ""}</div>
                    </td>

                    <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                      <select
                        value={view.role || "user"}
                        disabled={isPrimaryRow || !canManageRowRole}
                        onChange={(e) => {
                          if (isPrimaryRow || !canManageRowRole) return;
                          const nextRole = e.target.value;
                          const patch: any = { role: nextRole };
                          if (isMinistryRole(nextRole)) patch.governorate = MINISTRY_SCOPE;
                          else if (!isGovRole(nextRole)) patch.governorate = "";
                          if (!isSchoolRole(nextRole) || isOwnerRole(nextRole)) {
                            patch.tenantId = "";
                            patch.schoolName = "";
                            patch.tenantName = "";
                            patch.tenantGovernorate = "";
                          }
                          setDraft(u.email, patch);
                        }}
                        style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", minWidth: 210 }}
                      >
                        <option value="super_admin">مالك المنصة / super_admin</option>
                        <option value="ministry_super">سوبر الوزارة</option>
                        <option value="super">سوبر المحافظات</option>
                        <option value="tenant_admin">أدمن المدرسة</option>
                        <option value="admin">أدمن المدرسة (legacy)</option>
                        <option value="user">مستخدم</option>
                      </select>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{roleLabel(view.role)}</div>
                    </td>

                    <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                      {showTenantSelect ? (
                        <select
                          value={view.tenantId || ""}
                          disabled={isPrimaryRow || !canManageRowRole}
                          onChange={(e) => {
                            if (isPrimaryRow || !canManageRowRole) return;
                            setDraft(u.email, { tenantId: e.target.value });
                          }}
                          style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", minWidth: 240 }}
                        >
                          <option value="">-- اختر المدرسة --</option>
                          {visibleTenants.map((t: any) => <option key={t.id} value={t.id}>{(t.name || t.id)} ({t.id})</option>)}
                        </select>
                      ) : <div style={{ opacity: 0.8, fontSize: 13 }}>—</div>}
                    </td>

                    <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                      {isGovRole(currentRole) ? (
                        <select
                          value={view.governorate || ""}
                          disabled={isPrimaryRow || !canManageRowRole}
                          onChange={(e) => {
                            if (isPrimaryRow || !canManageRowRole) return;
                            setDraft(u.email, { governorate: e.target.value, tenantId: "", schoolName: "", tenantName: "", tenantGovernorate: "" });
                          }}
                          style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", minWidth: 240 }}
                        >
                          <option value="">اختر المحافظة</option>
                          {DIRECTORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      ) : isMinistryRole(currentRole) ? (
                        <div style={{ opacity: 0.9, fontWeight: 700 }}>{MINISTRY_SCOPE}</div>
                      ) : (
                        <div style={{ opacity: 0.8, fontSize: 13 }}>{view.governorate || view.tenantGovernorate || "-"}</div>
                      )}
                    </td>

                    <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" checked={!!view.enabled} disabled={isPrimaryRow || !canManageRowRole} onChange={(e) => {
                          if (isPrimaryRow || !canManageRowRole) return;
                          setDraft(u.email, { enabled: e.target.checked });
                        }} />
                        <span style={{ fontSize: 12, opacity: 0.9 }}>{view.enabled ? "مفعّل" : "غير مفعّل"}</span>
                      </label>
                    </td>

                    <td style={{ padding: "12px 10px", borderTopRightRadius: 14, borderBottomRightRadius: 14, verticalAlign: "top" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button variant="ghost" disabled={!dirty || isPrimaryRow || !canManageRowRole} onClick={async () => {
                          const patch = editDrafts[key] || {};
                          if (!Object.keys(patch).length) return;
                          await updateUser(u.email, patch);
                          clearDraft(u.email);
                        }}>تعديل</Button>
                        <Button variant="danger" disabled={isPrimaryRow || !canManageRowRole} onClick={() => {
                          if (isPrimaryRow || !canManageRowRole) return;
                          removeUser(u.email);
                        }}>حذف</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredUsers.length ? <div style={{ opacity: 0.85 }}>لا يوجد نتائج.</div> : null}
        </div>
      </Card>
    </div>
  );
}
