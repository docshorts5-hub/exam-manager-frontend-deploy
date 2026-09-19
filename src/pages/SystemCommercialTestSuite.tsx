// src/pages/SystemCommercialTestSuite.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import SystemHeader from "../components/system/SystemHeader";

import ministryLogo from "../assets/branding/ministry-logo.png";

type TestItem = {
  id: string;
  title: string;
  target: string;
  expected: string;
  path?: string;
  level: "critical" | "important" | "normal";
};

function readStorage(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.sessionStorage.getItem(key) || window.localStorage.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function listLocalKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys.sort();
  } catch {
    return [];
  }
}

function isReadOnlyActive(): boolean {
  return ["governorateSuperReadOnly", "viewAsReadOnly", "readOnly"].some((key) => {
    const value = readStorage(key).toLowerCase();
    return value === "true" || value === "1" || value === "yes";
  });
}

function getTenantId(): string {
  return (
    readStorage("effectiveTenantId") ||
    readStorage("selectedTenantId") ||
    readStorage("tenantId") ||
    readStorage("governorateSuperViewTenantId") ||
    "azaan2090"
  );
}

export default function SystemCommercialTestSuite() {
  const navigate = useNavigate();
  const { user, profile, isSuperAdmin, isSuper } = useAuth() as any;
  const [filter, setFilter] = useState<"all" | "critical" | "important" | "normal">("all");
  const [query, setQuery] = useState("");

  const tenantId = getTenantId();
  const role = String(profile?.role || (isSuperAdmin ? "super_admin" : isSuper ? "super" : "user") || "user").trim();
  const governorate = String(profile?.governorate || profile?.tenantGovernorate || readStorage("governorateSuperGovernorate") || "").trim();
  const readOnly = isReadOnlyActive();
  const keys = useMemo(() => listLocalKeys(), []);
  const cloudCacheKeys = keys.filter((k) => k.includes("cloud-cache")).length;
  const cloudStorageKeys = keys.filter((k) => k.includes("cloud-storage")).length;

  const tests: TestItem[] = useMemo(() => [
    {
      id: "owner-system",
      title: "مالك المنصة — الدخول إلى لوحة النظام",
      target: "مالك المنصة",
      expected: "يظهر كل شيء: المدارس، المستخدمون، المحافظات، السجلات، الصيانة، المراقبة.",
      path: "/system",
      level: "critical",
    },
    {
      id: "permissions-audit",
      title: "فحص الصلاحيات والربط",
      target: "مالك المنصة / مشرف المحافظة",
      expected: "تظهر المستخدمون داخل النطاق فقط، مع توضيح المدرسة أو مركز الدبلوم وحالة التفعيل.",
      path: "/system/permissions-audit",
      level: "critical",
    },
    {
      id: "governorate-super-system",
      title: "مشرف المحافظة — صفحة الإشراف",
      target: "مشرف المحافظة",
      expected: "يرى محافظته فقط، ويستطيع إضافة أدمن مدرسة وسوبر امتحانات داخل نفس المحافظة.",
      path: "/super-system",
      level: "critical",
    },
    {
      id: "school-admins-readonly",
      title: "دخول مشرف المحافظة إلى أدمن المدرسة",
      target: "مشرف المحافظة",
      expected: "يفتح جميع صفحات المدرسة بوضع مشاهدة فقط، بدون حفظ أو حذف أو استيراد.",
      path: "/school-admins",
      level: "critical",
    },
    {
      id: "exam-supers-readonly",
      title: "دخول مشرف المحافظة إلى مركز الدبلوم",
      target: "مشرف المحافظة",
      expected: "يفتح جميع صفحات مركز الدبلوم بوضع مشاهدة فقط، وداخل Layout12 وليس Layout المدرسة.",
      path: "/exam-supers",
      level: "critical",
    },
    {
      id: "school-cloud-health",
      title: "فحص التخزين السحابي للمدرسة",
      target: "أدمن المدرسة",
      expected: "يفتح داخل Layout المدرسة، ويعرض القراءة والكتابة والكاش بوضوح.",
      path: `/t/${tenantId}/cloud-health`,
      level: "important",
    },
    {
      id: "diploma-cloud-health",
      title: "فحص التخزين السحابي لمركز الدبلوم",
      target: "سوبر الامتحانات",
      expected: "يفتح داخل Layout12، وليس Layout المدرسة.",
      path: `/t/${tenantId}/cloud-health12`,
      level: "important",
    },
    {
      id: "school-backup",
      title: "النسخ الاحتياطي السحابي للمدرسة",
      target: "أدمن المدرسة",
      expected: "يمكن تصدير نسخة احتياطية، والاستعادة ممنوعة عند المشاهدة فقط.",
      path: `/t/${tenantId}/cloud-backup`,
      level: "important",
    },
    {
      id: "diploma-backup",
      title: "النسخ الاحتياطي السحابي لمركز الدبلوم",
      target: "سوبر الامتحانات",
      expected: "يفتح داخل Layout12، مع حماية وضع المشاهدة فقط.",
      path: `/t/${tenantId}/cloud-backup12`,
      level: "important",
    },
    {
      id: "audit-log",
      title: "سجل العمليات السحابي",
      target: "مالك المنصة / مشرف المحافظة",
      expected: "يسجل فتح الصفحات والأزرار والإجراءات الحساسة محليًا وسحابيًا.",
      path: "/system/audit-log",
      level: "important",
    },
    {
      id: "error-log",
      title: "سجل الأخطاء المركزي",
      target: "مالك المنصة",
      expected: "يسجل الأخطاء والتحذيرات المهمة ويعرضها في صفحة واحدة.",
      path: "/system/error-log",
      level: "important",
    },
    {
      id: "monitoring",
      title: "مركز مراقبة النظام",
      target: "مالك المنصة",
      expected: "يعرض حالة النظام، آخر مزامنة، الكاش، السجلات، والروابط المهمة.",
      path: "/system/monitoring",
      level: "normal",
    },
    {
      id: "maintenance",
      title: "مركز صيانة النظام",
      target: "مالك المنصة",
      expected: "ينظف الكاش المحلي فقط بدون حذف بيانات Firestore.",
      path: "/system/maintenance",
      level: "normal",
    },
    {
      id: "release-center",
      title: "مركز الإصدارات والتطوير",
      target: "مالك المنصة",
      expected: "يعرض مراحل التطوير والمرحلة الحالية والقادمة.",
      path: "/system/release-center",
      level: "normal",
    },
  ], [tenantId]);

  const visibleTests = tests.filter((item) => {
    const levelMatch = filter === "all" || item.level === filter;
    const q = query.trim().toLowerCase();
    const text = `${item.title} ${item.target} ${item.expected}`.toLowerCase();
    return levelMatch && (!q || text.includes(q));
  });

  const criticalCount = tests.filter((t) => t.level === "critical").length;
  const importantCount = tests.filter((t) => t.level === "important").length;
  const normalCount = tests.filter((t) => t.level === "normal").length;

  function exportReport() {
    const report = {
      exportedAt: new Date().toISOString(),
      user: user?.email || "",
      role,
      governorate,
      tenantId,
      readOnly,
      localStorageKeys: keys.length,
      cloudCacheKeys,
      cloudStorageKeys,
      tests,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commercial-test-suite-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyReport() {
    const text = [
      "حزمة الاختبار التجاري النهائي",
      `المستخدم: ${user?.email || "غير معروف"}`,
      `الدور: ${role}`,
      `المحافظة: ${governorate || "غير محددة"}`,
      `Tenant: ${tenantId}`,
      `وضع المشاهدة فقط: ${readOnly ? "مفعل" : "غير مفعل"}`,
      `عدد الاختبارات: ${tests.length}`,
      `اختبارات حرجة: ${criticalCount}`,
      `اختبارات مهمة: ${importantCount}`,
    ].join("\n");
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(135deg,#E8F1FB 0%,#DDF5E8 100%)", color: "#111827", padding: 26, fontFamily: "Tajawal, Cairo, Arial, sans-serif" }}>
      <style>{`
        .phase50-card{background:rgba(255,255,255,.72);border:2px solid #c9a227;border-radius:24px;box-shadow:0 16px 40px rgba(111,85,17,.10);}
        .phase50-btn{border:2px solid #b8941f;border-radius:14px;background:#fff7df;color:#111827;font-weight:900;padding:10px 16px;cursor:pointer;}
        .phase50-btn:hover{background:#f7e8b5;}
        .phase50-input{width:100%;border:2px solid #e0c467;border-radius:14px;background:#fff;color:#111827;font-weight:900;padding:12px 14px;outline:none;}
        .phase50-table{width:100%;border-collapse:collapse;background:#fffdf5;border-radius:18px;overflow:hidden;}
        .phase50-table th{background:#eadb99;color:#111827;font-weight:1000;padding:12px;border-bottom:1px solid #ceb24f;}
        .phase50-table td{padding:12px;border-bottom:1px solid #efe3b7;color:#111827;font-weight:800;vertical-align:top;}
        .phase50-badge{display:inline-flex;border-radius:999px;padding:6px 12px;font-weight:1000;border:1px solid rgba(0,0,0,.08);}
      `}</style>
      <SystemHeader
        title="حزمة الاختبار التجاري النهائي"
        description="اختبارات جاهزة للتحقق من الصلاحيات، السحابة، السجلات، والمشاهدة فقط قبل التسليم."
        logo={ministryLogo}
        onOwner={()=>navigate("/system")}
        onGateway={()=>navigate("/programs-gateway")}
      />



      <section
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(4,minmax(0,1fr))",
          gap:18,
          marginBottom:22,
          perspective:"1200px"
        }}
      >
        {[
          [tests.length,"إجمالي الاختبارات","linear-gradient(135deg,#2563eb,#38bdf8)"],
          [criticalCount,"اختبارات حرجة","linear-gradient(135deg,#dc2626,#fb7185)"],
          [importantCount,"اختبارات مهمة","linear-gradient(135deg,#059669,#34d399)"],
          [readOnly ? "مفعل" : "غير مفعل","وضع المشاهدة فقط","linear-gradient(135deg,#7c3aed,#60a5fa)"],
        ].map(([value,label,bg])=>(
          <div
            key={String(label)}
            style={{
              background:bg as string,
              borderRadius:32,
              padding:18,
              minHeight:125,
              color:"#ffffff",
              textAlign:"center",
              transformStyle:"preserve-3d",
              backdropFilter:"blur(14px)",
              border:"1px solid rgba(255,255,255,.35)",
              transition:"transform .35s ease, box-shadow .35s ease",
              boxShadow:
                "0 18px 35px rgba(15,23,42,.22), inset 0 2px 10px rgba(255,255,255,.35)",
              overflow:"hidden"
            }}
            onMouseEnter={(e)=>{
              e.currentTarget.style.transform=
              "translateY(-10px) rotateX(6deg) rotateY(-5deg)";
            }}
            onMouseLeave={(e)=>{
              e.currentTarget.style.transform="none";
            }}
          >

            <div
              style={{
                width:56,
                height:56,
                margin:"0 auto 10px",
                borderRadius:18,
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                background:"rgba(255,255,255,.22)",
                backdropFilter:"blur(10px)",
                fontSize:26,
                fontWeight:1000,
                boxShadow:
                "inset 0 2px 12px rgba(255,255,255,.5),0 14px 30px rgba(0,0,0,.25)"
              }}
            >
              <span
  style={{
    fontSize: String(value).length > 4 ? 12 : 26,
    lineHeight:1.05,
    textAlign:"center",
    whiteSpace:"normal",
    width:"52px",
    overflowWrap:"normal",
    letterSpacing:"0px"
  }}
>
  {String(value)}
</span>
            </div>

            <div
              style={{
                fontSize:16,
                fontWeight:1000,
                maxWidth:"170px", margin:"auto", lineHeight:1.4, wordBreak:"break-word", textShadow:"0 2px 6px rgba(0,0,0,.25)"
              }}
            >
              {String(label)}
            </div>

          </div>
        ))}
      </section>


      <section className="phase50-card" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr .8fr auto auto", gap: 12, alignItems: "end" }}>
          <label style={{ fontWeight: 1000 }}>
            بحث
            <input className="phase50-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم الاختبار أو الدور..." />
          </label>
          <label style={{ fontWeight: 1000 }}>
            مستوى الاختبار
            <select className="phase50-input" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">كل الاختبارات</option>
              <option value="critical">حرج</option>
              <option value="important">مهم</option>
              <option value="normal">عادي</option>
            </select>
          </label>
          <button className="phase50-btn" onClick={copyReport}>نسخ التقرير</button>
          <button className="phase50-btn" onClick={exportReport}>تصدير JSON</button>
        </div>
      </section>

            <section
        className="phase50-card"
        style={{
          padding: 22,
          marginBottom: 18,
          background: "rgba(255,255,255,.72)",
          backdropFilter: "blur(10px)",
          borderRadius: 28,
          boxShadow: "0 18px 40px rgba(15,23,42,.08)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>
            بيانات الجلسة الحالية
          </h2>

          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: "#475569",
              background: "rgba(255,255,255,.75)",
              border: "1px solid rgba(148,163,184,.25)",
              borderRadius: 999,
              padding: "8px 14px"
            }}
          >
            ملخص الجلسة
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 18
          }}
        >
          {[
            {
              label: "المستخدم",
              value: user?.email || "غير معروف",
              bg: "linear-gradient(135deg, rgba(59,130,246,.20), rgba(14,165,233,.10))",
              accent: "#2563eb"
            },
            {
              label: "الدور",
              value: role,
              bg: "linear-gradient(135deg, rgba(139,92,246,.20), rgba(99,102,241,.10))",
              accent: "#7c3aed"
            },
            {
              label: "المحافظة",
              value: governorate || "غير محددة",
              bg: "linear-gradient(135deg, rgba(16,185,129,.20), rgba(45,212,191,.10))",
              accent: "#059669"
            },
            {
              label: "Tenant",
              value: tenantId,
              bg: "linear-gradient(135deg, rgba(245,158,11,.20), rgba(251,191,36,.10))",
              accent: "#d97706"
            },
            {
              label: "localStorage",
              value: `${keys.length} مفتاح`,
              bg: "linear-gradient(135deg, rgba(236,72,153,.18), rgba(244,114,182,.08))",
              accent: "#db2777"
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 26,
                padding: 20,
                minHeight: 118,
                background: "rgba(255,255,255,.72)",
                border: "1px solid rgba(255,255,255,.95)",
                backdropFilter: "blur(18px)",
                boxShadow: "0 22px 45px rgba(15,23,42,.14), inset 0 2px 12px rgba(255,255,255,.8)"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: item.bg,
                  pointerEvents: "none"
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: -18,
                  left: -18,
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: item.accent,
                  opacity: 0.10,
                  filter: "blur(6px)"
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    padding: "7px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 1000,
                    color: item.accent,
                    background: "rgba(255,255,255,.72)",
                    border: "1px solid rgba(148,163,184,.20)"
                  }}
                >
                  {item.label}
                </div>

                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 1000,
                    color: "#0f172a",
                    lineHeight: 1.45,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word"
                  }}
                >
                  {String(item.value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="phase50-card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>قائمة الاختبارات</h2>
        <div
  style={{
    display:"grid",
    gap:14
  }}
>
  {visibleTests.map((item, index) => {
    const tone =
      item.level === "critical"
        ? {
            gradient:"linear-gradient(135deg, rgba(239,68,68,.16), rgba(251,113,133,.08))",
            accent:"#ef4444",
            pill:"rgba(239,68,68,.12)",
            shadow:"rgba(239,68,68,.16)",
            label:"حرج"
          }
        : item.level === "important"
        ? {
            gradient:"linear-gradient(135deg, rgba(16,185,129,.16), rgba(45,212,191,.08))",
            accent:"#10b981",
            pill:"rgba(16,185,129,.12)",
            shadow:"rgba(16,185,129,.16)",
            label:"مهم"
          }
        : {
            gradient:"linear-gradient(135deg, rgba(59,130,246,.14), rgba(125,211,252,.10))",
            accent:"#2563eb",
            pill:"rgba(59,130,246,.12)",
            shadow:"rgba(37,99,235,.14)",
            label:"عادي"
          };

    return (
      <div
        key={item.id}
        style={{
          position:"relative",
overflow:"hidden",
borderRadius:30,
padding:"20px 24px",
background:"linear-gradient(135deg,rgba(255,255,255,.88),rgba(248,250,252,.70))",
border:`1px solid ${tone.pill}`,
backdropFilter:"blur(20px)",
transition:"all .35s ease",
boxShadow:`0 24px 55px ${tone.shadow}, inset 0 2px 18px rgba(255,255,255,.95)`
        }}
      >
        <div
          style={{
            position:"absolute",
            inset:0,
            background:tone.gradient,
            pointerEvents:"none"
          }}
        />

        <div
          style={{
            position:"absolute",
            top:-24,
            left:-24,
            width:88,
            height:88,
            borderRadius:"50%",
            background:tone.accent,
            opacity:.10,
            filter:"blur(10px)"
          }}
        />

        <div
          style={{
            position:"relative",
            zIndex:1,
            display:"grid",
            gridTemplateColumns:"58px 1fr auto",
            gap:16,
            alignItems:"center"
          }}
        >
          <div
            style={{
              width:46,
              height:46,
              borderRadius:15,
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              background:"rgba(255,255,255,.72)",
              border:`1px solid ${tone.pill}`,
              color:tone.accent,
              fontWeight:1000,
              fontSize:20,
              boxShadow:"0 10px 24px rgba(15,23,42,.08)"
            }}
          >
            {index + 1}
          </div>

          <div style={{ minWidth:0 }}>
            <div
              style={{
                display:"flex",
                alignItems:"center",
                gap:10,
                flexWrap:"wrap",
                marginBottom:10
              }}
            >
              <span
                style={{
                  display:"inline-flex",
                  alignItems:"center",
                  justifyContent:"center",
                  padding:"6px 12px",
                  borderRadius:999,
                  fontSize:12,
                  fontWeight:1000,
                  color:tone.accent,
                  background:"rgba(255,255,255,.72)",
                  border:`1px solid ${tone.pill}`
                }}
              >
                {tone.label}
              </span>

              <span
                style={{
                  display:"inline-flex",
                  alignItems:"center",
                  justifyContent:"center",
                  padding:"6px 12px",
                  borderRadius:999,
                  fontSize:12,
                  fontWeight:900,
                  color:"#334155",
                  background:"rgba(255,255,255,.68)",
                  border:"1px solid rgba(148,163,184,.18)"
                }}
              >
                {item.target}
              </span>
            </div>

            <div
              style={{
                fontSize:19,
                fontWeight:1000,
                color:"#0f172a",
                marginBottom:8,
                lineHeight:1.45
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                fontSize:15,
                fontWeight:800,
                color:"#334155",
                lineHeight:1.75,
                overflowWrap:"anywhere",
                wordBreak:"break-word"
              }}
            >
              {item.expected}
            </div>
          </div>

          <div
            style={{
              display:"flex",
              alignItems:"center",
              justifyContent:"center"
            }}
          >
            <button
              className="phase50-btn"
              onClick={() => item.path && navigate(item.path)}
              disabled={!item.path}
              style={{
                minWidth:100,
                padding:"12px 16px",
                borderColor:tone.accent,
                background:item.path ? "rgba(255,255,255,.88)" : "rgba(241,245,249,.9)",
                color:"#0f172a",
                fontWeight:1000,
                boxShadow:"0 10px 18px rgba(15,23,42,.08)",
                cursor:item.path ? "pointer" : "not-allowed",
                opacity:item.path ? 1 : .65
              }}
            >
              {item.path ? "فتح الاختبار" : "لا يوجد مسار"}
            </button>
          </div>
        </div>
      </div>
    );
  })}
</div>
      </section>
    </div>
  );
}
