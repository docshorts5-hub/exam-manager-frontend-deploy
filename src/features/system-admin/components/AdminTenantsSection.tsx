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

  const showCreateCard = props.showCreateCard !== false;
  const createTitle = props.createTitle || "إنشاء مدرسة جديدة (Tenant) / إدارة المدارس حسب الصلاحية";
  const createButtonLabel = props.createButtonLabel || "إنشاء مدرسة جديدة";
  const managementTitle = props.managementTitle || "إدارة المدارس (Tenants)";
  const selectLabel = props.selectLabel || "اختيار المدرسة:";
  const listTitle = props.listTitle || "قائمة المدارس حسب الصلاحية";
  const settingsTitle = props.settingsTitle || "إعدادات المدرسة الأساسية (meta/config)";
  const linkedEmailLabel = props.linkedEmailLabel || "البريد المربوط بالمدرسة";
  const linkedEmailPlaceholder = props.linkedEmailPlaceholder || "لا يوجد بريد مربوط";
  const tenantIdLabel = props.tenantIdLabel || "Tenant ID الخاص بالمدرسة";
  const tenantIdPlaceholder = props.tenantIdPlaceholder || "لا يوجد Tenant محدد";
  const entityNameLabel = props.entityNameLabel || "اسم المدرسة (عربي)";
  const saveButtonLabel = props.saveButtonLabel || "حفظ إعدادات المدرسة";
  const emptyMessage = props.emptyMessage || "لا توجد Tenants بعد.";
  const selectEntityMessage = props.selectEntityMessage || "اختر المدرسة من القائمة لعرض بياناتها.";
  const openTitle = props.openTitle || "فتح بيانات المدرسة (لمالك المنصة فقط)";
  const openErrorMessage = props.openErrorMessage || "تعذر فتح بيانات المدرسة";
  const deleteTitle = props.deleteTitle || "حذف المدرسة";
  const supportPathBuilder = props.supportPathBuilder;
  const tenantCardVariant = String(props.tenantCardVariant || "school");
  const isDiplomaCard = tenantCardVariant === "diploma";
  const toneAccent = isDiplomaCard ? "#7c5c00" : GOLD;
  const toneBorder = isDiplomaCard ? "rgba(184,134,11,0.58)" : "rgba(212,175,55,0.36)";
  const toneActiveBackground = isDiplomaCard ? "rgba(255,236,153,0.72)" : "rgba(255,255,255,0.11)";
  const toneIdleBackground = isDiplomaCard ? "rgba(255,248,214,0.62)" : "rgba(255,255,255,0.075)";
  const toneSectionBackground = isDiplomaCard
    ? "linear-gradient(135deg, rgba(255,250,220,0.92) 0%, rgba(255,236,153,0.70) 48%, rgba(212,175,55,0.34) 100%)"
    : "linear-gradient(135deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.045) 100%)";
  const toneShadow = isDiplomaCard ? "0 18px 35px rgba(184,134,11,0.18)" : "0 12px 26px rgba(0,0,0,0.08)";
  const actionButtonStyles = [
    {
      border: "1px solid rgba(37,99,235,0.55)",
      background: "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(29,78,216,0.92))",
      color: "#ffffff",
      boxShadow: "0 10px 22px rgba(37,99,235,0.24)",
    },
    {
      border: "1px solid rgba(22,163,74,0.55)",
      background: "linear-gradient(135deg, rgba(34,197,94,0.95), rgba(21,128,61,0.92))",
      color: "#ffffff",
      boxShadow: "0 10px 22px rgba(22,163,74,0.22)",
    },
    {
      border: "1px solid rgba(217,119,6,0.55)",
      background: "linear-gradient(135deg, rgba(245,158,11,0.95), rgba(180,83,9,0.92))",
      color: "#ffffff",
      boxShadow: "0 10px 22px rgba(217,119,6,0.22)",
    },
    {
      border: "1px solid rgba(147,51,234,0.55)",
      background: "linear-gradient(135deg, rgba(168,85,247,0.95), rgba(126,34,206,0.92))",
      color: "#ffffff",
      boxShadow: "0 10px 22px rgba(147,51,234,0.22)",
    },
  ];

  const visibleTenantIds = new Set((visibleTenants || []).map((t: any) => String(t?.id || "").trim()).filter(Boolean));
  const selectedTenantIdInSection = visibleTenantIds.has(String(selectedTenantId || "").trim());
  const effectiveSelectedTenantId = selectedTenantIdInSection ? selectedTenantId : "";

  return (
    <div
      className={isDiplomaCard ? "systemTenantSection systemTenantSectionDiploma" : "systemTenantSection systemTenantSectionSchool"}
      style={{ display: "grid", gridTemplateColumns: showCreateCard ? "minmax(280px, 420px) 1fr" : "1fr", gap: 14, alignItems: "start", border: `2px solid ${toneBorder}`, borderRadius: 24, background: toneSectionBackground, padding: 12, boxShadow: toneShadow }}
    >
      <style>{`
        .systemTenantSection {
          overflow: hidden !important;
          isolation: isolate !important;
        }

        .systemTenantSectionDiploma {
          background: linear-gradient(135deg, rgba(255,250,220,0.98) 0%, rgba(255,236,153,0.88) 48%, rgba(212,175,55,0.54) 100%) !important;
          border-color: rgba(184,134,11,0.78) !important;
        }

        .systemTenantSectionSchool {
          background: linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.10) 100%) !important;
          border-color: rgba(255,255,255,0.24) !important;
        }

        .systemTenantSectionDiploma > *:not(style) {
          background: linear-gradient(135deg, rgba(255,250,220,0.98) 0%, rgba(255,241,184,0.94) 52%, rgba(255,228,120,0.82) 100%) !important;
          border: 3px solid rgba(184,134,11,0.72) !important;
          box-shadow: 0 18px 38px rgba(184,134,11,0.22) !important;
          color: #2f2500 !important;
        }

        .systemTenantSectionSchool > *:not(style) {
          background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.095) 100%) !important;
          border: 2px solid rgba(255,255,255,0.22) !important;
          box-shadow: 0 14px 30px rgba(0,0,0,0.12) !important;
        }

        .systemTenantSectionDiploma .systemTenantTenantRow {
          background: linear-gradient(135deg, rgba(255,248,214,0.98) 0%, rgba(255,236,153,0.90) 100%) !important;
          border: 2px solid rgba(184,134,11,0.46) !important;
        }

        .systemTenantSectionSchool .systemTenantTenantRow {
          background: rgba(255,255,255,0.13) !important;
          border: 1px solid rgba(255,255,255,0.20) !important;
        }

        .systemTenantActionButton {
          min-width: 46px !important;
          min-height: 40px !important;
          border-radius: 14px !important;
          color: #ffffff !important;
          font-weight: 1000 !important;
          cursor: pointer !important;
        }

        .systemTenantActionOpen {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          border: 2px solid rgba(37,99,235,0.85) !important;
          box-shadow: 0 10px 22px rgba(37,99,235,0.34) !important;
        }

        .systemTenantActionDelete {
          background: linear-gradient(135deg, #f97316 0%, #c2410c 100%) !important;
          border: 2px solid rgba(249,115,22,0.88) !important;
          box-shadow: 0 10px 22px rgba(194,65,12,0.32) !important;
        }

        /* FORCED_ACTION_BUTTON_COLOR_LOCK */
        .systemTenantSection button.systemTenantActionButton.systemTenantActionOpen,
        .systemTenantSectionDiploma button.systemTenantActionButton.systemTenantActionOpen,
        .systemTenantSectionSchool button.systemTenantActionButton.systemTenantActionOpen,
        button.systemTenantActionButton.systemTenantActionOpen {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          background-color: #2563eb !important;
          border-color: #1d4ed8 !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          box-shadow: 0 10px 22px rgba(37,99,235,0.42) !important;
        }

        .systemTenantSection button.systemTenantActionButton.systemTenantActionDelete,
        .systemTenantSectionDiploma button.systemTenantActionButton.systemTenantActionDelete,
        .systemTenantSectionSchool button.systemTenantActionButton.systemTenantActionDelete,
        button.systemTenantActionButton.systemTenantActionDelete {
          background: linear-gradient(135deg, #f97316 0%, #c2410c 100%) !important;
          background-color: #f97316 !important;
          border-color: #c2410c !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          box-shadow: 0 10px 22px rgba(194,65,12,0.42) !important;
        }
      `}</style>
      {showCreateCard ? (
      <Card title={createTitle}>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>اسم المدرسة</div>
            <Input value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="مثال: أزان 9-12" />
          </div>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>Tenant ID (Subdomain)</div>
            <Input value={newTenantIdRaw} onChange={(e) => setNewTenantIdRaw(e.target.value)} placeholder="مثال: azaan-9-12" />
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              سيتم اعتماد: <b style={{ color: toneAccent }}>{newTenantId || "-"}</b>
              {!newTenantId ? null : !isValidTenantId(newTenantId) ? <span style={{ color: "#fecaca" }}> — غير صالح</span> : <span style={{ color: "#bbf7d0" }}> — صالح</span>}
            </div>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={newTenantEnabled} onChange={(e) => setNewTenantEnabled(e.target.checked)} />
            <span>مُفعّل</span>
          </label>
          <Button onClick={createTenant} disabled={!canSaveTenant}>{createButtonLabel}</Button>
        </div>
      </Card>
      ) : null}

      <Card
        title={managementTitle}
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ opacity: 0.8 }}>اختيار المدرسة:</div>
            <select
              value={effectiveSelectedTenantId ?? ""}
              onChange={(e) => setSelectedTenantId(e.target.value || null)}
              style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", minWidth: 220 }}
            >
              {visibleTenants.map((t: any) => <option key={t.id} value={t.id}>{t.id}</option>)}
            </select>
          </div>
        }
      >
        <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.85, lineHeight: 1.8 }}>
          <b style={{ color: toneAccent }}>تنبيه صلاحيات:</b>
          <br />
          مالك المنصة يمكنه إدارة جميع المدارس والدخول إلى بياناتها الداخلية حسب الصلاحيات العليا.
          <br />
          سوبر الوزارة للمشاهدة فقط ولا يدخل إلى البيانات الداخلية للمدارس.
          <br />
          سوبر المحافظات يدير المدارس داخل محافظته فقط، ولا يدخل إلى البيانات الداخلية للمدرسة.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, color: toneAccent, marginBottom: 8 }}>{listTitle}</div>
            {supportError && <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,80,80,0.35)", background: "rgba(255,80,80,0.10)", color: "#ffd6d6", fontWeight: 700, fontSize: 13 }}>{supportError}</div>}
            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflow: "auto", paddingInlineEnd: 6 }}>
              {visibleTenants.map((t: any) => {
                const active = selectedTenantIdInSection && t.id === selectedTenantId;
                return (
                  <div key={t.id} style={{ borderRadius: 14, padding: 12, border: active ? `1px solid ${toneBorder}` : "1px solid rgba(255,255,255,0.10)", background: active ? toneActiveBackground : toneIdleBackground, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }} onClick={() => setSelectedTenantId(t.id)}>
                    <div>
                      <div style={{ fontWeight: 900, color: active ? toneAccent : isDiplomaCard ? "#2f2500" : "#e5e7eb" }}>{t.name || t.id}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{t.id}</div>
                    </div>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, opacity: 0.85 }}>مُفعّل</span>
                      <input type="checkbox" checked={t.enabled !== false} onChange={(e) => toggleTenantEnabled(t.id, e.target.checked)} onClick={(e) => e.stopPropagation()} />
                    </label>
                    {canSupport && t.id !== "system" && (
                      <button
                        className="systemTenantActionButton systemTenantActionOpen"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            setSupportError("");
                            await startSupportForTenant?.(t.id, "دعم فني");
                            const targetPath = typeof supportPathBuilder === "function" ? supportPathBuilder(t.id) : `/t/${t.id}`;
                            navigate(targetPath, { replace: true });
                          } catch (err: any) {
                            console.error(openErrorMessage, err);
                            setSupportError(err?.message ?? openErrorMessage);
                          }
                        }}
                        title={openTitle}
                        style={{ ...actionButtonStyles[0], padding: "8px 10px", borderRadius: 12, cursor: "pointer", fontWeight: 900 }}
                      >📂</button>
                    )}
                    {canSupport && t.id !== "system" && (
                      <button className="systemTenantActionButton systemTenantActionDelete" onClick={(e) => { e.stopPropagation(); deleteTenant(t.id); }} title={deleteTitle} style={{ ...actionButtonStyles[2], padding: "8px 10px", borderRadius: 12, cursor: "pointer", fontWeight: 900 }}>🗑️</button>
                    )}
                  </div>
                );
              })}
              {!visibleTenants.length ? <div style={{ opacity: 0.8 }}>{emptyMessage}</div> : null}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, color: toneAccent, marginBottom: 8 }}>{settingsTitle}</div>
            {!selectedTenantIdInSection ? (
              <div style={{ opacity: 0.8 }}>{selectEntityMessage}</div>
            ) : loadingConfig ? <div style={{ opacity: 0.85 }}>جاري التحميل...</div> : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>{linkedEmailLabel}</div>
                  <Input
                    value={selectedTenantLinkedEmail || ""}
                    readOnly
                    placeholder={linkedEmailPlaceholder}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>{tenantIdLabel}</div>
                  <Input
                    value={selectedTenantResolvedId || ""}
                    readOnly
                    placeholder={tenantIdPlaceholder}
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
                  <div style={{ marginBottom: 6, opacity: 0.85 }}>{entityNameLabel}</div>
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
                <Button onClick={saveTenantConfig}>{saveButtonLabel}</Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
