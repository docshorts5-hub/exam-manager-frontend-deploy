export type PlatformRole = "super_admin" | "ministry_super" | "super";

export type TenantRole = "tenant_admin";

export type SaaSRole = PlatformRole | TenantRole;

export type Capability =
  | "PLATFORM_OWNER"
  | "SYSTEM_ADMIN"
  | "TENANTS_MANAGE"
  | "SUPER_USERS_MANAGE"
  | "USERS_MANAGE"
  | "TENANT_READ"
  | "TENANT_WRITE"
  | "TEACHERS_MANAGE"
  | "EXAMS_MANAGE"
  | "ROOMS_MANAGE"
  | "DISTRIBUTION_RUN"
  | "REPORTS_VIEW"
  | "ARCHIVE_MANAGE"
  | "AUDIT_VIEW"
  | "SYNC_ADMIN"
  | "SETTINGS_MANAGE"
  | "SUPPORT_MODE";

export interface AuthzSnapshot {
  isAuthenticated: boolean;
  isEnabled: boolean;
  isSuperAdmin: boolean;
  isSuper: boolean;
  tenantId?: string | null;
  roles: SaaSRole[];
  supportTenantId?: string | null;
  supportUntil?: number | null;
  isSupportMode?: boolean;
  displayName?: string | null;
}
