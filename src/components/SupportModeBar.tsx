import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canAccessCapability, isPlatformOwner } from "../features/authz";
import { useI18n } from "../i18n/I18nProvider";

const GOLD = "#d4af37";

export default function SupportModeBar() {
  const navigate = useNavigate();
  const { authzSnapshot, supportTenantId, supportUntil, startSupportForTenant, endSupport, effectiveTenantId } = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [val, setVal] = useState("");
  const [localError, setLocalError] = useState<string>("");
  const canSupport = canAccessCapability(authzSnapshot, "SUPPORT_MODE");
  const owner = isPlatformOwner(authzSnapshot);

  const activeTenant = useMemo(() => (supportTenantId ? supportTenantId : null), [supportTenantId]);

  const remaining = useMemo(() => {
    if (!supportUntil) return null;
    const ms = Number(supportUntil) - Date.now();
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.ceil(ms / 60000));
  }, [supportUntil]);

  const effectiveLabel = useMemo(() => {
    if (!effectiveTenantId) return "-";
    return String(effectiveTenantId) === "system" ? tr("الوزارة", "Ministry") : String(effectiveTenantId);
  }, [effectiveTenantId, lang]);

  if (!canSupport) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1200,
        marginBottom: 12,
        borderRadius: 16,
        padding: "10px 12px",
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(212,175,55,0.22)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
        direction: isRTL ? "rtl" : "ltr",
      }}
    >
      <div style={{ fontWeight: 900, color: GOLD }}>
        {owner ? tr("وضع دعم مالك المنصة:", "Platform owner support mode:") : tr("وضع الدعم:", "Support mode:")}
      </div>

      <div style={{ opacity: 0.9 }}>
        {tr("الجهة الحالية", "Current tenant")}: <b style={{ color: GOLD }}>{activeTenant ?? tr("غير مُفعّل", "Inactive")}</b>
        {activeTenant && remaining != null ? (
          <>
            {" "}— {tr("المتبقي", "Remaining")}: <b style={{ color: GOLD }}>{remaining} {tr("د", "min")}</b>
          </>
        ) : null}
        {" "}— {tr("الجهة الفعلية", "Effective tenant")}: <b style={{ color: GOLD }}>{effectiveLabel}</b>
      </div>

      <div style={{ display: "flex", gap: 8, marginInlineStart: "auto", flexWrap: "wrap" }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={tr("اكتب tenantId مثال azaan-9-12", "Enter tenantId e.g. azaan-9-12")}
          style={{
            width: 240,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.55)",
            color: "#e5e7eb",
            outline: "none",
          }}
        />

        <button
          onClick={async () => {
            const t = val.trim();
            if (!t) return;
            setLocalError("");
            try {
              await startSupportForTenant?.(t, tr("دعم فني", "Technical support"));
              navigate(`/t/${t}`, { replace: true });
            } catch (e: any) {
              console.error("Unable to enable support", e);
              setLocalError(e?.message ?? tr("تعذر تفعيل الدعم", "Unable to enable support"));
            }
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(212,175,55,0.28)",
            background: "rgba(212,175,55,0.10)",
            color: GOLD,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {tr("تفعيل الدعم", "Enable support")}
        </button>

        {localError ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,80,80,0.35)",
              background: "rgba(255,80,80,0.10)",
              color: "#ffd6d6",
              fontWeight: 800,
              fontSize: 13,
              maxWidth: 360,
            }}
          >
            {localError}
          </div>
        ) : null}

        <button
          onClick={async () => {
            try {
              await endSupport?.();
            } catch {
            } finally {
              navigate("/super", { replace: true });
            }
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.14)",
            color: "#fecaca",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {tr("إلغاء الدعم", "Disable support")}
        </button>

        <button
          onClick={() => {
            (async () => {
              try {
                await endSupport?.();
              } finally {
                navigate("/super", { replace: true });
              }
            })();
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.12)",
            color: "#bfdbfe",
            fontWeight: 900,
            cursor: "pointer",
          }}
          title={tr("الرجوع إلى بوابة السوبر", "Back to super portal")}
        >
          {tr("رجوع", "Back")}
        </button>
      </div>
    </div>
  );
}
