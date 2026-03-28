import type { User } from "firebase/auth";
import type { AuthzSnapshot, Capability } from "../features/authz";

export type Role = "super_admin" | "super" | "admin" | "user";
export type SaaSRole = "super_admin" | "tenant_admin" | "manager" | "staff" | "viewer";

export type AllowDoc = {
  email: string;
  enabled: boolean;
  role: Role;
  roles?: SaaSRole[];
  tenantId: string;
  governorate?: string;
  userName?: string;
  schoolName?: string;
  name?: string;
  lastLoginAt?: any;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
};

export type UserProfile = {
  tenantId: string | null;
  roles: SaaSRole[];
  status: "active" | "suspended";
  email: string;
  displayName?: string;
  schoolName?: string;
  updatedAt?: any;
  source?: "allowlist" | "manual";
};

export type TokenClaims = {
  tenantId?: string;
  role?: Role;
  enabled?: boolean;
  isOwner?: boolean;
  supportTenantId?: string;
  supportUntil?: number;
};

export type AuthCtx = {
  user: User | null;
  loading: boolean;
  claims: TokenClaims | null;
  allow: AllowDoc | null;
  effectiveAllow: AllowDoc | null;
  effectiveTenantId: string | null;
  effectiveRole: Role | null;
  userProfile: UserProfile | null;
  profile: AllowDoc | null;
  isSuperAdmin: boolean;
  isSuper: boolean;
  isAdmin: boolean;
  isPlatformOwner: boolean;
  canSupport: boolean;
  supportTenantId: string | null;
  supportUntil: number | null;
  startSupportForTenant: (tenantId: string, reason?: string) => Promise<void>;
  endSupport: () => Promise<void>;
  refreshAllow: () => Promise<void>;
  logout: () => Promise<void>;
  isSupportMode: boolean;
  tenantId: string | null;
  authzSnapshot: AuthzSnapshot;
  capabilities: Capability[];
  can: (capability: Capability) => boolean;
  primaryRoleLabel: string;
};

export const SUPER_ADMIN_TENANT_ID = "system";
