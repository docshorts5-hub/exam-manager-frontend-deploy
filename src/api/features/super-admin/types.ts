export type SuperSystemTenant = {
  id: string;
  name?: string;
  enabled?: boolean;
  governorate?: string;
  updatedAt?: unknown;
};

export type SuperSystemAllowRole = "super_admin" | "super" | "admin" | "user";

export type SuperSystemAllowDoc = {
  email: string;
  enabled: boolean;
  role: SuperSystemAllowRole;
  tenantId: string;
  governorate?: string;
  userName?: string;
  schoolName?: string;
  name?: string;
  updatedAt?: unknown;
};

export type SuperPortalActionCard = {
  key: string;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
};


export type SuperProgramTenantRow = {
  id: string;
  name?: string;
  schoolName?: string;
  enabled?: boolean;
  governorate?: string;
};
