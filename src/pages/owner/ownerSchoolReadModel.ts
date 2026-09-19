import { callFn } from "../../services/functionsClient";

export type OwnerSchoolTenant = {
  id: string;
  name?: string;
  enabled?: boolean;
  governorate?: string;
  tenantGovernorate?: string;
  regionAr?: string;
  governorateAr?: string;
  scopeGovernorate?: string;
  gov?: string;
  tenantType?: unknown;
  type?: unknown;
  entityType?: unknown;
  kind?: unknown;
  category?: unknown;
  role?: unknown;
  scopeType?: unknown;
  centerType?: unknown;
  programType?: unknown;
  program?: unknown;
  mode?: unknown;
  entryMode?: unknown;
  route?: unknown;
  path?: unknown;
  dashboard?: unknown;
  homePath?: unknown;
  defaultRoute?: unknown;
  isExamCenter?: unknown;
  isDiplomaCenter?: unknown;
  examCenter?: unknown;
  diplomaCenter?: unknown;
  deleted?: unknown;
  [key: string]: unknown;
};

export type OwnerSchoolTenantClassification =
  | "school"
  | "excluded_center"
  | "unknown";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function marker(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, "_");
}

export function canonicalGovernorate(value: unknown): string {
  let v = clean(value);
  if (!v) return "";

  const prefixes = [
    "المديرية العامة للتعليم بمحافظة ",
    "المديرية العامة للتعليم ",
    "بمحافظة ",
    "محافظة ",
  ];

  for (const prefix of prefixes) {
    if (v.startsWith(prefix)) {
      v = v.slice(prefix.length).trim();
      break;
    }
  }

  return v.replace(/\s+/g, " ").trim();
}

export function tenantGovernorate(row: OwnerSchoolTenant): string {
  return canonicalGovernorate(
    row.governorate ??
      row.tenantGovernorate ??
      row.regionAr ??
      row.governorateAr ??
      row.scopeGovernorate ??
      row.gov ??
      "",
  );
}

export function tenantDisplayName(row: OwnerSchoolTenant): string {
  return clean(
    row.name ??
      row.schoolName ??
      row.tenantName ??
      row.title ??
      row.id ??
      "—",
  );
}

export function classifyOwnerSchoolTenant(
  row: OwnerSchoolTenant,
): OwnerSchoolTenantClassification {
  if (!row || !clean(row.id)) return "unknown";
  if (row.deleted === true) return "unknown";

  if (
    row.isExamCenter === true ||
    row.isDiplomaCenter === true ||
    row.examCenter === true ||
    row.diplomaCenter === true
  ) {
    return "excluded_center";
  }

  const identityMarkers = [
    row.tenantType,
    row.type,
    row.entityType,
    row.kind,
    row.category,
    row.scopeType,
    row.centerType,
    row.programType,
    row.program,
    row.mode,
    row.entryMode,
    row.route,
    row.path,
    row.dashboard,
    row.homePath,
    row.defaultRoute,
  ]
    .map(marker)
    .filter(Boolean);

  const exactCenterMarkers = new Set([
    "exam_center",
    "exam-center",
    "examcenter",
    "diploma",
    "diploma_center",
    "diploma-center",
    "diplomacenter",
    "center",
    "centre",
    "مركز_دبلوم",
    "مركز_امتحانات",
  ]);

  if (
    identityMarkers.some(
      (value) =>
        exactCenterMarkers.has(value) ||
        value.includes("diploma") ||
        value.includes("دبلوم") ||
        value.includes("exam_center") ||
        value.includes("exam-center") ||
        value.includes("diploma_center") ||
        value.includes("diploma-center"),
    )
  ) {
    return "excluded_center";
  }

  const exactSchoolMarkers = new Set([
    "school",
    "tenant_school",
    "school_tenant",
    "school-tenant",
    "مدرسة",
  ]);

  if (
    identityMarkers.some(
      (value) =>
        exactSchoolMarkers.has(value) ||
        value.includes("school"),
    )
  ) {
    return "school";
  }

  const hasSchoolSupervisor =
    clean(row.role) === "tenant_admin" ||
    clean(row.role) === "school_admin" ||
    clean(row.role) === "مشرف المدرسة";

  const hasSchoolName =
    Boolean(
      clean(row.name) ||
      clean(row.schoolName) ||
      clean(row.tenantName) ||
      clean(row.title)
    );

  if (hasSchoolSupervisor && hasSchoolName) {
    return "school";
  }

  if (hasSchoolName && tenantGovernorate(row)) {
    return "school";
  }

  return "unknown";
}

export function sameGovernorate(left: unknown, right: unknown): boolean {
  const a = canonicalGovernorate(left);
  const b = canonicalGovernorate(right);
  return Boolean(a && b && a === b);
}

export function safeDecodeRouteValue(value: string | undefined): string {
  const raw = clean(value);
  if (!raw) return "";

  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}



const listDiplomaCenterTenants = callFn<
  Record<string, never>,
  {
    items?: Array<{
      id: string;
      name: string;
      governorate: string;
      enabled: boolean;
      deleted?: boolean;
    }>;
  }
>("adminListDiplomaCenterTenants");


const listSchoolTenants = callFn<
  Record<string, never>,
  {
    items?: Array<{
      id: string;
      name: string;
      governorate: string;
      enabled: boolean;
      deleted?: boolean;
    }>;
  }
>("adminListSchoolTenants");


export async function loadOwnerSchoolReadModel(
  input: { isPlatformOwner: boolean },
) {

  if (!input?.isPlatformOwner) {
    throw new Error("PLATFORM_OWNER_REQUIRED");
  }

  const [
    schoolResponse,
    diplomaResponse,
  ] = await Promise.all([
    listSchoolTenants({}),
    listDiplomaCenterTenants({}),
  ]);


  if (!schoolResponse || !Array.isArray(schoolResponse.items)) {
    throw new Error("SCHOOL_RESPONSE_INVALID");
  }


  if (!diplomaResponse || !Array.isArray(diplomaResponse.items)) {
    throw new Error("DIPLOMA_RESPONSE_INVALID");
  }


  return {
    schools: schoolResponse.items.filter((item) => item.deleted !== true).map((item) => ({
      id: item.id,
      name: item.name,
      governorate: item.governorate,
      enabled: item.enabled,
      tenantType: "school",
      type: "school",
      entityType: "school",
    })),

    centers: diplomaResponse.items.map((item) => ({
      id: item.id,
      name: item.name,
      governorate: item.governorate,
      enabled: item.enabled,
      tenantType: "diploma_center",
      type: "diploma_center",
      entityType: "center",
    })),

    rejected: [],
  };
}









