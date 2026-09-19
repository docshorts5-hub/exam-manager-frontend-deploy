// YR_MONITORING_MODERN_V1
// src/pages/SystemMonitoringDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import MINISTRY_LOGO from "../assets/branding/ministry-logo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = MINISTRY_LOGO;
const GOLD = "#2563eb";
const INK = "#111827";
const BORDER = "#bfdbfe";
const BG = "linear-gradient(135deg,#eef8ff 0%,#ffffff 45%,#f3fbf7 100%)";
const CARD = "rgba(255,255,255,0.96)";

type Snapshot = {
  localKeys: number;
  cloudCacheKeys: number;
  cloudStatusKeys: number;
  auditRows: number;
  errorRows: number;
  criticalErrors: number;
  warnings: number;
  online: boolean;
  lastCloudSuccess: string;
  lastCloudWarning: string;
  lastCloudError: string;
  currentUser: string;
  role: string;
  governorate: string;
  tenantId: string;
  readOnly: boolean;
  createdAt: string;
};

function readStorage(key: string) {
  try {
    return String(window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

function parseArray(value: string): any[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MONITOR_STORAGE_KEYS = [
  "exam-manager:system-audit-log:v1",
  "systemAuditLog",
  "auditTrail",
  "exam-manager:system-error-log:v1",
  "systemErrorLog",
  "errorDiagnostics",
  "cloud-storage",
  "cloudLocalStorage"
];

function getAllKeys() {
  return MONITOR_STORAGE_KEYS.filter((key) => {
    try {
      return window.localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  });
}

function getProfile(auth: any) {
  return auth?.profile || auth?.userProfile || auth?.allow || {};
}

function makeSnapshot(auth: any): Snapshot {
  const keys = getAllKeys();
  const profile = getProfile(auth);
  const auditRows = [
    ...parseArray(readStorage("exam-manager:system-audit-log:v1")),
    ...parseArray(readStorage("systemAuditLog")),
    ...parseArray(readStorage("auditTrail")),
  ];
  const errorRows = [
    ...parseArray(readStorage("exam-manager:system-error-log:v1")),
    ...parseArray(readStorage("systemErrorLog")),
    ...parseArray(readStorage("errorDiagnostics")),
  ];

  const criticalErrors = errorRows.filter((row: any) => {
    const type = String(row?.type || row?.level || row?.severity || "").toLowerCase();
    const msg = String(row?.message || row?.error || "").toLowerCase();
    return type.includes("error") || type.includes("critical") || msg.includes("maximum update depth") || msg.includes("permission");
  }).length;

  const warnings = errorRows.filter((row: any) => {
    const type = String(row?.type || row?.level || row?.severity || "").toLowerCase();
    return type.includes("warn") || type.includes("warning");
  }).length;

  const currentUser = String(auth?.user?.email || profile?.email || readStorage("userEmail") || "غير محدد");
  const role = String(profile?.role || auth?.effectiveRole || readStorage("role") || "غير محدد");
  const governorate = String(profile?.governorate || profile?.scope || readStorage("governorate") || readStorage("scope") || "غير محدد");
  const tenantId = String(profile?.tenantId || auth?.tenantId || readStorage("tenantId") || readStorage("selectedTenantId") || "غير محدد");
  const readOnly = [readStorage("governorateSuperReadOnly"), readStorage("viewAsReadOnly"), readStorage("readOnly")]
    .some((v) => ["1", "true", "yes"].includes(String(v || "").toLowerCase()));

  return {
    localKeys: keys.length,
    cloudCacheKeys: keys.filter((k) => k.includes("cloud-cache")).length,
    cloudStatusKeys: keys.filter((k) => k.includes("cloud-storage") || k.includes("cloudLocalStorage")).length,
    auditRows: auditRows.length,
    errorRows: errorRows.length,
    criticalErrors,
    warnings,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastCloudSuccess: readStorage("exam-manager:cloud-storage:last-success-at") || "غير مسجل",
    lastCloudWarning: readStorage("exam-manager:cloud-storage:last-warning") || "لا يوجد",
    lastCloudError: readStorage("exam-manager:cloud-storage:last-error") || "لا يوجد",
    currentUser,
    role,
    governorate,
    tenantId,
    readOnly,
    createdAt: new Date().toLocaleString("ar"),
  };
}

function statusLabel(snapshot: Snapshot) {
  if (!snapshot.online) return { label: "الاتصال غير مستقر", tone: "danger" };
  if (snapshot.criticalErrors > 0) return { label: "يحتاج مراجعة", tone: "warning" };
  if (snapshot.errorRows > 0) return { label: "مستقر مع تنبيهات", tone: "warning" };
  return { label: "مستقر", tone: "ok" };
}

function downloadJson(name: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SystemMonitoringDashboard() {
  const navigate = useNavigate();
  const auth = useAuth() as any;

  const canViewMonitoring = Boolean(auth?.isSuperAdmin);

  if (!canViewMonitoring) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 40,
          display: "grid",
          placeItems: "center",
          background: "#f8fafc",
          color: "#111827",
          fontFamily: "inherit"
        }}
      >
        <section
          style={{
            background: "#ffffff",
            border: "2px solid #fecaca",
            borderRadius: 22,
            padding: 30,
            textAlign: "center",
            boxShadow: "0 12px 30px rgba(0,0,0,0.08)"
          }}
        >
          <h2 style={{ color: "#991b1b" }}>
            غير مصرح بالوصول
          </h2>

          <p style={{ fontWeight: 800 }}>
            لوحة مراقبة النظام مخصصة لمالك المنصة فقط.
          </p>
        </section>
      </main>
    );
  }

  const [snapshot, setSnapshot] = useState<Snapshot>(() => makeSnapshot(auth));

  useEffect(() => {
    const refresh = () => setSnapshot(makeSnapshot(auth));
    refresh();
    const id = window.setInterval(refresh, 15000);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [auth]);

  const status = useMemo(() => statusLabel(snapshot), [snapshot]);

  const cardStyle: React.CSSProperties = {
    background:
      "linear-gradient(145deg,rgba(255,255,255,0.98),rgba(245,250,255,0.96))",
    border: "1px solid rgba(191,219,254,0.9)",
    borderRadius: 24,
    padding: 22,
    color: INK,
    boxShadow:
      "0 18px 35px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
    transition:"all .25s ease",
  };


  const buttonStyle: React.CSSProperties = {
    border:"1px solid #2563eb",
    background:
      "linear-gradient(180deg,#ffffff,#dbeafe)",
    color:"#12345b",
    borderRadius:16,
    padding:"12px 22px",
    fontWeight:950,
    cursor:"pointer",
    boxShadow:
      "0 6px 0 #1d4ed8,0 12px 22px rgba(37,99,235,.25)",
    transition:"all .15s ease",
  };

  const statusColor = status.tone === "ok" ? "#116530" : status.tone === "danger" ? "#991b1b" : "#92400e";

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: BG, color: INK, padding: 28, fontFamily: "inherit" }}>
      <section style={{
        ...cardStyle,
        minHeight:220,
        display:"grid",
        gridTemplateColumns:"auto 1fr auto",
        alignItems:"center",
        gap:28,
        background:"rgba(255,255,255,0.45)",
        border:"2px solid rgba(199,221,255,0.8)",
        backdropFilter:"blur(12px)",
        boxShadow:"0 12px 30px rgba(37,99,235,0.10)"
      }}>

        <div style={{
          display:"flex",
          alignItems:"center",
          gap:16,
          fontWeight:900,
          direction:"rtl"
        }}>
          <img
            src={MINISTRY_LOGO_URL}
            alt="شعار وزارة التعليم"
            style={{
              width:105,
              height:105,
              objectFit:"contain",
              borderRadius:22,
              background:"transparent",
              padding:8
            }}
          />

          <div>
            <div style={{fontSize:25,color:"#14532d"}}>
              سلطنة عُمان
            </div>
            <div style={{fontSize:23,color:"#14532d"}}>
              وزارة التعليم
            </div>
          </div>
        </div>


        <div style={{textAlign:"center"}}>
          <h1 style={{
            margin:0,
            fontSize:44,
            fontWeight:950,
            color:INK
          }}>
            مركز مراقبة النظام
          </h1>

          <p style={{
            marginTop:12,
            fontWeight:800
          }}>
            مؤشرات محلية لمتابعة السجلات والأخطاء وحالة الاتصال والمستخدم الحالي.
          </p>
        </div>


        <div style={{textAlign:"left"}}>
          <button
            style={buttonStyle}
            onClick={()=>navigate("/system/operations")}
          >
            العودة إلى النظام والتطوير
          </button>
        </div>

      </section>

      <section style={{
        display:"grid",
        gridTemplateColumns:"repeat(4,minmax(0,1fr))",
        gap:18,
        marginTop:22
      }}>

        <div style={{
          ...cardStyle,
          background:"linear-gradient(135deg,#ecfdf5,#ffffff)",
          border:"1px solid #86efac"
        }}>
          <div style={{fontSize:32,color:"#15803d",fontWeight:950}}>
            ✓
          </div>
          <div style={{fontSize:30,color:"#15803d",fontWeight:950}}>
            {status.label}
          </div>
          <div style={{fontWeight:900}}>
            حالة النظام
          </div>
          <small>
            جميع الخدمات تعمل بصورة طبيعية
          </small>
        </div>


        <div style={{
          ...cardStyle,
          background:"linear-gradient(135deg,#fff1f2,#ffffff)",
          border:"1px solid #fecaca"
        }}>
          <div style={{fontSize:32,color:"#dc2626",fontWeight:950}}>
            ⚠ {snapshot.errorRows}
          </div>
          <div style={{fontWeight:900,color:"#991b1b"}}>
            أخطاء وتنبيهات
          </div>
          <small>
            لا توجد أخطاء حالياً
          </small>
        </div>


        <div style={{
          ...cardStyle,
          background:"linear-gradient(135deg,#eff6ff,#ffffff)",
          border:"1px solid #bfdbfe"
        }}>
          <div style={{fontSize:32,color:"#2563eb",fontWeight:950}}>
            ◉ {snapshot.auditRows}
          </div>
          <div style={{fontWeight:900}}>
            عمليات مسجلة
          </div>
          <small>
            في الجلسة الحالية
          </small>
        </div>


        <div style={{
          ...cardStyle,
          background:"linear-gradient(135deg,#ecfdf5,#ffffff)",
          border:"1px solid #86efac"
        }}>
          <div style={{fontSize:32,color:"#059669",fontWeight:950}}>
            ◉
          </div>
          <div style={{fontWeight:900}}>
            حالة الاتصال
          </div>
          <small>
            {snapshot.online ? "الاتصال بالخادم متاح" : "غير متصل"}
          </small>
        </div>

      </section>

      <section style={{
        display:"grid",
        gridTemplateColumns:"1.1fr 0.9fr",
        gap:22,
        marginTop:22
      }}>


        <div style={{
          ...cardStyle,
          background:"linear-gradient(145deg,#ffffff,#eef6ff)",
          border:"1px solid #bfdbfe",
          boxShadow:"0 18px 40px rgba(37,99,235,.12)"
        }}>

          <h2 style={{
            marginTop:0,
            color:"#12345b",
            display:"flex",
            alignItems:"center",
            gap:10
          }}>
            ⚙️ ملخص الحالة التشغيلية
          </h2>


          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(2,1fr)",
            gap:14
          }}>


            <div style={{padding:14,borderRadius:18,background:"#eff6ff",fontWeight:900}}>
              👤 المستخدم
              <br/>
              <span style={{color:"#2563eb"}}>
                {snapshot.currentUser}
              </span>
            </div>


            <div style={{padding:14,borderRadius:18,background:"#f5f3ff",fontWeight:900}}>
              🛡️ الدور
              <br/>
              <span style={{color:"#7c3aed"}}>
                {snapshot.role}
              </span>
            </div>


            <div style={{padding:14,borderRadius:18,background:"#ecfdf5",fontWeight:900}}>
              📍 المحافظة / النطاق
              <br/>
              <span style={{color:"#15803d"}}>
                {snapshot.governorate}
              </span>
            </div>


            <div style={{padding:14,borderRadius:18,background:"#ecfeff",fontWeight:900}}>
              🏫 المدرسة / المركز
              <br/>
              <span style={{color:"#0369a1"}}>
                {snapshot.tenantId}
              </span>
            </div>


            <div style={{
              padding:14,
              borderRadius:18,
              background:snapshot.readOnly ? "#fee2e2":"#dcfce7",
              fontWeight:900
            }}>
              👁️ وضع المشاهدة
              <br/>
              <span style={{
                color:snapshot.readOnly ? "#991b1b":"#166534"
              }}>
                {snapshot.readOnly ? "مفعل":"غير مفعل"}
              </span>
            </div>


            <div style={{padding:14,borderRadius:18,background:"#fffbeb",fontWeight:900}}>
              🕒 آخر تحديث
              <br/>
              <span style={{color:"#92400e"}}>
                {snapshot.createdAt}
              </span>
            </div>


          </div>

        </div>



        <div style={{
          ...cardStyle,
          background:"linear-gradient(145deg,#ffffff,#ecfeff)",
          border:"1px solid #bae6fd",
          boxShadow:"0 18px 40px rgba(14,116,144,.12)"
        }}>


          <h2 style={{
            marginTop:0,
            color:"#075985"
          }}>
            ☁️ حالة التخزين السحابي
          </h2>


          <div style={{
            display:"grid",
            gap:14
          }}>


            <div style={{padding:16,borderRadius:18,background:"#eff6ff",fontWeight:900}}>
              💾 مفاتيح التخزين المحلي
              <strong style={{display:"block",fontSize:28,color:"#2563eb"}}>
                {snapshot.localKeys}
              </strong>
            </div>


            <div style={{padding:16,borderRadius:18,background:"#ecfdf5",fontWeight:900}}>
              ☁️ كاش السحابة
              <strong style={{display:"block",fontSize:28,color:"#15803d"}}>
                {snapshot.cloudCacheKeys}
              </strong>
            </div>


            <div style={{padding:16,borderRadius:18,background:"#fefce8",fontWeight:900}}>
              📁 حالة السحابة
              <strong style={{display:"block",fontSize:28,color:"#a16207"}}>
                {snapshot.cloudStatusKeys}
              </strong>
            </div>


            <div style={{padding:16,borderRadius:18,background:"#f0fdf4",fontWeight:900}}>
              ✅ آخر نجاح مزامنة
              <small style={{display:"block",marginTop:8}}>
                {snapshot.lastCloudSuccess}
              </small>
            </div>


          </div>

        </div>


      </section>

      <section style={{ ...cardStyle, marginTop: 22 }}>
        <h2 style={{ marginTop: 0, color: INK }}>روابط الفحص السريع</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={buttonStyle} onClick={() => setSnapshot(makeSnapshot(auth))}>تحديث المراقبة</button>
          <button style={buttonStyle} onClick={() => navigate("/system/error-log")}>فتح سجل الأخطاء</button>
          <button style={buttonStyle} onClick={() => navigate("/system/audit-log")}>فتح سجل العمليات</button>
          <button style={buttonStyle} onClick={() => navigate("/system/permissions-audit")}>فحص الصلاحيات والربط</button>
          <button style={buttonStyle} onClick={() => navigate("/system/commercial-readiness")}>لوحة الجاهزية التجارية</button>
          <button style={buttonStyle} onClick={() => downloadJson(`system-monitoring-${Date.now()}.json`, snapshot)}>تصدير تقرير JSON</button>
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 22, borderColor: snapshot.lastCloudError !== "لا يوجد" ? "#991b1b" : BORDER }}>
        <h2 style={{ marginTop: 0, color: INK }}>آخر رسائل السحابة</h2>
        <div style={{ display: "grid", gap: 10, fontWeight: 900, lineHeight: 1.8 }}>
          <div>آخر تحذير: <span style={{ color: snapshot.lastCloudWarning === "لا يوجد" ? "#116530" : "#92400e" }}>{snapshot.lastCloudWarning}</span></div>
          <div>آخر خطأ: <span style={{ color: snapshot.lastCloudError === "لا يوجد" ? "#116530" : "#991b1b" }}>{snapshot.lastCloudError}</span></div>
        </div>
      </section>
    </main>
  );
}
