import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";
const GOLD = "#168a4b";
const BG = "linear-gradient(135deg, #fff2d7 0%, #e4f1ff 100%)";
const CARD = "rgba(255,255,255,0.94)";

type AuditRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  governorate: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
  enabled: boolean;
  source: string;
  scopeStatus: "inside" | "outside" | "unknown";
};

type TenantInfo = {
  id: string;
  name: string;
  governorate: string;
  tenantType: string;
};

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sameGovernorate(a: unknown, b: unknown) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function getRole(auth: any) {
  return String(
    auth?.effectiveRole ||
      auth?.allow?.role ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getGovernorateFromAny(...items: any[]) {
  for (const item of items) {
    if (!item) continue;
    const value =
      typeof item === "string"
        ? item
        : item?.governorate ??
          item?.tenantGovernorate ??
          item?.regionAr ??
          item?.governorateAr ??
          item?.scopeGovernorate ??
          item?.gov ??
          "";
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function getNameFromAny(...items: any[]) {
  for (const item of items) {
    if (!item) continue;
    const value =
      item?.name ??
      item?.userName ??
      item?.displayName ??
      item?.schoolName ??
      item?.schoolNameAr ??
      item?.centerNameAr ??
      "";
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function getTenantName(data: any) {
  return String(
    data?.schoolNameAr ||
      data?.centerNameAr ||
      data?.schoolName ||
      data?.name ||
      data?.tenantName ||
      ""
  ).trim();
}

function getTenantType(data: any) {
  const raw = String(
    data?.tenantType ||
      data?.type ||
      data?.entityType ||
      data?.kind ||
      ""
  )
    .trim()
    .toLowerCase();

  if (
    data?.isExamCenter === true ||
    data?.isDiplomaCenter === true ||
    ["exam_center", "exam-center", "diploma_center", "diploma-center"].includes(raw)
  ) {
    return "exam_center";
  }
  if (raw) return raw;
  return "school";
}


const GOVERNORATE_FIELD_CANDIDATES = [
  "governorate",
  "tenantGovernorate",
  "regionAr",
  "governorateAr",
  "scopeGovernorate",
  "gov",
];

const FIRESTORE_IN_LIMIT = 30;

function chunkArray<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isOwnerRole(role: string) {
  return ["super_admin", "platform_owner", "owner", "مالك المنصة"].includes(role);
}

function isGovernorateSuperRole(role: string) {
  return ["super", "governorate_super", "governorate-super", "سوبر المحافظة", "مشرف المحافظة"].includes(role);
}

function isExamRole(role: string, tenant?: TenantInfo) {
  const r = normalizeText(role);
  return (
    tenant?.tenantType === "exam_center" ||
    [
      "exam_super",
      "exam-center-admin",
      "exam_center_admin",
      "diploma_center_admin",
      "diploma_super",
      "center_admin",
      "control_admin",
      "distribution_super",
      "سوبر الامتحانات",
      "مسؤول مركز الدبلوم",
    ].some((x) => normalizeText(x) === r)
  );
}

function roleLabel(role: string) {
  const r = normalizeText(role);
  if (["super_admin", "platform_owner", "owner"].includes(r)) return "مالك المنصة";
  if (["ministry_super", "ministry-super", "مشرف الوزارة"].includes(r)) return "مشرف الوزارة";
  if (["super", "governorate_super", "governorate-super", "سوبر المحافظة", "مشرف المحافظة"].includes(r)) return "مشرف المحافظة";
  if (["exam_super", "سوبر الامتحانات"].includes(r)) return "سوبر الامتحانات";
  if (["exam_center_admin", "diploma_center_admin", "center_admin", "control_admin", "distribution_super"].includes(r)) return "مسؤول مركز دبلوم";
  if (["school_admin", "school-admin", "tenant_admin", "admin", "أدمن المدرسة", "ادمن المدرسة", "مدير المدرسة"].includes(r)) return "أدمن مدرسة";
  return role || "مستخدم";
}

function setReadOnlyView(tenantId: string) {
  const expiresAt = String(Date.now() + 6 * 60 * 60 * 1000);
  const entries: Array<[string, string]> = [
    ["governorateSuperReadOnly", "true"],
    ["viewAsReadOnly", "true"],
    ["readOnly", "true"],
    ["governorateSuperViewTenantId", tenantId],
    ["viewAsTenantId", tenantId],
    ["effectiveTenantId", tenantId],
    ["selectedTenantId", tenantId],
    ["governorateSuperViewExpiresAt", expiresAt],
  ];

  for (const [key, value] of entries) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function clearReadOnlyView() {
  const keys = [
    "governorateSuperReadOnly",
    "viewAsReadOnly",
    "readOnly",
    "governorateSuperViewTenantId",
    "viewAsTenantId",
    "governorateSuperViewExpiresAt",
  ];
  for (const key of keys) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export default function PermissionsAudit() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const role = getRole(auth);
  const isOwner = isOwnerRole(role);
  const isGovSuper = isGovernorateSuperRole(role);
  const currentGovernorate = getGovernorateFromAny(auth?.allow, auth?.profile, auth?.userProfile, auth?.authzSnapshot);

  const [tenants, setTenants] = useState<Record<string, TenantInfo>>({});
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrors([]);
      const nextErrors: string[] = [];
      const tenantMap: Record<string, TenantInfo> = {};
      const auditRows: AuditRow[] = [];

      try {
        const tenantDocs = new Map<string, any>();

        if (isOwner || !currentGovernorate) {
          const tenantSnap = await getDocs(collection(db, "tenants"));
          tenantSnap.forEach((docSnap) => tenantDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
        } else {
          let successCount = 0;

          for (const fieldName of GOVERNORATE_FIELD_CANDIDATES) {
            try {
              const tenantSnap = await getDocs(query(collection(db, "tenants"), where(fieldName, "==", currentGovernorate)));
              tenantSnap.forEach((docSnap) => tenantDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
              successCount += 1;
            } catch {
              // بعض الحقول قد لا تكون مستخدمة في قاعدة البيانات؛ نكمل باقي الحقول.
            }
          }

          if (successCount === 0) {
            throw new Error("لم تنجح أي قراءة مفلترة بالمحافظة من مجموعة tenants");
          }
        }

        tenantDocs.forEach((entry) => {
          const data = entry.data as any;
          const gov = getGovernorateFromAny(data);
          if (!isOwner && currentGovernorate && !sameGovernorate(gov, currentGovernorate)) return;
          tenantMap[entry.id] = {
            id: entry.id,
            name: getTenantName(data) || entry.id,
            governorate: gov,
            tenantType: getTenantType(data),
          };
        });
      } catch (e: any) {
        nextErrors.push(`تعذر قراءة قائمة المدارس والمراكز: ${e?.message || e}`);
      }

      try {
        const allowDocs = new Map<string, any>();

        if (isOwner || !currentGovernorate) {
          const allowSnap = await getDocs(collection(db, "allowlist"));
          allowSnap.forEach((docSnap) => allowDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
        } else {
          for (const fieldName of GOVERNORATE_FIELD_CANDIDATES) {
            try {
              const allowSnap = await getDocs(query(collection(db, "allowlist"), where(fieldName, "==", currentGovernorate)));
              allowSnap.forEach((docSnap) => allowDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // نكمل باقي حقول المحافظة.
            }
          }

          const tenantIds = Object.keys(tenantMap).filter(Boolean);
          for (const tenantIdChunk of chunkArray(tenantIds, FIRESTORE_IN_LIMIT)) {
            if (!tenantIdChunk.length) continue;
            try {
              const allowSnap = await getDocs(query(collection(db, "allowlist"), where("tenantId", "in", tenantIdChunk)));
              allowSnap.forEach((docSnap) => allowDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // بعض قواعد البيانات القديمة قد لا تحتوي tenantId في كل السجلات.
            }
          }
        }

        allowDocs.forEach((entry) => {
          const data = entry.data as any;
          const tenantId = String(data?.tenantId || data?.effectiveTenantId || "").trim();
          const tenant = tenantMap[tenantId];
          const gov = getGovernorateFromAny(data, tenant);
          if (!isOwner && currentGovernorate && !sameGovernorate(gov, currentGovernorate)) return;
          const rowRole = String(data?.role || "").trim();
          auditRows.push({
            id: `allowlist:${entry.id}`,
            email: String(data?.email || entry.id || "").trim(),
            name: getNameFromAny(data) || String(data?.email || entry.id || "").split("@")[0],
            role: rowRole,
            roleLabel: roleLabel(rowRole),
            governorate: gov,
            tenantId,
            tenantName: tenant?.name || String(data?.schoolName || data?.tenantName || "").trim(),
            tenantType: tenant?.tenantType || getTenantType(data),
            enabled: data?.enabled !== false,
            source: "allowlist",
            scopeStatus: !currentGovernorate ? "unknown" : sameGovernorate(gov, currentGovernorate) ? "inside" : "outside",
          });
        });
      } catch (e: any) {
        nextErrors.push(`تعذر قراءة صلاحيات allowlist. غالبًا تحتاج نشر قواعد Firestore المرفقة مع هذه المرحلة: ${e?.message || e}`);
      }

      try {
        const extraDocs = new Map<string, any>();

        if (isOwner || !currentGovernorate) {
          const extraSnap = await getDocs(collection(db, "governorateExamSupers"));
          extraSnap.forEach((docSnap) => extraDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
        } else {
          for (const fieldName of GOVERNORATE_FIELD_CANDIDATES) {
            try {
              const extraSnap = await getDocs(query(collection(db, "governorateExamSupers"), where(fieldName, "==", currentGovernorate)));
              extraSnap.forEach((docSnap) => extraDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // نكمل باقي حقول المحافظة.
            }
          }

          const tenantIds = Object.keys(tenantMap).filter(Boolean);
          for (const tenantIdChunk of chunkArray(tenantIds, FIRESTORE_IN_LIMIT)) {
            if (!tenantIdChunk.length) continue;
            try {
              const extraSnap = await getDocs(query(collection(db, "governorateExamSupers"), where("tenantId", "in", tenantIdChunk)));
              extraSnap.forEach((docSnap) => extraDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // نكمل بدون إيقاف الصفحة.
            }
          }
        }

        extraDocs.forEach((entry) => {
          const data = entry.data as any;
          const tenantId = String(data?.tenantId || "").trim();
          const tenant = tenantMap[tenantId];
          const gov = getGovernorateFromAny(data, tenant);
          if (!isOwner && currentGovernorate && !sameGovernorate(gov, currentGovernorate)) return;
          const email = String(data?.email || entry.id || "").trim();
          if (auditRows.some((r) => normalizeText(r.email) === normalizeText(email) && normalizeText(r.tenantId) === normalizeText(tenantId))) return;
          auditRows.push({
            id: `governorateExamSupers:${entry.id}`,
            email,
            name: getNameFromAny(data) || email.split("@")[0],
            role: "exam_super",
            roleLabel: "سوبر الامتحانات",
            governorate: gov,
            tenantId,
            tenantName: tenant?.name || String(data?.centerName || data?.schoolName || "").trim(),
            tenantType: "exam_center",
            enabled: data?.enabled !== false,
            source: "governorateExamSupers",
            scopeStatus: !currentGovernorate ? "unknown" : sameGovernorate(gov, currentGovernorate) ? "inside" : "outside",
          });
        });
      } catch (e: any) {
        nextErrors.push(`تعذر قراءة قائمة سوبر الامتحانات الثانوية: ${e?.message || e}`);
      }

      if (mounted) {
        setTenants(tenantMap);
        setRows(auditRows.sort((a, b) => a.roleLabel.localeCompare(b.roleLabel, "ar") || a.email.localeCompare(b.email)));
        setErrors(nextErrors);
        setLoading(false);
      }
    }

    if (isOwner || isGovSuper) void load();
    else setLoading(false);

    return () => {
      mounted = false;
    };
  }, [isOwner, isGovSuper, currentGovernorate]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return rows.filter((row) => {
      if (filter !== "all") {
        if (filter === "enabled" && !row.enabled) return false;
        if (filter === "disabled" && row.enabled) return false;
        if (filter === "school" && row.tenantType === "exam_center") return false;
        if (filter === "exam" && row.tenantType !== "exam_center") return false;
        if (filter === "outside" && row.scopeStatus !== "outside") return false;
      }
      if (!q) return true;
      return [row.email, row.name, row.roleLabel, row.governorate, row.tenantId, row.tenantName]
        .map(normalizeText)
        .some((x) => x.includes(q));
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const enabled = rows.filter((r) => r.enabled).length;
    const ministrySupers = rows.filter((r) => ["ministry_super", "ministry-super", "مشرف الوزارة"].includes(normalizeText(r.role))).length;
    const governorateSupers = rows.filter((r) => isGovernorateSuperRole(normalizeText(r.role))).length;
    const schoolAdmins = rows.filter((r) => ["school_admin", "school-admin", "tenant_admin", "admin", "أدمن المدرسة", "ادمن المدرسة", "مدير المدرسة"].includes(normalizeText(r.role))).length;
    const examSupers = rows.filter((r) => ["exam_super", "سوبر الامتحانات", "مشرف امتحانات الدبلوم"].includes(normalizeText(r.role))).length;
    return { total: rows.length, enabled, ministrySupers, governorateSupers, schoolAdmins, examSupers };
  }, [rows]);

  const openTenant = (row: AuditRow) => {
    if (!row.tenantId) return;
    const tenant = tenants[row.tenantId];
    const route = isExamRole(row.role, tenant) || row.tenantType === "exam_center" ? `/t/${row.tenantId}/dashboard12` : `/t/${row.tenantId}`;

    if (isGovSuper) setReadOnlyView(row.tenantId);
    else clearReadOnlyView();

    navigate(route);
  };

  if (!isOwner && !isGovSuper) {
    return (
      <div dir="rtl" className="permissions-audit-page" style={shellStyle}>
        <AuditReadableCss />
      {/* PERMISSIONS_AUDIT_CREATIVE_TABLE_START */}
      <style>{`
        .permissions-audit-page table {
          width: 100% !important;
          border-collapse: separate !important;
          border-spacing: 0 12px !important;
          min-width: 1080px !important;
        }

        .permissions-audit-page thead th {
          padding: 15px 16px !important;
          background:
            linear-gradient(
              180deg,
              #159557 0%,
              #0f7a46 100%
            ) !important;
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 1000 !important;
          text-align: center !important;
          border-top: 1px solid rgba(255,255,255,.20) !important;
          border-bottom: 3px solid #086239 !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.18) !important;
          white-space: nowrap !important;
        }

        .permissions-audit-page thead th:first-child {
          border-radius: 0 16px 16px 0 !important;
        }

        .permissions-audit-page thead th:last-child {
          border-radius: 16px 0 0 16px !important;
        }

        .permissions-audit-page tbody tr {
          transition:
            transform .18s ease,
            filter .18s ease !important;
          filter:
            drop-shadow(
              0 7px 12px rgba(15,23,42,.055)
            );
        }

        .permissions-audit-page tbody tr:hover {
          transform: translateY(-2px);
          filter:
            drop-shadow(
              0 12px 18px rgba(15,23,42,.11)
            );
        }

        .permissions-audit-page tbody td {
          padding: 15px 16px !important;
          background:
            rgba(255,255,255,.94) !important;
          border-top:
            1px solid rgba(148,163,184,.20) !important;
          border-bottom:
            1px solid rgba(148,163,184,.20) !important;
          text-align: center !important;
          vertical-align: middle !important;
          transition:
            background .18s ease,
            border-color .18s ease !important;
        }

        .permissions-audit-page tbody tr:nth-child(even) td {
          background:
            rgba(246,252,249,.96) !important;
        }

        .permissions-audit-page tbody tr:hover td {
          background:
            linear-gradient(
              180deg,
              #ffffff 0%,
              #effaf4 100%
            ) !important;
          border-color:
            rgba(22,163,74,.30) !important;
        }

        .permissions-audit-page tbody td:first-child {
          border-right:
            1px solid rgba(148,163,184,.20) !important;
          border-radius:
            0 18px 18px 0 !important;
        }

        .permissions-audit-page tbody td:last-child {
          border-left:
            1px solid rgba(148,163,184,.20) !important;
          border-radius:
            18px 0 0 18px !important;
        }

        .permissions-audit-page tbody td:nth-child(1) {
          min-width: 245px;
          font-weight: 1000 !important;
          color: #0f172a !important;
        }

        .permissions-audit-page tbody td:nth-child(2) {
          min-width: 155px;
          color: #17345f !important;
        }

        .permissions-audit-page tbody td:nth-child(3) {
          min-width: 130px;
          font-weight: 900 !important;
          color: #0f5132 !important;
        }

        .permissions-audit-page tbody td:nth-child(4) {
          min-width: 230px;
          font-weight: 850 !important;
          color: #334155 !important;
        }

        .permissions-audit-page tbody td:nth-child(5) {
          min-width: 125px;
        }

        .permissions-audit-page tbody td:nth-child(6) {
          min-width: 100px;
        }

        .permissions-audit-page tbody td:nth-child(2) span {
          border:
            1px solid rgba(30,64,175,.15) !important;
          background:
            linear-gradient(
              180deg,
              #ffffff,
              #f1f6ff
            ) !important;
          color: #17345f !important;
          padding: 7px 13px !important;
          border-radius: 999px !important;
          box-shadow:
            0 3px 9px rgba(30,64,175,.06) !important;
        }

        .permissions-audit-page tbody td:nth-child(5) > span {
          min-width: 64px !important;
          justify-content: center !important;
          border-radius: 999px !important;
          padding: 7px 12px !important;
          box-shadow:
            0 4px 10px rgba(22,163,74,.08) !important;
        }

        .permissions-audit-page tbody td:nth-child(5) div {
          margin-top: 7px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          color: #64748b !important;
        }

        .permissions-audit-page tbody button {
          min-width: 68px !important;
          min-height: 40px !important;
          border:
            1px solid #087443 !important;
          border-bottom:
            3px solid #055c34 !important;
          border-radius: 12px !important;
          background:
            linear-gradient(
              180deg,
              #1eaa63,
              #087443
            ) !important;
          color: #ffffff !important;
          font-family: inherit !important;
          font-weight: 1000 !important;
          cursor: pointer !important;
          box-shadow:
            0 6px 13px rgba(8,116,67,.17) !important;
          transition:
            transform .16s ease,
            box-shadow .16s ease !important;
        }

        .permissions-audit-page tbody button:not(:disabled):hover {
          transform: translateY(-2px) !important;
          box-shadow:
            0 9px 18px rgba(8,116,67,.25) !important;
        }

        .permissions-audit-page tbody button:disabled {
          border:
            1px solid #cbd5e1 !important;
          border-bottom:
            3px solid #b8c3d0 !important;
          background:
            linear-gradient(
              180deg,
              #e8eef3,
              #d9e2e9
            ) !important;
          color: #82909e !important;
          box-shadow: none !important;
          cursor: not-allowed !important;
          opacity: .85 !important;
        }

        @media (max-width: 900px) {
          .permissions-audit-page table {
            min-width: 980px !important;
          }

          .permissions-audit-page thead th,
          .permissions-audit-page tbody td {
            padding:
              12px 13px !important;
          }
        }
      `}</style>
      {/* PERMISSIONS_AUDIT_CREATIVE_TABLE_END */}
        <section style={{ ...panelStyle, background: "transparent", border: "none", boxShadow: "none", padding: "18px 8px 14px", direction: "ltr" }}>
          <h1 style={titleStyle}>غير مصرح</h1>
          <p style={mutedStyle}>هذه الصفحة مخصصة لمالك المنصة أو مشرف المحافظة فقط.</p>
          <button style={secondaryButtonStyle} onClick={() => navigate("/")}>العودة</button>
        </section>
      </div>
    );
  }

  return (
    <div dir="rtl" className="permissions-audit-page" style={shellStyle}>
      <AuditReadableCss />
      {/* PERMISSIONS_AUDIT_CREATIVE_TABLE_START */}
      <style>{`
        .permissions-audit-page table {
          width: 100% !important;
          border-collapse: separate !important;
          border-spacing: 0 12px !important;
          min-width: 1080px !important;
        }

        .permissions-audit-page thead th {
          padding: 15px 16px !important;
          background:
            linear-gradient(
              180deg,
              #159557 0%,
              #0f7a46 100%
            ) !important;
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 1000 !important;
          text-align: center !important;
          border-top: 1px solid rgba(255,255,255,.20) !important;
          border-bottom: 3px solid #086239 !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.18) !important;
          white-space: nowrap !important;
        }

        .permissions-audit-page thead th:first-child {
          border-radius: 0 16px 16px 0 !important;
        }

        .permissions-audit-page thead th:last-child {
          border-radius: 16px 0 0 16px !important;
        }

        .permissions-audit-page tbody tr {
          transition:
            transform .18s ease,
            filter .18s ease !important;
          filter:
            drop-shadow(
              0 7px 12px rgba(15,23,42,.055)
            );
        }

        .permissions-audit-page tbody tr:hover {
          transform: translateY(-2px);
          filter:
            drop-shadow(
              0 12px 18px rgba(15,23,42,.11)
            );
        }

        .permissions-audit-page tbody td {
          padding: 15px 16px !important;
          background:
            rgba(255,255,255,.94) !important;
          border-top:
            1px solid rgba(148,163,184,.20) !important;
          border-bottom:
            1px solid rgba(148,163,184,.20) !important;
          text-align: center !important;
          vertical-align: middle !important;
          transition:
            background .18s ease,
            border-color .18s ease !important;
        }

        .permissions-audit-page tbody tr:nth-child(even) td {
          background:
            rgba(246,252,249,.96) !important;
        }

        .permissions-audit-page tbody tr:hover td {
          background:
            linear-gradient(
              180deg,
              #ffffff 0%,
              #effaf4 100%
            ) !important;
          border-color:
            rgba(22,163,74,.30) !important;
        }

        .permissions-audit-page tbody td:first-child {
          border-right:
            1px solid rgba(148,163,184,.20) !important;
          border-radius:
            0 18px 18px 0 !important;
        }

        .permissions-audit-page tbody td:last-child {
          border-left:
            1px solid rgba(148,163,184,.20) !important;
          border-radius:
            18px 0 0 18px !important;
        }

        .permissions-audit-page tbody td:nth-child(1) {
          min-width: 245px;
          font-weight: 1000 !important;
          color: #0f172a !important;
        }

        .permissions-audit-page tbody td:nth-child(2) {
          min-width: 155px;
          color: #17345f !important;
        }

        .permissions-audit-page tbody td:nth-child(3) {
          min-width: 130px;
          font-weight: 900 !important;
          color: #0f5132 !important;
        }

        .permissions-audit-page tbody td:nth-child(4) {
          min-width: 230px;
          font-weight: 850 !important;
          color: #334155 !important;
        }

        .permissions-audit-page tbody td:nth-child(5) {
          min-width: 125px;
        }

        .permissions-audit-page tbody td:nth-child(6) {
          min-width: 100px;
        }

        .permissions-audit-page tbody td:nth-child(2) span {
          border:
            1px solid rgba(30,64,175,.15) !important;
          background:
            linear-gradient(
              180deg,
              #ffffff,
              #f1f6ff
            ) !important;
          color: #17345f !important;
          padding: 7px 13px !important;
          border-radius: 999px !important;
          box-shadow:
            0 3px 9px rgba(30,64,175,.06) !important;
        }

        .permissions-audit-page tbody td:nth-child(5) > span {
          min-width: 64px !important;
          justify-content: center !important;
          border-radius: 999px !important;
          padding: 7px 12px !important;
          box-shadow:
            0 4px 10px rgba(22,163,74,.08) !important;
        }

        .permissions-audit-page tbody td:nth-child(5) div {
          margin-top: 7px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          color: #64748b !important;
        }

        .permissions-audit-page tbody button {
          min-width: 68px !important;
          min-height: 40px !important;
          border:
            1px solid #087443 !important;
          border-bottom:
            3px solid #055c34 !important;
          border-radius: 12px !important;
          background:
            linear-gradient(
              180deg,
              #1eaa63,
              #087443
            ) !important;
          color: #ffffff !important;
          font-family: inherit !important;
          font-weight: 1000 !important;
          cursor: pointer !important;
          box-shadow:
            0 6px 13px rgba(8,116,67,.17) !important;
          transition:
            transform .16s ease,
            box-shadow .16s ease !important;
        }

        .permissions-audit-page tbody button:not(:disabled):hover {
          transform: translateY(-2px) !important;
          box-shadow:
            0 9px 18px rgba(8,116,67,.25) !important;
        }

        .permissions-audit-page tbody button:disabled {
          border:
            1px solid #cbd5e1 !important;
          border-bottom:
            3px solid #b8c3d0 !important;
          background:
            linear-gradient(
              180deg,
              #e8eef3,
              #d9e2e9
            ) !important;
          color: #82909e !important;
          box-shadow: none !important;
          cursor: not-allowed !important;
          opacity: .85 !important;
        }

        @media (max-width: 900px) {
          .permissions-audit-page table {
            min-width: 980px !important;
          }

          .permissions-audit-page thead th,
          .permissions-audit-page tbody td {
            padding:
              12px 13px !important;
          }
        }
      `}</style>
      {/* PERMISSIONS_AUDIT_CREATIVE_TABLE_END */}
      <section style={{ ...heroStyle, background: "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", direction: "ltr" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", direction: "rtl" }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => navigate(isOwner ? "/system" : "/super-system")}>
              {isOwner ? "العودة إلى لوحة مالك المنصة" : "العودة إلى صفحة مشرف المحافظة"}
            </button>
            {isOwner ? (<> <button type="button" style={secondaryButtonStyle} onClick={() => navigate("/programs-gateway")}>العودة إلى البوابة التشغيلية</button> <button type="button" style={secondaryButtonStyle} onClick={() => navigate("/system/security")}>العودة إلى الأمن والرقابة</button> </>) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, direction: "rtl", textAlign: "right" }}>
            <img src={MINISTRY_LOGO_URL} alt="وزارة التعليم" style={logoStyle} />
            <div>
              <div style={ministryStyle}>سلطنة عمان</div>
              <div style={ministryStyle}>وزارة التعليم</div>
              <div style={mutedStyle}>{currentGovernorate || "نطاق مالك المنصة"}</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", display: "grid", gap: 12, direction: "rtl" }}>
          <h1 style={titleStyle}>فحص الصلاحيات والربط</h1>
          <p style={subtitleStyle}>مراجعة المستخدمين، الأدوار، المحافظة، المدرسة أو مركز الدبلوم، وحالة الدخول والمشاهدة فقط.</p>
        </div>
      </section>

      <section style={gridStatsStyle}>
        <Stat label="إجمالي المستخدمين" value={stats.total} />
        <Stat label="المفعّلون" value={stats.enabled} />
        <Stat label="مشرفو الوزارة" value={stats.ministrySupers} />
        <Stat label="مشرفو المحافظات" value={stats.governorateSupers} />
        <Stat label="أدمنات المدارس" value={stats.schoolAdmins} />
        <Stat label="مشرفو امتحانات الدبلوم" value={stats.examSupers} />
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 220px auto", gap: 12, alignItems: "end" }}>
          <label style={labelStyle}>بحث
            <input style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالبريد أو الدور أو المركز..." />
          </label>
          <label style={labelStyle}>تصفية
            <select style={inputStyle} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">الكل</option>
              <option value="enabled">المفعل فقط</option>
              <option value="disabled">الموقوف فقط</option>
              <option value="school">المدارس</option>
              <option value="exam">مراكز الدبلوم</option>
              <option value="outside">خارج النطاق</option>
            </select>
          </label>
          <button style={primaryButtonStyle} onClick={() => window.location.reload()}>تحديث الفحص</button>
        </div>

        {errors.length ? (
          <div className="audit-warning" style={warningStyle}>
            <b>تنبيهات أثناء الفحص:</b>
            {errors.map((err, index) => <div key={index}>{err}</div>)}
          </div>
        ) : null}

        {loading ? (
          <div style={emptyStyle}>جاري تحميل بيانات الصلاحيات...</div>
        ) : filteredRows.length === 0 ? (
          <div style={emptyStyle}>لا توجد نتائج مطابقة للفحص الحالي.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>المحافظة</th>
                  <th>المدرسة / المركز</th>
                  <th>الحالة</th>
                  <th>الدخول</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const inside = row.scopeStatus !== "outside";
                  const canOpen = Boolean(row.tenantId && (isOwner || inside));
                  return (
                    <tr key={row.id}>
                      <td>
                        <div style={{ fontWeight: 1000 }}>{row.name || "—"}</div>
                        <div style={cellSubStyle}>{row.email || "—"}</div>
                      </td>
                      <td><span style={badgeStyle}>{row.roleLabel}</span><div style={cellSubStyle}>{row.role || "—"}</div></td>
                      <td>{row.governorate || "—"}</td>
                      <td>
                        <div style={{ fontWeight: 900 }}>{row.tenantName || row.tenantId || "—"}</div>
                        <div style={cellSubStyle}>{row.tenantId || "لا يوجد Tenant"}</div>
                      </td>
                      <td>
                        <span style={row.enabled ? okBadgeStyle : stopBadgeStyle}>{row.enabled ? "مفعل" : "موقوف"}</span>
                        <div style={cellSubStyle}>{inside ? "داخل النطاق" : "خارج نطاق المحافظة"}</div>
                      </td>
                      <td>
                        <button style={canOpen ? primarySmallStyle : disabledButtonStyle} disabled={!canOpen} onClick={() => openTenant(row)}>
                          {isGovSuper ? "فتح مشاهدة فقط" : "فتح"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AuditReadableCss() {
  return (
    <style>{`
      .permissions-audit-page,
      .permissions-audit-page * {
        color: #111827;
        font-weight: 800;
      }
      .permissions-audit-page input,
      .permissions-audit-page select,
      .permissions-audit-page textarea {
        color: #000000 !important;
        background: #fffdf5 !important;
        font-weight: 1000 !important;
        opacity: 1 !important;
      }
      .permissions-audit-page input::placeholder,
      .permissions-audit-page textarea::placeholder {
        color: #111827 !important;
        opacity: 1 !important;
        font-weight: 900 !important;
      }
      .permissions-audit-page table th,
      .permissions-audit-page table td {
        color: #000000 !important;
        font-weight: 900 !important;
      }
      .permissions-audit-page button {
        color: #000000 !important;
        font-weight: 1000 !important;
      }
      .permissions-audit-page .audit-warning,
      .permissions-audit-page .audit-warning * {
        color: #7c1d1d !important;
        font-weight: 1000 !important;
      }
    `}</style>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statStyle}>
      <div style={{ fontSize: 34, fontWeight: 1000, color: "#111827" }}>{value}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#6b4e00" }}>{label}</div>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: BG,
  padding: 28,
  boxSizing: "border-box",
  color: "#111827",
  display: "grid",
  gap: 22,
  alignContent: "start",
};
const heroStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fffaf0 0%, #f8efd7 100%)",
  border: `5px solid ${GOLD}`,
  borderRadius: 38,
  padding: 28,
  boxShadow: "0 16px 42px rgba(120,90,10,0.14)",
};
const panelStyle: React.CSSProperties = {
  background: CARD,
  border: `4px solid ${GOLD}`,
  borderRadius: 32,
  padding: 24,
  boxShadow: "0 12px 30px rgba(120,90,10,0.12)",
  display: "grid",
  gap: 18,
};
const gridStatsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 16 };
const statStyle: React.CSSProperties = { background: CARD, border: "1px solid rgba(148,163,184,.26)", borderBottom: "4px solid #168a4b", borderRadius: 22, padding: "20px 18px", textAlign: "center", boxShadow: "0 12px 28px rgba(15,23,42,.07)" };
const logoStyle: React.CSSProperties = { width: 96, height: 96, objectFit: "contain", border: "none", borderRadius: 0, padding: 0, background: "transparent", boxShadow: "none" };
const ministryStyle: React.CSSProperties = { fontSize: 24, fontWeight: 1000, color: "#12683b", lineHeight: 1.45 };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 1000, lineHeight: 1.15, color: "#0f7a43", letterSpacing: "-1px" };
const subtitleStyle: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 800, color: "#64748b" };
const mutedStyle: React.CSSProperties = { color: "#111827", fontWeight: 1000 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 8, fontWeight: 1000, color: "#000000" };
const inputStyle: React.CSSProperties = { minHeight: 52, border: "1px solid #d8e2ec", borderRadius: 14, padding: "0 16px", background: "#ffffff", fontWeight: 800, color: "#0f172a", fontSize: 15, boxShadow: "inset 0 1px 2px rgba(15,23,42,.03)" };
const primaryButtonStyle: React.CSSProperties = { minHeight: 48, border: "1px solid #11733e", borderRadius: 13, background: "linear-gradient(180deg,#20a65e,#168a4b)", color: "#ffffff", fontWeight: 1000, cursor: "pointer", padding: "0 20px", boxShadow: "0 7px 16px rgba(22,138,75,.18)" };
const secondaryButtonStyle: React.CSSProperties = { minHeight: 46, border: "1px solid #d9e3ef", borderRadius: 13, background: "rgba(255,255,255,.92)", color: "#17345f", fontWeight: 900, cursor: "pointer", padding: "0 18px", boxShadow: "0 5px 14px rgba(15,23,42,.05)" };
const warningStyle: React.CSSProperties = { border: "3px solid #dc2626", background: "#fff1f2", color: "#7c1d1d", borderRadius: 18, padding: 16, fontWeight: 1000, lineHeight: 2, fontSize: 16 };
const emptyStyle: React.CSSProperties = { padding: 18, textAlign: "center", fontWeight: 1000, color: "#000000", fontSize: 17 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: "0 12px", minWidth: 1080, color: "#0f172a" };
const cellSubStyle: React.CSSProperties = { fontSize: 13, color: "#64748b", fontWeight: 800, marginTop: 5 };
const badgeStyle: React.CSSProperties = { display: "inline-flex", padding: "7px 13px", border: "1px solid #d6e0ec", borderRadius: 999, background: "#f8fafc", color: "#17345f", fontWeight: 1000 };
const okBadgeStyle: React.CSSProperties = { ...badgeStyle, borderColor: "#16a34a", background: "#dcfce7", color: "#166534" };
const stopBadgeStyle: React.CSSProperties = { ...badgeStyle, borderColor: "#dc2626", background: "#fee2e2", color: "#991b1b" };
const primarySmallStyle: React.CSSProperties = { ...primaryButtonStyle, minHeight: 40, fontSize: 14 };
const disabledButtonStyle: React.CSSProperties = { ...primarySmallStyle, cursor: "not-allowed", opacity: 0.5 };
