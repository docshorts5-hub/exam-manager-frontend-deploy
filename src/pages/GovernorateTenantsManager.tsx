import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DIRECTORATES } from "../constants/directorates";
import {
  clearRegionalSuperTenantBindingAction,
  getTenantManagerDetailsAction,
  listRegionalSupersAction,
  listTenantsGroupedByGovernorateAction,
  migrateTenantIdAction,
  updateRegionalSuperGovernorateAction,
} from "../features/system-admin/services/adminTenantGovernorateTools";

const GOLD = "#d4af37";
const LINE = "rgba(212,175,55,0.22)";
const PANEL_BG = "rgba(255,255,255,0.03)";
const HEADER_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#071225",
  color: "#f5e7b2",
  padding: 16,
  direction: "rtl",
};

const shell: React.CSSProperties = {
  maxWidth: 1700,
  margin: "0 auto",
  display: "grid",
  gap: 14,
};

const panel: React.CSSProperties = {
  border: `1px solid ${LINE}`,
  borderRadius: 24,
  background: PANEL_BG,
  padding: 18,
  boxShadow: "0 18px 40px rgba(0,0,0,0.32)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  background: "#000000",
  border: "1px solid rgba(212,175,55,0.30)",
  color: "#d4af37",
  outline: "none",
  boxSizing: "border-box",
};

const actionBtn = (kind: "gold" | "soft" | "danger" = "gold"): React.CSSProperties => ({
  padding: "10px 16px",
  borderRadius: 14,
  border:
    kind === "danger"
      ? "1px solid rgba(239,68,68,0.35)"
      : kind === "soft"
      ? "1px solid rgba(255,255,255,0.14)"
      : "1px solid rgba(212,175,55,0.30)",
  background:
    kind === "danger"
      ? "rgba(239,68,68,0.12)"
      : kind === "soft"
      ? "rgba(255,255,255,0.05)"
      : "rgba(212,175,55,0.16)",
  color: kind === "danger" ? "#fecaca" : "#f5e7b2",
  fontWeight: 900,
  cursor: "pointer",
});

const labelStyle: React.CSSProperties = {
  marginBottom: 6,
  opacity: 0.88,
  fontWeight: 800,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  background: "#000000",
  border: "1px solid rgba(212,175,55,0.30)",
  color: "#d4af37",
  outline: "none",
  boxSizing: "border-box",
  appearance: "none" as any,
  WebkitAppearance: "none" as any,
  MozAppearance: "none" as any,
};

const optionStyle: React.CSSProperties = {
  background: "#000000",
  color: "#d4af37",
};

function mapGovernorateTenantManagerError(error: any, fallback: string) {
  const code = String(error?.message || error || "").trim();

  if (code === "MISSING_TENANT_ID") return "لم يتم تحديد المدرسة.";
  if (code === "TENANT_NOT_FOUND") return "المدرسة المحددة غير موجودة.";
  if (code === "MISSING_OLD_TENANT_ID") return "Tenant الحالي غير محدد.";
  if (code === "MISSING_NEW_TENANT_ID") return "أدخل Tenant ID الجديد.";
  if (code === "INVALID_NEW_TENANT_ID") return "Tenant ID الجديد غير صالح.";
  if (code === "SAME_TENANT_ID") return "Tenant ID الجديد مطابق للحالي.";
  if (code === "OLD_TENANT_NOT_FOUND") return "Tenant الحالي غير موجود.";
  if (code === "NEW_TENANT_ALREADY_EXISTS") return "Tenant ID الجديد مستخدم مسبقًا.";
  if (code === "MISSING_EMAIL") return "البريد الإلكتروني غير موجود.";
  if (code === "USER_NOT_FOUND") return "المستخدم غير موجود.";
  if (code === "NOT_REGIONAL_SUPER") return "هذا المستخدم ليس من نوع سوبر المحافظات.";
  if (code === "MISSING_GOVERNORATE") return "اختر المحافظة أولًا.";
  if (code === "Missing or insufficient permissions." || /permission/i.test(code)) {
    return "لا توجد صلاحية كافية لتنفيذ هذه العملية.";
  }

  return fallback;
}

export default function GovernorateTenantsManager() {
  const { user, logout } = useAuth() as any;
  const navigate = useNavigate();

  const [rows, setRows] = useState<any[]>([]);
  const [supers, setSupers] = useState<any[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [details, setDetails] = useState<any | null>(null);
  const [newTenantId, setNewTenantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    const [tenantRows, superRows] = await Promise.all([
      listTenantsGroupedByGovernorateAction(),
      listRegionalSupersAction(),
    ]);
    setRows(tenantRows);
    setSupers(superRows);
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedTenantId) {
      setDetails(null);
      return;
    }
    getTenantManagerDetailsAction(selectedTenantId)
      .then((result: any) => {
        setDetails(result);
        setMsg("");
      })
      .catch((e: any) => {
        setDetails(null);
        setMsg(mapGovernorateTenantManagerError(e, "تعذر تحميل بيانات المدرسة."));
      });
  }, [selectedTenantId]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of rows) {
      const gov = String(row?.governorate || "غير مصنفة").trim();
      if (!selectedGovernorate || gov === selectedGovernorate) {
        if (!map.has(gov)) map.set(gov, []);
        map.get(gov)!.push(row);
      }
    }
    return Array.from(map.entries());
  }, [rows, selectedGovernorate]);

  const selectedTenantName = String(
    details?.schoolName ||
      details?.schoolNameAr ||
      details?.name ||
      rows.find((r: any) => String(r?.tenantId || "") === String(selectedTenantId || ""))?.schoolName ||
      selectedTenantId ||
      ""
  ).trim();

  async function doMigrate() {
    if (!user || !selectedTenantId || !newTenantId.trim()) return;
    const ok = window.confirm(
      `هل تريد نقل Tenant المدرسة "${selectedTenantName || selectedTenantId}" من "${selectedTenantId}" إلى "${newTenantId.trim()}"؟`
    );
    if (!ok) return;

    setBusy(true);
    try {
      await migrateTenantIdAction({
        user,
        oldTenantId: selectedTenantId,
        newTenantId: newTenantId.trim(),
      });
      setMsg("تم نقل Tenant بنجاح.");
      setNewTenantId("");
      setSelectedTenantId(newTenantId.trim());
      await refresh();
    } catch (e: any) {
      setMsg(mapGovernorateTenantManagerError(e, "تعذر تنفيذ نقل Tenant."));
    } finally {
      setBusy(false);
    }
  }

  async function clearRegionalBinding(email: string) {
    const ok = window.confirm("هل تريد تنظيف Tenant المربوط بهذا السوبر؟");
    if (!ok) return;

    setBusy(true);
    try {
      await clearRegionalSuperTenantBindingAction({
        user,
        email,
      });
      setMsg("تم تنظيف Tenant المرتبط بسوبر المحافظات.");
      await refresh();
    } catch (e: any) {
      setMsg(mapGovernorateTenantManagerError(e, "تعذر تنظيف Tenant."));
    } finally {
      setBusy(false);
    }
  }

  async function saveSuperGovernorate(email: string, governorate: string) {
    setBusy(true);
    try {
      await updateRegionalSuperGovernorateAction({
        user,
        email,
        governorate,
      });
      setMsg("تم تحديث محافظة سوبر المحافظات.");
      await refresh();
    } catch (e: any) {
      setMsg(mapGovernorateTenantManagerError(e, "تعذر تحديث المحافظة."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={page}>
      <div style={shell}>
        <header
          style={{
            border: `1px solid ${GOLD}`,
            borderRadius: 24,
            padding: 18,
            background:
              "linear-gradient(135deg, rgba(28,20,2,0.96), rgba(8,8,8,0.98), rgba(30,20,3,0.95))",
            boxShadow: "0 20px 45px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={actionBtn("soft")} onClick={() => navigate("/system")}>
                العودة إلى لوحة مالك المنصة
              </button>
              <button style={actionBtn("soft")} onClick={logout}>
                تسجيل خروج
              </button>
              <div style={{ fontWeight: 800, opacity: 0.92 }}>
                ({String(user?.email || "")})
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, fontWeight: 950, color: GOLD }}>المدارس حسب المحافظات</div>
              <div style={{ marginTop: 8, fontSize: 18, opacity: 0.9 }}>إدارة المدارس و Tenant والسوبرات</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 12 }}>
              <img
                src={HEADER_LOGO_URL}
                alt="شعار وزارة التعليم"
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "contain",
                  borderRadius: 14,
                  border: "1px solid rgba(212,175,55,0.28)",
                  background: "rgba(255,255,255,0.03)",
                  padding: 4,
                }}
              />
              <div style={{ textAlign: "left", fontSize: 26, fontWeight: 950, color: GOLD }}>
                وزارة التعليم
              </div>
            </div>
          </div>
        </header>

        <div style={panel}>
          <div style={{ fontWeight: 900, color: GOLD, marginBottom: 8 }}>صفحة مستقلة لإدارة المدارس وTenant</div>
          <div style={{ lineHeight: 1.95, opacity: 0.92 }}>
            هذه الصفحة تعرض المدارس مرتبة حسب المحافظات، وتسمح بعرض بيانات المدرسة المختارة، وتنفيذ نقل آمن
            لـ Tenant ID، كما تسمح بتصحيح أي Tenant مربوط بسوبر المحافظات لأن الصحيح أن سوبر المحافظات يرتبط
            بالمحافظة فقط.
          </div>
        </div>

        {msg ? (
          <div
            style={{
              ...panel,
              color: "#fff8dc",
              border: "1px solid rgba(212,175,55,0.35)",
              background: "rgba(212,175,55,0.10)",
              fontWeight: 800,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={panel}>
              <div style={{ fontWeight: 900, color: GOLD, marginBottom: 12 }}>بيانات المدرسة المحددة</div>
              {!selectedTenantId ? (
                <div style={{ opacity: 0.84 }}>اختر مدرسة أولًا.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={labelStyle}>اسم المدرسة</div>
                      <input style={input} value={selectedTenantName} readOnly />
                    </div>
                    <div>
                      <div style={labelStyle}>Tenant ID</div>
                      <input style={input} value={String(selectedTenantId || "")} readOnly />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={labelStyle}>المحافظة</div>
                      <input style={input} value={String(details?.governorate || details?.regionAr || "")} readOnly />
                    </div>
                    <div>
                      <div style={labelStyle}>البريد المربوط بالمدرسة</div>
                      <input style={input} value={String(details?.linkedEmail || details?.email || "")} readOnly placeholder="لا يوجد ربط" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={labelStyle}>الحالة</div>
                      <input style={input} value={details?.enabled === false ? "غير مفعلة" : "مفعلة"} readOnly />
                    </div>
                    <div>
                      <div style={labelStyle}>الولاية</div>
                      <input style={input} value={String(details?.wilayatAr || "")} readOnly />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={panel}>
              <div style={{ fontWeight: 900, color: GOLD, marginBottom: 10 }}>نقل Tenant ID إلى قيمة جديدة</div>
              <div style={{ opacity: 0.9, lineHeight: 1.9, marginBottom: 12 }}>
                هذه العملية تنسخ المدرسة وكل الربوط التابعة لها إلى Tenant جديد، ثم تؤرشف القديم وتحدّث
                allowlist و tenantAdminLinks.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
                <div>
                  <div style={labelStyle}>Tenant ID الجديد</div>
                  <input
                    style={input}
                    value={newTenantId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTenantId(e.target.value)}
                    placeholder="Tenant ID الجديد"
                  />
                </div>
                <button style={actionBtn("gold")} onClick={doMigrate} disabled={busy || !selectedTenantId || !newTenantId.trim()}>
                  تنفيذ نقل Tenant
                </button>
              </div>
            </div>

            <div style={panel}>
              <div style={{ fontWeight: 900, color: GOLD, marginBottom: 10 }}>سوبر المحافظات</div>
              <div style={{ opacity: 0.9, lineHeight: 1.9, marginBottom: 12 }}>
                سوبر المحافظات يجب أن يرتبط بالمحافظة فقط. إذا وجدت قيمة Tenant مربوطة بالخطأ، يمكنك تنظيفها من هنا.
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {supers.map((row: any) => (
                  <div
                    key={row.email}
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 18,
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "220px 1fr 290px 280px",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <button
                      style={actionBtn("danger")}
                      onClick={() => clearRegionalBinding(String(row.email || ""))}
                      disabled={busy}
                    >
                      تنظيف Tenant
                    </button>

                    <input style={input} value={String(row.tenantId || "-")} readOnly />

                    <select
                      value={String(row.governorate || "")}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        void saveSuperGovernorate(String(row.email || ""), e.target.value)
                      }
                      style={selectStyle}
                      disabled={busy}
                    >
                      <option value="" style={optionStyle}>اختر المحافظة</option>
                      {DIRECTORATES.map((g) => (
                        <option key={g} value={g} style={optionStyle}>
                          {g}
                        </option>
                      ))}
                    </select>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, color: "#fff1c4" }}>{row.email}</div>
                      <div style={{ opacity: 0.82, fontSize: 13 }}>{String(row.name || row.userName || "")}</div>
                    </div>
                  </div>
                ))}
                {!supers.length ? <div style={{ opacity: 0.82 }}>لا يوجد سجلات سوبر محافظات.</div> : null}
              </div>
            </div>
          </div>

          <div style={panel}>
            <div style={{ fontWeight: 900, color: GOLD, marginBottom: 12 }}>اختيار المحافظة والمدرسة</div>
            <select
              value={selectedGovernorate}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedGovernorate(e.target.value)}
              style={selectStyle}
            >
              <option value="" style={optionStyle}>كل المحافظات</option>
              {DIRECTORATES.map((g) => (
                <option key={g} value={g} style={optionStyle}>
                  {g}
                </option>
              ))}
            </select>

            <div style={{ height: 12 }} />

            <div
              style={{
                maxHeight: 740,
                overflow: "auto",
                paddingInlineEnd: 6,
                display: "grid",
                gap: 14,
              }}
            >
              {grouped.map(([gov, items]) => (
                <div key={gov}>
                  <div style={{ fontWeight: 900, marginBottom: 10, color: "#fff1c4" }}>{gov}</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {items.map((row: any) => {
                      const active = String(selectedTenantId || "") === String(row?.tenantId || "");
                      const label = String(row?.schoolName || row?.name || row?.tenantId || "").trim();
                      const tid = String(row?.tenantId || "").trim();

                      return (
                        <button
                          key={tid}
                          onClick={() => setSelectedTenantId(tid)}
                          style={{
                            width: "100%",
                            textAlign: "right",
                            borderRadius: 16,
                            padding: "14px 16px",
                            border: active
                              ? "1px solid rgba(212,175,55,0.45)"
                              : "1px solid rgba(255,255,255,0.10)",
                            background: active ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.04)",
                            color: "#e5e7eb",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <div style={{ fontWeight: 900, color: active ? GOLD : "#fff1c4", fontSize: 18 }}>
                            {label}
                          </div>
                          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>{tid}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!grouped.length ? <div style={{ opacity: 0.82 }}>لا توجد مدارس ضمن هذا الفلتر.</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
