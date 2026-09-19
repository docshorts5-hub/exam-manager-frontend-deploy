// src/pages/SystemMaintenanceCenter.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import MINISTRY_LOGO from "../assets/branding/ministry-logo.png";


const GOLD = "#b9931f";
const INK = "#111827";
const BG = "linear-gradient(135deg,#f8fbff 0%,#ffffff 45%,#eef7ff 100%)";
const CARD = "rgba(255,253,247,0.94)";
const BORDER = "rgba(185,147,31,0.58)";
const GREEN = "#0f7a3a";
const RED = "#9f1239";

type StorageItem = {
  key: string;
  bytes: number;
  category: string;
};

function safeGetLocalKeys(): StorageItem[] {
  const rows: StorageItem[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) || "";
      const value = window.localStorage.getItem(key) || "";
      let category = "بيانات عامة";
      if (key.includes("cloud-cache")) category = "كاش السحابة";
      else if (key.includes("cloud-storage")) category = "حالة التخزين السحابي";
      else if (key.includes("system-audit") || key.toLowerCase().includes("audit")) category = "سجل العمليات";
      else if (key.includes("system-error") || key.toLowerCase().includes("error")) category = "سجل الأخطاء";
      else if (key.includes("readonly") || key.includes("viewAs")) category = "وضع المشاهدة";
      rows.push({ key, bytes: new Blob([value]).size, category });
    }
  } catch {}
  return rows.sort((a, b) => b.bytes - a.bytes);
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function removeByPredicate(predicate: (key: string) => boolean) {
  let count = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && predicate(key)) keys.push(key);
    }
    keys.forEach((key) => {
      window.localStorage.removeItem(key);
      count += 1;
    });
  } catch {}
  return count;
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getProfile(auth: any) {
  return auth?.profile || auth?.userProfile || auth?.allow || {};
}

function readSessionFlag(...keys: string[]) {
  for (const key of keys) {
    try {
      const value = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      if (value) return value;
    } catch {}
  }
  return "";
}

export default function SystemMaintenanceCenter() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const profile = getProfile(auth);
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState("");

  const rows = useMemo(() => safeGetLocalKeys(), [tick]);
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  const cloudCacheCount = rows.filter((row) => row.category === "كاش السحابة").length;
  const logsCount = rows.filter((row) => row.category === "سجل العمليات" || row.category === "سجل الأخطاء").length;
  const readonlyFlag = readSessionFlag("exam-manager:view-as-readonly", "viewAsReadOnly", "readOnly");

  const email = String(auth?.user?.email || profile?.email || "-");
  const role = String(profile?.role || profile?.primaryRole || (auth?.isSuperAdmin ? "super_admin" : "-") || "-");
  const governorate = String(profile?.governorate || profile?.tenantGovernorate || "-");
  const tenantId = String(profile?.tenantId || "-");

  const makeMaintenanceReport = () => ({
    createdAt: new Date().toISOString(),
    user: { email, role, governorate, tenantId },
    browser: {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      language: navigator.language,
    },
    storage: {
      totalKeys: rows.length,
      totalBytes,
      cloudCacheCount,
      logsCount,
      readonlyFlag: Boolean(readonlyFlag),
      topKeys: rows.slice(0, 50),
    },
  });

  const clearCloudCache = () => {
    const count = removeByPredicate((key) => key.includes("cloud-cache") || key.includes("cloud-storage:last-warning") || key.includes("cloud-storage:last-error"));
    setTick((v) => v + 1);
    setMessage(`تم تنظيف ${count} مفتاح من كاش السحابة والتنبيهات المؤقتة.`);
  };

  const clearLocalLogs = () => {
    const count = removeByPredicate((key) => key.includes("system-audit") || key.includes("system-error") || key.toLowerCase().includes("audittrail") || key.toLowerCase().includes("errordiagnostics"));
    setTick((v) => v + 1);
    setMessage(`تم تنظيف ${count} مفتاح من سجلات المتصفح المحلية فقط.`);
  };

  const exportReport = () => {
    downloadJson(`system-maintenance-report-${new Date().toISOString().slice(0, 10)}.json`, makeMaintenanceReport());
    setMessage("تم تصدير تقرير الصيانة بنجاح.");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(makeMaintenanceReport(), null, 2));
      setMessage("تم نسخ تقرير الصيانة إلى الحافظة.");
    } catch {
      setMessage("تعذر النسخ التلقائي. استخدم زر التصدير بدلًا من ذلك.");
    }
  };

  const hardRefresh = () => {
    window.location.reload();
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: BG, padding: 28, color: INK, fontFamily: "system-ui, Tahoma, Arial" }}>
      <section style={{
        borderRadius:28,
        padding:30,
        background:"linear-gradient(135deg,rgba(255,255,255,.85),rgba(239,246,255,.75))",
        border:"2px solid #bfdbfe",
        boxShadow:"0 20px 50px rgba(15,23,42,.12)",
        backdropFilter:"blur(14px)"
      }}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:20,flexWrap:"wrap"}}>

          <div style={{
            display:"flex",
            alignItems:"center",
            gap:16
          }}>
            <img
              src={MINISTRY_LOGO}
              alt="شعار وزارة التعليم"
              style={{
                width:90,
                height:90,
                objectFit:"contain",
                background:"transparent"
              }}
            />

            <div style={{
              textAlign:"right",
              lineHeight:1.6
            }}>
              <div style={{
                fontSize:26,
                fontWeight:950,
                color:"#166534"
              }}>
                سلطنة عمان
              </div>

              <div style={{
                fontSize:22,
                fontWeight:900,
                color:"#166534"
              }}>
                وزارة التعليم
              </div>
            </div>
          </div>

          <div style={{textAlign:"center",flex:1}}>
            <h1 style={{
              margin:0,
              fontSize:46,
              fontWeight:950,
              color:"#12345b"
            }}>
              مركز صيانة النظام
            </h1>

            <p style={{
              marginTop:12,
              fontWeight:800
            }}>
              أدوات آمنة لإدارة التخزين المحلي ومراجعة سلامة النظام
            </p>
          </div>

          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button style={smallButton} onClick={()=>navigate("/system")}>
              ⬅ صفحة النظام و التطوير
            </button>

            <button style={smallButton} onClick={()=>navigate("/programs-gateway")}>
              البوابة التشغيلية
            </button>

            <button style={smallButton} onClick={()=>navigate("/system/operations")}>
              ⬅   مركز صيانة النظام   
            </button>
          </div>

        </div>

      </section>

      <section style={{
        display:"grid",
        gridTemplateColumns:"repeat(4,minmax(180px,1fr))",
        gap:16,
        marginTop:22
      }}>

        {[
          ["🟢 حالة النظام","جاهز للعمل","#0f7a3a","#ecfdf5"],
          ["🔐 الجلسة",email || "غير معروف","#12345b","#eff6ff"],
          ["💾 التخزين المحلي",fmtBytes(totalBytes),"#8a6500","#fffaf0"],
          ["☁️ كاش السحابة",String(cloudCacheCount),"#2563eb","#eff6ff"]
        ].map(([icon,label,value,color,bg])=>(
          
          <div
            key={String(label)}
            style={{
              border:`1px solid ${color}44`,
              borderRadius:24,
              background:`linear-gradient(145deg,#ffffff,${bg})`,
              padding:"18px",
              boxShadow:"0 14px 32px rgba(15,23,42,.10)",
              minHeight:110,
              display:"flex",
              flexDirection:"column",
              justifyContent:"center",
              gap:8
            }}
          >

            <div style={{
              fontSize:14,
              fontWeight:900,
              color:"#64748b"
            }}>
              {icon} {label}
            </div>

            <div style={{
              fontSize:22,
              fontWeight:950,
              color
            }}>
              {value}
            </div>

          </div>

        ))}

      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 16, marginTop: 22 }}>
        {[
          ["مفاتيح التخزين المحلي", rows.length],
          ["حجم التخزين التقريبي", fmtBytes(totalBytes)],
          ["مفاتيح كاش السحابة", cloudCacheCount],
          ["مفاتيح السجلات المحلية", logsCount],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              border:"1px solid rgba(185,147,31,.45)",
              borderRadius:24,
              background:"linear-gradient(135deg,rgba(255,255,255,.95),rgba(239,246,255,.85))",
              padding:"22px 18px",
              textAlign:"center",
              boxShadow:"0 12px 30px rgba(15,23,42,.10)",
              transition:"transform .2s ease"
            }}
          >
            <div style={{
              fontSize:34,
              fontWeight:950,
              color:"#12345b",
              marginBottom:8
            }}>
              {String(value)}
            </div>

            <div style={{
              fontWeight:900,
              color:"#8a6500",
              fontSize:16
            }}>
              {String(label)}
            </div>
          </div>
        ))}
      </section>

      {message ? (
        <div style={{ marginTop: 18, border: `2px solid ${GREEN}`, borderRadius: 16, background: "#ecfdf5", color: GREEN, padding: 14, fontWeight: 900 }}>
          {message}
        </div>
      ) : null}

      <section style={{ marginTop:22, border:"1.5px solid rgba(96,165,250,.35)", borderRadius:28, background:"linear-gradient(145deg,rgba(255,255,255,.96),rgba(239,246,255,.88))", padding:28, boxShadow:"0 20px 48px rgba(15,23,42,.10)", backdropFilter:"blur(16px)" }}>
        <h2 style={{ marginTop: 0, fontSize: 30, fontWeight:950 }}>
          أدوات الصيانة الآمنة
        </h2>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(260px,420px))",gap:20,justifyContent:"center",alignItems:"stretch"}}>

          <button onClick={clearCloudCache} style={buttonStyle(GREEN)}>
            <ActionIcon symbol="✓" color={GREEN} bg="#dcfce7" />
            <span>تنظيف كاش السحابة المحلي</span>
          </button>

          <button onClick={clearLocalLogs} style={buttonStyle(RED)}>
            <ActionIcon symbol="!" color={RED} bg="#ffe4e6" />
            <span>تنظيف السجلات المحلية فقط</span>
          </button>

          <button onClick={exportReport} style={buttonStyle(GOLD)}>
            <ActionIcon symbol="↓" color="#9a6d00" bg="#fef3c7" />
            <span>تصدير تقرير الصيانة JSON</span>
          </button>

          <button onClick={copyReport} style={buttonStyle("#1d4ed8")}>
            <ActionIcon symbol="⧉" color="#1d4ed8" bg="#dbeafe" />
            <span>نسخ تقرير الصيانة</span>
          </button>

          <button onClick={() => setTick((v) => v + 1)} style={buttonStyle("#4b5563")}>
            <ActionIcon symbol="↻" color="#475569" bg="#e2e8f0" />
            <span>تحديث القراءة</span>
          </button>

          <button onClick={hardRefresh} style={buttonStyle("#7c3aed")}>
            <ActionIcon symbol="⟳" color="#7c3aed" bg="#ede9fe" />
            <span>إعادة تحميل الصفحة</span>
          </button>

        </div>

        <p style={{marginBottom:0,marginTop:18,fontWeight:850,lineHeight:2}}>
          تنبيه أمني: جميع عمليات التنظيف تعمل على التخزين المحلي فقط ولا تقوم بحذف بيانات Firestore الأصلية.
        </p>

      </section>

      <section style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(280px,1fr))", gap:18, marginTop:22, alignItems:"start" }}>

        <div style={{
          border:"1px solid rgba(59,130,246,.25)",
          borderRadius:28,
          background:"linear-gradient(145deg,#ffffff,#fffaf0)",
          padding:26,
          boxShadow:"0 18px 45px rgba(15,23,42,.12)",
          position:"relative",
          overflow:"hidden"
        }}>

          <div style={{
            position:"absolute",
            top:0,
            right:0,
            width:90,
            height:90,
            background:"rgba(37,99,235,.08)",
            borderRadius:"0 0 0 90px"
          }} />

          <h3 style={{
            ...h3Style,
            display:"flex",
            alignItems:"center",
            gap:10,
            color:"#12345b"
          }}>
            🔐 بيانات الجلسة الحالية
          </h3>

          <div style={{
            display:"grid",
            gap:6,
            marginTop:18
          }}>
            <Info label="المستخدم" value={email} />
            <Info label="الدور" value={role} />
            <Info label="المحافظة" value={governorate} />
            <Info label="Tenant" value={tenantId} />
            <Info label="وضع المشاهدة فقط" value={readonlyFlag ? "مفعل" : "غير مفعل"} />
          </div>

        </div>


        <div style={{
          border:"1.5px solid rgba(96,165,250,.30)",
          borderRadius:28,
          background:"linear-gradient(145deg,rgba(255,255,255,.97),rgba(239,246,255,.88))",
          padding:26,
          boxShadow:"0 18px 42px rgba(15,23,42,.10)",
          backdropFilter:"blur(14px)"
        }}>

          <h3 style={h3Style}>🧭 روابط متابعة سريعة</h3>

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16}}>

            <button onClick={() => navigate("/system/monitoring")} style={quickLinkStyle("#2563eb","#eff6ff")}>
  <span style={quickLinkArrowStyle("#2563eb","#dbeafe")}>‹</span>

  <span style={{direction:"rtl",textAlign:"right"}}>
    <span style={{display:"block",fontSize:17,fontWeight:950,color:"#12345b"}}>
      مركز مراقبة النظام
    </span>
    <span style={{display:"block",marginTop:5,fontSize:12,fontWeight:750,color:"#64748b"}}>
      متابعة الحالة التشغيلية للنظام
    </span>
  </span>

  <span style={quickLinkIconStyle("#2563eb","#dbeafe")}>📡</span>
</button>

            <button onClick={() => navigate("/system/error-log")} style={quickLinkStyle("#ea580c","#fff7ed")}>
  <span style={quickLinkArrowStyle("#ea580c","#ffedd5")}>‹</span>

  <span style={{direction:"rtl",textAlign:"right"}}>
    <span style={{display:"block",fontSize:17,fontWeight:950,color:"#9a3412"}}>
      سجل الأخطاء
    </span>
    <span style={{display:"block",marginTop:5,fontSize:12,fontWeight:750,color:"#9a3412"}}>
      مراجعة الأخطاء والتنبيهات
    </span>
  </span>

  <span style={quickLinkIconStyle("#ea580c","#ffedd5")}>⚠</span>
</button>

            <button onClick={() => navigate("/system/audit-log")} style={quickLinkStyle("#d97706","#fffbeb")}>
  <span style={quickLinkArrowStyle("#d97706","#fef3c7")}>‹</span>

  <span style={{direction:"rtl",textAlign:"right"}}>
    <span style={{display:"block",fontSize:17,fontWeight:950,color:"#92400e"}}>
      سجل العمليات
    </span>
    <span style={{display:"block",marginTop:5,fontSize:12,fontWeight:750,color:"#a16207"}}>
      متابعة حركة النظام والعمليات
    </span>
  </span>

  <span style={quickLinkIconStyle("#d97706","#fef3c7")}>▣</span>
</button>

            <button onClick={() => navigate("/system/permissions-audit")} style={quickLinkStyle("#7c3aed","#f5f3ff")}>
  <span style={quickLinkArrowStyle("#7c3aed","#ede9fe")}>‹</span>

  <span style={{direction:"rtl",textAlign:"right"}}>
    <span style={{display:"block",fontSize:17,fontWeight:950,color:"#5b21b6"}}>
      فحص الصلاحيات والربط
    </span>
    <span style={{display:"block",marginTop:5,fontSize:12,fontWeight:750,color:"#7c3aed"}}>
      تدقيق الوصول والربط الأمني
    </span>
  </span>

  <span style={quickLinkIconStyle("#7c3aed","#ede9fe")}>🔎</span>
</button>

          </div>

        </div>

      </section>

      <section style={{ marginTop:22, border:"1.5px solid rgba(96,165,250,.30)", borderRadius:28, background:"linear-gradient(145deg,#ffffff,#fffaf0)", padding:26, boxShadow:"0 18px 42px rgba(15,23,42,.10)", overflow:"hidden" }}>
        <h2 style={{ marginTop: 0, fontSize: 28 }}>أكبر مفاتيح التخزين المحلي</h2>
        <div style={{
  overflowX:"auto",
  border:"1px solid rgba(185,147,31,.35)",
  borderRadius:26,
  background:"linear-gradient(145deg,#ffffff,#fffaf0)",
  padding:"12px 14px 16px",
  boxShadow:"0 18px 42px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.95)"
}}>

  <div style={{
    display:"flex",
    alignItems:"center",
    justifyContent:"space-between",
    gap:12,
    flexWrap:"wrap",
    padding:"4px 4px 14px"
  }}>

    <div style={{
      display:"flex",
      gap:9,
      flexWrap:"wrap"
    }}>

      <span style={{
        padding:"7px 13px",
        borderRadius:999,
        background:"linear-gradient(145deg,#fff7df,#fffdf7)",
        color:"#1e40af",
        fontWeight:900,
        fontSize:12,
        boxShadow:"0 5px 12px rgba(185,147,31,.14)"
      }}>
        أعلى {Math.min(rows.length,30)} مفتاح
      </span>

      <span style={{
        padding:"7px 13px",
        borderRadius:999,
        background:"linear-gradient(145deg,#ecfdf5,#f0fdf4)",
        color:"#047857",
        fontWeight:900,
        fontSize:12,
        boxShadow:"0 5px 12px rgba(5,150,105,.10)"
      }}>
        الحجم الكلي: {fmtBytes(totalBytes)}
      </span>

    </div>

    <span style={{
      color:"#64748b",
      fontWeight:800,
      fontSize:12
    }}>
      مرتبة تنازلياً حسب الحجم
    </span>

  </div>


  <table style={{
    width:"100%",
    tableLayout:"fixed",
    borderCollapse:"separate",
    borderSpacing:"0 10px",
    fontWeight:800
  }}>

    <colgroup>
      <col style={{width:"62%"}} />
      <col style={{width:"22%"}} />
      <col style={{width:"16%"}} />
    </colgroup>


    <thead>
      <tr style={{
        background:"linear-gradient(135deg,#12345b,#1f4d7a,#b9931f)",
        color:"#ffffff"
      }}>

        <th style={{
          padding:"16px 20px",
          textAlign:"right",
          borderRadius:"0 18px 18px 0",
          fontWeight:950,
          fontSize:15,
          letterSpacing:.2
        }}>
          المفتاح
        </th>

        <th style={{
          padding:"16px",
          textAlign:"center",
          fontWeight:950,
          fontSize:15
        }}>
          التصنيف
        </th>

        <th style={{
          padding:"16px",
          textAlign:"center",
          borderRadius:"18px 0 0 18px",
          fontWeight:950,
          fontSize:15
        }}>
          الحجم
        </th>

      </tr>
    </thead>


    <tbody>

      {rows.slice(0,30).map((row,index) => {

        const categoryTone =
          row.category === "كاش السحابة"
            ? { bg:"#ecfdf5", color:"#047857", border:"#6ee7b7" }
            : row.category === "سجل الأخطاء"
              ? { bg:"#fff1f2", color:"#be123c", border:"#fda4af" }
              : row.category === "سجل العمليات"
                ? { bg:"#fffbeb", color:"#a16207", border:"#fde68a" }
                : row.category === "وضع المشاهدة"
                  ? { bg:"#f5f3ff", color:"#6d28d9", border:"#c4b5fd" }
                  : { bg:"#fff7df", color:"#8a6500", border:"#e6c65c" };

        const maxBytes = rows[0]?.bytes || 1;
        const ratio = Math.max(8,Math.min(100,(row.bytes / maxBytes) * 100));

        return (
          <tr
            key={row.key}
            style={{
              filter:"drop-shadow(0 7px 10px rgba(15,23,42,.06))"
            }}
          >

            <td style={{
              padding:"14px 18px",
              background:index % 2 === 0
                ? "linear-gradient(145deg,#fffdf7,#ffffff)"
                : "linear-gradient(145deg,#ffffff,#faf7ef)",
              borderTop:"1px solid #e2e8f0",
              borderBottom:"1px solid #e2e8f0",
              borderRight:"1px solid #e2e8f0",
              borderRadius:"0 18px 18px 0"
            }}>

              <div style={{
                display:"flex",
                alignItems:"center",
                gap:12,
                direction:"ltr"
              }}>

                <span style={{
                  width:10,
                  height:10,
                  minWidth:10,
                  borderRadius:"50%",
                  background:index < 3 ? "#b9931f" : "#94a3b8",
                  boxShadow:index < 3
                    ? "0 0 0 5px rgba(185,147,31,.14)"
                    : "none"
                }}/>

                <span style={{
                  color:"#0f172a",
                  fontWeight:900,
                  fontSize:13,
                  textAlign:"left",
                  wordBreak:"break-all",
                  lineHeight:1.5
                }}>
                  {row.key}
                </span>

              </div>

            </td>


            <td style={{
              padding:"14px 12px",
              background:index % 2 === 0 ? "#ffffff" : "#f8fafc",
              borderTop:"1px solid #e2e8f0",
              borderBottom:"1px solid #e2e8f0",
              textAlign:"center"
            }}>

              <span style={{
                display:"inline-flex",
                alignItems:"center",
                justifyContent:"center",
                minWidth:105,
                padding:"8px 13px",
                borderRadius:999,
                background:categoryTone.bg,
                color:categoryTone.color,
                border:`1px solid ${categoryTone.border}`,
                fontWeight:950,
                fontSize:12,
                boxShadow:"0 5px 12px rgba(15,23,42,.06)"
              }}>
                {row.category}
              </span>

            </td>


            <td style={{
              padding:"12px",
              background:index % 2 === 0 ? "#ffffff" : "#f8fafc",
              borderTop:"1px solid #e2e8f0",
              borderBottom:"1px solid #e2e8f0",
              borderLeft:"1px solid #e2e8f0",
              borderRadius:"18px 0 0 18px",
              textAlign:"center"
            }}>

              <div style={{
                display:"grid",
                gap:7,
                justifyItems:"center"
              }}>

                <span style={{
                  display:"inline-flex",
                  justifyContent:"center",
                  minWidth:92,
                  padding:"8px 12px",
                  borderRadius:14,
                  background:"linear-gradient(145deg,#fff7df,#fffdf7)",
                  color:"#8a6500",
                  border:"1px solid #bfdbfe",
                  fontWeight:950,
                  fontSize:13,
                  boxShadow:"0 6px 14px rgba(37,99,235,.13), inset 0 1px 0 #ffffff"
                }}>
                  {fmtBytes(row.bytes)}
                </span>

                <span style={{
                  display:"block",
                  width:"92px",
                  height:5,
                  borderRadius:999,
                  overflow:"hidden",
                  background:"#e2e8f0"
                }}>

                  <span style={{
                    display:"block",
                    width:`${ratio}%`,
                    height:"100%",
                    borderRadius:999,
                    background:index < 3
                      ? "linear-gradient(90deg,#b9931f,#e6c65c)"
                      : "linear-gradient(90deg,#64748b,#94a3b8)"
                  }}/>

                </span>

              </div>

            </td>

          </tr>
        );
      })}


      {!rows.length ? (
        <tr>
          <td
            colSpan={3}
            style={{
              padding:30,
              textAlign:"center",
              color:"#64748b",
              background:"#f8fafc",
              borderRadius:18,
              fontWeight:900
            }}
          >
            لا توجد مفاتيح محلية للعرض.
          </td>
        </tr>
      ) : null}

    </tbody>

  </table>

</div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", borderBottom: "1px solid rgba(185,147,31,0.22)", padding: "10px 0", gap: 10 }}>
      <b style={{ color: "#5f4a08" }}>{label}</b>
      <span style={{ fontWeight: 900 }}>{value || "-"}</span>
    </div>
  );
}

function ActionIcon({ symbol, color, bg }: { symbol: string; color: string; bg: string }) {
  return (
    <span style={{
      width:46,
      height:46,
      minWidth:46,
      borderRadius:15,
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      background:`linear-gradient(145deg,#ffffff,${bg})`,
      color,
      fontSize:23,
      fontWeight:950,
      border:`1px solid ${color}44`,
      boxShadow:"inset 0 1px 0 rgba(255,255,255,.9), 0 5px 10px rgba(15,23,42,.14)"
    }}>
      {symbol}
    </span>
  );
}

function buttonStyle(color: string): React.CSSProperties {
  return {
    border: `2px solid ${color}`,
    borderBottomWidth: 4,
    color,
    background: "linear-gradient(145deg,#ffffff,#f6f9fc)",
    borderRadius: 20,
    padding: "10px 18px",
    minHeight: 72,
    fontWeight: 950,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    direction: "rtl",
    boxShadow: "0 7px 0 rgba(15,23,42,.12), 0 15px 28px rgba(15,23,42,.12), inset 0 1px 0 rgba(255,255,255,.95)",
    transform: "translateY(-2px)",
    transition: "transform .18s ease, box-shadow .18s ease",
  };
}

function quickLinkStyle(color: string, bg: string): React.CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    border: `1.5px solid ${color}88`,
    borderBottom: `7px solid ${color}`,
    borderRadius: 24,
    background: `linear-gradient(145deg,#ffffff 0%,${bg} 100%)`,
    minHeight: 108,
    padding: "16px 18px",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "48px 1fr 54px",
    alignItems: "center",
    gap: 14,
    direction: "ltr",
    color: "#0f172a",
    boxShadow: `0 9px 0 ${color}22, 0 18px 32px ${color}28, inset 0 1px 0 rgba(255,255,255,.95)`,
    transform: "translateY(-3px)",
    transition: "transform .18s ease, box-shadow .18s ease",
  };
}

function quickLinkIconStyle(color: string, bg: string): React.CSSProperties {
  return {
    width: 52,
    height: 52,
    borderRadius: 17,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "end",
    background: `linear-gradient(145deg,#ffffff,${bg})`,
    border: `1px solid ${color}44`,
    boxShadow: `0 7px 16px ${color}25, inset 0 1px 0 rgba(255,255,255,.95)`,
    fontSize: 24,
  };
}

function quickLinkArrowStyle(color: string, bg: string): React.CSSProperties {
  return {
    width: 42,
    height: 42,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "start",
    background: `linear-gradient(145deg,#ffffff,${bg})`,
    border: `1px solid ${color}55`,
    color,
    fontSize: 24,
    fontWeight: 950,
    boxShadow: `0 6px 14px ${color}28`,
  };
}

function panelStyle(): React.CSSProperties {
  return { border: `2px solid ${BORDER}`, borderRadius: 20, background: CARD, padding: 20 };
}

const h3Style: React.CSSProperties = { fontSize: 24, marginTop: 0, color: INK };
const th: React.CSSProperties = { border: `1px solid ${BORDER}`, padding: 12, textAlign: "right", color: INK };
const td: React.CSSProperties = { border: `1px solid rgba(185,147,31,0.24)`, padding: 12, color: INK, wordBreak: "break-word" };
const smallButton: React.CSSProperties = { border: `2px solid ${GOLD}`, background: "#fffaf0", color: INK, borderRadius: 12, padding: "12px 14px", fontWeight: 950, cursor: "pointer", textAlign: "right" };

