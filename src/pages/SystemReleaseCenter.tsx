// src/pages/SystemReleaseCenter.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ministryLogo from "../assets/branding/ministry-logo.png";

const GOLD = "#b7952b";
const GOLD_DARK = "#7a5a08";
const INK = "#111827";
const MUTED = "#334155";
const PAPER = "#f7f1df";
const CARD = "#fffaf0";
const LINE = "rgba(183,149,43,0.72)";

const CURRENT_PHASE = 49;
const RELEASE_NAME = "النسخة السحابية التجارية التجريبية";
const RELEASE_CODE = "cloud-commercial-r49";

type ReleaseItem = {
  phase: number;
  title: string;
  status: "done" | "needs-test" | "next";
  note: string;
};

const releaseItems: ReleaseItem[] = [
  { phase: 30, title: "تسريع السحابة وإظهار زر الفحص", status: "done", note: "إظهار بيانات الكاش أولًا ثم تحديث السحابة في الخلفية." },
  { phase: 34, title: "ربط صفحة sync القديمة بصفحات السحابة الجديدة", status: "done", note: "ربط فحص التخزين والنسخ الاحتياطي مع المدرسة والدبلوم." },
  { phase: 38, title: "فصل أدوات المدرسة عن مركز الدبلوم", status: "done", note: "cloud-health للمدرسة و cloud-health12 لمركز الدبلوم." },
  { phase: 39, title: "فحص الصلاحيات والربط", status: "done", note: "مراجعة المستخدم والدور والمحافظة والارتباط بالمدرسة أو المركز." },
  { phase: 41, title: "لوحة الجاهزية التجارية", status: "done", note: "مراجعة حالة النظام قبل التسليم التجاري." },
  { phase: 42, title: "سجل العمليات", status: "done", note: "تسجيل فتح الصفحات والضغط على الأزرار الحساسة." },
  { phase: 45, title: "سجل العمليات السحابي", status: "needs-test", note: "يحتاج نشر قواعد Firestore والتأكد من ظهور السجلات من أكثر من جهاز." },
  { phase: 46, title: "سجل الأخطاء المركزي", status: "needs-test", note: "يحتاج تجربة أخطاء فعلية والتأكد من ظهورها في صفحة مالك المنصة." },
  { phase: 47, title: "مركز مراقبة النظام", status: "done", note: "مؤشرات عامة لحالة النظام والسحابة والكاش." },
  { phase: 48, title: "مركز صيانة النظام", status: "done", note: "تنظيف الكاش المحلي وتصدير تقرير الصيانة بدون حذف بيانات السحابة." },
  { phase: 49, title: "مركز الإصدارات والتطوير", status: "done", note: "تجميع مراحل التطوير وحالة النسخة وخطة الاختبار القادمة." },
  { phase: 50, title: "حزمة الاختبار التجاري النهائية", status: "next", note: "المرحلة القادمة: قائمة اختبار رسمية لكل الأدوار والصفحات قبل التسليم." },
];

function readSafe(storage: Storage | undefined, key: string): string {
  try {
    if (!storage) return "";
    return String(storage.getItem(key) || "");
  } catch {
    return "";
  }
}

function listKeysSafe(storage: Storage | undefined): string[] {
  try {
    if (!storage) return [];
    return Array.from({ length: storage.length }, (_, i) => storage.key(i) || "").filter(Boolean).sort();
  } catch {
    return [];
  }
}

function Badge({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "green" | "red" | "blue" | "gray" }) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    gold: { bg: "#fff7d6", border: "#d4af37", color: "#5b4100" },
    green: { bg: "#dcfce7", border: "#16a34a", color: "#14532d" },
    red: { bg: "#fee2e2", border: "#dc2626", color: "#7f1d1d" },
    blue: { bg: "#dbeafe", border: "#2563eb", color: "#1e3a8a" },
    gray: { bg: "#f1f5f9", border: "#94a3b8", color: "#334155" },
  };
  const c = colors[tone];
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color, borderRadius: 999, padding: "7px 12px", fontWeight: 1000, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
    </span>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section
      style={{
        background:
          "linear-gradient(145deg, #fffdf7 0%, #fff8e8 45%, #eef6ff 100%)",
        border: `2px solid ${LINE}`,
        borderRadius: 28,
        padding: 22,
        position: "relative",
        overflow: "hidden",
        boxShadow:
          "0 18px 35px rgba(15,23,42,0.12), 0 8px 18px rgba(184,138,59,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
        transition: "all .25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow =
          "0 25px 45px rgba(15,23,42,0.18), 0 12px 25px rgba(184,138,59,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 18px 35px rgba(15,23,42,0.12), 0 8px 18px rgba(184,138,59,0.18), inset 0 1px 0 rgba(255,255,255,0.9)";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background:
            "linear-gradient(90deg,#2563eb,#16a34a,#b88a3b)",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, color: INK, fontSize: 24, fontWeight: 1000 }}>
          {title}
        </h2>
        {right}
      </div>

      {children}
    </section>
  );
}

function Button({ children, onClick, tone = "gold" }: { children: React.ReactNode; onClick: () => void; tone?: "gold" | "blue" | "red" | "green" }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    gold: { bg: "#f7d66b", color: "#111827", border: "#b7952b" },
    blue: { bg: "#dbeafe", color: "#1e3a8a", border: "#2563eb" },
    green: { bg: "#dcfce7", color: "#14532d", border: "#16a34a" },
    red: { bg: "#fee2e2", color: "#7f1d1d", border: "#dc2626" },
  };
  const c = colors[tone];
  return (
    <button onClick={onClick} style={{ border: `2px solid ${c.border}`, background: c.bg, color: c.color, borderRadius: 14, padding: "11px 16px", fontWeight: 1000, cursor: "pointer", minHeight: 44 }}>
      {children}
    </button>
  );
}

export default function SystemReleaseCenter() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    const localKeys = listKeysSafe(typeof window !== "undefined" ? window.localStorage : undefined);
    const sessionKeys = listKeysSafe(typeof window !== "undefined" ? window.sessionStorage : undefined);
    const role = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "effectiveRole") || readSafe(typeof window !== "undefined" ? window.sessionStorage : undefined, "effectiveRole");
    const tenantId = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "tenantId") || readSafe(typeof window !== "undefined" ? window.sessionStorage : undefined, "tenantId");
    const governorate = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "governorate") || readSafe(typeof window !== "undefined" ? window.sessionStorage : undefined, "governorate");
    const lastSuccess = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "exam-manager:cloud-storage:last-success-at");
    const lastWarning = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "exam-manager:cloud-storage:last-warning");
    const lastError = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "exam-manager:cloud-storage:last-error");

    return {
      releaseName: RELEASE_NAME,
      releaseCode: RELEASE_CODE,
      currentPhase: CURRENT_PHASE,
      generatedAt: new Date().toISOString(),
      session: { role, tenantId, governorate },
      cloud: { lastSuccess, lastWarning, lastError },
      storageSummary: {
        localStorageKeys: localKeys.length,
        sessionStorageKeys: sessionKeys.length,
        cloudCacheKeys: localKeys.filter((k) => k.includes("cloud-cache")).length,
        auditKeys: localKeys.filter((k) => k.toLowerCase().includes("audit")).length,
        errorKeys: localKeys.filter((k) => k.toLowerCase().includes("error")).length,
      },
      installedPhases: releaseItems.filter((item) => item.status !== "next").map((item) => item.phase),
      nextPhase: releaseItems.find((item) => item.status === "next")?.phase || null,
    };
  }, []);

  function exportJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `release-center-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const doneCount = releaseItems.filter((item) => item.status === "done").length;
  const needsTestCount = releaseItems.filter((item) => item.status === "needs-test").length;
  const nextCount = releaseItems.filter((item) => item.status === "next").length;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(135deg,#d9ecff 0%,#eaf4ff 35%,#f9e7b8 100%)", padding: 28, color: INK, fontFamily: "Tahoma, Arial, sans-serif" }}>
      <header
style={{
background:"rgba(255,255,255,0.72)",
border:"1px solid rgba(37,99,235,.20)",
borderRadius:28,
padding:"24px 30px",
marginBottom:24,
boxShadow:"0 20px 50px rgba(15,23,42,.10)",
backdropFilter:"blur(18px)"
}}
>

<div
style={{
display:"grid",
gridTemplateColumns:"420px 1fr 220px",
alignItems:"center",
gap:20,
direction:"rtl"
}}
>

{/* الشعار يمين */}
<div style={{textAlign:"center"}}>
<img
src={ministryLogo}
alt="logo"
style={{
width:110,
height:110,
objectFit:"contain"
}}
/>

<div style={{fontWeight:1000,fontSize:20,color:INK}}>
سلطنة عمان
</div>

<div style={{fontWeight:1000,fontSize:20,color:INK}}>
وزارة التعليم
</div>

</div>


{/* العنوان وسط */}
<div style={{textAlign:"center"}}>

<h1
style={{
margin:"0 0 10px",
fontSize:48,
fontWeight:1000,
color:INK
}}
>
مركز الإصدارات والتطوير
</h1>

<p
style={{
margin:0,
color:MUTED,
fontWeight:900,
fontSize:17
}}
>
متابعة مراحل التطوير، حالة النسخة الحالية، وتجهيز المرحلة القادمة قبل التسليم التجاري.
</p>

</div>


{/* الأزرار يسار */}
<div
style={{
display:"flex",
gap:10,
flexWrap:"wrap",
justifyContent:"flex-start"
}}
>

<Button onClick={() => navigate("/system/operations")} tone="gold">
لوحة النظام و التطوير
</Button>

<Button onClick={() => navigate("/programs-gateway")} tone="gold">
البوابة التشغيلية
</Button>

<Button onClick={() => navigate("/system/release-center")} tone="blue">
مركز الإصدارات والتطوير
</Button>

</div>

</div>

</header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 22 }}>
        <Card title="المرحلة الحالية">
          <div style={{
            position:"relative",overflow:"hidden",background:"linear-gradient(145deg,#ffffff 0%,#dbeafe 70%,#bfdbfe 100%)",borderRadius:24,padding:24,border:"1px solid rgba(255,255,255,.8)",transition:"all .35s cubic-bezier(.2,.8,.2,1)",cursor:"pointer",transform:"translateZ(0)",boxShadow:"0 22px 45px rgba(37,99,235,.28), inset 0 3px 12px rgba(255,255,255,.95)"
          }}>
            <div style={{position:"absolute",top:12,left:12,width:55,height:55,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,background:"linear-gradient(145deg,#2563eb,#60a5fa)",color:"#fff",boxShadow:"0 10px 25px rgba(37,99,235,.35)"}}>☁</div><div style={{fontSize:44,fontWeight:1000,color:"#4338ca"}}>
              {CURRENT_PHASE}
            </div>
            <div style={{fontWeight:900}}>
              {RELEASE_CODE}
            </div>
          </div>
        </Card>


        <Card title="المراحل المثبتة">
          <div style={{
            background:"linear-gradient(145deg,#ffffff 0%,#dcfce7 65%,#bbf7d0 100%)",borderRadius:24,padding:24,border:"1px solid rgba(255,255,255,.85)",transition:"all .35s cubic-bezier(.2,.8,.2,1)",cursor:"pointer",boxShadow:"0 22px 45px rgba(22,163,74,.28), inset 0 3px 12px rgba(255,255,255,.95)"
          }}>
            <div style={{position:"absolute",top:12,left:12,width:55,height:55,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,background:"linear-gradient(145deg,#16a34a,#4ade80)",color:"#fff",boxShadow:"0 10px 25px rgba(22,163,74,.35)"}}>✓</div><div style={{fontSize:44,fontWeight:1000,color:"#15803d"}}>
              {doneCount}
            </div>
            <div style={{fontWeight:900}}>
              جاهزة للاختبار
            </div>
          </div>
        </Card>


        <Card title="تحتاج اختبار">
          <div style={{
            background:"linear-gradient(145deg,#ffffff 0%,#ffedd5 65%,#fed7aa 100%)",borderRadius:24,padding:24,border:"1px solid rgba(255,255,255,.85)",transition:"all .35s cubic-bezier(.2,.8,.2,1)",cursor:"pointer",boxShadow:"0 22px 45px rgba(234,88,12,.28), inset 0 3px 12px rgba(255,255,255,.95)"
          }}>
            <div style={{position:"absolute",top:12,left:12,width:55,height:55,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,background:"linear-gradient(145deg,#ea580c,#fb923c)",color:"#fff",boxShadow:"0 10px 25px rgba(234,88,12,.35)"}}>⌛</div><div style={{fontSize:44,fontWeight:1000,color:"#c2410c"}}>
              {needsTestCount}
            </div>
            <div style={{fontWeight:900}}>
              خاصة بالسجل السحابي
            </div>
          </div>
        </Card>


        <Card title="المرحلة القادمة">
          <div style={{
            background:"linear-gradient(145deg,#ffffff 0%,#ede9fe 65%,#ddd6fe 100%)",borderRadius:24,padding:24,border:"1px solid rgba(255,255,255,.85)",transition:"all .35s cubic-bezier(.2,.8,.2,1)",cursor:"pointer",boxShadow:"0 22px 45px rgba(124,58,237,.28), inset 0 3px 12px rgba(255,255,255,.95)"
          }}>
            <div style={{position:"absolute",top:12,left:12,width:55,height:55,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,background:"linear-gradient(145deg,#7c3aed,#a78bfa)",color:"#fff",boxShadow:"0 10px 25px rgba(124,58,237,.35)"}}>▣</div><div style={{fontSize:44,fontWeight:1000,color:"#2563eb"}}>
              {nextCount ? 50 : "—"}
            </div>
            <div style={{fontWeight:900}}>
              حزمة الاختبار التجاري
            </div>
          </div>
        </Card>
      </section>

      <Card
        title="حالة النسخة الحالية"
        right={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Button onClick={copyReport} tone="blue">{copied ? "تم النسخ" : "نسخ تقرير النسخة"}</Button><Button onClick={exportJson} tone="green">تصدير JSON</Button></div>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, background: "#fffdf7" }}><b>اسم النسخة:</b><br />{RELEASE_NAME}</div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, background: "#fffdf7" }}><b>آخر مزامنة:</b><br />{report.cloud.lastSuccess || "غير مسجلة"}</div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, background: "#fffdf7" }}><b>مفاتيح التخزين المحلي:</b><br />{report.storageSummary.localStorageKeys}</div>
        </div>
      </Card>

      <div style={{ height: 18 }} />

      <Card title="خريطة مراحل التطوير">

        <div style={{
          display:"grid",
          gap:14,
          padding:10
        }}>

          {releaseItems.map((item)=>(

            <div
              key={item.phase}
              style={{
                display:"grid",
                gridTemplateColumns:"90px 1fr 160px",
                gap:18,
                alignItems:"center",
                padding:"18px 22px",
                borderRadius:24,
                background:item.phase===CURRENT_PHASE
                ?"linear-gradient(135deg,#fff7d6,#ffffff)"
                :"linear-gradient(135deg,#ffffff,#f8fafc)",
                border:item.phase===CURRENT_PHASE
                ?"2px solid #d4af37"
                :"1px solid rgba(212,175,55,.35)",
                boxShadow:"0 15px 35px rgba(15,23,42,.12)"
              }}
            >

              <div style={{
                width:60,
                height:60,
                borderRadius:20,
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                fontSize:22,
                fontWeight:1000,
                color:"#fff",
                background:
                item.status==="done"
                ?"linear-gradient(145deg,#16a34a,#4ade80)"
                :
                item.status==="needs-test"
                ?"linear-gradient(145deg,#ea580c,#fb923c)"
                :
                "linear-gradient(145deg,#2563eb,#60a5fa)"
              }}>
                {item.phase}
              </div>

              <div>
                <div style={{
                  fontSize:20,
                  fontWeight:1000,
                  color:INK
                }}>
                  {item.title}
                </div>

                <div style={{
                  marginTop:6,
                  color:MUTED,
                  fontWeight:800
                }}>
                  {item.note}
                </div>
              </div>

              <div>
                {
                  item.status==="done"
                  ? <Badge tone="green">مثبتة</Badge>
                  : item.status==="needs-test"
                  ? <Badge tone="gold">تحتاج اختبار</Badge>
                  : <Badge tone="blue">القادمة</Badge>
                }
              </div>

            </div>

          ))}

        </div>

      </Card>
       <Card title="روابط سريعة للمرحلة التجارية">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button onClick={() => navigate("/system/monitoring")} tone="green">مركز مراقبة النظام</Button>
          <Button onClick={() => navigate("/system/maintenance")} tone="gold">مركز الصيانة</Button>
          <Button onClick={() => navigate("/system/error-log")} tone="red">سجل الأخطاء</Button>
          <Button onClick={() => navigate("/system/audit-log")} tone="blue">سجل العمليات</Button>
          <Button onClick={() => navigate("/system/permissions-audit")} tone="gold">فحص الصلاحيات</Button>
          <Button onClick={() => navigate("/system/commercial-readiness")} tone="green">الجاهزية التجارية</Button>
        </div>
      </Card>
    </div>
  );
}
