// src/pages/SuperSystem.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import "./superSystem.theme.css";
import MinistrySuperSystemView, { type MinistryGovernorateSuperRow } from "./ministry/MinistrySuperSystemView";
import { isMinistrySuperViewer } from "./ministry/ministryPageGuard";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase/firebase";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  isPlatformOwner,
  resolveRoleBadgeStyle,
} from "../features/authz";
import { getActionErrorMessage } from "../services/functionsRuntimePolicy";
import { DIRECTORATES, MINISTRY_SCOPE } from "../constants/directorates";
import { useSuperSystemTenants } from "../features/super-admin/hooks/useSuperSystemTenants";
import "./SuperSystemOmanBrand.css";
import {
  archiveAndDeleteTenant,
  createTenantForScope,
  deleteTenantAdminAssignment,
  loadTenantEditState,
  saveTenantAdminAssignment,
  saveTenantForScope,
} from "../features/super-admin/services/superSystemService";
import {
  migrateAllowlistSchoolAdminLinks,
  type AllowlistSchoolAdminMigrationReport,
} from "../features/super-admin/services/migrateAllowlistSchoolAdminLinks";

const safeId = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const normalizeKind = (value: unknown) => String(value || "").trim().toLowerCase();

const isExamCenterTenant = (tenant: any) => {
  const values = [
    tenant?.tenantType,
    tenant?.type,
    tenant?.entityType,
    tenant?.kind,
    tenant?.category,
  ]
    .map(normalizeKind)
    .filter(Boolean);

  return (
    tenant?.isExamCenter === true ||
    tenant?.isDiplomaCenter === true ||
    values.some((v) =>
      ["exam_center", "exam-center", "examcenter", "diploma_center", "diploma-center"].includes(v),
    )
  );
};

const isSchoolTenant = (tenant: any) => !isExamCenterTenant(tenant);

const getGovernorateValue = (...items: any[]) => {
  for (const item of items) {
    if (!item) continue;
    const value =
      typeof item === "string"
        ? item
        : item?.governorate ??
          item?.tenantGovernorate ??
          item?.regionAr ??
          item?.governorateAr ??
          item?.gov ??
          item?.scopeGovernorate ??
          "";
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const sameGovernorate = (a: unknown, b: unknown) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

const withSchoolTenantMarkers = (extra?: Record<string, unknown>) => ({
  ...(extra || {}),
  tenantType: "school",
  type: "school",
  entityType: "school",
  isExamCenter: false,
  isDiplomaCenter: false,
});

type TenantAdminLinkRow = {
  tenantId: string;
  tenantName: string;
  email: string;
};

type PendingTenantDelete = {
  tenantId: string;
  tenantName: string;
};

type PendingAdminLinkDelete = TenantAdminLinkRow | null;

type ExistingEmailReplaceState = {
  email: string;
  currentTenantId: string;
  currentSchoolName: string;
  newTenantId: string;
  newSchoolName: string;
};

type PendingSchoolRenameConfirm = {
  tenantId: string;
  oldName: string;
  newName: string;
};

function ConfirmModal(props: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const {
    open,
    title,
    message,
    confirmLabel = "نعم",
    cancelLabel = "إغلاق",
    confirmVariant = "primary",
    busy = false,
    onConfirm,
    onClose,
  } = props;

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.58)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 540,
          borderRadius: 18,
          border: "1px solid rgba(212,175,55,0.28)",
          background: "#101010",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          color: "#f8fafc",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px 12px",
            borderBottom: "1px solid rgba(212,175,55,0.18)",
            fontWeight: 900,
            color: "#d4af37",
            fontSize: 20,
          }}
        >
          {title}
        </div>

        <div style={{ padding: 20, lineHeight: 1.9 }}>{message}</div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            gap: 10,
            padding: 20,
            borderTop: "1px solid rgba(212,175,55,0.18)",
          }}
        >
          <button
            className={`btn ${confirmVariant === "danger" ? "danger" : "primary"}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "جارٍ التنفيذ..." : confirmLabel}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperSystem() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth() as any;
  const { user, allow, logout } = auth;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const roleBadge = resolveRoleBadgeStyle(authzSnapshot);
  const isOwner = isPlatformOwner(authzSnapshot);
  const canManageSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");

  if (!user) return <Navigate to="/login" replace />;
  if (!allow?.enabled) return <Navigate to="/login" replace />;
  if (!canManageSystem) return <Navigate to="/" replace />;

  const myGov = getGovernorateValue(allow, authzSnapshot as any);
  const isMinistryViewer = !isOwner && (isMinistrySuperViewer(auth as any) || myGov === MINISTRY_SCOPE);
  const isRegionalSuper = !isOwner && !isMinistryViewer;
  const canSeeAllGovs = isOwner || isMinistryViewer;

  // ✅ فتح الروابط الرئيسية بتحميل كامل للصفحة بدلاً من انتقال داخلي فقط.
  // السبب: بعض صفحات السوبر تعتمد على تحميل صلاحيات/tenant من البداية،
  // ومع الانتقال الداخلي كانت تظهر شاشة سوداء حتى يتم تحديث الصفحة يدويًا.
  const openSystemPage = React.useCallback((path: string) => {
    const target = String(path || "").trim();
    if (!target) return;
    try {
      window.location.assign(target);
    } catch {
      navigate(target);
    }
  }, [navigate]);

  const {
    tenants,
    setTenants,
    search,
    setSearch,
    selectedTenantId,
    setSelectedTenantId,
    visibleTenants: rawVisibleTenants,
    selectedTenant: rawSelectedTenant,
  } = useSuperSystemTenants({ canSeeAllGovs, myGov });

  const visibleTenants = useMemo(() => {
    const sourceTenants = Array.isArray(tenants) && tenants.length ? tenants : rawVisibleTenants;
    return sourceTenants.filter((tenant: any) => {
      if (!isSchoolTenant(tenant)) return false;
      if (canSeeAllGovs) return true;
      const tenantGov = getGovernorateValue(tenant);
      return sameGovernorate(tenantGov, myGov);
    });
  }, [tenants, rawVisibleTenants, canSeeAllGovs, myGov]);

  const selectedTenant = useMemo(() => {
    if (!rawSelectedTenant) return rawSelectedTenant;
    return isSchoolTenant(rawSelectedTenant) ? rawSelectedTenant : null;
  }, [rawSelectedTenant]);

  const requestedTenantId = String(searchParams.get("tenantId") || "").trim();

  useEffect(() => {
    if (!requestedTenantId) return;
    const existsInVisibleList = visibleTenants.some(
      (t) => String(t.id || "").trim() === requestedTenantId
    );
    if (!existsInVisibleList) return;
    if (selectedTenantId === requestedTenantId) return;
    setSelectedTenantId(requestedTenantId);
  }, [requestedTenantId, visibleTenants, selectedTenantId, setSelectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId) return;
    const stillVisibleSchool = visibleTenants.some((t) => String(t.id || "").trim() === String(selectedTenantId || "").trim());
    if (!stillVisibleSchool) {
      setSelectedTenantId("");
    }
  }, [selectedTenantId, visibleTenants, setSelectedTenantId]);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-super-system-settings12-theme", "true");
    styleEl.textContent = `
      /* التنسيق العام والخط الأسود العريض */
      .super-system-page {
        background: linear-gradient(180deg, #f7f3e7 0%, #f3edde 100%) !important;
        color: #000000 !important;
        font-weight: 900 !important;
      }

      /* جعل جميع النصوص سوداء وعريضة */
      .super-system-page *,
      .super-system-page .super-program-title,
      .super-system-page .super-subtitle,
      .super-system-page .super-card-title,
      .super-system-page .super-panel-title,
      .super-system-page .tenant-name,
      .super-system-page .label,
      .super-system-page .super-brand-text {
        color: #000000 !important;
        font-weight: 900 !important;
      }

      .super-system-page .super-header {
        background: linear-gradient(135deg, #8b6a00 0%, #b8860b 48%, #7a5c00 100%) !important;
        border: 5px solid #000000 !important;
        border-radius: 28px !important;
      }

      .super-system-page.ministry-super-page .super-header {
        background: linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #94a3b8 100%) !important;
        border-color: #38bdf8 !important;
        box-shadow: 0 18px 48px rgba(14, 165, 233, 0.22) !important;
      }

      .super-system-page.ministry-super-page .super-subtitle,
      .super-system-page.ministry-super-page .super-brand-gov {
        color: #bae6fd !important;
      }
        box-shadow: 0 24px 50px rgba(0,0,0,0.1) !important;
      }

      /* تنسيق الكروت بحدود عريضة وملونة */
      .super-system-page .super-card {
        background: #ffffff !important;
        border-width: 6px !important;
        border-style: solid !important;
        border-radius: 22px !important;
        transition: transform 0.2s, box-shadow 0.2s;
        padding: 20px !important;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: right;
        cursor: pointer;
      }

      .super-system-page .super-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 24px rgba(0,0,0,0.15) !important;
      }

      /* تتابع الألوان لحدود الكروت */
      .super-system-page .super-card:nth-child(7n+1) { border-color: #e63946 !important; }
      .super-system-page .super-card:nth-child(7n+2) { border-color: #457b9d !important; }
      .super-system-page .super-card:nth-child(7n+3) { border-color: #2a9d8f !important; }
      .super-system-page .super-card:nth-child(7n+4) { border-color: #f4a261 !important; }
      .super-system-page .super-card:nth-child(7n+5) { border-color: #9b5de5 !important; }
      .super-system-page .super-card:nth-child(7n+6) { border-color: #00bbf9 !important; }
      .super-system-page .super-card:nth-child(7n+7) { border-color: #fee440 !important; }

      .super-system-page .super-panel {
        background: #ffffff !important;
        border: 5px solid #000000 !important;
        border-radius: 22px !important;
      }

      .super-system-page .tenant-row {
        border: 3px solid #000000 !important;
        background: #fbf8ef !important;
        border-radius: 18px !important;
      }

      .super-system-page .input {
        border: 3px solid #000000 !important;
        font-weight: 900 !important;
        color: #000000 !important;
        background: #fffdf7 !important;
      }

      .super-system-page .btn {
        border: 3px solid #000000 !important;
        font-weight: 900 !important;
        color: #000000 !important;
        background: #d4af37 !important;
      }

      .super-system-page .btn.danger {
        border-color: #000000 !important;
        background: #ef4444 !important;
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      try {
        document.head.removeChild(styleEl);
      } catch {}
    };
  }, []);

  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantEnabled, setEditTenantEnabled] = useState(true);
  const [editWilayatAr, setEditWilayatAr] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editReloadTick, setEditReloadTick] = useState(0);

  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantId, setNewTenantId] = useState("");
  const [newTenantEnabled, setNewTenantEnabled] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userEnabled, setUserEnabled] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [linkedTenantAdminEmail, setLinkedTenantAdminEmail] = useState("");

  const [tenantAdminRows, setTenantAdminRows] = useState<TenantAdminLinkRow[]>([]);
  const [tenantAdminBusy, setTenantAdminBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [ministryGovernorateSupers, setMinistryGovernorateSupers] = useState<MinistryGovernorateSuperRow[]>([]);
  const [ministrySupersLoading, setMinistrySupersLoading] = useState(false);

  useEffect(() => {
    if (!isMinistryViewer) {
      setMinistryGovernorateSupers([]);
      setMinistrySupersLoading(false);
      return;
    }

    let alive = true;

    const normalizeRoleList = (value: any): string[] => {
      const roles: string[] = [];
      const singleRole = String(value?.role || "").trim().toLowerCase();
      if (singleRole) roles.push(singleRole);

      if (Array.isArray(value?.roles)) {
        value.roles.forEach((role: unknown) => {
          const text = String(role || "").trim().toLowerCase();
          if (text) roles.push(text);
        });
      }

      return Array.from(new Set(roles));
    };

    const isGovernorateSupervisor = (value: any): boolean => {
      const roles = normalizeRoleList(value);
      return roles.includes("super") && !roles.includes("super_admin") && !roles.includes("ministry_super");
    };

    const isSchoolAdminRole = (value: any): boolean => {
      const roles = normalizeRoleList(value);
      return roles.includes("tenant_admin") || roles.includes("admin");
    };

    const isExamSuperRole = (value: any): boolean => {
      const roles = normalizeRoleList(value);
      return roles.includes("exam_super") || roles.includes("exam_super12") || roles.includes("diploma_super");
    };

    const looksLikeDiplomaCenterTenant = (tenant: any): boolean => {
      const markerText = [
        tenant?.kind,
        tenant?.type,
        tenant?.tenantType,
        tenant?.mode,
        tenant?.program,
        tenant?.programType,
        tenant?.entryMode,
        tenant?.route,
        tenant?.path,
        tenant?.dashboard,
        tenant?.homePath,
        tenant?.defaultRoute,
        tenant?.centerType,
        tenant?.isExamCenter,
        tenant?.isDiplomaCenter,
        tenant?.examCenter,
        tenant?.diplomaCenter,
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");

      return (
        tenant?.isExamCenter === true ||
        tenant?.isDiplomaCenter === true ||
        tenant?.examCenter === true ||
        tenant?.diplomaCenter === true ||
        markerText.includes("center") ||
        markerText.includes("diploma") ||
        markerText.includes("exam") ||
        markerText.includes("dashboard12") ||
        markerText.includes("mode=center") ||
        markerText.includes("type=center")
      );
    };

    const tenantGovernorate = (tenant: any): string => String(getGovernorateValue(tenant) || "").trim();

    const run = async () => {
      setMinistrySupersLoading(true);

      try {
        const allowSnap = await getDocs(collection(db, "allowlist"));
        const allowRows = allowSnap.docs.map((docSnap) => {
          const data = (docSnap.data() as any) || {};
          return {
            ...data,
            email: String(data?.email || docSnap.id || "").trim().toLowerCase(),
            id: String(docSnap.id || data?.email || "").trim().toLowerCase(),
          };
        });

        const sourceTenants = (Array.isArray(tenants) ? tenants : []).filter((tenant: any) => tenant?.deleted !== true);
        const diplomaCenterTenants = sourceTenants.filter((tenant: any) => looksLikeDiplomaCenterTenant(tenant));
        const diplomaCenterIds = new Set(
          diplomaCenterTenants
            .map((tenant: any) => String(tenant?.id || "").trim())
            .filter(Boolean)
        );
        const schoolTenants = sourceTenants.filter(
          (tenant: any) =>
            !diplomaCenterIds.has(String(tenant?.id || "").trim()) &&
            isSchoolTenant(tenant)
        );

        const rows: MinistryGovernorateSuperRow[] = allowRows
          .filter((row) => isGovernorateSupervisor(row))
          .map((row) => {
            const governorate = String(getGovernorateValue(row) || row?.governorate || row?.tenantGovernorate || "").trim();
            const sameGovSchoolTenants = governorate
              ? schoolTenants.filter((tenant: any) => sameGovernorate(tenantGovernorate(tenant), governorate))
              : [];

            const sameGovDiplomaCenters = governorate
              ? diplomaCenterTenants.filter((tenant: any) => sameGovernorate(tenantGovernorate(tenant), governorate))
              : [];

            const schoolTenantIds = new Set(
              sameGovSchoolTenants
                .map((tenant: any) => String(tenant?.id || "").trim())
                .filter(Boolean)
            );

            const schoolAdminsCount = allowRows.filter((item) => {
              if (!isSchoolAdminRole(item)) return false;

              const itemGov = String(getGovernorateValue(item) || item?.governorate || item?.tenantGovernorate || "").trim();
              const itemTenantId = String(item?.tenantId || "").trim();

              return (
                (governorate && itemGov && sameGovernorate(itemGov, governorate)) ||
                (itemTenantId && schoolTenantIds.has(itemTenantId))
              );
            }).length;

            const examSupersCount = allowRows.filter((item) => {
              if (!isExamSuperRole(item)) return false;
              const itemGov = String(getGovernorateValue(item) || item?.governorate || item?.tenantGovernorate || "").trim();
              return governorate && itemGov && sameGovernorate(itemGov, governorate);
            }).length;

            return {
              id: row.id || row.email || governorate || "governorate-super",
              name: String(row?.userName || row?.name || row?.displayName || row?.email || governorate || "سوبر محافظة").trim(),
              email: String(row?.email || "").trim().toLowerCase(),
              governorate,
              enabled: row?.enabled !== false,
              schoolsCount: sameGovSchoolTenants.length,
              diplomaCentersCount: sameGovDiplomaCenters.length,
              schoolAdminsCount,
              examSupersCount,
            };
          })
          .sort((a, b) =>
            String(a.governorate || a.name || a.email || "").localeCompare(
              String(b.governorate || b.name || b.email || ""),
              "ar"
            )
          );

        const officialRows: MinistryGovernorateSuperRow[] = DIRECTORATES.map((directorateName, index) => {
          const officialName = String(directorateName || "").trim();
          const governorate = officialName
            .replace(/^المديرية العامة للتعليم بمحافظة\s+/, "")
            .trim();

          const existing = rows.find((row) =>
            sameGovernorate(String(row?.governorate || ""), governorate),
          );

          const sameGovSchoolTenants = schoolTenants.filter((tenant: any) =>
            sameGovernorate(tenantGovernorate(tenant), governorate),
          );

          const sameGovDiplomaCenters = diplomaCenterTenants.filter((tenant: any) =>
            sameGovernorate(tenantGovernorate(tenant), governorate),
          );

          const schoolTenantIds = new Set(
            sameGovSchoolTenants
              .map((tenant: any) => String(tenant?.id || "").trim())
              .filter(Boolean),
          );

          const schoolAdminsCount = allowRows.filter((item) => {
            if (!isSchoolAdminRole(item)) return false;

            const itemGov = String(
              getGovernorateValue(item) || item?.governorate || item?.tenantGovernorate || "",
            ).trim();
            const itemTenantId = String(item?.tenantId || "").trim();

            return (
              (itemGov && sameGovernorate(itemGov, governorate)) ||
              (itemTenantId && schoolTenantIds.has(itemTenantId))
            );
          }).length;

          const examSupersCount = allowRows.filter((item) => {
            if (!isExamSuperRole(item)) return false;
            const itemGov = String(
              getGovernorateValue(item) || item?.governorate || item?.tenantGovernorate || "",
            ).trim();
            return Boolean(itemGov && sameGovernorate(itemGov, governorate));
          }).length;

          return {
            ...(existing || {}),
            id: `official-governorate-${index + 1}`,
            name: officialName,
            governorate,
            email: String(existing?.email || "").trim(),
            enabled: existing ? existing.enabled !== false : false,
            schoolsCount: sameGovSchoolTenants.length,
            diplomaCentersCount: sameGovDiplomaCenters.length,
            schoolAdminsCount,
            examSupersCount,
          } as MinistryGovernorateSuperRow;
        });

        if (!alive) return;
        setMinistryGovernorateSupers(officialRows);
      } catch (error) {
        console.error("Failed to load ministry governorate supervisors.", error);
        if (alive) {
          setMinistryGovernorateSupers(
            DIRECTORATES.map((directorateName, index) => {
              const officialName = String(directorateName || "").trim();
              const governorate = officialName
                .replace(/^المديرية العامة للتعليم بمحافظة\s+/, "")
                .trim();

              return {
                id: `official-governorate-${index + 1}`,
                name: officialName,
                email: "",
                enabled: false,
                governorate,
                schoolsCount: 0,
                diplomaCentersCount: 0,
                schoolAdminsCount: 0,
                examSupersCount: 0,
              } as MinistryGovernorateSuperRow;
            }),
          );
        }
      } finally {
        if (alive) setMinistrySupersLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [isMinistryViewer, tenants]);

  const [pendingTenantDelete, setPendingTenantDelete] = useState<PendingTenantDelete | null>(null);
  const [pendingAdminLinkDelete, setPendingAdminLinkDelete] = useState<PendingAdminLinkDelete>(null);
  const [existingEmailReplaceState, setExistingEmailReplaceState] =
    useState<ExistingEmailReplaceState | null>(null);
  const [originalEditTenantName, setOriginalEditTenantName] = useState("");
  const [pendingSchoolRenameConfirm, setPendingSchoolRenameConfirm] =
    useState<PendingSchoolRenameConfirm | null>(null);

  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const getTenantDisplayName = async (tenantIdValue: string, fallbackName?: string) => {
    const tenantId = String(tenantIdValue || "").trim();
    if (!tenantId) return String(fallbackName || "").trim() || "مدرسة غير معروفة";

    try {
      const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
      if (tenantSnap.exists()) {
        const data = tenantSnap.data() as any;
        return String(data?.name || fallbackName || tenantId).trim();
      }
    } catch {}

    return String(fallbackName || tenantId).trim();
  };

  const getExistingLinkByEmail = async (emailValue: string) => {
    const email = String(emailValue || "").trim().toLowerCase();
    if (!email) return null;

    const existingSnap = await getDoc(doc(db, "allowlist", email));
    if (!existingSnap.exists()) return null;

    const existingData = existingSnap.data() as any;
    const tenantId = String(existingData?.tenantId || "").trim();
    const role = String(existingData?.role || "").trim().toLowerCase();
    if (!tenantId || !["tenant_admin", "admin"].includes(role)) return null;

    const schoolName = await getTenantDisplayName(
      tenantId,
      String(existingData?.schoolName || existingData?.tenantName || "").trim(),
    );

    return { email, tenantId, schoolName };
  };

  const getExistingLinkByTenant = async (tenantIdValue: string) => {
    const tenantId = String(tenantIdValue || "").trim();
    if (!tenantId) return null;

    try {
      const tenantLinkSnap = await getDoc(doc(db, "tenantAdminLinks", tenantId));
      if (tenantLinkSnap.exists()) {
        const tenantLinkData = tenantLinkSnap.data() as any;
        const linkedEmail = String(tenantLinkData?.email || "").trim().toLowerCase();

        if (linkedEmail) {
          const allowSnap = await getDoc(doc(db, "allowlist", linkedEmail));
          if (allowSnap.exists()) {
            const allowData = allowSnap.data() as any;
            const role = String(allowData?.role || "").trim().toLowerCase();

            if (role === "tenant_admin" || role === "admin") {
              const schoolName = await getTenantDisplayName(
                tenantId,
                String(
                  allowData?.schoolName ||
                    allowData?.tenantName ||
                    tenantLinkData?.schoolName ||
                    "",
                ).trim(),
              );

              return {
                tenantId,
                email: linkedEmail,
                schoolName,
                userName: String(allowData?.userName || "").trim(),
                enabled: allowData?.enabled !== false,
              };
            }
          }

          const schoolName = await getTenantDisplayName(
            tenantId,
            String(tenantLinkData?.schoolName || "").trim(),
          );

          return {
            tenantId,
            email: linkedEmail,
            schoolName,
            userName: "",
            enabled: true,
          };
        }
      }
    } catch (error) {
      console.error(error);
    }

    const rowFromState = tenantAdminRows.find(
      (row) => String(row.tenantId || "").trim() === tenantId,
    );

    if (rowFromState?.email) {
      try {
        const allowSnap = await getDoc(
          doc(db, "allowlist", String(rowFromState.email || "").trim().toLowerCase()),
        );

        if (allowSnap.exists()) {
          const allowData = allowSnap.data() as any;
          const role = String(allowData?.role || "").trim().toLowerCase();

          if (role === "tenant_admin" || role === "admin") {
            const schoolName = await getTenantDisplayName(
              tenantId,
              String(
                allowData?.schoolName || allowData?.tenantName || rowFromState.tenantName || "",
              ).trim(),
            );

            return {
              tenantId,
              email: String(rowFromState.email || "").trim().toLowerCase(),
              schoolName,
              userName: String(allowData?.userName || "").trim(),
              enabled: allowData?.enabled !== false,
            };
          }
        }
      } catch (error) {
        console.error(error);
      }
    }

    try {
      const baseFilters: any[] = [
        where("tenantId", "==", tenantId),
        where("role", "in", ["tenant_admin", "admin"]),
      ];

      if (!canSeeAllGovs) {
        baseFilters.push(where("governorate", "==", String(myGov || "").trim()));
      }

      const snap = await getDocs(query(collection(db, "allowlist"), ...baseFilters));

      const match = snap.docs.find((d) => {
        const data = d.data() as any;
        const role = String(data?.role || "").trim().toLowerCase();
        return role === "tenant_admin" || role === "admin";
      });

      if (!match) return null;

      const data = match.data() as any;
      const email = String(data?.email || match.id || "").trim().toLowerCase();
      const schoolName = await getTenantDisplayName(
        tenantId,
        String(data?.schoolName || data?.tenantName || "").trim(),
      );

      return {
        tenantId,
        email,
        schoolName,
        userName: String(data?.userName || "").trim(),
        enabled: data?.enabled !== false,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const isEmailAlreadyLinkedToAnotherSchool = async (emailValue: string, tenantIdValue: string) => {
    const email = String(emailValue || "").trim().toLowerCase();
    const tenantId = String(tenantIdValue || "").trim();
    if (!email || !tenantId) return false;

    const existing = await getExistingLinkByEmail(email);
    if (!existing) return false;
    return existing.tenantId !== tenantId;
  };

  const isTenantAlreadyLinkedToAnotherEmail = async (tenantIdValue: string, emailValue: string) => {
    const tenantId = String(tenantIdValue || "").trim();
    const email = String(emailValue || "").trim().toLowerCase();
    if (!tenantId || !email) return false;

    const existing = await getExistingLinkByTenant(tenantId);
    if (!existing) return false;
    return existing.email !== email;
  };

  const runAllowlistMigration = async () => {
    if (!isOwner) {
      alert("هذه الأداة متاحة لمالك المنصة فقط.");
      return;
    }

    const ok = confirm(
      "سيتم تنظيف روابط الأدمن القديمة داخل allowlist وتوحيدها إلى tenant_admin مع تعبئة Tenant ID والمحافظة واسم المدرسة. هل تريد المتابعة؟",
    );
    if (!ok) return;

    setMigrationBusy(true);
    try {
      const report: AllowlistSchoolAdminMigrationReport = await migrateAllowlistSchoolAdminLinks({
        apply: true,
      });

      setEditReloadTick((x: number) => x + 1);

      alert(
        [
          "تم تنفيذ أداة التنظيف بنجاح.",
          `إجمالي السجلات المفحوصة: ${report.scanned}`,
          `تم تحديثها: ${report.updated}`,
          `تم حذف السجلات المكررة: ${report.deleted}`,
          `السجلات المتجاهلة: ${report.skipped}`,
          report.conflicts.length
            ? `تعارضات تحتاج مراجعة: ${report.conflicts.length}`
            : "لا توجد تعارضات متبقية.",
        ].join("\n"),
      );
    } catch (e) {
      console.error(e);
      alert("تعذر تنفيذ أداة التنظيف. تأكد من الصلاحيات ثم جرّب مرة أخرى.");
    } finally {
      setMigrationBusy(false);
    }
  };

  const exportTenantAdminLinksToExcel = () => {
    const rows = [...tenantAdminRows];

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <tr>
              <th>Tenant ID</th>
              <th>اسم المدرسة</th>
              <th>البريد الإلكتروني المرتبط</th>
            </tr>
            ${rows
              .map(
                (r) => `
              <tr>
                <td>${String(r.tenantId || "")}</td>
                <td>${String(r.tenantName || "")}</td>
                <td>${String(r.email || "")}</td>
              </tr>
            `,
              )
              .join("")}
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tenant-admin-links.xls";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const parseExcelLikeFile = async (file: File): Promise<TenantAdminLinkRow[]> => {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const rows: TenantAdminLinkRow[] = [];
    const separator = lines[0].includes("\t") ? "\t" : ",";

    const rawRows = lines.map((line) => line.split(separator).map((cell) => cell.trim()));
    const header = rawRows[0].map((h) => h.toLowerCase());

    const tenantIdIndex = header.findIndex((h) => h.includes("tenant"));
    const tenantNameIndex = header.findIndex((h) => h.includes("اسم المدرسة") || h.includes("school"));
    const emailIndex = header.findIndex((h) => h.includes("البريد") || h.includes("email"));

    const startAt = tenantIdIndex >= 0 || tenantNameIndex >= 0 || emailIndex >= 0 ? 1 : 0;

    for (let i = startAt; i < rawRows.length; i++) {
      const cols = rawRows[i];
      const row: TenantAdminLinkRow = {
        tenantId: String(cols[tenantIdIndex >= 0 ? tenantIdIndex : 0] || "").trim(),
        tenantName: String(cols[tenantNameIndex >= 0 ? tenantNameIndex : 1] || "").trim(),
        email: String(cols[emailIndex >= 0 ? emailIndex : 2] || "").trim(),
      };

      if (!row.tenantId || !row.email) continue;
      rows.push(row);
    }

    return rows;
  };

  const importTenantAdminLinksFromExcel = async (file: File) => {
    if (isMinistryViewer) {
      alert("سوبر الوزارة للمشاهدة فقط ولا يمكنه استيراد روابط الأدمن.");
      return;
    }

    setImportBusy(true);
    try {
      const importedRows = await parseExcelLikeFile(file);

      if (!importedRows.length) {
        alert("لم يتم العثور على بيانات صالحة داخل الملف.");
        return;
      }

      for (const row of importedRows) {
        const tenantId = String(row.tenantId || "").trim();
        const email = String(row.email || "").trim().toLowerCase();
        if (!tenantId || !email) continue;

        const tenantDocRef = doc(db, "tenants", tenantId);
        const tenantDocSnap = await getDoc(tenantDocRef);
        const tenantDocData = tenantDocSnap.exists() ? (tenantDocSnap.data() as any) : null;

        if (!tenantDocData) continue;
        if (!isSchoolTenant(tenantDocData)) continue;

        const tenantGovernorate = getGovernorateValue(tenantDocData);
        if (!canSeeAllGovs && !sameGovernorate(tenantGovernorate, myGov)) {
          continue;
        }

        const alreadyLinked = await isEmailAlreadyLinkedToAnotherSchool(email, tenantId);
        if (alreadyLinked) {
          continue;
        }

        const tenantAlreadyLinked = await isTenantAlreadyLinkedToAnotherEmail(tenantId, email);
        if (tenantAlreadyLinked) {
          continue;
        }

        await setDoc(
          doc(db, "allowlist", email),
          {
            email,
            enabled: true,
            role: "tenant_admin",
            tenantId,
            schoolName: row.tenantName || tenantDocData?.name || tenantId,
            tenantName: row.tenantName || tenantDocData?.name || tenantId,
            governorate: tenantGovernorate,
            tenantGovernorate,
          },
          { merge: true },
        );
      }

      setEditReloadTick((x) => x + 1);
      alert("تم استيراد بيانات الجدول بنجاح.");
    } catch (e) {
      console.error(e);
      alert("تعذر استيراد الملف. تأكد من أن الملف بصيغة CSV أو Excel محفوظ كنص قابل للقراءة.");
    } finally {
      setImportBusy(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const deleteTenantAdminLink = async (row: TenantAdminLinkRow) => {
    if (isMinistryViewer) {
      alert("سوبر الوزارة للمشاهدة فقط ولا يمكنه حذف الربط.");
      return;
    }

    const tenantId = String(row.tenantId || "").trim();
    const tenant = tenants.find((t) => String(t.id || "").trim() === tenantId);

    if (tenant && tenant.enabled === false) {
      alert("لا يمكن إلغاء ربط الأدمن من مدرسة غير مفعلة. قم بتفعيل المدرسة أولاً ثم ألغِ الربط.");
      return;
    }

    const email = String(row.email || "").trim().toLowerCase();
    if (!email) return;

    try {
      await deleteTenantAdminAssignment({ email, tenantId });
      setTenantAdminRows((prev) =>
        prev.filter(
          (item) =>
            !(
              String(item.tenantId || "") === tenantId &&
              String(item.email || "").toLowerCase() === email
            ),
        ),
      );
      setPendingAdminLinkDelete(null);
      if (selectedTenantId && tenantId === String(selectedTenantId || "").trim()) {
        setLinkedTenantAdminEmail("");
        setUserEmail("");
        setUserName("");
        setUserEnabled(true);
      }
      alert("تم حذف الربط من الجدول بنجاح.");
    } catch (e: any) {
      console.error(e);
      const message = String(e?.message || "");
      if (message === "TENANT_DISABLED_LINK_CHANGE_BLOCKED") {
        alert("لا يمكن إلغاء ربط الأدمن من مدرسة غير مفعلة. قم بتفعيل المدرسة أولاً ثم ألغِ الربط.");
        return;
      }
      alert("تعذر حذف الربط. تأكد من الصلاحيات ثم جرّب مرة أخرى.");
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!selectedTenantId) {
        setLinkedTenantAdminEmail("");
        setOriginalEditTenantName("");
        return;
      }
      try {
        const state = await loadTenantEditState(selectedTenantId);
        setEditTenantName(state.name);
        setOriginalEditTenantName(state.name);
        setEditTenantEnabled(state.enabled);
        setEditWilayatAr(state.wilayatAr);
        setEditLogoUrl(state.logoUrl);
      } catch (e) {
        console.error(e);
      }
    };

    void run();
  }, [selectedTenantId, editReloadTick]);

  useEffect(() => {
    const run = async () => {
      if (!selectedTenantId) {
        setUserEmail("");
        setUserName("");
        setUserEnabled(true);
        setLinkedTenantAdminEmail("");
        return;
      }

      try {
        const existingAdmin = await getExistingLinkByTenant(selectedTenantId);
        if (!existingAdmin) {
          setUserEmail("");
          setUserName("");
          setUserEnabled(true);
          setLinkedTenantAdminEmail("");
          return;
        }

        const existingEmail = String(existingAdmin.email || "").trim().toLowerCase();
        setLinkedTenantAdminEmail(existingEmail);
        setUserEmail(existingEmail);
        setUserName(String(existingAdmin.userName || ""));
        setUserEnabled(existingAdmin.enabled !== false);
      } catch (e) {
        console.error(e);
        setUserEmail("");
        setUserName("");
        setUserEnabled(true);
        setLinkedTenantAdminEmail("");
      }
    };

    void run();
  }, [selectedTenantId, editReloadTick]);

  useEffect(() => {
    const run = async () => {
      setTenantAdminBusy(true);
      try {
        const allowRef = collection(db, "allowlist");
        const tenantSource = (Array.isArray(visibleTenants) && visibleTenants.length ? visibleTenants : tenants)
          .filter((t: any) => isSchoolTenant(t));

        const tenantsMap = new Map<string, { tenantName: string; governorate: string }>(
          tenantSource.map((t: any) => [
            String(t.id || "").trim(),
            {
              tenantName: String(t.name || t.id || ""),
              governorate: getGovernorateValue(t),
            },
          ]),
        );

        const rows: TenantAdminLinkRow[] = [];
        const seen = new Set<string>();

        const addRow = (row: TenantAdminLinkRow) => {
          const tenantId = String(row.tenantId || "").trim();
          const email = String(row.email || "").trim().toLowerCase();
          if (!tenantId || !email) return;

          const key = `${tenantId}__${email}`;
          if (seen.has(key)) return;
          seen.add(key);

          rows.push({
            tenantId,
            tenantName: String(row.tenantName || tenantId).trim(),
            email,
          });
        };

        // القراءة الأولى من allowlist مع فلتر المحافظة كما كان، حفاظًا على قواعد Firestore الحالية.
        // بعض السجلات القديمة لا تظهر هنا لأن حقل المحافظة قد يكون ناقصًا أو مختلفًا.
        try {
          const q = !canSeeAllGovs
            ? query(
                allowRef,
                where("role", "in", ["tenant_admin", "admin"]),
                where("governorate", "==", String(myGov || "").trim()),
              )
            : query(allowRef, where("role", "in", ["tenant_admin", "admin"]));
          const snap = await getDocs(q);

          for (const docSnap of snap.docs as QueryDocumentSnapshot<DocumentData>[]) {
            const data = docSnap.data() as any;
            const tenantId = String(data?.tenantId || "").trim();
            const email = String(data?.email || docSnap.id || "").trim().toLowerCase();
            if (!tenantId || !email) continue;

            const tenantMeta = tenantsMap.get(tenantId);
            let tenantDocData: any = null;

            // مشرف المحافظة لا يحتاج قراءة tenants خارج قائمة مدارس محافظته.
            // بعض سجلات allowlist القديمة قد تحمل نفس المحافظة لكن tenantId غير متاح ضمن نطاقه،
            // ومحاولة قراءة tenants/{tenantId} لها تسبب Firebase permission warning.
            if (!canSeeAllGovs && !tenantMeta) {
              continue;
            }

            try {
              const tenantDocSnap = await getDoc(doc(db, "tenants", tenantId));
              tenantDocData = tenantDocSnap.exists() ? tenantDocSnap.data() : null;
            } catch (tenantError) {
              if (canSeeAllGovs) {
                console.warn("تعذر قراءة بيانات المدرسة أثناء تحميل جدول الأدمن.", tenantError);
              }
            }

            const effectiveTenantData = tenantDocData || tenantMeta || data;
            if (!isSchoolTenant(effectiveTenantData)) continue;

            const effectiveGovernorate = getGovernorateValue(tenantDocData, tenantMeta, data);
            if (!canSeeAllGovs && !sameGovernorate(effectiveGovernorate, myGov)) {
              continue;
            }

            addRow({
              tenantId,
              tenantName: String(
                tenantDocData?.name || data?.schoolName || data?.tenantName || tenantMeta?.tenantName || tenantId,
              ),
              email,
            });
          }
        } catch (allowlistError) {
          console.warn("تعذر تحميل جدول الأدمن من allowlist، سيتم استخدام روابط المدارس كبديل.", allowlistError);
        }

        // القراءة الثانية مكمّلة من tenantAdminLinks / المدرسة المحددة.
        // هذا يعالج اختفاء البيانات عندما يكون ربط الأدمن موجودًا، لكن جدول allowlist لا يعيده بسبب اختلاف حقل المحافظة.
        for (const tenant of tenantSource as any[]) {
          const tenantId = String(tenant?.id || "").trim();
          if (!tenantId) continue;

          const tenantGovernorate = getGovernorateValue(tenant);
          if (!canSeeAllGovs && !sameGovernorate(tenantGovernorate, myGov)) {
            continue;
          }

          try {
            const existingAdmin = await getExistingLinkByTenant(tenantId);
            const email = String(existingAdmin?.email || "").trim().toLowerCase();
            if (!email) continue;

            addRow({
              tenantId,
              tenantName: String(existingAdmin?.schoolName || tenant?.name || tenantId),
              email,
            });
          } catch (linkError) {
            console.warn("تعذر قراءة رابط أدمن المدرسة.", linkError);
          }
        }

        rows.sort((a, b) =>
          String(a.tenantName || a.tenantId).localeCompare(String(b.tenantName || b.tenantId), "ar"),
        );
        setTenantAdminRows(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setTenantAdminBusy(false);
      }
    };

    void run();
  }, [tenants, visibleTenants, canSeeAllGovs, myGov, editReloadTick, selectedTenantId]);

  const createTenant = async () => {
    if (isMinistryViewer) {
      alert("سوبر الوزارة للمشاهدة فقط ولا يمكنه إنشاء المدارس.");
      return;
    }

    const cleanedName = String(newTenantName || "").trim();
    const cleanedTenantId = safeId(String(newTenantId || cleanedName || ""));
    const governorateForWrite = canSeeAllGovs ? String(myGov || "").trim() : String(myGov || "").trim();

    if (!cleanedName) {
      alert("اكتب اسم المدرسة أولاً.");
      return;
    }

    if (!cleanedTenantId) {
      alert("اكتب Tenant ID صحيح أو اسم مدرسة يمكن تحويله إلى معرف.");
      return;
    }

    if (isRegionalSuper && !governorateForWrite) {
      alert("حساب سوبر المحافظة غير مرتبط بمحافظة، لذلك لا يمكن إنشاء مدرسة جديدة.");
      return;
    }

    const tenantPayload = withSchoolTenantMarkers({
      name: cleanedName,
      schoolName: cleanedName,
      schoolNameAr: cleanedName,
      enabled: newTenantEnabled,
      governorate: governorateForWrite || undefined,
      tenantGovernorate: governorateForWrite || undefined,
      regionAr: governorateForWrite || undefined,
      governorateAr: governorateForWrite || undefined,
      scopeGovernorate: governorateForWrite || undefined,
      createdBy: String(user?.email || "").trim().toLowerCase(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const configPayload = withSchoolTenantMarkers({
      schoolName: cleanedName,
      schoolNameAr: cleanedName,
      centerName: cleanedName,
      tenantName: cleanedName,
      enabled: newTenantEnabled,
      governorate: governorateForWrite || undefined,
      tenantGovernorate: governorateForWrite || undefined,
      regionAr: governorateForWrite || undefined,
      governorateAr: governorateForWrite || undefined,
      scopeGovernorate: governorateForWrite || undefined,
      createdBy: String(user?.email || "").trim().toLowerCase(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      let finalTenantId = cleanedTenantId;

      // نحاول أولاً استخدام خدمة النظام القديمة، لكن لا نسمح لفشلها بكسر إنشاء المدرسة
      // لمشرف المحافظة؛ لأن الخدمة قد تكتب في مسارات لا تسمح بها القواعد الحالية.
      try {
        const result = await createTenantForScope({
          tenantId: cleanedTenantId,
          name: cleanedName,
          enabled: newTenantEnabled,
          canSeeAllGovs,
          myGov: governorateForWrite,
        });
        finalTenantId = String(result?.tenantId || cleanedTenantId).trim();
      } catch (serviceError: any) {
        const message = String(serviceError?.message || "");
        if (message === "TENANT_EXISTS") {
          alert("Tenant ID مستخدم بالفعل. اختر Tenant ID جديد.");
          return;
        }
        if (message === "MISSING_GOVERNORATE") {
          alert("حساب السوبر غير مرتبط بمحافظة.");
          return;
        }
        console.warn("تعذر إنشاء المدرسة عبر createTenantForScope، سيتم استخدام الحفظ المباشر.", serviceError);
      }

      await setDoc(doc(db, "tenants", finalTenantId), tenantPayload, { merge: true });

      await setDoc(
        doc(db, "tenants", finalTenantId, "meta", "config"),
        configPayload,
        { merge: true },
      );

      setNewTenantName("");
      setNewTenantId("");
      setNewTenantEnabled(true);
      setSelectedTenantId(finalTenantId);
      setTenants((prev) => {
        const exists = prev.some((tenant) => String(tenant.id || "").trim() === finalTenantId);
        const nextTenant = {
          id: finalTenantId,
          name: cleanedName,
          enabled: newTenantEnabled,
          governorate: governorateForWrite,
          tenantGovernorate: governorateForWrite,
          regionAr: governorateForWrite,
          tenantType: "school",
          type: "school",
          entityType: "school",
          isExamCenter: false,
          isDiplomaCenter: false,
        } as any;
        if (exists) {
          return prev.map((tenant) =>
            String(tenant.id || "").trim() === finalTenantId
              ? { ...tenant, ...nextTenant }
              : tenant,
          );
        }
        return [nextTenant, ...prev];
      });
      setEditReloadTick((x: number) => x + 1);
      alert("تم إنشاء المدرسة بنجاح ✅");
    } catch (e: any) {
      console.error(e);
      alert(getActionErrorMessage(e, "تعذر إنشاء المدرسة. تأكد من صلاحيات إنشاء tenants داخل نفس المحافظة ثم جرّب مرة أخرى."));
    }
  };

  const commitSaveSelectedTenant = async (tenantId: string, name: string) => {
    setEditBusy(true);
    try {
      const currentTenant = tenants.find((t) => String(t.id || "").trim() === String(tenantId || "").trim());
      const tenantGovernorateValue = isRegionalSuper ? String(myGov || "").trim() : getGovernorateValue(currentTenant, selectedTenant, myGov);

      // بعض قواعد Firestore القديمة تمنع خدمة الحفظ العامة لمشرف المحافظة.
      // لذلك لا نجعل فشلها يمنع الحفظ المباشر داخل tenant/meta/config.
      try {
        await saveTenantForScope({
          tenantId,
          name,
          enabled: editTenantEnabled,
          wilayatAr: editWilayatAr,
          logoUrl: editLogoUrl,
          canSeeAllGovs,
          myGov,
        });
      } catch (scopeSaveError) {
        console.warn("تعذر تنفيذ saveTenantForScope، سيتم استكمال الحفظ المباشر.", scopeSaveError);
      }

      await setDoc(
        doc(db, "tenants", tenantId),
        withSchoolTenantMarkers({
          name,
          governorate: tenantGovernorateValue,
          tenantGovernorate: tenantGovernorateValue,
          regionAr: tenantGovernorateValue,
          governorateAr: tenantGovernorateValue,
          scopeGovernorate: tenantGovernorateValue,
        }),
        { merge: true },
      );

      await setDoc(
        doc(db, "tenants", tenantId, "meta", "config"),
        withSchoolTenantMarkers({
          schoolName: name,
          schoolNameAr: name,
          enabled: editTenantEnabled,
          wilayat: editWilayatAr,
          wilayatAr: editWilayatAr,
          logoUrl: editLogoUrl,
          governorate: tenantGovernorateValue,
          tenantGovernorate: tenantGovernorateValue,
          regionAr: tenantGovernorateValue,
          governorateAr: tenantGovernorateValue,
          scopeGovernorate: tenantGovernorateValue,
        }),
        { merge: true },
      );

      setOriginalEditTenantName(name);
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === tenantId
            ? {
                ...tenant,
                name,
                enabled: editTenantEnabled,
              }
            : tenant,
        ),
      );

      if (linkedTenantAdminEmail) {
        setLinkedTenantAdminEmail(String(linkedTenantAdminEmail || "").trim().toLowerCase());
      }

      if (
        !String(userName || "").trim() ||
        String(userName || "").trim() === String(originalEditTenantName || "").trim()
      ) {
        setUserName(name);
      }

      setEditReloadTick((x: number) => x + 1);
      alert("تم حفظ بيانات المدرسة بنجاح.");
    } catch (e: any) {
      console.error(e);
      alert(getActionErrorMessage(e, "تعذر حفظ بيانات المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."));
    } finally {
      setEditBusy(false);
      setPendingSchoolRenameConfirm(null);
    }
  };

  const saveSelectedTenant = async () => {
    if (isMinistryViewer) {
      alert("سوبر الوزارة للمشاهدة فقط ولا يمكنه تعديل بيانات المدرسة.");
      return;
    }
    if (!selectedTenantId) {
      alert("اختر مدرسة أولاً.");
      return;
    }
    if (selectedTenant && !isSchoolTenant(selectedTenant)) {
      alert("هذه الصفحة مخصصة للمدارس فقط، ولا يمكن تعديل مركز امتحانات من هنا.");
      return;
    }

    const name = String(editTenantName || "").trim();
    if (!name) {
      alert("يرجى إدخال اسم المدرسة.");
      return;
    }

    const oldName = String(originalEditTenantName || "").trim();
    if (oldName && oldName !== name) {
      setPendingSchoolRenameConfirm({
        tenantId: selectedTenantId,
        oldName,
        newName: name,
      });
      return;
    }

    await commitSaveSelectedTenant(selectedTenantId, name);
  };

  const confirmSchoolRenameAndSave = async () => {
    if (!pendingSchoolRenameConfirm) return;
    await commitSaveSelectedTenant(
      pendingSchoolRenameConfirm.tenantId,
      pendingSchoolRenameConfirm.newName,
    );
  };

  const deleteTenant = async (tenantId: string) => {
    if (isMinistryViewer) {
      alert("سوبر الوزارة للمشاهدة فقط ولا يمكنه حذف المدارس.");
      return;
    }
    const id = String(tenantId || "").trim();
    if (!id) return;

    const tenant = tenants.find((t) => String(t.id || "").trim() === id);
    if (tenant && !isSchoolTenant(tenant)) {
      alert("هذه الصفحة مخصصة للمدارس فقط، ولا يمكن حذف مركز امتحانات من هنا.");
      return;
    }

    try {
      await archiveAndDeleteTenant({
        tenantId: id,
        deletedBy: String(user?.email || ""),
        isPlatformOwner: isOwner,
        myGov,
      });
      setTenants((prev) => prev.filter((t) => t.id !== id));
      if (selectedTenantId === id) setSelectedTenantId("");
      setPendingTenantDelete(null);
      setEditReloadTick((x: number) => x + 1);
      alert("تم حذف المدرسة بنجاح.");
    } catch (e) {
      console.error(e);
      alert(getActionErrorMessage(e, "تعذر حذف المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."));
    }
  };

  const saveTenantAdminAssignmentResilient = async (params: {
    email: string;
    enabled: boolean;
    tenantId: string;
    tenantName: string;
    tenantGovernorate: string;
    userName: string;
  }) => {
    const email = String(params.email || "").trim().toLowerCase();
    const tenantId = String(params.tenantId || "").trim();
    const tenantName = String(params.tenantName || tenantId).trim();
    const tenantGovernorate = String(params.tenantGovernorate || "").trim();
    const userNameValue = String(params.userName || "").trim();

    if (!email || !email.includes("@")) {
      throw new Error("INVALID_EMAIL");
    }
    if (!tenantId) {
      throw new Error("MISSING_TENANT");
    }

    const payload = withSchoolTenantMarkers({
      email,
      enabled: params.enabled !== false,
      role: "tenant_admin",
      scopeType: "tenant",
      tenantId,
      schoolName: tenantName,
      tenantName,
      governorate: tenantGovernorate,
      tenantGovernorate,
      userName: userNameValue,
      updatedAt: serverTimestamp(),
      updatedBy: String(user?.email || "").trim().toLowerCase(),
    });

    // المصدر الأساسي للصلاحية: allowlist.
    // هذا هو المسار الذي يقرأه النظام عند تسجيل الدخول وتحديد صلاحية أدمن المدرسة.
    await setDoc(doc(db, "allowlist", email), payload, { merge: true });

    // جدول tenantAdminLinks مساعد فقط لإظهار الربط داخل الجداول.
    // بعض قواعد Firestore لا تسمح لمشرف المحافظة بالكتابة هنا، لذلك لا نوقف عملية الربط إذا فشل هذا المسار.
    try {
      await setDoc(
        doc(db, "tenantAdminLinks", tenantId),
        {
          email,
          tenantId,
          schoolName: tenantName,
          tenantName,
          governorate: tenantGovernorate,
          tenantGovernorate,
          enabled: params.enabled !== false,
          userName: userNameValue,
          updatedAt: serverTimestamp(),
          updatedBy: String(user?.email || "").trim().toLowerCase(),
        },
        { merge: true },
      );
    } catch (linkError) {
      console.warn("تعذر تحديث tenantAdminLinks، وتم الاكتفاء بتحديث allowlist.", linkError);
    }
  };

  const saveAdminUser = async (forceReplaceExistingEmail?: boolean) => {
    if (isMinistryViewer) {
      alert("سوبر الوزارة للمشاهدة فقط ولا يمكنه إضافة أو تعديل أدمن المدرسة.");
      return;
    }

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

    if (!isSchoolTenant(tenant)) {
      alert("هذه الصفحة مخصصة لأدمن المدرسة فقط. مراكز الامتحانات تدار من صفحة سوبر الامتحانات.");
      return;
    }

    if (
      isRegionalSuper &&
      !sameGovernorate(getGovernorateValue(tenant), myGov)
    ) {
      alert("لا يمكنك إضافة مستخدم لمدرسة خارج محافظتك.");
      return;
    }

    if (tenant.enabled === false) {
      alert("لا يمكن تعديل ربط الأدمن لمدرسة غير مفعلة. قم بتفعيل المدرسة أولاً.");
      return;
    }

    setSaveBusy(true);
    try {
      const normalizedEmail = String(userEmail || "").trim().toLowerCase();
      const existingByEmail = await getExistingLinkByEmail(normalizedEmail);
      if (existingByEmail && existingByEmail.tenantId !== tenantId && !forceReplaceExistingEmail) {
        setExistingEmailReplaceState({
          email: normalizedEmail,
          currentTenantId: existingByEmail.tenantId,
          currentSchoolName: existingByEmail.schoolName,
          newTenantId: tenantId,
          newSchoolName: String(tenant.name || tenantId),
        });
        return;
      }

      const existingByTenant = await getExistingLinkByTenant(tenantId);
      if (existingByTenant && existingByTenant.email !== normalizedEmail) {
        alert(
          `هذه المدرسة مرتبطة مسبقًا بالبريد الإلكتروني: ${existingByTenant.email} لمدرسة ${existingByTenant.schoolName} (Tenant ID: ${existingByTenant.tenantId}). لا يمكن ربط مدرسة واحدة بأكثر من بريد إلكتروني.`,
        );
        return;
      }

      await saveTenantAdminAssignmentResilient({
        email: normalizedEmail,
        enabled: userEnabled,
        tenantId,
        tenantName: String(tenant.name || tenantId),
        tenantGovernorate: isRegionalSuper ? String(myGov || "").trim() : getGovernorateValue(tenant, myGov),
        userName,
      });

      setExistingEmailReplaceState(null);
      setUserEmail("");
      setUserName("");
      setUserEnabled(true);
      setEditReloadTick((x: number) => x + 1);
      alert("تم حفظ المستخدم بنجاح.");
    } catch (e: any) {
      console.error(e);
      const message = String(e?.message || "");
      if (message === "INVALID_EMAIL") {
        alert("يرجى إدخال بريد صحيح.");
      } else if (message === "TENANT_DISABLED") {
        alert("لا يمكن تعديل ربط الأدمن لمدرسة غير مفعلة. قم بتفعيل المدرسة أولاً.");
      } else if (message === "DISABLED_TENANT_LINK_LOCKED") {
        alert("هذا البريد مرتبط بمدرسة غير مفعلة، ولا يمكن نقله أو إعادة ربطه حتى يتم تفعيل تلك المدرسة أولاً.");
      } else if (message === "TENANT_ALREADY_LINKED_TO_ANOTHER_EMAIL") {
        alert("هذه المدرسة مرتبطة مسبقًا بإيميل آخر، ولا يمكن ربطها بإيميل مختلف.");
      } else {
        alert(getActionErrorMessage(e, "تعذر حفظ المستخدم. تأكد من الصلاحيات ثم جرّب مرة أخرى."));
      }
    } finally {
      setSaveBusy(false);
    }
  };

  if (isMinistryViewer) {
    return (
      <MinistrySuperSystemView
        userEmail={user?.email || ""}
        governorateSupers={ministryGovernorateSupers}
        onBack={() => openSystemPage("/super")}
        onLogout={() => logout()}
        onOpenTotpReset={() => openSystemPage("/security/totp-reset")}
        onOpenGovernorate={(row) =>
          openSystemPage(`/super-system/governorate/${encodeURIComponent(row.governorate || row.id)}`)
        }
      />
    );
  }

  return (
    <>
      <div className={`super-system-page ${isMinistryViewer ? "ministry-super-page" : ""}`} dir="rtl">
        <img className="super-brand-logo" src={MINISTRY_LOGO_URL} alt="وزارة التعليم" />

        <div
          className="super-cards"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              border: "1px solid rgba(212,175,55,0.38)",
              borderRadius: 18,
              padding: 16,
              background: "rgba(255, 250, 235, 0.08)",
              boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
                borderBottom: "1px solid rgba(212,175,55,0.28)",
                paddingBottom: 10,
              }}
            >
              <div style={{ fontWeight: 1000, color: "#d4af37", fontSize: 20 }}>قائمة المدارس وأدمنات المدارس</div>
              <div style={{ color: "#f8fafc", opacity: 0.85, fontWeight: 800, fontSize: 13 }}>إدارة المدارس وربط أدمن المدرسة</div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              <button
                className="super-card"
                onClick={() => openSystemPage("/security/totp-reset")}
                style={{ borderColor: "rgba(20,120,76,0.78)", background: "linear-gradient(135deg, rgba(20,120,76,0.20), rgba(255,255,255,0.04))" }}
              >
                <div className="super-card-title">🔐 إعادة تهيئة رمز TOTP</div>
                <div className="super-card-desc">
                  {isOwner
                    ? "إدارة إعادة التهيئة لجميع الحسابات وفق الصلاحيات العليا."
                    : "إعادة تهيئة حسابات المدارس ومراكز الدبلوم داخل نطاق المحافظة فقط."}
                </div>
              </button>
              <button
                className="super-card"
                disabled={isMinistryViewer}
                onClick={() => openSystemPage(isOwner ? "/platform-super-system/add-school-admin" : "/super-system/add-school-admin")}
                style={{ borderColor: "rgba(212,175,55,0.72)", background: "linear-gradient(135deg, rgba(212,175,55,0.22), rgba(255,255,255,0.04))" }}
              >
                <div className="super-card-title">➕ إضافة أدمن مدرسة</div>
                <div className="super-card-desc">صفحة مستقلة لربط أدمن بمدرسة داخل المحافظة بدون تعديل بيانات المدرسة.</div>
              </button>

              <button
                className="super-card"
                onClick={() => openSystemPage("/programs-gateway")}
              >
                <div className="super-card-title">أدمنات المدارس في المحافظة</div>
                <div className="super-card-desc">عرض جميع أدمنات المدارس حسب المحافظة ثم فتح نظام المدرسة للمشاهدة والمتابعة.</div>
              </button>

              <button
                className="super-card"
                onClick={() =>
                  document.getElementById("section-tenants")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <div className="super-card-title">إدارة المدارس</div>
                <div className="super-card-desc">عرض وبحث المدارس داخل النطاق المسموح.</div>
              </button>

              <button
                className="super-card"
                disabled={isMinistryViewer}
                onClick={() =>
                  document.getElementById("section-create")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <div className="super-card-title">إضافة مدرسة جديدة</div>
                <div className="super-card-desc">إنشاء مدرسة داخل محافظتك.</div>
              </button>

              <button
                className="super-card"
                disabled={isMinistryViewer}
                onClick={() =>
                  document.getElementById("section-edit")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <div className="super-card-title">تعديل بيانات المدرسة</div>
                <div className="super-card-desc">تعديل اسم المدرسة والشعار والولاية داخل محافظتك.</div>
              </button>

              <button
                className="super-card"
                disabled={isMinistryViewer}
                onClick={() =>
                  document.getElementById("section-admin")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                <div className="super-card-title">إدارة أدمن المدرسة</div>
                <div className="super-card-desc">إضافة أو ربط أو حذف أدمن مدرسة داخل النطاق المسموح.</div>
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(212,175,55,0.38)",
              borderRadius: 18,
              padding: 16,
              background: "rgba(255, 250, 235, 0.08)",
              boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
                borderBottom: "1px solid rgba(212,175,55,0.28)",
                paddingBottom: 10,
              }}
            >
              <div style={{ fontWeight: 1000, color: "#d4af37", fontSize: 20 }}>قائمة مراكز الدبلوم وسوبر الامتحانات</div>
              <div style={{ color: "#f8fafc", opacity: 0.85, fontWeight: 800, fontSize: 13 }}>إدارة سوبر الامتحانات ومراكز الدبلوم</div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              <button
                className="super-card"
                disabled={isMinistryViewer}
                onClick={() => openSystemPage(isOwner ? "/platform-super-system/add-exam-super12" : "/super-system/add-exam-super12")}
                style={{ borderColor: "rgba(212,175,55,0.72)", background: "linear-gradient(135deg, rgba(212,175,55,0.22), rgba(255,255,255,0.04))" }}
              >
                <div className="super-card-title">➕ إضافة سوبر امتحانات دبلوم</div>
                <div className="super-card-desc">صفحة مستقلة لإضافة سوبر امتحانات وربطه بمركز امتحانات دبلوم داخل نطاق المحافظة.</div>
              </button>

              <button
                className="super-card"
                onClick={() => openSystemPage("/exam-supers")}
              >
                <div className="super-card-title">سوبر الامتحانات في المحافظة</div>
                <div className="super-card-desc">عرض جميع سوبر الامتحانات ضمن النطاق المسموح ثم فتح مركز الامتحانات للمشاهدة والمتابعة.</div>
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(212,175,55,0.28)",
              borderRadius: 18,
              padding: 16,
              background: "rgba(0,0,0,0.18)",
              boxShadow: "0 14px 34px rgba(0,0,0,0.14)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
                borderBottom: "1px solid rgba(212,175,55,0.2)",
                paddingBottom: 10,
              }}
            >
              <div style={{ fontWeight: 1000, color: "#d4af37", fontSize: 20 }}>قائمة البوابات والفحص والسجلات</div>
              <div style={{ color: "#f8fafc", opacity: 0.85, fontWeight: 800, fontSize: 13 }}>أدوات المتابعة والتشغيل</div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              <button className="super-card" onClick={() => openSystemPage("/programs-gateway")}>
                <div className="super-card-title">فتح البوابة التشغيلية</div>
                <div className="super-card-desc">الانتقال إلى البوابة التشغيلية لاختيار البرنامج أو القوائم الإشرافية.</div>
              </button>

              <button className="super-card" onClick={() => openSystemPage("/system/permissions-audit")}>
                <div className="super-card-title">فحص الصلاحيات والربط</div>
                <div className="super-card-desc">مراجعة المستخدمين والأدوار والمحافظة وربط المدارس ومراكز الدبلوم، مع فتح النطاق للمشاهدة فقط عند مشرف المحافظة.</div>
              </button>

              <button className="super-card" onClick={() => openSystemPage("/system/commercial-readiness")}>
                <div className="super-card-title">لوحة الجاهزية التجارية</div>
                <div className="super-card-desc">مراجعة حالة الصلاحيات، السحابة، المشاهدة فقط، النسخ الاحتياطي، وروابط الفحص قبل التشغيل التجاري.</div>
              </button>

              <button className="super-card" onClick={() => openSystemPage("/system/audit-log")}>
                <div className="super-card-title">سجل العمليات</div>
                <div className="super-card-desc">متابعة إجراءات الحفظ والحذف والاستيراد والتوزيع والاستعادة أثناء الاختبار والتشغيل التجاري.</div>
              </button>
            </div>
          </div>
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
              ? "أنت مالك المنصة، ويمكنك من هذه الشاشة إدارة المحافظات والسوبرات والمدارس والمستخدمين والدخول إلى جميع البيانات حسب الصلاحيات العليا."
              : isMinistryViewer
                ? "أنت سوبر الوزارة، وصلاحيتك هنا مشاهدة المحافظات والمدارس فقط بدون إضافة أو تعديل أو حذف، وبدون دخول إلى البيانات الداخلية للمدارس."
                : "أنت سوبر المحافظات، ويمكنك إدارة المدارس وأدمنات المدارس داخل محافظتك فقط، بدون دخول إلى البيانات الداخلية للمدرسة."}
          </div>
        </div>

        <div className="super-grid">
          <div className="super-panel" id="section-tenants">
            <div className="super-panel-title">إدارة المدارس (Tenants)</div>
            <div style={{ marginBottom: 10 }}>
              <input
                className="input"
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="tenant-list">
              {visibleTenants.map((t) => (
                <div key={t.id} className={`tenant-row ${selectedTenantId === t.id ? "active" : ""}`}>
                  <button
                    className="icon-btn"
                    title="حذف"
                    onClick={() =>
                      setPendingTenantDelete({
                        tenantId: String(t.id || "").trim(),
                        tenantName: String(t.name || t.id || "").trim(),
                      })
                    }
                    disabled={isMinistryViewer}
                  >
                    🗑️
                  </button>
                  <button className="icon-btn" title="اختيار" onClick={() => setSelectedTenantId(t.id)}>
                    📁
                  </button>
                  <div className="tenant-meta" onClick={() => setSelectedTenantId(t.id)}>
                    <div className="tenant-name">{t.name || t.id}</div>
                    <div className="tenant-id">{t.id}</div>
                    <div className="tenant-id" style={{ opacity: 0.8 }}>
                      {getGovernorateValue(t) ? `المحافظة: ${getGovernorateValue(t)}` : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      marginInlineStart: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ opacity: 0.9 }}>{t.enabled ? "مفعل" : "غير مفعل"}</span>
                    <input type="checkbox" checked={t.enabled !== false} readOnly />
                  </div>
                </div>
              ))}
              {!visibleTenants.length ? <div style={{ padding: 12, opacity: 0.8 }}>لا توجد مدارس.</div> : null}
            </div>
          </div>

          <div className="super-panel" id="section-edit">
            <div className="super-panel-title">تعديل بيانات المدرسة المختارة</div>
            {!selectedTenantId ? (
              <div style={{ padding: 12, opacity: 0.85 }}>اختر مدرسة من القائمة أولاً.</div>
            ) : (
              <div className="form-grid">
                <label className="label">Tenant ID</label>
                <input className="input" value={selectedTenantId} readOnly />

                <label className="label">الإيميل المرتبط بالمدرسة</label>
              <input
                className="input"
                value={linkedTenantAdminEmail}
                readOnly
                placeholder="لا يوجد ربط حالياً"
              />

              <label className="label">اسم المدرسة</label>
                <input
                  className="input"
                  value={editTenantName}
                  onChange={(e) => setEditTenantName(e.target.value)}
                  disabled={isMinistryViewer}
                />

                <label className="label">الحالة</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={editTenantEnabled !== false}
                    onChange={(e) => setEditTenantEnabled(e.target.checked)}
                    disabled={isMinistryViewer}
                  />
                  <span style={{ opacity: 0.9 }}>{editTenantEnabled ? "مفعل" : "غير مفعل"}</span>
                </div>

                <label className="label">الولاية</label>
                <input
                  className="input"
                  value={editWilayatAr}
                  onChange={(e) => setEditWilayatAr(e.target.value)}
                  disabled={isMinistryViewer}
                  placeholder="مثال: بوشر"
                />

                <label className="label">رابط الشعار</label>
                <input
                  className="input"
                  value={editLogoUrl}
                  onChange={(e) => setEditLogoUrl(e.target.value)}
                  disabled={isMinistryViewer}
                  placeholder={MINISTRY_LOGO_URL}
                />

                <div />
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button className="btn" disabled={editBusy || isMinistryViewer} onClick={() => void saveSelectedTenant()}>
                    {editBusy ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={editBusy}
                    onClick={() => setEditReloadTick((x: number) => x + 1)}
                    title="إعادة تحميل البيانات"
                  >
                    تحديث
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="super-panel" id="section-create">
            <div className="super-panel-title">إنشاء مدرسة جديدة (Tenant)</div>
            <div className="form-grid">
              <label className="label">اسم المدرسة</label>
              <input
                className="input"
                value={newTenantName}
                onChange={(e) => setNewTenantName(e.target.value)}
                disabled={isMinistryViewer}
                placeholder="مثال: أزان 12-9"
              />

              <label className="label">Tenant ID (Subdomain)</label>
              <input
                className="input"
                value={newTenantId}
                onChange={(e) => setNewTenantId(safeId(e.target.value))}
                disabled={isMinistryViewer}
                placeholder="مثال: azaan-9-12"
              />

              <div />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="label">مفعل</span>
                <input
                  type="checkbox"
                  checked={newTenantEnabled}
                  onChange={(e) => setNewTenantEnabled(e.target.checked)}
                  disabled={isMinistryViewer}
                />
              </div>

              <div />
              <button className="btn primary" onClick={() => void createTenant()} disabled={isMinistryViewer}>
                إنشاء مدرسة جديدة
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.9 }}>
              {isOwner ? (
                <div>مالك المنصة يمكنه إنشاء مدارس لأي محافظة.</div>
              ) : isMinistryViewer ? (
                <div>سوبر الوزارة للمشاهدة فقط، ولا يمكنه إنشاء المدارس أو تعديلها أو حذفها.</div>
              ) : (
                <div>
                  سيتم تثبيت محافظة المدرسة تلقائيًا على: <b>{myGov || "غير محددة"}</b>
                </div>
              )}
            </div>
          </div>

          <div className="super-panel" id="section-admin">
            <div className="super-panel-title">إدارة أدمن المدرسة</div>

            <div style={{ marginBottom: 10, opacity: 0.85 }}>
              المدرسة المحددة: <b>{selectedTenant?.name || selectedTenantId || "—"}</b>
            </div>
            {isMinistryViewer ? (
              <div style={{ marginBottom: 10, opacity: 0.82, color: "#fbbf24" }}>
                هذه الصفحة في وضع مشاهدة فقط لسوبر الوزارة.
              </div>
            ) : null}

            <div className="form-grid">
              <label className="label">البريد الإلكتروني (مفتاح الوثيقة)</label>
              <input
                className="input"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                disabled={isMinistryViewer}
                placeholder="name@example.com"
              />

              <label className="label">الاسم (اختياري)</label>
              <input
                className="input"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={isMinistryViewer}
                placeholder="اسم المستخدم"
              />

              <div />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="label">مفعل</span>
                <input
                  type="checkbox"
                  checked={userEnabled}
                  onChange={(e) => setUserEnabled(e.target.checked)}
                  disabled={isMinistryViewer}
                />
              </div>

              <div />
              <button className="btn primary" onClick={() => void saveAdminUser()} disabled={saveBusy || isMinistryViewer}>
                {saveBusy ? "جارٍ الحفظ..." : "حفظ المستخدم"}
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.9 }}>
              <div>
                ملاحظة: هذه الصفحة تسمح لسوبر المحافظات أو مالك المنصة بإضافة <b>أدمن المدرسة</b> فقط، بينما سوبر الوزارة للمشاهدة فقط.
              </div>
              <div>
                لا يمكن ربط نفس البريد الإلكتروني بأكثر من مدرسة، ولا يمكن ربط المدرسة نفسها بأكثر من بريد إلكتروني.
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                border: "1px solid rgba(212,175,55,0.22)",
                borderRadius: 14,
                padding: 14,
                background: "rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 900, color: "#d4af37" }}>جدول ربط المدارس مع الأدمن</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ opacity: 0.85 }}>
                    {tenantAdminBusy ? "جارٍ التحديث..." : `عدد السجلات: ${tenantAdminRows.length}`}
                  </span>

                  <button
                    className="btn btn-ghost"
                    onClick={() => excelInputRef.current?.click()}
                    disabled={importBusy || isMinistryViewer}
                  >
                    {importBusy ? "جارٍ الاستيراد..." : "استيراد Excel"}
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={() => setEditReloadTick((x: number) => x + 1)}
                    disabled={tenantAdminBusy}
                  >
                    تحديث الجدول
                  </button>

                  <button className="btn primary" onClick={exportTenantAdminLinksToExcel} disabled={!tenantAdminRows.length}>
                    تصدير Excel
                  </button>

                  {isOwner ? (
                    <button className="btn" onClick={() => void runAllowlistMigration()} disabled={migrationBusy}>
                      {migrationBusy ? "جارٍ التنظيف..." : "تنظيف الروابط القديمة"}
                    </button>
                  ) : null}
                </div>
              </div>

              <input
                ref={excelInputRef}
                type="file"
                accept=".csv,.txt,.xls,.xlsx"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void importTenantAdminLinksFromExcel(file);
                  }
                }}
              />

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 860,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <thead>
                    <tr style={{ background: "rgba(212,175,55,0.14)" }}>
                      <th style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)", textAlign: "right" }}>
                        Tenant ID
                      </th>
                      <th style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)", textAlign: "right" }}>
                        اسم المدرسة
                      </th>
                      <th style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)", textAlign: "right" }}>
                        البريد الإلكتروني المرتبط
                      </th>
                      <th
                        style={{
                          padding: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          textAlign: "center",
                          width: 120,
                        }}
                      >
                        إجراء
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {tenantAdminRows.length ? (
                      tenantAdminRows.map((row, idx) => (
                        <tr key={`${row.tenantId}-${row.email}-${idx}`}>
                          <td style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)" }}>{row.tenantId}</td>
                          <td style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)" }}>{row.tenantName}</td>
                          <td style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)" }}>{row.email}</td>
                          <td
                            style={{
                              padding: 10,
                              border: "1px solid rgba(255,255,255,0.08)",
                              textAlign: "center",
                            }}
                          >
                            <button
                              className="btn danger"
                              onClick={() => setPendingAdminLinkDelete(row)}
                              disabled={isMinistryViewer}
                            >
                              حذف الربط
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            padding: 14,
                            border: "1px solid rgba(255,255,255,0.08)",
                            textAlign: "center",
                            opacity: 0.8,
                          }}
                        >
                          لا توجد بيانات ربط حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 10, opacity: 0.78, lineHeight: 1.9 }}>
                صيغة الاستيراد المقترحة: Tenant ID ، اسم المدرسة ، البريد الإلكتروني المرتبط
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingTenantDelete}
        title="تأكيد طلب الحذف"
        confirmVariant="danger"
        message={
          pendingTenantDelete ? (
            <div className="owner-delete-modal-readable">
                هل تريد الحذف؟
              <div style={{ marginTop: 10, opacity: 0.9 }}>
                المدرسة: <b>{pendingTenantDelete.tenantName || pendingTenantDelete.tenantId}</b>
              </div>
              <div style={{ opacity: 0.8 }}>Tenant ID: {pendingTenantDelete.tenantId}</div>
            </div>
          ) : null
        }
        onConfirm={() => {
          if (pendingTenantDelete) {
            void deleteTenant(pendingTenantDelete.tenantId);
          }
        }}
        onClose={() => setPendingTenantDelete(null)}
      />

      <ConfirmModal
        open={!!pendingAdminLinkDelete}
        title="تأكيد حذف الربط"
        confirmVariant="danger"
        message={
          pendingAdminLinkDelete ? (
            <div>
              هل تريد الحذف؟
              <div style={{ marginTop: 10, opacity: 0.9 }}>
                المدرسة: <b>{pendingAdminLinkDelete.tenantName || pendingAdminLinkDelete.tenantId}</b>
              </div>
              <div style={{ opacity: 0.8 }}>Tenant ID: {pendingAdminLinkDelete.tenantId}</div>
              <div style={{ opacity: 0.8 }}>البريد الإلكتروني: {pendingAdminLinkDelete.email}</div>
            </div>
          ) : null
        }
        onConfirm={() => {
          if (pendingAdminLinkDelete) {
            void deleteTenantAdminLink(pendingAdminLinkDelete);
          }
        }}
        onClose={() => setPendingAdminLinkDelete(null)}
      />

      <ConfirmModal
        open={!!pendingSchoolRenameConfirm}
        title="تأكيد تغيير اسم المدرسة"
        confirmVariant="primary"
        busy={editBusy}
        message={
          pendingSchoolRenameConfirm ? (
            <div>
              <div>هل تريد تغير الاسم من اسم "{pendingSchoolRenameConfirm.oldName}" إلى الاسم الجديد "{pendingSchoolRenameConfirm.newName}"؟</div>
            </div>
          ) : null
        }
        onConfirm={() => {
          void confirmSchoolRenameAndSave();
        }}
        onClose={() => {
          if (!editBusy) {
            setPendingSchoolRenameConfirm(null);
          }
        }}
      />

      <ConfirmModal
        open={!!existingEmailReplaceState}
        title="البريد الإلكتروني مرتبط مسبقًا"
        confirmVariant="primary"
        busy={saveBusy}
        message={
          existingEmailReplaceState ? (
            <div>
              <div>هذا البريد الإلكتروني مرتبط مسبقًا بمدرسة أخرى.</div>
              <div style={{ marginTop: 10 }}>هل تريد استبدال المدرسة؟</div>
              <div style={{ marginTop: 14, opacity: 0.92 }}>
                البريد الإلكتروني: <b>{existingEmailReplaceState.email}</b>
              </div>
              <div style={{ marginTop: 8, opacity: 0.92 }}>
                المدرسة الحالية: <b>{existingEmailReplaceState.currentSchoolName}</b>
              </div>
              <div style={{ opacity: 0.8 }}>Tenant ID الحالي: {existingEmailReplaceState.currentTenantId}</div>
              <div style={{ marginTop: 12, opacity: 0.92 }}>
                المدرسة الجديدة: <b>{existingEmailReplaceState.newSchoolName}</b>
              </div>
              <div style={{ opacity: 0.8 }}>Tenant ID الجديد: {existingEmailReplaceState.newTenantId}</div>
            </div>
          ) : null
        }
        onConfirm={() => {
          void saveAdminUser(true);
        }}
        onClose={() => {
          if (!saveBusy) {
            setExistingEmailReplaceState(null);
          }
        }}
      />
    </>
  );
}