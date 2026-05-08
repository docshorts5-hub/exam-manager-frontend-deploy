import React, { createContext, useContext, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { buildAuthzSnapshot, isPlatformOwner, resolveEffectiveRoles } from "../features/authz";

export type Role = "super_admin" | "tenant_admin" | "manager" | "staff" | "viewer";

export type UserProfile = {
  tenantId: string | null;
  roles: Role[];
  status: "active" | "suspended";
  displayName?: string;
};

type SessionState = {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  tenantId: string | null;
  roles: Role[];
  isActive: boolean;
  hasRole: (...roles: Role[]) => boolean;
};

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth() as any;
  const profile = (auth?.userProfile ?? null) as UserProfile | null;
  const snapshot = auth?.authzSnapshot || buildAuthzSnapshot(auth);
  const tenantId = profile?.tenantId ?? auth?.tenantId ?? null;
  const roles = resolveEffectiveRoles(snapshot) as Role[];
  const isActive = (profile?.status === "active") || snapshot.isEnabled === true;

  const hasRole = (...required: Role[]) => {
    if (isPlatformOwner(snapshot)) return true;
    return required.some((r) => roles.includes(r));
  };

  const value = useMemo(
    () => ({ user: auth?.user ?? null, profile, loading: !!auth?.loading, tenantId, roles, isActive, hasRole }),
    [auth?.user, profile, auth?.loading, tenantId, roles, isActive]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
