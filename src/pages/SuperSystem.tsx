// src/pages/SuperSystem.tsx
// صفحة خاصة بالسوبر (المحافظات):
// - يرى فقط مدارس محافظته
// - يستطيع إنشاء مدرسة جديدة
// - يستطيع إضافة/ربط Admin فقط داخل محافظته
// - أي تعديل/حذف/إضافة ينعكس تلقائيًا عند السوبر أدمن لأنه نفس بيانات Firestore

import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "./superSystem.theme.css";

import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, canAccessCapability, isPlatformOwner, resolveRoleBadgeStyle } from "../features/authz";
import { getActionErrorMessage } from "../services/functionsRuntimePolicy";
import { MINISTRY_SCOPE } from "../constants/directorates";
import { useSuperSystemTenants } from "../features/super-admin/hooks/useSuperSystemTenants";
import {
  archiveAndDeleteTenant,
  createTenantForScope,
  loadTenantEditState,
  saveTenantAdminAssignment,
  saveTenantForScope,
} from "../features/super-admin/services/superSystemService";

// شعار وزارة التعليم (حسب طلبك)
const safeId = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";


export default function SuperSystem() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { user, allow, logout } = auth;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const roleBadge = resolveRoleBadgeStyle(authzSnapshot);
  const isOwner = isPlatformOwner(authzSnapshot);
  const canManageSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");

  if (!user) return <Navigate to="/login" replace />;
  if (!allow?.enabled) return <Navigate to="/login" replace />;
  if (!canManageSystem) return <Navigate to="/" replace />;

  const myGov = String(allow?.governorate ?? "").trim();
  const canSeeAllGovs = isOwner || myGov === MINISTRY_SCOPE;

  const {
    tenants,
    setTenants,
    search,
    setSearch,
    selectedTenantId,
    setSelectedTenantId,
    visibleTenants,
    selectedTenant,
  } = useSuperSystemTenants({ canSeeAllGovs, myGov });

  // edit selected tenant (root + meta/config)
  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantEnabled, setEditTenantEnabled] = useState(true);
  const [editWilayatAr, setEditWilayatAr] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editReloadTick, setEditReloadTick] = useState(0);


  // create tenant form
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantId, setNewTenantId] = useState("");
  const [newTenantEnabled, setNewTenantEnabled] = useState(true);

  // add admin form
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userEnabled, setUserEnabled] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  
  // ====== Load selected tenant details for editing ======
  useEffect(() => {
    const run = async () => {
      if (!selectedTenantId) return;
      try {
        const state = await loadTenantEditState(selectedTenantId);
        setEditTenantName(state.name);
        setEditTenantEnabled(state.enabled);
        setEditWilayatAr(state.wilayatAr);
        setEditLogoUrl(state.logoUrl);
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [selectedTenantId, editReloadTick]);
  // ====== Create tenant ======
  const createTenant = async () => {
    try {
      const result = await createTenantForScope({
        tenantId: newTenantId,
        name: newTenantName,
        enabled: newTenantEnabled,
        canSeeAllGovs,
        myGov,
      });
      setNewTenantName("");
      setNewTenantId("");
      setNewTenantEnabled(true);
      setSelectedTenantId(result.tenantId);
      alert("تم إنشاء المدرسة بنجاح ✅");
    } catch (e: any) {
      console.error(e);
      if (String(e?.message || "") === "TENANT_EXISTS") {
        alert("Tenant ID مستخدم بالفعل. اختر Tenant ID جديد.");
      } else if (String(e?.message || "") === "MISSING_GOVERNORATE") {
        alert("حساب السوبر غير مرتبط بمحافظة.");
      } else {
        alert(getActionErrorMessage(e, "تعذر إنشاء المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."));
      }
    }
  };

  // ====== Delete tenant (archive + delete main doc) ======
  
  // ====== Update selected tenant (Super can fully write within their governorate) ======
  const saveSelectedTenant = async () => {
    if (!selectedTenantId) {
      alert("اختر مدرسة أولاً.");
      return;
    }

    const name = String(editTenantName || "").trim();
    if (!name) {
      alert("يرجى إدخال اسم المدرسة.");
      return;
    }

    setEditBusy(true);
    try {
      await saveTenantForScope({
        tenantId: selectedTenantId,
        name,
        enabled: editTenantEnabled,
        wilayatAr: editWilayatAr,
        logoUrl: editLogoUrl,
        canSeeAllGovs,
        myGov,
      });
      alert("تم حفظ بيانات المدرسة بنجاح.");
    } catch (e: any) {
      console.error(e);
      alert(getActionErrorMessage(e, "تعذر حفظ بيانات المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."));
    } finally {
      setEditBusy(false);
    }
  };
const deleteTenant = async (tenantId: string) => {
    const id = String(tenantId || "").trim();
    if (!id) return;
    if (!confirm(`تأكيد حذف المدرسة (${id})؟`)) return;

    try {
      await archiveAndDeleteTenant({ tenantId: id, deletedBy: String(user?.email || "") });
      setTenants((prev) => prev.filter((t) => t.id !== id));
      if (selectedTenantId === id) setSelectedTenantId("");
      alert("تم حذف المدرسة بنجاح.");
    } catch (e) {
      console.error(e);
      alert(getActionErrorMessage(e, "تعذر حذف المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."));
    }
  };

  // ====== Add admin user (allowlist) ======
  const saveAdminUser = async () => {
    const tenantId = String(selectedTenantId || "").trim();
    if (!tenantId) {
      alert("اختر مدرسة أولاً.");
      return;
    }

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      alert("المدرسة غير موجودة.");
      return;
    }

    if (!canSeeAllGovs && String(tenant.governorate || "") !== myGov) {
      alert("لا يمكنك إضافة مستخدم لمدرسة خارج محافظتك.");
      return;
    }

    setSaveBusy(true);
    try {
      await saveTenantAdminAssignment({
        email: userEmail,
        enabled: userEnabled,
        tenantId,
        tenantName: tenant.name,
        tenantGovernorate: tenant.governorate,
        canSeeAllGovs,
        myGov,
        userName,
      });
      setUserEmail("");
      setUserName("");
      setUserEnabled(true);
      alert("تم حفظ المستخدم بنجاح.");
    } catch (e: any) {
      console.error(e);
      alert(String(e?.message || "") === "INVALID_EMAIL" ? "يرجى إدخال بريد صحيح." : getActionErrorMessage(e, "تعذر حفظ المستخدم. تأكد من الصلاحيات ثم جرّب مرة أخرى."));
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="super-system-page" dir="rtl">
      <div className="super-header">
        {/* يمين: الشعار + وزارة التعليم */}
        <div className="super-header-right super-brand">
          <img className="super-brand-logo" src={MINISTRY_LOGO_URL} alt="وزارة التعليم" />
          <div className="super-brand-text">
            <div className="super-brand-ministry">وزارة التعليم</div>
            <div className="super-brand-gov">{myGov || ""}</div>
          </div>
        </div>

        {/* وسط: اسم البرنامج */}
        <div className="super-header-center">
          <div className="super-program-title">نظام إدارة الامتحانات المطور</div>
          <div className="super-subtitle">
            {isOwner ? "مالك المنصة داخل نطاق المحافظات" : canSeeAllGovs ? "عرض جميع المحافظات" : "مدير المحافظة - إدارة المدارس والمستخدمين"}
          </div>
        </div>

        {/* يسار: أزرار */}
        <div className="super-header-left">
          {/* مهم: السوبر (المحافظة) لا يجب أن يرى أي زر يوصل للسوبر أدمن */}
          {isOwner ? <button className="super-btn" onClick={() => navigate("/system")}>لوحة مالك المنصة</button> : null}
          <button className="super-btn" onClick={() => navigate("/")}>العودة</button>
          <button className="super-btn danger" onClick={() => logout()}>تسجيل خروج</button>
        </div>
      </div>

      {/* بطاقات واضحة لتسهيل التنقل */}
      <div className="super-cards">
        <button className="super-card" onClick={() => document.getElementById("section-tenants")?.scrollIntoView({ behavior: "smooth" })}>
          <div className="super-card-title">إدارة المدارس</div>
          <div className="super-card-desc">عرض/بحث المدارس + حذف/اختيار.</div>
        </button>
        <button className="super-card" onClick={() => document.getElementById("section-edit")?.scrollIntoView({ behavior: "smooth" })}>
          <div className="super-card-title">تعديل بيانات المدرسة</div>
          <div className="super-card-desc">تعديل اسم المدرسة والشعار والولاية (داخل محافظتك).</div>
        </button>
        <button className="super-card" onClick={() => document.getElementById("section-create")?.scrollIntoView({ behavior: "smooth" })}>
          <div className="super-card-title">إضافة مدرسة جديدة</div>
          <div className="super-card-desc">إنشاء مدرسة داخل محافظتك.</div>
        </button>
        <button className="super-card" onClick={() => document.getElementById("section-admin")?.scrollIntoView({ behavior: "smooth" })}>
          <div className="super-card-title">ربط الأدمن</div>
          <div className="super-card-desc">إضافة/ربط Admin بمدرسة محددة.</div>
        </button>
        <button className="super-card" onClick={() => navigate("/") }>
          <div className="super-card-title">الدخول للبرنامج</div>
          <div className="super-card-desc">الانتقال للواجهة الرئيسية بعد اختيار المدرسة.</div>
        </button>
      </div>


      <div
        style={{
          marginBottom: 16,
          border: "1px solid rgba(212,175,55,0.28)",
          background: "rgba(0,0,0,0.32)",
          borderRadius: 16,
          padding: 14,
          color: "#f8fafc",
        }}
      >
        <div style={{ fontWeight: 900, color: "#d4af37", marginBottom: 6 }}>{roleBadge.label}</div>
        <div style={{ lineHeight: 1.8, opacity: 0.92 }}>
          {isOwner
            ? "أنت مالك المنصة، ويمكنك من هذه الشاشة مراجعة نطاق المحافظات بالكامل، كما يمكنك العودة إلى لوحة المالك لإدارة كل الصلاحيات العليا والمستخدمين والمدارس."
            : "أنت مشرف نطاق، لذلك ترى وتدير فقط المدارس والمستخدمين المرتبطين بنطاقك الإداري."}
        </div>
      </div>

      <div className="super-grid">
        {/* Tenants list */}
        <div className="super-panel" id="section-tenants">
          <div className="super-panel-title">إدارة المدارس (Tenants)</div>
          <div style={{ marginBottom: 10 }}>
            <input className="input" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="tenant-list">
            {visibleTenants.map((t) => (
              <div key={t.id} className={`tenant-row ${selectedTenantId === t.id ? "active" : ""}`}>
                <button className="icon-btn" title="حذف" onClick={() => deleteTenant(t.id)}>🗑️</button>
                <button className="icon-btn" title="اختيار" onClick={() => setSelectedTenantId(t.id)}>📁</button>
                <div className="tenant-meta" onClick={() => setSelectedTenantId(t.id)}>
                  <div className="tenant-name">{t.name || t.id}</div>
                  <div className="tenant-id">{t.id}</div>
                  <div className="tenant-id" style={{ opacity: 0.8 }}>
                    {t.governorate ? `المحافظة: ${t.governorate}` : ""}
                  </div>
                </div>
                <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ opacity: 0.9 }}>{t.enabled ? "مفعل" : "غير مفعل"}</span>
                  <input type="checkbox" checked={t.enabled !== false} readOnly />
                </div>
              </div>
            ))}
            {!visibleTenants.length ? <div style={{ padding: 12, opacity: 0.8 }}>لا توجد مدارس.</div> : null}
          </div>
        </div>

        
        {/* Edit selected tenant */}
        <div className="super-panel" id="section-edit">
          <div className="super-panel-title">تعديل بيانات المدرسة المختارة</div>
          {!selectedTenantId ? (
            <div style={{ padding: 12, opacity: 0.85 }}>اختر مدرسة من القائمة أولاً.</div>
          ) : (
            <div className="form-grid">
              <label className="label">Tenant ID</label>
              <input className="input" value={selectedTenantId} readOnly />

              <label className="label">اسم المدرسة</label>
              <input className="input" value={editTenantName} onChange={(e) => setEditTenantName(e.target.value)} />

              <label className="label">الحالة</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={editTenantEnabled !== false} onChange={(e) => setEditTenantEnabled(e.target.checked)} />
                <span style={{ opacity: 0.9 }}>{editTenantEnabled ? "مفعل" : "غير مفعل"}</span>
              </div>

              <label className="label">الولاية</label>
              <input className="input" value={editWilayatAr} onChange={(e) => setEditWilayatAr(e.target.value)} placeholder="مثال: بوشر" />

              <label className="label">رابط الشعار</label>
              <input className="input" value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} placeholder={MINISTRY_LOGO_URL} />

              <div />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="btn" disabled={editBusy} onClick={saveSelectedTenant}>
                  {editBusy ? "جاري الحفظ..." : "حفظ التغييرات"}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={editBusy}
                  onClick={() => {
                    // reload from firestore
                    setEditReloadTick((x: number) => x + 1);
                  }}
                  title="إعادة تحميل البيانات"
                >
                  تحديث
                </button>
              </div>
            </div>
          )}
        </div>

{/* Create tenant */}
        <div className="super-panel" id="section-create">
          <div className="super-panel-title">إنشاء مدرسة جديدة (Tenant)</div>
          <div className="form-grid">
            <label className="label">اسم المدرسة</label>
            <input className="input" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="مثال: أزان 12-9" />

            <label className="label">Tenant ID (Subdomain)</label>
            <input
              className="input"
              value={newTenantId}
              onChange={(e) => setNewTenantId(safeId(e.target.value))}
              placeholder="مثال: azaan-9-12"
            />

            <div />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="label">مفعل</span>
              <input type="checkbox" checked={newTenantEnabled} onChange={(e) => setNewTenantEnabled(e.target.checked)} />
            </div>

            <div />
            <button className="btn primary" onClick={createTenant}>إنشاء مدرسة جديدة</button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.9 }}>
            {canSeeAllGovs ? (
              <div>السوبر أدمن يمكنه إنشاء مدارس لأي محافظة (حسب إعدادات المدرسة).</div>
            ) : (
              <div>سيتم تثبيت محافظة المدرسة تلقائيًا على: <b>{myGov || "غير محددة"}</b></div>
            )}
          </div>
        </div>

        {/* Add admin */}
        <div className="super-panel" id="section-admin">
          <div className="super-panel-title">إضافة/ربط Admin بالمدرسة</div>

          <div style={{ marginBottom: 10, opacity: 0.85 }}>
            المدرسة المحددة: <b>{selectedTenant?.name || selectedTenantId || "—"}</b>
          </div>

          <div className="form-grid">
            <label className="label">البريد الإلكتروني (مفتاح الوثيقة)</label>
            <input className="input" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="name@example.com" />

            <label className="label">الاسم (اختياري)</label>
            <input className="input" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="اسم المستخدم" />

            <div />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="label">مفعل</span>
              <input type="checkbox" checked={userEnabled} onChange={(e) => setUserEnabled(e.target.checked)} />
            </div>

            <div />
            <button className="btn primary" onClick={saveAdminUser} disabled={saveBusy}>
              {saveBusy ? "جارٍ الحفظ..." : "حفظ المستخدم"}
            </button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.9 }}>
            <div>ملاحظة: هذه الصفحة تسمح للسوبر بإضافة <b>Admin</b> فقط.</div>
          </div>
        </div>
      </div>
    </div>
  );
}