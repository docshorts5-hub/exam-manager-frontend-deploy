import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";

const GOLD = "#d4af37";
const SOFT = "rgba(212,175,55,0.18)";
const BG = "linear-gradient(180deg, #f4efe2 0%, #ebe4d3 100%)";
const CARD = "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)";

type AllowDoc = {
  email?: string;
  role?: string;
  tenantId?: string;
  governorate?: string;
  enabled?: boolean;
  userName?: string;
  name?: string;
  schoolName?: string;
};

export default function ExamSupersDirectory() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const role = String(
    auth?.effectiveRole ||
      auth?.allow?.role ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      ""
  ).trim().toLowerCase();

  const isOwner = role === "super_admin";
  const isGovernorateSuper = role === "super";
  const governorateScope = String(
    auth?.allow?.governorate ||
      auth?.profile?.governorate ||
      auth?.userProfile?.governorate ||
      ""
  ).trim();

  const [rows, setRows] = useState<AllowDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "allowlist"), orderBy("email"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: AllowDoc[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as AllowDoc;
          const r = String(data?.role || "").trim().toLowerCase();
          if (r !== "exam_super") return;
          next.push({ email: docSnap.id, ...data });
        });
        setRows(next);
        setLoading(false);
      },
      () => {
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (isOwner) return rows;
    if (isGovernorateSuper && governorateScope) {
      return rows.filter((r) => String(r.governorate || "").trim() === governorateScope);
    }
    return [];
  }, [rows, isOwner, isGovernorateSuper, governorateScope]);

  if (!isOwner && !isGovernorateSuper) {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: 22, boxSizing: "border-box", direction: isRTL ? "rtl" : "ltr" }}>
      <div style={{ maxWidth: 1700, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={heroStyle}>
          <button type="button" onClick={() => navigate("/programs-gateway")} style={backBtn}>
            {tr("العودة إلى programs-gateway", "Back to programs-gateway")}
          </button>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={pillGreen}>{tr("قائمة سوبر الامتحانات", "Exam Supers Directory")}</div>
            <h1 style={h1}>{tr("جميع سوبر الامتحانات", "All Exam Supers")}</h1>
          </div>
        </section>

        <section style={panel}>
          {loading ? (
            <div style={emptyStyle}>{tr("جاري تحميل القائمة...", "Loading list...")}</div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>{tr("لا يوجد سوبر امتحانات مطابقون للعرض الحالي.", "No exam supers match the current view.")}</div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {filtered.map((row) => {
                const email = String(row.email || "").trim();
                const tenantId = String(row.tenantId || "").trim();
                const title = String(row.schoolName || row.name || row.userName || email.split("@")[0] || "").trim();
                const gov = String(row.governorate || "").trim() || tr("بدون محافظة", "No governorate");
                const enabled = row.enabled === true;
                return (
                  <div key={email} style={rowCard}>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={rowTitle}>{title}</div>
                      <div style={rowMeta}>{email}</div>
                      <div style={tagRow}>
                        <span style={tag}>{gov}</span>
                        <span style={tag}>{tenantId || tr("بدون Tenant", "No Tenant")}</span>
                        <span style={{ ...tag, background: enabled ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)" }}>
                          {enabled ? tr("مفعل", "Enabled") : tr("موقوف", "Disabled")}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => tenantId && navigate(`/t/${tenantId}/dashboard12`)} disabled={!tenantId} style={primaryBtn}>
                        {tr("دخول", "Open")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #8b6a00 0%, #b8860b 48%, #7a5c00 100%)",
  borderRadius: 38,
  border: `4px solid ${GOLD}`,
  boxShadow: `0 24px 50px rgba(0,0,0,0.25), 0 0 28px ${SOFT}`,
  padding: "28px 30px",
  color: "#fff7d8",
  display: "grid",
  gap: 18,
};
const panel: React.CSSProperties = {
  background: CARD,
  borderRadius: 40,
  border: `5px solid ${GOLD}`,
  boxShadow: "0 0 0 10px rgba(212,175,55,0.12) inset, 0 18px 38px rgba(150,120,20,0.14)",
  padding: 28,
  display: "grid",
  gap: 22,
};
const backBtn: React.CSSProperties = {
  minHeight: 56, width: "fit-content", padding: "0 20px", borderRadius: 18, border: `3px solid ${GOLD}`,
  background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 1000, fontSize: 17, cursor: "pointer",
};
const pillGreen: React.CSSProperties = {
  display: "inline-flex", width: "fit-content", padding: "10px 18px", borderRadius: 999,
  border: "2px solid rgba(16,185,129,0.22)", background: "rgba(16,185,129,0.10)", color: "#111", fontWeight: 900, fontSize: 14,
};
const h1: React.CSSProperties = { margin: 0, fontSize: "clamp(28px,5vw,54px)", lineHeight: 1.15, fontWeight: 1000 };
const emptyStyle: React.CSSProperties = { color: "#111", fontWeight: 900, fontSize: 20, padding: 12 };
const rowCard: React.CSSProperties = {
  background: "#fbf8ef", border: `4px solid ${GOLD}`, borderRadius: 30, padding: 22,
  display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "center", boxShadow: "0 12px 24px rgba(150,120,20,0.10)",
};
const rowTitle: React.CSSProperties = { color: "#111", fontWeight: 1000, fontSize: 28, lineHeight: 1.3 };
const rowMeta: React.CSSProperties = { color: "#111", fontWeight: 800, fontSize: 18 };
const tagRow: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const tag: React.CSSProperties = {
  display: "inline-flex", padding: "8px 14px", borderRadius: 999, border: `2px solid ${GOLD}`,
  background: "rgba(212,175,55,0.10)", color: "#111", fontWeight: 900, fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  minHeight: 56, minWidth: 130, padding: "0 20px", borderRadius: 18, border: `3px solid ${GOLD}`,
  background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)", color: "#111",
  fontWeight: 1000, fontSize: 18, cursor: "pointer", boxShadow: "0 12px 22px rgba(150,120,20,0.14)",
};
