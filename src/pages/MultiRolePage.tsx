import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permissions";
import { useTenant } from "../tenant/TenantContext";
import {
  deleteTenantMember,
  listTenantMembers,
  upsertTenantMember,
  type TenantMemberRecord,
  type TenantMemberRole,
} from "../services/distributionCollaboration.service";
import { capsFromRoles, resolvePrimaryRoleLabel, type Capability, type SaaSRole } from "../features/authz";
import { useI18n } from "../i18n/I18nProvider";

const GOLD = "#ffd700";
const BG = "#000";
const LINE = "rgba(255,215,0,0.18)";
const CARD_BG = "linear-gradient(180deg, rgba(255,215,0,0.05), rgba(255,215,0,0.02))";
const PANEL_BG = "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const RED = "#f87171";
const SLATE = "#e5e7eb";

const roleOrder: TenantMemberRole[] = ["tenant_admin", "manager", "staff", "viewer"];

function uniqueRoles(roles: TenantMemberRole[] | undefined | null): TenantMemberRole[] {
  const raw = Array.isArray(roles) ? roles : [];
  const normalized = raw.filter((role): role is TenantMemberRole => roleOrder.includes(role as TenantMemberRole));
  const deduped = Array.from(new Set(normalized));
  return deduped.length ? roleOrder.filter((role) => deduped.includes(role)) : ["viewer"];
}

function badgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: bg,
    color,
    border: `1px solid ${bg.replace("0.12", "0.30").replace("0.14", "0.30").replace("0.08", "0.18")}`,
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

function translateAuthRole(label: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "مشرف نطاق": { ar: "مشرف نطاق", en: "Domain Supervisor" },
    "مدير جهة": { ar: "مدير جهة", en: "Tenant Admin" },
    "مدير": { ar: "مدير", en: "Manager" },
    "مستخدم تشغيلي": { ar: "مستخدم تشغيلي", en: "Operational User" },
    "مستخدم": { ar: "مستخدم", en: "User" },
  };
  return map[label]?.[lang] || label;
}

function glowSurface(border = LINE, background = PANEL_BG): React.CSSProperties {
  return {
    background,
    border: `1px solid ${border}`,
    borderRadius: 24,
    boxShadow: "0 20px 50px rgba(0,0,0,0.30)",
    backdropFilter: "blur(14px)",
  };
}

function TopPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={badgeStyle(color, bg)}>{label}</span>;
}

function StatCard({ title, value, note, accent = GOLD }: { title: string; value: React.ReactNode; note: string; accent?: string }) {
  return (
    <div style={{ ...glowSurface("rgba(255,255,255,0.08)"), padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", insetInlineEnd: -24, top: -28, width: 110, height: 110, borderRadius: "50%", background: `${accent}14` }} />
      <div style={{ position: "relative", display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13, color: "rgba(255,215,0,0.78)", fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 34, fontWeight: 900, color: accent, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "rgba(255,244,191,0.70)", lineHeight: 1.8 }}>{note}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#fff3bf" }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 13, color: "rgba(255,244,191,0.70)", lineHeight: 1.9 }}>{subtitle}</div> : null}
      <div style={{ height: 1, background: "linear-gradient(90deg, rgba(255,215,0,0.35), rgba(255,255,255,0.06), rgba(255,255,255,0))" }} />
    </div>
  );
}

function CapabilityPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...glowSurface("rgba(255,255,255,0.08)"), padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: "#fff3bf" }}>{title}</div>
      {children}
    </div>
  );
}

export default function MultiRolePage() {
  const auth = useAuth() as any;
  const { tenantId: tenantFromContext } = useTenant() as any;
  const { can, caps, roles, snapshot } = useCan();
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const roleMeta: Record<TenantMemberRole, { label: string; tone: string; bg: string }> = {
    tenant_admin: { label: tr("مدير الجهة", "Tenant Admin"), tone: GOLD, bg: "rgba(255,215,0,0.12)" },
    manager: { label: tr("مدير", "Manager"), tone: BLUE, bg: "rgba(96,165,250,0.14)" },
    staff: { label: tr("تشغيل", "Operations"), tone: GREEN, bg: "rgba(52,211,153,0.14)" },
    viewer: { label: tr("مشاهد", "Viewer"), tone: SLATE, bg: "rgba(229,231,235,0.12)" },
  };

  const capabilityLabels: Record<Capability, string> = {
    PLATFORM_OWNER: tr("مالك المنصة", "Platform owner"),
    SYSTEM_ADMIN: tr("إدارة النظام", "System admin"),
    TENANTS_MANAGE: tr("إدارة الجهات", "Manage tenants"),
    SUPER_USERS_MANAGE: tr("إدارة المشرفين", "Manage supervisors"),
    USERS_MANAGE: tr("إدارة المستخدمين", "Manage users"),
    TENANT_READ: tr("قراءة بيانات الجهة", "Read tenant data"),
    TENANT_WRITE: tr("تعديل بيانات الجهة", "Write tenant data"),
    TEACHERS_MANAGE: tr("إدارة المعلمين", "Manage teachers"),
    EXAMS_MANAGE: tr("إدارة الاختبارات", "Manage exams"),
    ROOMS_MANAGE: tr("إدارة القاعات", "Manage rooms"),
    DISTRIBUTION_RUN: tr("تشغيل التوزيع", "Run distribution"),
    REPORTS_VIEW: tr("عرض التقارير", "View reports"),
    ARCHIVE_MANAGE: tr("إدارة الأرشيف", "Manage archive"),
    AUDIT_VIEW: tr("عرض السجل الرقابي", "View audit logs"),
    SYNC_ADMIN: tr("إدارة المزامنة", "Manage sync"),
    SETTINGS_MANAGE: tr("إدارة الإعدادات", "Manage settings"),
    SUPPORT_MODE: tr("وضع الدعم", "Support mode"),
  };

  const tenantId = String(tenantFromContext || auth?.effectiveTenantId || auth?.userProfile?.tenantId || "").trim();
  const canManageUsers = can("USERS_MANAGE");

  const [items, setItems] = useState<TenantMemberRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { displayName: string; roles: TenantMemberRole[]; enabled: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState("");
  const [deletingEmail, setDeletingEmail] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [newMember, setNewMember] = useState({
    email: "",
    displayName: "",
    roles: ["staff"] as TenantMemberRole[],
    enabled: true,
  });

  const pageStyle: React.CSSProperties = {
    padding: "24px",
    background: "radial-gradient(circle at top, rgba(255,215,0,0.16), transparent 24%), radial-gradient(circle at 80% 20%, rgba(96,165,250,0.10), transparent 24%), linear-gradient(180deg, #050505 0%, #000 100%)",
    color: GOLD,
    minHeight: "100vh",
    direction: isRTL ? "rtl" : "ltr",
  };

  const cardStyle: React.CSSProperties = {
    background: CARD_BG,
    border: `1px solid ${LINE}`,
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 18px 40px rgba(0,0,0,0.30)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    color: "#fff3bf",
    border: `1px solid ${LINE}`,
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    boxSizing: "border-box",
  };

  const buttonStyle = (variant: "brand" | "ghost" | "danger" = "brand"): React.CSSProperties => ({
    background:
      variant === "brand"
        ? "linear-gradient(135deg, rgba(255,215,0,0.24), rgba(255,215,0,0.10))"
        : variant === "danger"
        ? "rgba(239,68,68,0.16)"
        : "rgba(255,255,255,0.05)",
    color: variant === "danger" ? "#fecaca" : GOLD,
    border: `1px solid ${variant === "danger" ? "rgba(239,68,68,0.35)" : LINE}`,
    borderRadius: 12,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: variant === "brand" ? "0 10px 24px rgba(255,215,0,0.10)" : undefined,
  });

  const roleLabel = (role: TenantMemberRole) => roleMeta[role]?.label || role;
  const toSourceLabel = (source?: TenantMemberRecord["source"]) => {
    if (source === "both") return tr("محلي + سحابي", "Local + cloud");
    if (source === "cloud") return tr("سحابي", "Cloud");
    if (source === "local") return tr("محلي", "Local");
    return "—";
  };

  const myCapabilities = useMemo(() => Array.from(caps).sort(), [caps]);

  const refresh = async () => {
    if (!tenantId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listTenantMembers(tenantId);
      setItems(rows);
      setDrafts(
        Object.fromEntries(
          rows.map((item) => [
            item.email,
            {
              displayName: item.displayName || "",
              roles: uniqueRoles(item.roles),
              enabled: !!item.enabled,
            },
          ])
        )
      );
    } catch (e: any) {
      setMessage(e?.message || tr("تعذر تحميل صلاحيات المستخدمين.", "Unable to load user permissions."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [tenantId, lang]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const draft = drafts[item.email];
      return [
        item.email,
        item.displayName,
        draft?.displayName,
        ...(draft?.roles || item.roles || []).map(roleLabel),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, drafts, search, lang]);

  const totals = useMemo(() => {
    const memberRoles = items.flatMap((item) => uniqueRoles(drafts[item.email]?.roles || item.roles));
    return {
      totalUsers: items.length,
      activeUsers: items.filter((item) => (drafts[item.email]?.enabled ?? item.enabled) === true).length,
      disabledUsers: items.filter((item) => (drafts[item.email]?.enabled ?? item.enabled) !== true).length,
      totalAssignedRoles: memberRoles.length,
    };
  }, [items, drafts]);

  const distribution = useMemo(() => {
    const countByRole: Record<TenantMemberRole, number> = {
      tenant_admin: 0,
      manager: 0,
      staff: 0,
      viewer: 0,
    };

    items.forEach((item) => {
      uniqueRoles(drafts[item.email]?.roles || item.roles).forEach((role) => {
        countByRole[role] += 1;
      });
    });

    return roleOrder.map((role) => ({ role, count: countByRole[role] }));
  }, [items, drafts]);

  const updateDraft = (email: string, patch: Partial<{ displayName: string; roles: TenantMemberRole[]; enabled: boolean }>) => {
    setDrafts((prev) => {
      const current = prev[email] || { displayName: "", roles: ["viewer" as TenantMemberRole], enabled: true };
      return {
        ...prev,
        [email]: {
          displayName: patch.displayName ?? current.displayName,
          roles: uniqueRoles(patch.roles ?? current.roles),
          enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
        },
      };
    });
  };

  const toggleDraftRole = (email: string, role: TenantMemberRole) => {
    const current = uniqueRoles(drafts[email]?.roles || ["viewer"]);
    const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
    updateDraft(email, { roles: next.length ? next : ["viewer"] });
  };

  const saveMember = async (item: TenantMemberRecord) => {
    if (!canManageUsers || !tenantId) return;
    const draft = drafts[item.email] || { displayName: item.displayName || "", roles: uniqueRoles(item.roles), enabled: !!item.enabled };
    setSavingEmail(item.email);
    setMessage("");
    try {
      await upsertTenantMember({
        tenantId,
        email: item.email,
        displayName: draft.displayName,
        roles: uniqueRoles(draft.roles),
        enabled: !!draft.enabled,
        actorEmail: auth?.user?.email || "",
      });
      if (String(item.email).toLowerCase() === String(auth?.user?.email || "").toLowerCase()) {
        try {
          await auth?.refreshAllow?.();
        } catch {}
      }
      setMessage(
        tr(
          `تم حفظ صلاحيات ${draft.displayName || item.email} وربطها بالصلاحيات الفعلية.`,
          `Permissions for ${draft.displayName || item.email} were saved and linked to the effective access rules.`
        )
      );
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || tr(`تعذر حفظ صلاحيات ${item.email}.`, `Unable to save permissions for ${item.email}.`));
    } finally {
      setSavingEmail("");
    }
  };

  const deleteMember = async (item: TenantMemberRecord) => {
    if (!canManageUsers || !tenantId) return;

    const currentUserEmail = String(auth?.user?.email || "").trim().toLowerCase();
    const targetEmail = String(item.email || "").trim().toLowerCase();

    if (targetEmail && targetEmail === currentUserEmail) {
      setMessage(tr("لا يمكنك حذف حسابك الحالي من شاشة Multi-Role.", "You cannot delete your current account from the Multi-Role page."));
      return;
    }

    const confirmed = window.confirm(
      tr(
        `سيتم حذف المستخدم ${item.displayName || item.email} وإزالة صلاحياته الفعلية من الجهة و allowlist. هل تريد المتابعة؟`,
        `The user ${item.displayName || item.email} will be deleted and their effective permissions will be removed from the tenant and the allowlist. Do you want to continue?`
      )
    );

    if (!confirmed) return;

    setDeletingEmail(targetEmail);
    setMessage("");
    try {
      await deleteTenantMember(tenantId, targetEmail);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[targetEmail];
        return next;
      });
      setMessage(
        tr(
          `تم حذف المستخدم ${item.displayName || item.email} وإزالة صلاحياته المرتبطة به.`,
          `The user ${item.displayName || item.email} and their linked permissions were deleted.`
        )
      );
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || tr(`تعذر حذف ${item.email}.`, `Unable to delete ${item.email}.`));
    } finally {
      setDeletingEmail("");
    }
  };

  const createMember = async () => {
    if (!canManageUsers || !tenantId) return;
    const email = String(newMember.email || "").trim().toLowerCase();
    if (!email.includes("@")) {
      setMessage(tr("أدخل بريدًا إلكترونيًا صحيحًا.", "Enter a valid email address."));
      return;
    }
    setSavingEmail(email);
    setMessage("");
    try {
      await upsertTenantMember({
        tenantId,
        email,
        displayName: newMember.displayName,
        roles: uniqueRoles(newMember.roles),
        enabled: !!newMember.enabled,
        actorEmail: auth?.user?.email || "",
      });
      if (email === String(auth?.user?.email || "").toLowerCase()) {
        try {
          await auth?.refreshAllow?.();
        } catch {}
      }
      setNewMember({ email: "", displayName: "", roles: ["staff"], enabled: true });
      setMessage(tr("تمت إضافة المستخدم وحفظ صلاحياته الفعلية.", "The user was added and their effective permissions were saved."));
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || tr("تعذر إضافة المستخدم.", "Unable to add the user."));
    } finally {
      setSavingEmail("");
    }
  };

  const renderCapabilityBadges = (memberRoles: TenantMemberRole[]) => {
    const memberCaps = Array.from(capsFromRoles(memberRoles as SaaSRole[]));
    if (!memberCaps.length) {
      return <span style={{ opacity: 0.7 }}>{tr("لا توجد صلاحيات تشغيلية", "No operational permissions")}</span>;
    }
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {memberCaps.map((cap) => (
          <span key={cap} style={badgeStyle("#f5e7b2", "rgba(255,255,255,0.08)")}>{capabilityLabels[cap] || cap}</span>
        ))}
      </div>
    );
  };

  const systemHealth = canManageUsers ? tr("مركز إدارة متقدم", "Advanced control center") : tr("وضع العرض الآمن", "Safe view mode");

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 20, position: "relative" }}>
        <div style={{ ...glowSurface("rgba(255,215,0,0.22)", "linear-gradient(115deg, rgba(35,25,0,0.95), rgba(8,10,18,0.96) 40%, rgba(8,14,28,0.98) 100%)"), padding: 26, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", insetInlineEnd: -90, top: -100, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,215,0,0.12)", filter: "blur(8px)" }} />
          <div style={{ position: "absolute", insetInlineStart: -40, bottom: -70, width: 220, height: 220, borderRadius: "50%", background: "rgba(96,165,250,0.10)", filter: "blur(12px)" }} />
          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <TopPill label={tr("صلاحيات فعلية مرتبطة بالنظام", "Live permissions linked to system")} color={GOLD} bg="rgba(255,215,0,0.14)" />
                <TopPill label={systemHealth} color={canManageUsers ? GREEN : BLUE} bg={canManageUsers ? "rgba(52,211,153,0.16)" : "rgba(96,165,250,0.16)"} />
                <TopPill label={tr("ثنائي اللغة", "Bilingual interface")} color="#bfdbfe" bg="rgba(96,165,250,0.16)" />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={badgeStyle("#111", GOLD)}>{tr("الجهة الحالية", "Current tenant")}: {tenantId || "—"}</span>
                <button style={buttonStyle("ghost")} onClick={refresh}>{tr("تحديث", "Refresh")}</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.9fr)", gap: 18, alignItems: "stretch" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "#fff1b8", fontWeight: 900, letterSpacing: 0.4, fontSize: 14 }}>{tr("MULTI ROLE CONTROL CENTER", "MULTI ROLE CONTROL CENTER")}</div>
                <div style={{ fontSize: "clamp(30px, 4.8vw, 58px)", fontWeight: 900, lineHeight: 1.04, color: "#fff3bf" }}>
                  {tr("منصة أنيقة لإدارة المستخدمين والأدوار والصلاحيات الفعلية", "An elegant command surface for users, roles, and effective permissions")}
                </div>
                <div style={{ color: "rgba(255,244,191,0.82)", lineHeight: 1.95, fontSize: 15, maxWidth: 900 }}>
                  {tr(
                    "واجهة تنفيذية فائقة التنظيم تربط أعضاء الجهة الحقيقيين بالأدوار الفعلية والقدرات التشغيلية الناتجة عنها، مع تجربة مرئية فاخرة تمنح المسؤول وضوحًا فوريًا وثقة عالية في إدارة الوصول داخل النظام.",
                    "A premium executive interface that connects real tenant members to effective roles and derived operational capabilities, giving administrators instant visibility and high-confidence access control management."
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginTop: 8 }}>
                  <StatCard title={tr("إجمالي المستخدمين", "Total users")} value={totals.totalUsers} note={tr("كل الحسابات داخل الجهة الحالية", "All accounts inside the current tenant")} />
                  <StatCard title={tr("الحسابات المفعلة", "Active accounts")} value={totals.activeUsers} note={tr("قابلة للوصول حسب التكوين الحالي", "Accounts enabled under current configuration")} accent={GREEN} />
                  <StatCard title={tr("إجمالي الأدوار", "Assigned roles")} value={totals.totalAssignedRoles} note={tr("إجمالي الأدوار الموزعة على المستخدمين", "Total roles distributed across users")} accent={BLUE} />
                </div>
              </div>

              <div style={{ ...glowSurface("rgba(255,255,255,0.08)", "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))"), padding: 20, display: "grid", gap: 16, alignContent: "start" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff3bf" }}>{tr("لوحة الحالة التنفيذية", "Executive status board")}</div>
                <div style={{ color: "rgba(255,244,191,0.72)", lineHeight: 1.85, fontSize: 13 }}>
                  {tr(
                    "تلخص هذه اللوحة حالة الصلاحيات الحالية، ووضع الإدارة، ونسبة الحسابات المفعلة، وتمنح المسؤول قراءة فورية قبل البدء بالتعديل أو الإضافة.",
                    "This board summarizes the current permission state, management mode, enabled-account ratio, and gives administrators a quick operational read before they edit or add members."
                  )}
                </div>
                <CapabilityPanel title={tr("ملخص سريع", "Quick summary")}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <div style={{ ...cardStyle, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{tr("المستخدمون الموقوفون", "Disabled accounts")}</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: RED }}>{totals.disabledUsers}</div>
                    </div>
                    <div style={{ ...cardStyle, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{tr("وضع الإدارة", "Management mode")}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: canManageUsers ? GREEN : BLUE }}>{canManageUsers ? tr("تحكم كامل", "Full control") : tr("عرض فقط", "View only")}</div>
                    </div>
                  </div>
                </CapabilityPanel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {distribution.map(({ role, count }) => (
                    <TopPill key={role} label={`${roleMeta[role].label}: ${count}`} color={roleMeta[role].tone} bg={roleMeta[role].bg} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <StatCard title={tr("إجمالي المستخدمين", "Total users")} value={totals.totalUsers} note={tr("عدد أعضاء الجهة الفعليين", "Real tenant members count")} />
          <StatCard title={tr("الحسابات المفعلة", "Enabled accounts")} value={totals.activeUsers} note={tr("التي تعمل حاليًا بالصلاحيات الحالية", "Currently active with effective access")} accent={GREEN} />
          <StatCard title={tr("الحسابات الموقوفة", "Disabled accounts")} value={totals.disabledUsers} note={tr("المتوقفة عن الوصول حتى إعادة التفعيل", "Blocked from access until re-enabled")} accent={RED} />
          <StatCard title={tr("إجمالي الأدوار المسندة", "Total assigned roles")} value={totals.totalAssignedRoles} note={tr("يشمل كل الأدوار الموزعة على الأعضاء", "Includes every role assigned to members")} accent={BLUE} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 430px) 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ ...glowSurface(), padding: 20, display: "grid", gap: 16 }}>
            <SectionHeader
              title={tr("صلاحياتك الفعلية الآن", "Your effective permissions now")}
              subtitle={tr("قراءة مباشرة لما يراه النظام عن حسابك الحالي من أدوار وقدرات تشغيلية.", "A direct system-level view of your current roles and effective operational capabilities.")}
            />
            <div style={{ display: "grid", gap: 12 }}>
              <div><strong>{tr("الدور الأساسي", "Primary role")}:</strong> {translateAuthRole(auth?.primaryRoleLabel || resolvePrimaryRoleLabel(snapshot), lang)}</div>
              <div><strong>{tr("الأدوار النشطة", "Active roles")}:</strong> {roles.length ? roles.join(" , ") : "—"}</div>
              <div><strong>{tr("إدارة المستخدمين", "User management")}:</strong> {canManageUsers ? tr("مسموح", "Allowed") : tr("عرض فقط", "View only")}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {myCapabilities.length ? myCapabilities.map((cap) => (
                <span key={cap} style={badgeStyle("#111", GOLD)}>{capabilityLabels[cap] || cap}</span>
              )) : <span style={{ opacity: 0.75 }}>{tr("لا توجد صلاحيات ظاهرة", "No visible permissions")}</span>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.9, color: "rgba(255,215,0,0.82)" }}>
              {tr(
                "أي تعديل تحفظه هنا يتم تخزينه في أعضاء الجهة ثم مزامنته مع allowlist حتى تصبح الصلاحيات الفعلية للمستخدم مرتبطة بما تراه في هذه الصفحة.",
                "Any change saved here is stored in tenant members and synchronized with the allowlist so the user's effective access matches what you see on this page."
              )}
            </div>
          </div>

          <div style={{ ...glowSurface(), padding: 20, display: "grid", gap: 16 }}>
            <SectionHeader
              title={tr("إضافة مستخدم بصلاحيات فعلية", "Add a user with effective permissions")}
              subtitle={tr("أنشئ حسابًا جديدًا وحدد أدواره الفعلية بطريقة واضحة ومنظمة قبل حفظه داخل الجهة.", "Create a new account and define its effective roles clearly before saving it into the tenant.")}
            />
            {!canManageUsers ? <span style={{ color: "#fecaca", fontWeight: 800 }}>{tr("ليس لديك صلاحية تعديل المستخدمين", "You do not have permission to modify users")}</span> : null}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <input style={inputStyle} placeholder={tr("البريد الإلكتروني", "Email address")} value={newMember.email} onChange={(e) => setNewMember((s) => ({ ...s, email: e.target.value }))} disabled={!canManageUsers} />
              <input style={inputStyle} placeholder={tr("الاسم الظاهر", "Display name")} value={newMember.displayName} onChange={(e) => setNewMember((s) => ({ ...s, displayName: e.target.value }))} disabled={!canManageUsers} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {roleOrder.map((role) => {
                const active = newMember.roles.includes(role);
                const meta = roleMeta[role];
                return (
                  <label key={role} style={{ ...badgeStyle(meta.tone, active ? meta.bg : "rgba(255,255,255,0.06)"), cursor: canManageUsers ? "pointer" : "default" }}>
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={!canManageUsers}
                      onChange={() => {
                        const next = active ? newMember.roles.filter((item) => item !== role) : [...newMember.roles, role];
                        setNewMember((s) => ({ ...s, roles: uniqueRoles(next) }));
                      }}
                    />
                    <span>{meta.label}</span>
                  </label>
                );
              })}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
              <input type="checkbox" checked={newMember.enabled} disabled={!canManageUsers} onChange={(e) => setNewMember((s) => ({ ...s, enabled: e.target.checked }))} />
              <span>{tr("الحساب مفعل", "Account is enabled")}</span>
            </label>
            <div>
              <button style={buttonStyle("brand")} onClick={createMember} disabled={!canManageUsers || !!savingEmail}>
                {savingEmail === String(newMember.email || "").trim().toLowerCase() ? tr("جارٍ الحفظ...", "Saving...") : tr("إضافة المستخدم", "Add user")}
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...glowSurface(), padding: 20, display: "grid", gap: 16 }}>
          <SectionHeader
            title={tr("المستخدمون وصلاحياتهم الفعلية", "Users and their effective permissions")}
            subtitle={tr("إدارة مباشرة للأعضاء داخل الجهة مع ربط فوري بين الأدوار والقدرات الناتجة عنها.", "Direct management of tenant members with immediate visibility into the capabilities derived from their roles.")}
          />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TopPill label={tr("المستخدمون الحقيقيون فقط", "Real tenant users only")} color={GOLD} bg="rgba(255,215,0,0.12)" />
              <TopPill label={tr(canManageUsers ? "تعديل مباشر متاح" : "وضع القراءة فقط", canManageUsers ? "Direct editing enabled" : "Read-only mode")} color={canManageUsers ? GREEN : BLUE} bg={canManageUsers ? "rgba(52,211,153,0.14)" : "rgba(96,165,250,0.14)"} />
            </div>
            <input style={{ ...inputStyle, width: 340 }} placeholder={tr("بحث بالبريد أو الاسم أو الدور", "Search by email, name, or role")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {message ? <div style={{ ...badgeStyle("#111", GOLD), justifyContent: "flex-start" }}>{message}</div> : null}

          {loading ? (
            <div style={{ fontWeight: 800 }}>{tr("جارٍ تحميل بيانات الصلاحيات...", "Loading permission data...")}</div>
          ) : !filteredItems.length ? (
            <div style={{ opacity: 0.82, fontWeight: 800 }}>{tr("لا يوجد مستخدمون بعد داخل هذه الجهة.", "There are no users in this tenant yet.")}</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {filteredItems.map((item) => {
                const draft = drafts[item.email] || { displayName: item.displayName || "", roles: uniqueRoles(item.roles), enabled: !!item.enabled };
                const memberRoles = uniqueRoles(draft.roles);
                return (
                  <div key={item.email} style={{ ...glowSurface("rgba(255,255,255,0.08)"), padding: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.95fr) minmax(150px, 0.5fr) minmax(280px, 1fr) minmax(300px, 1.2fr) minmax(110px, 0.35fr) minmax(190px, 0.6fr)", gap: 14, alignItems: "start" }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <input style={inputStyle} value={draft.displayName} disabled={!canManageUsers} onChange={(e) => updateDraft(item.email, { displayName: e.target.value })} />
                        <div style={{ color: "rgba(255,215,0,0.85)", fontWeight: 700, lineHeight: 1.8 }}>{item.email}</div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                          <input type="checkbox" checked={!!draft.enabled} disabled={!canManageUsers} onChange={(e) => updateDraft(item.email, { enabled: e.target.checked })} />
                          <span>{draft.enabled ? tr("مفعل", "Enabled") : tr("موقوف", "Disabled")}</span>
                        </label>
                        <span style={badgeStyle(draft.enabled ? GREEN : RED, draft.enabled ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)")}>{draft.enabled ? tr("نشط", "Active") : tr("متوقف", "Disabled")}</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {roleOrder.map((role) => {
                          const active = memberRoles.includes(role);
                          const meta = roleMeta[role];
                          return (
                            <label key={role} style={{ ...badgeStyle(meta.tone, active ? meta.bg : "rgba(255,255,255,0.06)"), cursor: canManageUsers ? "pointer" : "default" }}>
                              <input type="checkbox" checked={active} disabled={!canManageUsers} onChange={() => toggleDraftRole(item.email, role)} />
                              <span>{meta.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div>{renderCapabilityBadges(memberRoles)}</div>

                      <div>
                        <span style={badgeStyle("#f5e7b2", "rgba(255,255,255,0.08)")}>{toSourceLabel(item.source)}</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={buttonStyle("brand")} disabled={!canManageUsers || !!savingEmail || !!deletingEmail} onClick={() => saveMember(item)}>
                          {savingEmail === item.email ? tr("جارٍ الحفظ...", "Saving...") : tr("حفظ", "Save")}
                        </button>
                        <button style={buttonStyle("danger")} disabled={!canManageUsers || !!savingEmail || !!deletingEmail} onClick={() => deleteMember(item)}>
                          {deletingEmail === item.email ? tr("جارٍ الحذف...", "Deleting...") : tr("حذف المستخدم", "Delete user")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
