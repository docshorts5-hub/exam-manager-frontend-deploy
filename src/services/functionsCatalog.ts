export type CloudFunctionName =
  | "tenantListDocs"
  | "tenantUpsertDoc"
  | "tenantDeleteDoc"
  | "writeActivityLog"
  | "syncMyClaims"
  | "startSupportSession"
  | "endSupportSession"
  | "adminUpsertTenant"
  | "adminDeleteTenant"
  | "adminUpsertAllowlist"
  | "adminDeleteAllowlist"
  | "adminUpsertAllowlistUser"
  | "bootstrapOwner"
  | "adminMigrationCounts"
  | "adminMigrateRootToTenant";

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
    allowLocalFallback: true,
    preferCloudRuntime: true,
  },
  endSupportSession: {
    name: "endSupportSession",
    category: "support",
    description: "End the active support session.",
    allowLocalFallback: true,
    preferCloudRuntime: true,
  },
  adminUpsertTenant: {
    name: "adminUpsertTenant",
    category: "platform-admin",
    description: "Create or update a tenant from the platform admin surface.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminDeleteTenant: {
    name: "adminDeleteTenant",
    category: "platform-admin",
    description: "Archive or disable a tenant from the platform admin surface.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminUpsertAllowlist: {
    name: "adminUpsertAllowlist",
    category: "platform-admin",
    description: "Create or update an allowlist entry.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminDeleteAllowlist: {
    name: "adminDeleteAllowlist",
    category: "platform-admin",
    description: "Delete an allowlist entry.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminUpsertAllowlistUser: {
    name: "adminUpsertAllowlistUser",
    category: "platform-admin",
    description: "Compatibility alias for allowlist upsert.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  bootstrapOwner: {
    name: "bootstrapOwner",
    category: "platform-admin",
    description: "Bootstrap the first platform owner entry.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminMigrationCounts: {
    name: "adminMigrationCounts",
    category: "migration",
    description: "Inspect root-to-tenant migration counts.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
  adminMigrateRootToTenant: {
    name: "adminMigrateRootToTenant",
    category: "migration",
    description: "Run root-to-tenant migration.",
    allowLocalFallback: true,
    platformOwnerOnly: true,
    preferCloudRuntime: true,
  },
};

export function getCloudFunctionSpec(name: string): CloudFunctionSpec | null {
  return (cloudFunctionSpecs as Record<string, CloudFunctionSpec | undefined>)[name] ?? null;
}
