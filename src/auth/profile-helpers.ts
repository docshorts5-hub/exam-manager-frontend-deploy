import type { User } from "firebase/auth";
import type { AllowDoc, SaaSRole, UserProfile } from "./types";
import { mapAllowRoleToSaaSRoles, normalizeStoredSaaSRoles } from "./auth-helpers";
import { loadUserProfileUiModel, upsertBaseUserProfileDoc } from "../infra/repositories/userProfileRepository";

export async function upsertBaseUserProfile(user: User, email: string): Promise<void> {
  await upsertBaseUserProfileDoc(user, email);
}

export async function loadUiUserProfile(params: {
  user: User;
  email: string;
  effectiveAllow: AllowDoc | null;
}): Promise<UserProfile | null> {
  const { user, email, effectiveAllow } = params;
  const roles: SaaSRole[] = effectiveAllow
    ? (normalizeStoredSaaSRoles((effectiveAllow as any)?.roles).length
        ? normalizeStoredSaaSRoles((effectiveAllow as any)?.roles)
        : mapAllowRoleToSaaSRoles({
            allowRole: effectiveAllow.role,
            email,
            governorate: (effectiveAllow as any)?.governorate,
          }))
    : [];

  const fallbackProfile: UserProfile | null = effectiveAllow || email
    ? {
        tenantId: effectiveAllow?.tenantId ?? null,
        roles,
        status: "active",
        email,
        displayName: user.displayName || undefined,
        schoolName: undefined,
        updatedAt: undefined,
        source: "manual",
      }
    : null;

  return loadUserProfileUiModel({
    uid: user.uid,
    fallback: fallbackProfile,
  });
}
