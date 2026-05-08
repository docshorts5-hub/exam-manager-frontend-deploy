import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, isPlatformOwner } from "../features/authz";

const GOLD = "#d4af37";
const GOLD_SOFT = "rgba(212,175,55,0.22)";
const CREAM = "#f6f1e3";
const INK = "#111111";

type SuperRow = {
  email: string;
  enabled?: boolean;
  role?: string;
  governorate?: string;
  name?: string;
  userName?: string;
};

type GovGroup = {
  governorate: string;
  supers: SuperRow[];
};

export default function PlatformGovernorateSupersDirectory() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const isOwner = isPlatformOwner(authzSnapshot);

  const [rows, setRows] = useState<SuperRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    const unsub = onSnapshot(
      collection(db, "allowlist"),
      (snap) => {
        const out: SuperRow[] = [];
        snap.forEach((d) => {
          const row = d.data() as SuperRow;
          if (String(row.role || "").trim().toLowerCase() !== "super") return;
          const gov = String(row.governorate || "").trim();
          if (!gov) return;
          out.push({
            email: String(row.email || d.id || "").trim().toLowerCase(),
            enabled: row.enabled !== false,
            role: row.role,
            governorate: gov,
            name: String(row.name || "").trim(),
            userName: String(row.userName || "").trim(),
          });
        });
        out.sort((a, b) => {
          const ga = String(a.governorate || "");
          const gb = String(b.governorate || "");
          if (ga !== gb) return ga.localeCompare(gb, "ar");
          return String(a.email || "").localeCompare(String(b.email || ""), "en");
        });
        setRows(out);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [isOwner]);

  const groups = useMemo<GovGroup[]>(() => {
    const map = new Map<string, SuperRow[]>();
    for (const row of rows) {
      const gov = String(row.governorate || "").trim();
      if (!gov) continue;
      if (!map.has(gov)) map.set(gov, []);
      map.get(gov)!.push(row);
    }
    return Array.from(map.entries()).map(([governorate, supers]) => ({ governorate, supers }));
  }, [rows]);

  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isOwner) return <Navigate to="/programs-gateway" replace />;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f4efe2 0%, #ebe4d3 100%)",
        padding: 22,
        boxSizing: "border-box",
        direction: "rtl",
        color: INK,
      }}
    >
      <div style={{ maxWidth: 1680, margin: "0 auto", display: "grid", gap: 24 }}>
        <section
          style={{
            background: "linear-gradient(135deg, #8b6a00 0%, #b8860b 48%, #7a5c00 100%)",
            borderRadius: 38,
            border: `4px solid ${GOLD}`,
            boxShadow: `0 24px 50px rgba(0,0,0,0.25), 0 0 28px ${GOLD_SOFT}`,
            padding: "28px 30px",
            color: "#fff7d8",
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate("/programs-gateway")}
              style={{
                minHeight: 56,
                padding: "0 22px",
                borderRadius: 20,
                border: "3px solid rgba(255,247,216,0.45)",
                background: "rgba(255,255,255,0.10)",
                color: "#fff7d8",
                fontWeight: 900,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              العودة إلى البوابة التشغيلية
            </button>

            <div style={{ textAlign: "right", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>وزارة التربية والتعليم</div>
              <div style={{ fontSize: 68, lineHeight: 1, fontWeight: 1000 }}>سوبر المحافظات</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                صفحة خاصة بمالك المنصة لعرض جميع مشرفي المحافظات والدخول إلى صفحة كل محافظة.
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            background: "linear-gradient(180deg, #f7f2e6 0%, #efe8da 100%)",
            borderRadius: 38,
            border: `4px solid ${GOLD}`,
            boxShadow: `0 20px 42px rgba(0,0,0,0.12), 0 0 24px ${GOLD_SOFT}`,
            padding: 22,
            display: "grid",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 18px",
                borderRadius: 999,
                border: "2px solid #a7e0bd",
                background: "rgba(160,255,210,0.10)",
                color: "#111",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              اختيار المحافظة
            </div>
            <div style={{ textAlign: "right", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 56, fontWeight: 1000, lineHeight: 1.1 }}>جميع سوبر المحافظات</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                اختر أي مشرف محافظة لفتح صفحة سوبر المحافظة الخاصة به حسب نطاقه.
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 18, fontWeight: 800 }}>جاري التحميل...</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 18, fontWeight: 800 }}>لا يوجد سوبر محافظات حالياً.</div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {groups.map((group) => (
                <div
                  key={group.governorate}
                  style={{
                    borderRadius: 28,
                    border: `4px solid ${GOLD}`,
                    background: "linear-gradient(180deg, #f9f5ea 0%, #f0eadb 100%)",
                    boxShadow: `0 14px 28px rgba(0,0,0,0.08), inset 0 0 0 3px rgba(255,255,255,0.45)`,
                    padding: 18,
                    display: "grid",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 22,
                      border: `3px solid ${GOLD}`,
                      background: "rgba(255,255,255,0.40)",
                      padding: "14px 18px",
                      fontSize: 30,
                      fontWeight: 1000,
                      textAlign: "right",
                    }}
                  >
                    {group.governorate}
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    {group.supers.map((row) => {
                      const displayName =
                        String(row.userName || row.name || "").trim() || row.email.split("@")[0];

                      return (
                        <div
                          key={row.email}
                          style={{
                            borderRadius: 28,
                            border: `4px solid ${GOLD}`,
                            background: "rgba(255,255,255,0.28)",
                            padding: 20,
                            display: "grid",
                            gridTemplateColumns: "160px 1fr",
                            gap: 16,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "flex-start" }}>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/super-system?governorate=${encodeURIComponent(group.governorate)}`)
                              }
                              style={{
                                minWidth: 150,
                                minHeight: 64,
                                borderRadius: 20,
                                border: `3px solid ${GOLD}`,
                                background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
                                color: "#111",
                                fontWeight: 1000,
                                fontSize: 24,
                                cursor: "pointer",
                                boxShadow: "0 12px 22px rgba(150,120,20,0.16)",
                              }}
                            >
                              دخول
                            </button>
                          </div>

                          <div style={{ textAlign: "right", display: "grid", gap: 10 }}>
                            <div style={{ fontSize: 34, fontWeight: 1000 }}>{displayName}</div>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>{row.email}</div>
                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                              <span
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: 999,
                                  border: `2px solid ${GOLD}`,
                                  background: row.enabled ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
                                  fontWeight: 900,
                                  fontSize: 18,
                                }}
                              >
                                {row.enabled ? "مفعل" : "موقوف"}
                              </span>
                              <span
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: 999,
                                  border: `2px solid ${GOLD}`,
                                  background: "rgba(255,255,255,0.45)",
                                  fontWeight: 900,
                                  fontSize: 18,
                                }}
                              >
                                {group.governorate}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
