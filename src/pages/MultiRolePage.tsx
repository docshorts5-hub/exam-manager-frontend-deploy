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

const GOLD = "#111827";
const BG = "#f7efe2";
const LINE = "#b88a3b";
const CARD_BG = "linear-gradient(180deg, #fffaf0 0%, #f3e5cd 100%)";
const PANEL_BG = "linear-gradient(180deg, #fdf3df 0%, #ead4b2 100%)";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const RED = "#f87171";
const SLATE = "#374151";
const OFFICIAL_TEXT = "#111827";
const OFFICIAL_MUTED_TEXT = "#374151";
const OFFICIAL_CARD_BG = "linear-gradient(180deg, #fffaf0 0%, #f3e5cd 100%)";
const OFFICIAL_PANEL_BG = "linear-gradient(180deg, #fdf3df 0%, #ead4b2 100%)";
const OFFICIAL_BORDER_COLORS = ["#b88a3b", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#be123c"];

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
    background: "#fff7e6",
    color: OFFICIAL_TEXT,
    border: `2px solid ${color || LINE}`,
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

function glowSurface(border = LINE, background = OFFICIAL_CARD_BG): React.CSSProperties {
  const borderGradient = `linear-gradient(135deg, ${border}, #2563eb, #16a34a, #dc2626, #7c3aed)`;
  return {
    background: `${background} padding-box, ${borderGradient} border-box`,
    color: OFFICIAL_TEXT,
    border: "2px solid transparent",
    borderRadius: 24,
    boxShadow: "0 18px 45px rgba(88, 62, 25, 0.16)",
    backdropFilter: "blur(10px)",
  };
}

function TopPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={badgeStyle(color, bg)}>{label}</span>;
}

function StatCard({ title, value, note, accent = GOLD }: { title: string; value: React.ReactNode; note: string; accent?: string }) {
  const border = accent || OFFICIAL_BORDER_COLORS[Math.abs(String(title).length) % OFFICIAL_BORDER_COLORS.length];
  return (
    <div style={{ ...glowSurface(border, OFFICIAL_CARD_BG), padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", insetInlineEnd: -24, top: -28, width: 110, height: 110, borderRadius: "50%", background: `${border}14` }} />
      <div style={{ position: "relative", display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13, color: OFFICIAL_TEXT, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 34, fontWeight: 900, color: OFFICIAL_TEXT, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: OFFICIAL_MUTED_TEXT, lineHeight: 1.8 }}>{note}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: OFFICIAL_TEXT }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 13, color: OFFICIAL_MUTED_TEXT, lineHeight: 1.9 }}>{subtitle}</div> : null}
      <div style={{ height: 2, background: "linear-gradient(90deg, #b88a3b, #2563eb, #16a34a, #dc2626, transparent)" }} />
    </div>
  );
}

function CapabilityPanel({ title, children }: { title: string; children: React.ReactNode }) {
  const border = OFFICIAL_BORDER_COLORS[Math.abs(String(title).length) % OFFICIAL_BORDER_COLORS.length];
  return (
    <div style={{ ...glowSurface(border, OFFICIAL_CARD_BG), padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: OFFICIAL_TEXT }}>{title}</div>
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
    background: "radial-gradient(circle at top, rgba(180,135,55,0.18), transparent 28%), radial-gradient(circle at 80% 20%, rgba(37,99,235,0.08), transparent 25%), linear-gradient(180deg, #f7efe2 0%, #efe1ca 48%, #e7d2b3 100%)",
    color: OFFICIAL_TEXT,
    minHeight: "100vh",
    direction: isRTL ? "rtl" : "ltr",
  };

  const cardStyle: React.CSSProperties = {
    background: `${OFFICIAL_CARD_BG} padding-box, linear-gradient(135deg, #b88a3b, #2563eb, #16a34a, #dc2626) border-box`,
    color: OFFICIAL_TEXT,
    border: "2px solid transparent",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 16px 34px rgba(88, 62, 25, 0.14)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#fffaf0",
    color: OFFICIAL_TEXT,
    border: `2px solid ${LINE}`,
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    boxSizing: "border-box",
    fontWeight: 700,
  };

  const buttonStyle = (variant: "brand" | "ghost" | "danger" = "brand"): React.CSSProperties => ({
    background:
      variant === "brand"
        ? "linear-gradient(135deg, #fff4d8 0%, #e8c98f 100%)"
        : variant === "danger"
        ? "#fee2e2"
        : "#fffaf0",
    color: OFFICIAL_TEXT,
    border: `2px solid ${variant === "danger" ? "#dc2626" : variant === "brand" ? "#b88a3b" : "#2563eb"}`,
    borderRadius: 12,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: variant === "brand" ? "0 10px 24px rgba(88,62,25,0.14)" : undefined,
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
          <span key={cap} style={badgeStyle("#b88a3b", "rgba(255,255,255,0.08)")}>{capabilityLabels[cap] || cap}</span>
        ))}
      </div>
    );
  };

  const systemHealth = canManageUsers ? tr("مركز إدارة متقدم", "Advanced control center") : tr("وضع العرض الآمن", "Safe view mode");

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 20, position: "relative" }}>
        <div style={{ ...glowSurface("#b88a3b", OFFICIAL_PANEL_BG), padding: 26, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", insetInlineEnd: -90, top: -100, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,215,0,0.12)", filter: "blur(8px)" }} />
          <div style={{ position: "absolute", insetInlineStart: -40, bottom: -70, width: 220, height: 220, borderRadius: "50%", background: "rgba(96,165,250,0.10)", filter: "blur(12px)" }} />
          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <TopPill label={tr("صلاحيات فعلية مرتبطة بالنظام", "Live permissions linked to system")} color={GOLD} bg="rgba(255,215,0,0.14)" />
                <TopPill label={systemHealth} color={canManageUsers ? GREEN : BLUE} bg={canManageUsers ? "rgba(52,211,153,0.16)" : "rgba(96,165,250,0.16)"} />
                <TopPill label={tr("ثنائي اللغة", "Bilingual interface")} color="#2563eb" bg="rgba(96,165,250,0.16)" />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={badgeStyle("#111", GOLD)}>{tr("الجهة الحالية", "Current tenant")}: {tenantId || "—"}</span>
                <button style={buttonStyle("ghost")} onClick={refresh}>{tr("تحديث", "Refresh")}</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.9fr)", gap: 18, alignItems: "stretch" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, letterSpacing: 0.4, fontSize: 14 }}>{tr("MULTI ROLE CONTROL CENTER", "MULTI ROLE CONTROL CENTER")}</div>
                <div style={{ fontSize: "clamp(30px, 4.8vw, 58px)", fontWeight: 900, lineHeight: 1.04, color: OFFICIAL_TEXT }}>
                  {tr("منصة أنيقة لإدارة المستخدمين والأدوار والصلاحيات الفعلية", "An elegant command surface for users, roles, and effective permissions")}
                </div>
                <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.95, fontSize: 15, maxWidth: 900 }}>
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

              <div style={{ ...glowSurface("#2563eb", OFFICIAL_CARD_BG), padding: 20, display: "grid", gap: 16, alignContent: "start" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: OFFICIAL_TEXT }}>{tr("لوحة الحالة التنفيذية", "Executive status board")}</div>
                <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.85, fontSize: 13 }}>
                  {tr(
                    "تلخص هذه اللوحة حالة الصلاحيات الحالية، ووضع الإدارة، ونسبة الحسابات المفعلة، وتمنح المسؤول قراءة فورية قبل البدء بالتعديل أو الإضافة.",
                    "This board summarizes the current permission state, management mode, enabled-account ratio, and gives administrators a quick operational read before they edit or add members."
                  )}
                </div>
                <CapabilityPanel title={tr("ملخص سريع", "Quick summary")}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <div style={{ ...cardStyle, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{tr("المستخدمون الموقوفون", "Disabled accounts")}</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: OFFICIAL_TEXT }}>{totals.disabledUsers}</div>
                    </div>
                    <div style={{ ...cardStyle, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{tr("وضع الإدارة", "Management mode")}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: OFFICIAL_TEXT }}>{canManageUsers ? tr("تحكم كامل", "Full control") : tr("عرض فقط", "View only")}</div>
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
            <div style={{ fontSize: 13, lineHeight: 1.9, color: OFFICIAL_MUTED_TEXT }}>
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
            {!canManageUsers ? <span style={{ color: OFFICIAL_TEXT, fontWeight: 800 }}>{tr("ليس لديك صلاحية تعديل المستخدمين", "You do not have permission to modify users")}</span> : null}
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
        <div
          style={{
            ...glowSurface("#d4af37"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI200 بطاقة هوية المستخدم", "QI200 User Identity Card")}
            subtitle={tr(
              "هوية الحساب الحالية والصلاحيات الفعلية المرتبطة بالجهة.",
              "Current account identity and effective access profile."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("الاسم", "Name")}:</strong>
              <div>{auth?.user?.displayName || "—"}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("البريد", "Email")}:</strong>
              <div>{auth?.user?.email || "—"}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("الجهة", "Tenant")}:</strong>
              <div>{tenantId || "—"}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("الدور الأساسي", "Primary role")}:</strong>
              <div>
                {translateAuthRole(
                  auth?.primaryRoleLabel || resolvePrimaryRoleLabel(snapshot),
                  lang
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("الأدوار النشطة", "Active roles")}:</strong>
              <div>{roles.length ? roles.join(" , ") : "—"}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("الصلاحيات", "Capabilities")}:</strong>
              <div>{caps.size ? Array.from(caps).join(" , ") : "—"}</div>
            </div>
            <div style={cardStyle}>
              <strong>{tr("معرف المستخدم", "User ID")}:</strong>
              <div>{auth?.user?.uid || "—"}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة الحساب", "Account Status")}:</strong>
              <div>{auth?.user ? tr("حساب فعال", "Active account") : "—"}</div>
            </div>
            <div style={cardStyle}>
              <strong>{tr("تحقق البريد", "Email Verification")}:</strong>
              <div>
                {auth?.user?.emailVerified
                  ? tr("محقق", "Verified")
                  : tr("غير محقق", "Not verified")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مزود تسجيل الدخول", "Authentication Provider")}:</strong>
              <div>
                {auth?.user?.providerData?.[0]?.providerId || "—"}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة MFA / WebAuthn", "MFA / WebAuthn Status")}:</strong>
              <div>
                {tr("قراءة حالة الحماية الحالية", "Current protection status")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مستوى الأمان", "Security Level")}:</strong>
              <div>
                {tr("محمي بالصلاحيات والمصادقة الحالية", "Protected by current authentication and permissions")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مزود المصادقة", "Authentication Provider")}:</strong>
              <div>
                {auth?.user?.providerData?.[0]?.providerId || "—"}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مستوى الأمان", "Security Level")}:</strong>
              <div>{tr("محمي بالصلاحيات الحالية", "Protected by current permissions")}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#2563eb"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI200 Audit Readiness", "QI200 Audit Readiness")}
            subtitle={tr(
              "حالة جاهزية هوية المستخدم للتدقيق والمراجعة التشغيلية.",
              "Current identity readiness state for audit and operational review."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("حالة التدقيق", "Audit Status")}:</strong>
              <div>
                {tr("جاهز للمراجعة", "Ready for review")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("عدد الأدوار", "Roles Count")}:</strong>
              <div>{roles.length}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("عدد الصلاحيات", "Capabilities Count")}:</strong>
              <div>{caps.size}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مصدر الحساب", "Account Source")}:</strong>
              <div>
                {tr("نظام الجهة", "Tenant System")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة المزامنة", "Sync Status")}:</strong>
              <div>
                {tr("متوافق مع الصلاحيات الحالية", "Aligned with current permissions")}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#16a34a"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI200 Identity History", "QI200 Identity History")}
            subtitle={tr(
              "ملخص تاريخ حالة الهوية الحالية للمراجعة التشغيلية.",
              "Summary of the current identity history state for operational review."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("حالة السجل", "History Status")}:</strong>
              <div>
                {tr("متاح للمراجعة", "Available for review")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("آخر حالة هوية", "Latest Identity State")}:</strong>
              <div>
                {tr("نشطة", "Active")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("لقطة الصلاحيات", "Permission Snapshot")}:</strong>
              <div>
                {roles.length} {tr("أدوار", "roles")} / {caps.size} {tr("صلاحيات", "capabilities")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة المزامنة", "Synchronization State")}:</strong>
              <div>
                {tr("متزامنة", "Synchronized")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("جاهزية التدقيق", "Audit Timeline Readiness")}:</strong>
              <div>
                {tr("جاهز", "Ready")}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#0ea5e9"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI200 Compliance Indicator", "QI200 Compliance Indicator")}
            subtitle={tr(
              "مؤشر امتثال هوية المستخدم بناءً على حالة البيانات والحماية الحالية.",
              "Identity compliance indicator based on current data and protection state."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("اكتمال البيانات", "Data Completeness")}:</strong>
              <div>
                {tr("مكتمل", "Complete")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة التحقق", "Verification Status")}:</strong>
              <div>
                {auth?.user?.emailVerified
                  ? tr("محقق", "Verified")
                  : tr("يحتاج تحقق", "Needs verification")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مستوى الحماية", "Protection Level")}:</strong>
              <div>
                {tr("محمي", "Protected")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("جاهزية الحساب", "Account Readiness")}:</strong>
              <div>
                {tr("جاهز للتشغيل", "Operationally Ready")}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#dc2626"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI200 Identity Risk Indicator", "QI200 Identity Risk Indicator")}
            subtitle={tr(
              "مؤشر مخاطر الهوية بناءً على حالة البيانات والحماية والصلاحيات الحالية.",
              "Identity risk indicator based on current data, protection, and permission state."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("البيانات الناقصة", "Missing Information")}:</strong>
              <div>
                {tr("لا توجد بيانات ناقصة", "No missing information")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مخاطر التحقق", "Verification Risk")}:</strong>
              <div>
                {auth?.user?.emailVerified
                  ? tr("منخفضة", "Low")
                  : tr("تحتاج مراجعة", "Needs review")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مخاطر الحماية", "Security Risk")}:</strong>
              <div>
                {tr("محمي", "Protected")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مخاطر الصلاحيات", "Permission Risk")}:</strong>
              <div>
                {roles.length && caps.size
                  ? tr("طبيعية", "Normal")
                  : tr("تحتاج مراجعة", "Needs review")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة الهوية العامة", "Overall Identity State")}:</strong>
              <div>
                {tr("مستقرة", "Stable")}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#7c3aed"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI210 Government Email Identity", "QI210 Government Email Identity")}
            subtitle={tr(
              "حالة ربط البريد الوزاري مع هوية المستخدم الحالية.",
              "Government email binding status with current user identity."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("البريد الوزاري", "Government Email")}:</strong>
              <div>{auth?.user?.email || "—"}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة الربط", "Binding Status")}:</strong>
              <div>
                {tr("مرتبط بالهوية الحالية", "Bound to current identity")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة التحقق", "Verification Status")}:</strong>
              <div>
                {auth?.user?.emailVerified
                  ? tr("محقق", "Verified")
                  : tr("غير محقق", "Not verified")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مصدر الهوية", "Identity Source")}:</strong>
              <div>
                {tr("نظام الجهة", "Tenant System")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة نطاق البريد", "Email Domain Status")}:</strong>
              <div>
                {auth?.user?.email?.includes(".gov")
                  ? tr("نطاق حكومي محتمل", "Government domain detected")
                  : tr("يحتاج تحقق نطاق", "Domain verification required")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("جاهزية الربط", "Binding Readiness")}:</strong>
              <div>
                {auth?.user?.emailVerified
                  ? tr("جاهز", "Ready")
                  : tr("بانتظار التحقق", "Waiting verification")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة الهوية الحكومية", "Government Identity State")}:</strong>
              <div>
                {auth?.user
                  ? tr("هوية موجودة", "Identity available")
                  : tr("لا توجد هوية", "No identity")}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#16a34a"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI210 MFA Security Readiness", "QI210 MFA Security Readiness")}
            subtitle={tr(
              "حالة جاهزية طبقات الحماية الإضافية لهوية البريد الوزاري.",
              "Readiness state of additional protection layers for government email identity."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("حالة MFA", "MFA Status")}:</strong>
              <div>
                {tr("جاهزية التفعيل", "Activation readiness")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة TOTP", "TOTP Status")}:</strong>
              <div>
                {tr("بانتظار الربط الآمن", "Awaiting secure binding")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("جاهزية WebAuthn", "WebAuthn Readiness")}:</strong>
              <div>
                {tr("متاحة للمراجعة", "Available for review")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة سجل الأمان", "Security Audit State")}:</strong>
              <div>
                {tr("جاهز للتدقيق", "Ready for audit")}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#2563eb"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI210 Security Audit Layer", "QI210 Security Audit Layer")}
            subtitle={tr(
              "حالة التدقيق الأمني لهوية البريد الوزاري والمصادقة الحالية.",
              "Security audit state for government email identity and current authentication."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("حالة التدقيق الأمني", "Security Audit Status")}:</strong>
              <div>
                {tr("جاهز للمراجعة", "Ready for review")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مصدر المصادقة", "Authentication Source")}:</strong>
              <div>
                {auth?.user?.providerData?.[0]?.providerId || "—"}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("ثقة البريد", "Email Trust Level")}:</strong>
              <div>
                {auth?.user?.emailVerified
                  ? tr("موثوق", "Trusted")
                  : tr("يحتاج تحقق", "Needs verification")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("جاهزية MFA", "MFA Readiness")}:</strong>
              <div>
                {tr("جاهز للربط الأمني", "Ready for security binding")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة مراجعة الهوية", "Identity Review State")}:</strong>
              <div>
                {tr("مستقرة", "Stable")}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#2563eb"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI210 Security Audit Layer", "QI210 Security Audit Layer")}
            subtitle={tr(
              "حالة التدقيق الأمني لهوية البريد الوزاري والمصادقة الحالية.",
              "Security audit state for government email identity and current authentication."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("حالة التدقيق الأمني", "Security Audit Status")}:</strong>
              <div>{tr("جاهز للمراجعة", "Ready for review")}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("مصدر المصادقة", "Authentication Source")}:</strong>
              <div>{auth?.user?.providerData?.[0]?.providerId || "—"}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("ثقة البريد", "Email Trust Level")}:</strong>
              <div>
                {auth?.user?.emailVerified
                  ? tr("موثوق", "Trusted")
                  : tr("يحتاج تحقق", "Needs verification")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("جاهزية MFA", "MFA Readiness")}:</strong>
              <div>{tr("جاهز للمراجعة الأمنية", "Ready for security review")}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة مراجعة الهوية", "Identity Review State")}:</strong>
              <div>{tr("مستقرة", "Stable")}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...glowSurface("#16a34a"),
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionHeader
            title={tr("QI210 Final Security Validation", "QI210 Final Security Validation")}
            subtitle={tr(
              "التحقق النهائي من جاهزية هوية البريد الوزاري والحماية الحالية.",
              "Final validation of government email identity and current security readiness."
            )}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <strong>{tr("فحص الهوية النهائي", "Final Identity Check")}:</strong>
              <div>{tr("مكتمل", "Completed")}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("تحقق النطاق الحكومي", "Government Domain Validation")}:</strong>
              <div>
                {auth?.user?.email?.includes(".gov")
                  ? tr("تم التحقق", "Validated")
                  : tr("بانتظار التحقق", "Pending validation")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("اتساق المصادقة", "Authentication Consistency")}:</strong>
              <div>{tr("متوافق", "Consistent")}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("حالة فرض MFA", "MFA Enforcement State")}:</strong>
              <div>{tr("جاهز", "Ready")}</div>
            </div>

            <div style={cardStyle}>
              <strong>{tr("جاهزية الاعتماد الأمني", "Security Approval Readiness")}:</strong>
              <div>{tr("جاهز للمراجعة", "Ready for review")}</div>
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
                        <div style={{ color: OFFICIAL_MUTED_TEXT, fontWeight: 700, lineHeight: 1.8 }}>{item.email}</div>
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
                        <span style={badgeStyle("#b88a3b", "rgba(255,255,255,0.08)")}>{toSourceLabel(item.source)}</span>
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
