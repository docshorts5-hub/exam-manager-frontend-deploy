import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where, getDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, isPlatformOwner } from "../features/authz";
import { resolveAdministrativeTheme } from "../features/administrative-theme/administrativeTheme";
import { MINISTRY_SCOPE } from "../constants/directorates";
import { db } from "../firebase/firebase";
import { useSuperSystemTenants } from "../features/super-admin/hooks/useSuperSystemTenants";
import {
  archiveAndDeleteTenant,
  createTenantForScope,
  saveTenantForScope,
} from "../features/super-admin/services/superSystemService";
import { isMinistrySuperViewer } from "./ministry/ministryPageGuard";
import "./GovernorateSuperModel3Preview.css";
import "./GovernorateSchoolsManagementModel3.css";

const MODEL3_LOGO = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

type TenantRow = {
  id: string;
  name?: string;
  tenantName?: string;
  schoolName?: string;
  schoolNameAr?: string;
  enabled?: boolean;
  governorate?: string;
  tenantGovernorate?: string;
  regionAr?: string;
  wilayatAr?: string;
  logoUrl?: string;
  kind?: string;
  type?: string;
  tenantType?: string;
  scopeType?: string;
  entityType?: string;
  program?: string;
  role?: string;
  email?: string;
  __fromTenantDoc?: boolean;
  __fromAllowlist?: boolean;
  __scopedBySuperHook?: boolean;
  __scopedByDirectGovQuery?: boolean;
  __scopedByAllowlistGov?: boolean;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanGovernorateName(value: string) {
  let v = String(value || "").replace(/\s+/g, " ").trim();
  const fullPrefix = "المديرية العامة للتعليم بمحافظة";

  if (v.includes(fullPrefix)) {
    v = v.slice(v.lastIndexOf(fullPrefix) + fullPrefix.length).trim();
  }

  v = v
    .replace(/^محافظة\s+/g, "")
    .replace(/^بمحافظة\s+/g, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return v || "شمال الشرقية";
}

function normalizeGovernorate(value: unknown): string {
  return cleanGovernorateName(String(value || ""))
    .replace(/\s+/g, "")
    .replace(/^محافظة/g, "")
    .replace(/^بمحافظة/g, "");
}

function sameGovernorate(a: unknown, b: unknown): boolean {
  const aa = normalizeGovernorate(a);
  const bb = normalizeGovernorate(b);
  return Boolean(aa && bb && aa === bb);
}

function getProfile(auth: any) {
  return auth?.profile || auth?.userProfile || auth?.allow || {};
}

function getGovernorate(auth: any) {
  const p = getProfile(auth);
  const claims = auth?.claims || auth?.tokenClaims || {};

  return String(
    auth?.supportGovernorate ||
      auth?.supportGov ||
      auth?.actingGovernorate ||
      p?.supportGovernorate ||
      p?.supportGov ||
      p?.actingGovernorate ||
      claims?.supportGovernorate ||
      claims?.supportGov ||
      claims?.actingGovernorate ||
      p?.governorate ||
      p?.tenantGovernorate ||
      p?.regionAr ||
      p?.region ||
      auth?.governorate ||
      "شمال الشرقية",
  ).trim();
}

function getGovernorateVariants(rawGovernorate: string, governorate: string): string[] {
  return Array.from(
    new Set(
      [
        rawGovernorate,
        governorate,
        `محافظة ${governorate}`,
        `بمحافظة ${governorate}`,
        `المديرية العامة للتعليم بمحافظة ${governorate}`,
      ]
        .map((v) => text(v))
        .filter(Boolean),
    ),
  );
}

function getTenantGovernorate(row: TenantRow): string {
  return text(row.governorate || row.tenantGovernorate || row.regionAr || "");
}

function getTenantName(row: TenantRow): string {
  return text(row.name || row.schoolName || row.tenantName || row.id || "—");
}

function looksLikeSchoolTenant(row: TenantRow): boolean {
  if (row.__fromAllowlist) return true;

  const marker = [
    row.kind,
    row.type,
    row.tenantType,
    row.scopeType,
    row.program,
    row.name,
    row.tenantName,
    row.schoolName,
  ]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");

  if (marker.includes("diploma") || marker.includes("دبلوم") || marker.includes("exam_center")) {
    return false;
  }

  if (
    marker.includes("school") ||
    marker.includes("مدرس") ||
    row.schoolName ||
    row.tenantName ||
    row.name
  ) {
    return true;
  }

  return false;
}

function safeId(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function mergeRows(...groups: TenantRow[][]): TenantRow[] {
  const map = new Map<string, TenantRow>();

  function mergeTenantRow(existing: TenantRow, incoming: TenantRow): TenantRow {
    const next: TenantRow = { ...existing };

    for (const [key, value] of Object.entries(incoming) as Array<[keyof TenantRow, any]>) {
      if (value === undefined || value === null) continue;

      if (typeof value === "string") {
        const cleaned = value.trim();
        if (!cleaned) continue;
        (next as any)[key] = cleaned;
        continue;
      }

      if (key === "enabled") {
        (next as any)[key] = value !== false;
        continue;
      }

      (next as any)[key] = value;
    }

    if (existing.enabled === false || incoming.enabled === false) {
      next.enabled = false;
    }

    return next;
  }

  for (const rows of groups) {
    for (const row of rows || []) {
      const id = text(row?.id);
      if (!id) continue;

      const existing = map.get(id);
      map.set(id, existing ? mergeTenantRow(existing, row) : row);
    }
  }

  return Array.from(map.values());
}

function allowlistToSchoolRow(id: string, data: any, scoped: boolean): TenantRow | null {
  const role = String(data?.role || "").trim().toLowerCase();
  const roles = Array.isArray(data?.roles)
    ? data.roles.map((r: unknown) => String(r || "").trim().toLowerCase())
    : [];

  const isSchoolAdmin =
    role === "tenant_admin" ||
    role === "admin" ||
    roles.includes("tenant_admin") ||
    roles.includes("admin");

  if (!isSchoolAdmin) return null;

  const tenantId = text(data?.tenantId);
  if (!tenantId) return null;

  return {
    id: tenantId,
    name: text(data?.schoolName || data?.tenantName || data?.name || tenantId),
    schoolName: text(data?.schoolName || data?.tenantName || data?.name || tenantId),
    tenantName: text(data?.tenantName || data?.schoolName || data?.name || tenantId),
    governorate: text(data?.governorate || data?.tenantGovernorate || data?.regionAr),
    tenantGovernorate: text(data?.tenantGovernorate || data?.governorate || data?.regionAr),
    wilayatAr: text(data?.wilayatAr),
    enabled: data?.enabled !== false,
    role,
    email: text(data?.email || id),
    __fromAllowlist: true,
    __scopedByAllowlistGov: scoped,
  };
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button className="gm3-school-action-card" type="button" onClick={onClick}>
      <span className="gm3-school-action-icon">{icon}</span>
      <span>
        <b>{title}</b>
        <small>{desc}</small>
      </span>
    </button>
  );
}

export default function GovernorateSchoolsManagementModel3() {
  const nav = useNavigate();
  const auth = useAuth() as any;

  const snapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const administrativeTheme = resolveAdministrativeTheme(snapshot);
  const isOwner = isPlatformOwner(snapshot);
  const rawGovernorate = getGovernorate(auth);
  const governorate = cleanGovernorateName(rawGovernorate);
  const governorateForWrite = text(rawGovernorate) || governorate;
  const canSeeAllGovs = isOwner;

  const isMinistryViewer =
    !isOwner && (isMinistrySuperViewer(auth as any) || String(rawGovernorate || "").trim() === MINISTRY_SCOPE);

  const isUserAllowed = Boolean(auth?.user) && auth?.allow?.enabled !== false;
  const email = text(auth?.user?.email || auth?.allow?.email || "—");

  console.debug("STEP43H10_RAW_GOV_WRITE_DIAG", {
    displayGovernorate: governorate,
    governorateForWrite,
    rawGovernorate,
  });

  const tenantsState = useSuperSystemTenants({ canSeeAllGovs, myGov: governorate }) as any;

  const hookTenantsRaw: TenantRow[] = mergeRows(
    Array.isArray(tenantsState?.tenants) ? tenantsState.tenants : [],
    Array.isArray(tenantsState?.visibleTenants) ? tenantsState.visibleTenants : [],
  );

  const hookTenants: TenantRow[] = hookTenantsRaw.map((row) => ({
    ...row,
    __fromTenantDoc: true,
    __scopedBySuperHook: !canSeeAllGovs,
  }));

  const hookLoading = Boolean(tenantsState?.loading || tenantsState?.busy);

  const [directTenants, setDirectTenants] = useState<TenantRow[]>([]);
  const [allowlistSchools, setAllowlistSchools] = useState<TenantRow[]>([]);
  const [directLoading, setDirectLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [newWilayat, setNewWilayat] = useState("");
  const [newEnabled, setNewEnabled] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);

  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editWilayat, setEditWilayat] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editLinkedEmail, setEditLinkedEmail] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editBusy, setEditBusy] = useState(false);

  const governorateVariants = useMemo(
    () => getGovernorateVariants(rawGovernorate, governorate),
    [rawGovernorate, governorate],
  );

  useEffect(() => {
    let alive = true;

    async function loadScopedData() {
      setDirectLoading(true);

      const tenantRows: TenantRow[] = [];
      const allowRows: TenantRow[] = [];

      try {
        const tenantsRef = collection(db, "tenants");

        if (canSeeAllGovs) {
          const snap = await getDocs(tenantsRef);
          snap.forEach((docSnap) =>
            tenantRows.push({
              id: docSnap.id,
              ...(docSnap.data() as any),
              __fromTenantDoc: true,
            }),
          );
        } else {
          for (const field of ["governorate", "tenantGovernorate", "regionAr"]) {
            for (const value of governorateVariants) {
              try {
                const snap = await getDocs(query(tenantsRef, where(field, "==", value)));
                snap.forEach((docSnap) =>
                  tenantRows.push({
                    id: docSnap.id,
                    ...(docSnap.data() as any),
                    __fromTenantDoc: true,
                    __scopedByDirectGovQuery: true,
                  }),
                );
              } catch (error) {
                console.warn(`تعذر تحميل tenants حسب ${field}.`, error);
              }
            }
          }
        }
      } catch (error) {
        console.warn("تعذر تحميل tenants.", error);
      }

      try {
        const allowRef = collection(db, "allowlist");

        if (canSeeAllGovs) {
          const snap = await getDocs(allowRef);
          snap.forEach((docSnap) => {
            const row = allowlistToSchoolRow(docSnap.id, docSnap.data(), false);
            if (row) allowRows.push(row);
          });
        } else {
          for (const field of ["governorate", "tenantGovernorate", "regionAr"]) {
            for (const value of governorateVariants) {
              try {
                const snap = await getDocs(query(allowRef, where(field, "==", value)));
                snap.forEach((docSnap) => {
                  const row = allowlistToSchoolRow(docSnap.id, docSnap.data(), true);
                  if (row) allowRows.push(row);
                });
              } catch (error) {
                console.warn(`تعذر تحميل allowlist حسب ${field}.`, error);
              }
            }
          }
        }
      } catch (error) {
        console.warn("تعذر تحميل allowlist.", error);
      }

      if (alive) {
        setDirectTenants(mergeRows(tenantRows));
        setAllowlistSchools(mergeRows(allowRows));
        setDirectLoading(false);
      }
    }

    if (isUserAllowed && !isMinistryViewer) {
      void loadScopedData();
    } else {
      setDirectTenants([]);
      setAllowlistSchools([]);
      setDirectLoading(false);
    }

    return () => {
      alive = false;
    };
  }, [canSeeAllGovs, governorateVariants, isUserAllowed, isMinistryViewer]);

  const allTenantRows = useMemo(
    () => mergeRows(hookTenants, directTenants, allowlistSchools),
    [hookTenants, directTenants, allowlistSchools],
  );

  const schools = useMemo(() => {
    return allTenantRows
      .filter((row) => looksLikeSchoolTenant(row))
      .filter((row) => {
        if (canSeeAllGovs) return true;

        const rowGov = getTenantGovernorate(row);
        if (rowGov) return sameGovernorate(rowGov, governorate);

        return (
          row.__scopedBySuperHook === true ||
          row.__scopedByDirectGovQuery === true ||
          row.__scopedByAllowlistGov === true
        );
      })
      .sort((a, b) => getTenantName(a).localeCompare(getTenantName(b), "ar"));
  }, [allTenantRows, canSeeAllGovs, governorate]);

  const loading = hookLoading || directLoading;

  useEffect(() => {
    const hash = window.location.hash;

    if (hash === "#create") {
      setTimeout(() => {
        document.getElementById("gm3-schools-create")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
      return;
    }

    if (hash === "#edit" || hash === "#schools") {
      setTimeout(() => {
        document.getElementById("gm3-schools-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }, []);

  if (!isUserAllowed) {
    return <Navigate to="/login" replace />;
  }

  if (isMinistryViewer) {
    return <Navigate to="/super-system" replace />;
  }

  function canManageRow(row: TenantRow): boolean {
    const id = text(row?.id);
    if (!id) return false;
    if (!looksLikeSchoolTenant(row)) return false;
    if (canSeeAllGovs) return true;

    const rowGov = getTenantGovernorate(row);
    if (rowGov) return sameGovernorate(rowGov, governorate);

    return (
      row.__scopedBySuperHook === true ||
      row.__scopedByDirectGovQuery === true ||
      row.__scopedByAllowlistGov === true
    );
  }

  function assertCanWrite(): boolean {
    if (!isUserAllowed) {
      alert("انتهت الجلسة أو الحساب غير مفعل.");
      return false;
    }

    if (isMinistryViewer) {
      alert("مشرف الوزارة في وضع مشاهدة فقط ولا يمكنه إدارة المدارس.");
      return false;
    }

    if (!canSeeAllGovs && !governorateForWrite) {
      alert("حساب مشرف المحافظة غير مرتبط بمحافظة.");
      return false;
    }

    return true;
  }

  function reloadPage() {
    window.location.reload();
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(row: TenantRow) {
    if (!canManageRow(row)) {
      alert("لا يمكنك تعديل مدرسة خارج نطاق صلاحياتك.");
      return;
    }

    setEditId(text(row.id));
    setEditName(getTenantName(row));
    setEditWilayat(text(row.wilayatAr));
    setEditLogoUrl(text(row.logoUrl));
    setEditLinkedEmail(text(row.email));
    setEditEnabled(row.enabled !== false);

    setTimeout(() => scrollTo("gm3-schools-edit"), 100);
  }

  async function createSchool() {
    if (!assertCanWrite()) return;

    const cleanedName = text(newName);
    const cleanedId = safeId(newId || cleanedName);
    const cleanedWilayat = text(newWilayat);

    if (!cleanedName) {
      alert("اكتب اسم المدرسة.");
      return;
    }

    if (!cleanedId) {
      alert("اكتب Tenant ID صالحًا باللغة الإنجليزية مثل: school-01");
      return;
    }

    if (allTenantRows.some((row) => text(row.id).toLowerCase() === cleanedId.toLowerCase())) {
      alert("Tenant ID مستخدم بالفعل.");
      return;
    }

    const failures: string[] = [];
    let savedAny = false;

    setCreateBusy(true);

    try {
      try {
        await createTenantForScope({
          tenantId: cleanedId,
          name: cleanedName,
          enabled: newEnabled,
          governorate: governorateForWrite,
          canSeeAllGovs,
          myGov: governorateForWrite,
        } as any);
        savedAny = true;
      } catch (createError: any) {
        console.warn("فشل createTenantForScope، سيتم تجربة الحفظ المباشر.", createError);
        failures.push(createError?.message || "createTenantForScope failed");
      }

      try {
        await saveTenantForScope({
          tenantId: cleanedId,
          name: cleanedName,
          enabled: newEnabled,
          wilayatAr: cleanedWilayat,
          logoUrl: "",
          canSeeAllGovs,
          myGov: governorateForWrite,
        } as any);
        savedAny = true;
      } catch (scopeSaveError: any) {
        console.warn("فشل saveTenantForScope بعد إنشاء المدرسة، سيتم الاعتماد على الحفظ المباشر.", scopeSaveError);
        failures.push(scopeSaveError?.message || "saveTenantForScope failed");
      }

      try {
        await saveTenantConfigFallback({
          tenantId: cleanedId,
          name: cleanedName,
          enabled: newEnabled,
          wilayatAr: cleanedWilayat,
          logoUrl: "",
        });
        savedAny = true;
      } catch (directSaveError: any) {
        console.warn("فشل الحفظ المباشر للمدرسة.", directSaveError);
        failures.push(directSaveError?.message || "direct tenant save failed");
      }

      if (!savedAny) {
        throw new Error(failures.join(" | ") || "لم يتم حفظ المدرسة.");
      }

      const newRow: TenantRow = {
        id: cleanedId,
        name: cleanedName,
        tenantName: cleanedName,
        schoolName: cleanedName,
        schoolNameAr: cleanedName,
        enabled: newEnabled,
        governorate: governorateForWrite,
        tenantGovernorate: governorateForWrite,
        regionAr: governorateForWrite,
        wilayatAr: cleanedWilayat,
        logoUrl: "",
        type: "school",
        tenantType: "school",
        kind: "school",
        entityType: "school",
        __scopedByDirectGovQuery: true,
      };

      setDirectTenants((prev) => mergeRows(prev, [newRow]));

      console.debug("STEP43H18C_CREATE_PERSISTED", {
        tenantId: cleanedId,
        savedAny,
        failures,
        wilayatAr: cleanedWilayat,
      });

      alert("تم إنشاء المدرسة.");
      setNewName("");
      setNewId("");
      setNewWilayat("");
      setNewEnabled(true);
    } catch (error: any) {
      console.error("تعذر إنشاء المدرسة بعد كل المسارات الآمنة.", {
        error,
        failures,
      });
      alert(error?.message || "تعذر إنشاء المدرسة.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function saveTenantConfigFallback(params: {
    tenantId: string;
    name: string;
    enabled: boolean;
    wilayatAr: string;
    logoUrl: string;
  }) {
    const cleanTenantId = text(params.tenantId);
    const cleanName = text(params.name);
    const cleanWilayat = text(params.wilayatAr);
    const cleanLogo = text(params.logoUrl);

    if (!cleanTenantId) {
      throw new Error("Tenant ID غير صالح للحفظ.");
    }

    const canonicalRootPayload = {
      tenantId: cleanTenantId,
      name: cleanName,
      tenantName: cleanName,
      schoolName: cleanName,
      schoolNameAr: cleanName,
      enabled: params.enabled !== false,
      governorate: governorateForWrite,
      tenantGovernorate: governorateForWrite,
      regionAr: governorateForWrite,
      wilayatAr: cleanWilayat,
      logoUrl: cleanLogo,
      type: "school",
      tenantType: "school",
      kind: "school",
      entityType: "school",
      isDiplomaCenter: false,
      isExamCenter: false,
      updatedAt: serverTimestamp(),
      updatedBy: auth?.user?.email || "",
    };

    const canonicalConfigPayload = {
      ...canonicalRootPayload,
      ministryAr: "سلطنة عمان - وزارة التعليم",
      systemNameAr: "نظام إدارة الامتحانات الذكي",
    };

    await setDoc(doc(db, "tenants", cleanTenantId), canonicalRootPayload, { merge: true });
    await setDoc(doc(db, "tenants", cleanTenantId, "meta", "config"), canonicalConfigPayload, { merge: true });
  }

  async function saveAllowlistSchoolFallback(
    row: TenantRow,
    params: {
      tenantId: string;
      name: string;
      enabled: boolean;
      wilayatAr: string;
      logoUrl: string;
    },
  ) {
    const linkedEmail = text(row.email || editLinkedEmail).toLowerCase();
    const tenantId = text(params.tenantId);

    if (!linkedEmail || linkedEmail === "—" || linkedEmail.includes("لا يوجد")) {
      throw new Error("لا يوجد إيميل مربوط يمكن تحديثه لهذه المدرسة.");
    }

    if (!tenantId) {
      throw new Error("Tenant ID غير موجود.");
    }

    const allowRef = doc(db, "allowlist", linkedEmail);
    const allowSnap = await getDoc(allowRef);

    if (!allowSnap.exists()) {
      throw new Error("سجل الإيميل المربوط غير موجود في allowlist.");
    }

    const allowData = allowSnap.data() as any;
    const role = String(allowData?.role || row.role || "").trim().toLowerCase();
    const roles = Array.isArray(allowData?.roles)
      ? allowData.roles.map((r: unknown) => String(r || "").trim().toLowerCase())
      : [];

    const isSchoolAdmin =
      role === "tenant_admin" ||
      role === "admin" ||
      roles.includes("tenant_admin") ||
      roles.includes("admin");

    if (!isSchoolAdmin) {
      throw new Error("الإيميل المربوط ليس مدير مدرسة.");
    }

    const allowTenantId = text(allowData?.tenantId || row.id);
    if (allowTenantId !== tenantId) {
      throw new Error("الإيميل المربوط لا يخص نفس المدرسة المحددة.");
    }

    const allowGov = text(
      allowData?.governorate ||
        allowData?.tenantGovernorate ||
        allowData?.regionAr ||
        getTenantGovernorate(row) ||
        governorateForWrite,
    );

    if (!canSeeAllGovs && allowGov && !sameGovernorate(allowGov, governorate)) {
      throw new Error("لا يمكن تحديث مدرسة خارج نطاق المحافظة.");
    }

    await setDoc(
      allowRef,
      {
        email: linkedEmail,
        enabled: params.enabled !== false,
        role: role || "tenant_admin",
        tenantId,
        name: text(params.name),
        schoolName: text(params.name),
        tenantName: text(params.name),
        wilayatAr: text(params.wilayatAr),
        logoUrl: text(params.logoUrl),
        governorate: allowGov || governorateForWrite,
        tenantGovernorate: allowGov || governorateForWrite,
        updatedAt: serverTimestamp(),
        updatedBy: email,
        updatedByRole: canSeeAllGovs ? "platform_owner" : "governorate_super",
      },
      { merge: true },
    );
  }

  async function saveEdit() {
    if (!assertCanWrite()) return;

    if (!editId) {
      alert("اختر مدرسة أولاً من القائمة اليمنى.");
      return;
    }

    const currentSchool = schools.find((row) => text(row.id) === text(editId));
    if (!currentSchool || !canManageRow(currentSchool)) {
      alert("لا يمكنك حفظ تعديل لمدرسة خارج نطاق صلاحياتك.");
      return;
    }

    if (!text(editName)) {
      alert("اكتب اسم المدرسة.");
      return;
    }

    const savePayload = {
      tenantId: text(editId),
      name: text(editName),
      enabled: editEnabled,
      wilayatAr: text(editWilayat),
      logoUrl: text(editLogoUrl),
    };

    const failures: string[] = [];
    let savedAny = false;

    setEditBusy(true);

    try {
      try {
        await saveTenantForScope({
          ...savePayload,
          canSeeAllGovs,
          myGov: governorateForWrite,
        } as any);
        savedAny = true;
      } catch (scopeSaveError: any) {
        console.warn("فشل saveTenantForScope.", scopeSaveError);
        failures.push(scopeSaveError?.message || "saveTenantForScope failed");
      }

      try {
        await saveTenantConfigFallback(savePayload);
        savedAny = true;
      } catch (configSaveError: any) {
        console.warn("فشل حفظ tenants/meta/config.", configSaveError);
        failures.push(configSaveError?.message || "tenant config save failed");
      }

      if (text(editLinkedEmail || currentSchool.email)) {
        try {
          await saveAllowlistSchoolFallback(currentSchool, savePayload);
          savedAny = true;
        } catch (allowSaveError: any) {
          console.warn("فشل حفظ allowlist.", allowSaveError);
          failures.push(allowSaveError?.message || "allowlist save failed");
        }
      }

      if (!savedAny) {
        throw new Error(failures.join(" | ") || "لم يتم حفظ أي مسار.");
      }

      const mergedRow: TenantRow = {
        ...currentSchool,
        id: savePayload.tenantId,
        name: savePayload.name,
        tenantName: savePayload.name,
        schoolName: savePayload.name,
        schoolNameAr: savePayload.name,
        enabled: savePayload.enabled,
        wilayatAr: savePayload.wilayatAr,
        logoUrl: savePayload.logoUrl,
        governorate: getTenantGovernorate(currentSchool) || governorateForWrite,
        tenantGovernorate: getTenantGovernorate(currentSchool) || governorateForWrite,
        type: currentSchool.type || "school",
        tenantType: currentSchool.tenantType || "school",
        kind: currentSchool.kind || "school",
        entityType: currentSchool.entityType || "school",
        __scopedByDirectGovQuery: currentSchool.__scopedByDirectGovQuery,
        __scopedBySuperHook: currentSchool.__scopedBySuperHook,
        __scopedByAllowlistGov: currentSchool.__scopedByAllowlistGov,
      };

      setDirectTenants((prev) => mergeRows(prev, [mergedRow]));
      if (text(editLinkedEmail || currentSchool.email)) {
        setAllowlistSchools((prev) => mergeRows(prev, [mergedRow]));
      }

      console.debug("STEP43H18_SAVE_PERSISTED", {
        tenantId: savePayload.tenantId,
        savedAny,
        failures,
        wilayatAr: savePayload.wilayatAr,
      });

      alert("تم حفظ بيانات المدرسة.");
    } catch (error: any) {
      console.error("تعذر حفظ بيانات المدرسة بعد كل المسارات الآمنة.", {
        error,
        failures,
      });
      alert(error?.message || "تعذر حفظ بيانات المدرسة.");
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteSchool(row: TenantRow) {
    if (!assertCanWrite()) return;

    if (!canManageRow(row)) {
      alert("لا يمكنك حذف مدرسة خارج نطاق صلاحياتك.");
      return;
    }

    const id = text(row.id);
    const name = getTenantName(row);
    if (!id) return;

    const ok = confirm(`سيتم حذف/أرشفة المدرسة:\n${name}\n\nهل تريد المتابعة؟`);
    if (!ok) return;

    try {
      await archiveAndDeleteTenant({
        tenantId: id,
        deletedBy: email,
        isPlatformOwner: isOwner,
        myGov: governorateForWrite,
      });

      alert("تم حذف/أرشفة المدرسة.");
      reloadPage();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "تعذر حذف المدرسة.");
    }
  }

  function openReadOnly(row: TenantRow) {
    if (!canManageRow(row)) {
      alert("لا يمكنك الدخول إلى مدرسة خارج نطاق صلاحياتك.");
      return;
    }

    const id = encodeURIComponent(text(row.id));
    if (!id) return;
    window.location.href = `/t/${id}/dashboard?readOnly=1&fromSuper=1`;
  }

  async function logout() {
    try {
      await auth?.logout?.();
    } finally {
      nav("/login");
    }
  }

  return (
    <div className={`m3-page gm3-schools-page ${administrativeTheme.rootClassName}`} dir="rtl">
      <div className="m3-canvas">
        <header className="m3-header">
          <div className="m3-logo-box">
            <img src={MODEL3_LOGO} alt="وزارة التربية والتعليم" />
          </div>

          <div className="m3-title-block">
            <h1>إدارة المدارس</h1>
            <p>إدارة المدارس و مدراء المدارس ضمن النطاق المصرح</p>
            <p className="m3-location">
              {canSeeAllGovs ? "نطاق مالك المنصة - جميع المحافظات" : `المديرية العامة للتعليم بمحافظة ${governorate}`}
            </p>
          </div>

          <div className="m3-user">
            <span className="m3-user-avatar">م</span>
            <span className="m3-user-email">{email}</span>
          </div>

          <div className="m3-actions">
            <button className="m3-back" type="button" onClick={() => nav("/super-system")}>
              العودة
            </button>
            <button
              className="m3-back"
              type="button"
              onClick={() =>
                nav("/system/management/schools/deleted")
              }
            >
              المدارس المحذوفة 🗑️
            </button>
            <button className="m3-logout" type="button" onClick={() => void logout()}>
              تسجيل خروج
            </button>
          </div>

          <div className="m3-pills">
            <span className="m3-pill m3-pill-gold">إدارة المدارس</span>
            <span className="m3-pill m3-pill-green">{schools.length} مدرسة</span>
          </div>
        </header>

        <section className="m3-notice gm3-security-note">
          <b>ملاحظة أمنية:</b> تظهر هنا المدارس التابعة لنطاق المحافظة فقط، ولا يسمح النظام بتعديل أو حذف مدرسة خارج صلاحيات الحساب.
          <span className="gm3-scope-debug">
            المصدر: hook {hookTenants.length} · tenants {directTenants.length} · allowlist {allowlistSchools.length} · المعروض {schools.length}
          </span>
        </section>

        <main className="gm3-schools-split">
          <aside id="gm3-schools-list" className="gm3-school-panel gm3-schools-side-list">
            <div className="gm3-school-panel-title">
              <span className="gm3-school-icon">🏫</span>
              <div>
                <h2>{canSeeAllGovs ? "المدارس التابعة لجميع المحافظات" : "المدارس التابعة للمحافظة"}</h2>
                <p>
                  {canSeeAllGovs
                    ? "مالك المنصة يرى كل المدارس لأغراض الدعم والإدارة."
                    : `النطاق الحالي: محافظة ${governorate}`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="gm3-empty">جاري تحميل المدارس...</div>
            ) : schools.length === 0 ? (
              <div className="gm3-empty">
                لا توجد مدارس ظاهرة لهذا النطاق حالياً. راجع عدادات المصدر بالأعلى لتحديد سبب عدم الظهور.
              </div>
            ) : (
              <div className="gm3-vertical-school-list">
                {schools.map((row) => (
                  <div
                    key={row.id}
                    className={`gm3-school-list-item ${editId === text(row.id) ? "is-selected" : ""}`}
                  >
                    <button className="gm3-school-list-main" type="button" onClick={() => startEdit(row)}>
                      <b>{getTenantName(row)}</b>
                      <small>
                        {text(row.wilayatAr) || "—"} · {getTenantGovernorate(row) || "مصدر مصرح"}
                      </small>
                      <span className={row.enabled === false ? "gm3-status off" : "gm3-status on"}>
                        {row.enabled === false ? "غير مفعلة" : "مفعلة"}
                      </span>
                    </button>

                    <div className="gm3-school-list-actions">
                      <button type="button" onClick={() => openReadOnly(row)}>
                        مشاهدة
                      </button>
                      <button type="button" onClick={() => startEdit(row)}>
                        تعديل
                      </button>
                      <button className="danger" type="button" onClick={() => void deleteSchool(row)}>
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="gm3-schools-workspace">
            <section className="gm3-management-cards">
              <ActionCard
                icon="🏫"
                title="المدارس التابعة للمحافظة"
                desc="القائمة الطولية على يمين الصفحة"
                onClick={() => scrollTo("gm3-schools-list")}
              />

              <ActionCard
                icon="➕"
                title="إضافة مدرسة"
                desc="إنشاء مدرسة جديدة داخل المحافظة"
                onClick={() => scrollTo("gm3-schools-create")}
              />

              <ActionCard
                icon="✏️"
                title="تعديل بيانات مدرسة"
                desc="اختر المدرسة من القائمة ثم عدّل البيانات"
                onClick={() => scrollTo("gm3-schools-edit")}
              />

              <ActionCard
                icon="🔄"
                title="تحديث القائمة"
                desc="إعادة تحميل المدارس"
                onClick={reloadPage}
              />
            </section>

            <section id="gm3-schools-create" className="gm3-school-panel">
              <div className="gm3-school-panel-title">
                <span className="gm3-school-icon">➕</span>
                <div>
                  <h2>إضافة مدرسة</h2>
                  <p>إنشاء مدرسة جديدة داخل نطاق المحافظة.</p>
                </div>
              </div>

              <div className="gm3-form-grid">
                <label>اسم المدرسة</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: مدرسة الأمل" />

                <label>Tenant ID</label>
                <input value={newId} onChange={(e) => setNewId(safeId(e.target.value))} placeholder="school-ibr-01" />

                <label>الولاية</label>
                <input value={newWilayat} onChange={(e) => setNewWilayat(e.target.value)} placeholder="مثال: إبراء" />

                <label>الحالة</label>
                <div className="gm3-check-row">
                  <input type="checkbox" checked={newEnabled} onChange={(e) => setNewEnabled(e.target.checked)} />
                  <span>{newEnabled ? "مفعلة" : "غير مفعلة"}</span>
                </div>
              </div>

              <div className="gm3-actions-row">
                <button className="gm3-primary" type="button" disabled={createBusy} onClick={() => void createSchool()}>
                  {createBusy ? "جاري الإنشاء..." : "إنشاء مدرسة"}
                </button>
              </div>
            </section>

            <section id="gm3-schools-edit" className="gm3-school-panel">
              <div className="gm3-school-panel-title">
                <span className="gm3-school-icon">✏️</span>
                <div>
                  <h2>تعديل بيانات المدرسة</h2>
                  <p>اختر مدرسة من القائمة اليمنى ثم عدّل بياناتها هنا.</p>
                </div>
              </div>

              <div className="gm3-selected">
                المدرسة المحددة: <b>{editName || editId || "لم يتم اختيار مدرسة بعد"}</b>
              </div>

              <div className="gm3-form-grid">
                <label>اسم المدرسة</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!editId} />

                <label>Tenant ID</label>
                <input value={editId} disabled />

                <label>الولاية</label>
                <input value={editWilayat} onChange={(e) => setEditWilayat(e.target.value)} disabled={!editId} />

                <label>رابط الشعار</label>
                <input value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} disabled={!editId} />

                <label>الإيميل المربوط بالمدرسة</label>
                <input value={editLinkedEmail || "لا يوجد إيميل ظاهر"} disabled />

                <label>الحالة</label>
                <div className="gm3-check-row">
                  <input
                    type="checkbox"
                    checked={editEnabled}
                    onChange={(e) => setEditEnabled(e.target.checked)}
                    disabled={!editId}
                  />
                  <span>{editEnabled ? "مفعلة" : "غير مفعلة"}</span>
                </div>
              </div>

              <div className="gm3-actions-row">
                <button className="gm3-primary" type="button" disabled={!editId || editBusy} onClick={() => void saveEdit()}>
                  {editBusy ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

