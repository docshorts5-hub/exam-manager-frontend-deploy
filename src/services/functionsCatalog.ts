export type CloudFunctionName =
  | "tenantListDocs"
  | "tenantUpsertDoc"
  | "tenantDeleteDoc"
  | "writeActivityLog"
  | "syncMyClaims"
  | "startSupportSession"
  | "endSupportSession"
  | "adminListDiplomaCenterTenants"
  | "adminListSchoolTenants"
  | "adminUpsertDiplomaCenterTenant"
  | "adminUpsertTenant"
  | "adminUpsertSchoolTenant"
  | "adminDeleteSchoolTenant"
  | "adminDeleteTenant"
  | "adminUpsertAllowlist"
  | "adminDeleteAllowlist"
  | "adminUpsertAllowlistUser"
  | "bootstrapOwner"
  | "adminMigrationCounts"
  | "adminMigrateRootToTenant"
  | "totpAdminInspectUser"
  | "totpAdminResetUser"
  | "totpAdminListResetAudit";

export type CloudFunctionCategory =
  | "tenant-data"
  | "audit"
  | "auth"
  | "support"
  | "platform-admin"
  | "migration";

export type CloudFunctionSpec = {
  name: CloudFunctionName;
  category: CloudFunctionCategory;
  description: string;
  allowLocalFallback: boolean;
  platformOwnerOnly?: boolean;
  preferCloudRuntime?: boolean;
};

export const cloudFunctionSpecs: Record<CloudFunctionName, CloudFunctionSpec> = {
  tenantListDocs: {
    name: "tenantListDocs",
    category: "tenant-data",
    description: "List tenant collection documents.",
    allowLocalFallback: true,
  },
  tenantUpsertDoc: {
    name: "tenantUpsertDoc",
    category: "tenant-data",
    description: "Create or update a tenant-scoped document.",
    allowLocalFallback: true,
  },
  tenantDeleteDoc: {
    name: "tenantDeleteDoc",
    category: "tenant-data",
    description: "Delete a tenant-scoped document.",
    allowLocalFallback: true,
  },
  writeActivityLog: {
    name: "writeActivityLog",
    category: "audit",
    description: "Write a tenant activity log entry.",
    allowLocalFallback: true,
    preferCloudRuntime: true,
  },
  syncMyClaims: {
    name: "syncMyClaims",
    category: "auth",
    description: "Refresh the current user's effective claims.",
    allowLocalFallback: true,
  },
  startSupportSession: {
    name: "startSupportSession",
    category: "support",
    description: "Start a support session for a tenant.",
    allowLocalFallback: false,
    preferCloudRuntime: true,
  },
  endSupportSession: {
    name: "endSupportSession",
    category: "support",
    description: "End the active support session.",
    allowLocalFallback: false,
    preferCloudRuntime: true,
  },
  adminListDiplomaCenterTenants: {
    name: "adminListDiplomaCenterTenants",
    category: "platform-admin",
    description: "List explicit diploma-center tenants for the platform owner only.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminListSchoolTenants: {
    name: "adminListSchoolTenants",
    category: "platform-admin",
    description: "List explicit school tenants for the platform owner only.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminUpsertDiplomaCenterTenant: {
    name: "adminUpsertDiplomaCenterTenant",
    category: "platform-admin",
    description: "Create or update an explicit diploma-center tenant for the platform owner only.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminUpsertTenant: {
    name: "adminUpsertTenant",
    category: "platform-admin",
    description: "Create or update a tenant from the platform admin surface.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminUpsertSchoolTenant: {
    name: "adminUpsertSchoolTenant",
    category: "platform-admin",
    description: "Create or update an explicit school tenant with server-side school invariants.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminDeleteSchoolTenant: {
    name: "adminDeleteSchoolTenant",
    category: "platform-admin",
    description: "Archive or disable an explicit school tenant from the platform admin surface.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminDeleteTenant: {
    name: "adminDeleteTenant",
    category: "platform-admin",
    description: "Archive or disable a tenant from the platform admin surface.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminUpsertAllowlist: {
    name: "adminUpsertAllowlist",
    category: "platform-admin",
    description: "Create or update an allowlist entry.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminDeleteAllowlist: {
    name: "adminDeleteAllowlist",
    category: "platform-admin",
    description: "Delete an allowlist entry.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminUpsertAllowlistUser: {
    name: "adminUpsertAllowlistUser",
    category: "platform-admin",
    description: "Compatibility alias for allowlist upsert.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  bootstrapOwner: {
    name: "bootstrapOwner",
    category: "platform-admin",
    description: "Bootstrap the first platform owner entry.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminMigrationCounts: {
    name: "adminMigrationCounts",
    category: "migration",
    description: "Inspect root-to-tenant migration counts.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminMigrateRootToTenant: {
    name: "adminMigrateRootToTenant",
    category: "migration",
    description: "Run root-to-tenant migration.",
    allowLocalFallback: false,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  totpAdminInspectUser: {
    name: "totpAdminInspectUser",
    category: "auth",
    description: "Inspect a TOTP account within the authenticated administrative scope.",
    allowLocalFallback: false,
    preferCloudRuntime: true,
  },
  totpAdminResetUser: {
    name: "totpAdminResetUser",
    category: "auth",
    description: "Reset TOTP securely while preserving other MFA factors.",
    allowLocalFallback: false,
    preferCloudRuntime: true,
  },
  totpAdminListResetAudit: {
    name: "totpAdminListResetAudit",
    category: "audit",
    description: "List visible TOTP reset audit records within the administrative scope.",
    allowLocalFallback: false,
    preferCloudRuntime: true,
  },
};

export function getCloudFunctionSpec(name: string): CloudFunctionSpec | null {
  return (cloudFunctionSpecs as Record<string, CloudFunctionSpec | undefined>)[name] ?? null;
}








