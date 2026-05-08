export type TenantDoc = {
  id: string;
  name?: string;
  enabled?: boolean;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
  governorate?: string;
  deleted?: boolean;
};

export type TenantConfig = {
  ministryAr?: string;
  schoolNameAr?: string;
  systemNameAr?: string;
  governorate?: string;
  regionAr?: string;
  wilayatAr?: string;
  logoUrl?: string;
};

export type AllowUser = {
  email: string;
  enabled: boolean;
  role: "user" | "admin" | "tenant_admin" | "super" | "ministry_super" | "super_admin";
  tenantId: string;
  name?: string;
  schoolName?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
  governorate?: string;
};
