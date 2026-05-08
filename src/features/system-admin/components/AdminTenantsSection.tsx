import React from "react";
import { DIRECTORATES } from "../../../constants/directorates";
import { Button, Card, GOLD, Input } from "../ui";

export default function AdminTenantsSection(props: any) {
  const {
    visibleTenants,
    selectedTenantId,
    setSelectedTenantId,
    supportError,
    canSupport,
    startSupportForTenant,
    navigate,
    setSupportError,
    deleteTenant,
    selectedTenantConfig,
    setSelectedTenantConfig,
    selectedTenantLinkedEmail,
    selectedTenantResolvedId,
    loadingConfig,
    saveTenantConfig,
    newTenantName,
    setNewTenantName,
    newTenantIdRaw,
    setNewTenantIdRaw,
    newTenantId,
    isValidTenantId,
    newTenantEnabled,
    setNewTenantEnabled,
    createTenant,
    canSaveTenant,
    toggleTenantEnabled,
  } = props;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) 1fr", gap: 14, alignItems: "start" }}>
      <Card title="إنشاء مدرسة جديدة (Tenant) / إدارة المدارس حسب الصلاحية">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>اسم المدرسة</div>
            <Input value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="مثال: أزان 9-12" />
          </div>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>Tenant ID (Subdomain)</div>
            <Input value={newTenantIdRaw} onChange={(e) => setNewTenantIdRaw(e.target.value)} placeholder="مثال: azaan-9-12" />
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              سيتم اعتماد: <b style={{ color: GOLD }}>{newTenantId || "-"}</b>
              {!newTenantId ? null : !isValidTenantId(newTenantId) ? <span style={{ color: "#fecaca" }}> — غير صالح</span> : <span style={{ color: "#bbf7d0" }}> — صالح</span>}
            </div>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={newTenantEnabled} onChange={(e) => setNewTenantEnabled(e.target.checked)} />
            <span>مُفعّل</span>
          </label>
          <Button onClick={createTenant} disabled={!canSaveTenant}>إنشاء مدرسة جديدة</Button>
        </div>
      </Card>

      <Card
        title="إدارة المدارس (Tenants)"
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ opacity: 0.8 }}>اختيار المدرسة:</div>
            <select
              value={selectedTenantId ?? ""}
              onChange={(e) => setSelectedTenantId(e.target.value || null)}
              style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", minWidth: 220 }}
            >
              {visibleTenants.map((t: any) => <option key={t.id} value={t.id}>{t.id}</option>)}
            </select>
          </div>
        }
      >
        <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.85, lineHeight: 1.8 }}>
          <b style={{ color: GOLD }}>تنبيه صلاحيات:</b>
          <br />
          مالك المنصة يمكنه إدارة جميع المدارس والدخول إلى بياناتها الداخلية حسب الصلاحيات العليا.
          <br />
          سوبر الوزارة للمشاهدة فقط ولا يدخل إلى البيانات الداخلية للمدارس.
          <br />
          سوبر المحافظات يدير المدارس داخل محافظته فقط، ولا يدخل إلى البيانات الداخلية للمدرسة.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, color: GOLD, marginBottom: 8 }}>قائمة المدارس حسب الصلاحية</div>
            {supportError && <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,80,80,0.35)", background: "rgba(255,80,80,0.10)", color: "#ffd6d6", fontWeight: 700, fontSize: 13 }}>{supportError}</div>}
            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflow: "auto", paddingInlineEnd: 6 }}>
              {visibleTenants.map((t: any) => {
                const active = t.id === selectedTenantId;
                return (
                  <div key={t.id} style={{ borderRadius: 14, padding: 12, border: active ? `1px solid rgba(212,175,55,0.45)` : "1px solid rgba(255,255,255,0.10)", background: active ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }} onClick={() => setSelectedTenantId(t.id)}>
                    <div>
                      <div style={{ fontWeight: 900, color: active ? GOLD : "#e5e7eb" }}>{t.name || t.id}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{t.id}</div>
                    </div>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, opacity: 0.85 }}>مُفعّل</span>
                      <input type="checkbox" checked={t.enabled !== false} onChange={(e) => toggleTenantEnabled(t.id, e.target.checked)} onClick={(e) => e.stopPropagation()} />
                    </label>
                    {canSupport && t.id !== "system" && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            setSupportError("");
                            await startSupportForTenant?.(t.id, "دعم فني");
                            navigate(`/t/${t.id}`, { replace: true });
                          } catch (err: any) {
                            console.error("تعذر فتح بيانات المدرسة", err);
                            setSupportError(err?.message ?? "تعذر فتح بيانات المدرسة");
                          }
                        }}
                        title="فتح بيانات المدرسة (لمالك المنصة فقط)"
                        style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.12)", color: "#bfdbfe", cursor: "pointer", fontWeight: 900 }}
                      >📂</button>
                    )}
                    {canSupport && t.id !== "system" && (
                      <button onClick={(e) => { e.stopPropagation(); deleteTenant(t.id); }} title="حذف المدرسة" style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.12)", color: "#fecaca", cursor: "pointer", fontWeight: 900 }}>🗑️</button>
                    )}
                  </div>
                );
              })}
              {!visibleTenants.length ? <div style={{ opacity: 0.8 }}>لا توجد Tenants بعد.</div> : null}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, color: GOLD, marginBottom: 8 }}>إعدادات المدرسة الأساسية (meta/config)</div>
            {loadingConfig ? <div style={{ opacity: 0.85 }}>جاري التحميل...</div> : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>البريد المربوط بالمدرسة</div>
                  <Input
                    value={selectedTenantLinkedEmail || ""}
                    readOnly
                    placeholder="لا يوجد بريد مربوط"
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>Tenant ID الخاص بالمدرسة</div>
                  <Input
                    value={selectedTenantResolvedId || ""}
                    readOnly
                    placeholder="لا يوجد Tenant محدد"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>الوزارة (عربي)</div>
                    <Input value={selectedTenantConfig.ministryAr || ""} onChange={(e) => setSelectedTenantConfig((p: any) => ({ ...p, ministryAr: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>اسم النظام (عربي)</div>
                    <Input value={selectedTenantConfig.systemNameAr || ""} onChange={(e) => setSelectedTenantConfig((p: any) => ({ ...p, systemNameAr: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>اسم المدرسة (عربي)</div>
                  <Input value={selectedTenantConfig.schoolNameAr || ""} onChange={(e) => setSelectedTenantConfig((p: any) => ({ ...p, schoolNameAr: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>المحافظة</div>
                    <select value={selectedTenantConfig.governorate || selectedTenantConfig.regionAr || ""} onChange={(e) => setSelectedTenantConfig((p: any) => ({ ...p, governorate: e.target.value, regionAr: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,215,0,0.25)", background: "rgba(0,0,0,0.35)", color: "#FFD700", outline: "none" }}>
                      <option value="">اختر المحافظة</option>
                      {DIRECTORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>الولاية</div>
                    <Input value={selectedTenantConfig.wilayatAr || ""} onChange={(e) => setSelectedTenantConfig((p: any) => ({ ...p, wilayatAr: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>Logo URL</div>
                  <Input value={selectedTenantConfig.logoUrl || ""} onChange={(e) => setSelectedTenantConfig((p: any) => ({ ...p, logoUrl: e.target.value }))} />
                </div>
                <Button onClick={saveTenantConfig}>حفظ إعدادات المدرسة</Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
