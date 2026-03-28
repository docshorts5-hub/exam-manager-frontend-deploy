import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import type { AllowDoc, TokenClaims, UserProfile } from "../types";
import { auth } from "../../firebase/firebase";
import { PRIMARY_SUPER_ADMIN_EMAIL } from "../../constants/directorates";
import { writeActivityLog } from "../../services/activityLog.service";
import { allowFromClaims, fetchTokenClaims, mapAllowRoleToSaaSRoles, normalizeAllowlistRole, normalizeStoredSaaSRoles, ownerAllow } from "../auth-helpers";
import { loadUiUserProfile, upsertBaseUserProfile } from "../profile-helpers";
import { SUPER_ADMIN_TENANT_ID } from "../types";

const DISABLE_FUNCTIONS = String(import.meta.env.VITE_DISABLE_FUNCTIONS ?? "true") === "true";
const IS_DEV = Boolean(import.meta.env.DEV);

export function useAuthSessionState() {
  const [user, setUser] = useState<User | null>(null);
  const [allow, setAllow] = useState<AllowDoc | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [claims, setClaims] = useState<TokenClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const loggedThisSessionRef = useRef(false);
  const claimsSyncAttemptedRef = useRef(false);

  const refreshAllow = async (targetUser?: User | null) => {
    const currentUser = targetUser ?? auth.currentUser ?? user;
    const email = currentUser?.email ? String(currentUser.email).toLowerCase().trim() : "";
    if (!email || !currentUser) {
      setAllow(null);
      setUserProfile(null);
      return;
    }

    if (email === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) {
      setAllow(ownerAllow(email));
    }

    const tokenClaims = await fetchTokenClaims(currentUser);
    setClaims(tokenClaims);
    const allowFromToken = allowFromClaims(email, tokenClaims);
    setAllow(allowFromToken || (email === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() ? ownerAllow(email) : null));

    let effectiveAllow = allowFromToken || (email === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() ? ownerAllow(email) : null);
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../../firebase/firebase");
      const aSnap = await getDoc(doc(db, "allowlist", email));
      if (aSnap.exists()) {
        const a = aSnap.data() as any;
        if (a?.enabled === true && String(a?.tenantId ?? "").trim()) {
          const roleBase = effectiveAllow?.role ?? a?.role;
          const r = normalizeAllowlistRole(roleBase, email, a?.governorate);
          const roles = normalizeStoredSaaSRoles(a?.roles);
          effectiveAllow = {
            email,
            enabled: effectiveAllow?.enabled ?? true,
            role: r,
            roles: roles.length ? roles : mapAllowRoleToSaaSRoles({ allowRole: r, email, governorate: a?.governorate }),
            tenantId: r === "super" || r === "super_admin" ? SUPER_ADMIN_TENANT_ID : String(effectiveAllow?.tenantId ?? a.tenantId).trim(),
            userName: a?.userName ?? undefined,
            schoolName: a?.schoolName ?? undefined,
            governorate: a?.governorate ?? undefined,
            name: a?.name ?? undefined,
          } as AllowDoc;
          setAllow(effectiveAllow);
        }
      }
    } catch {}

    if (
      !DISABLE_FUNCTIONS &&
      !IS_DEV &&
      !claimsSyncAttemptedRef.current &&
      effectiveAllow?.enabled === true &&
      String(effectiveAllow?.role ?? "").toLowerCase() === "super"
    ) {
      const needsSync = !(tokenClaims?.enabled === true && String(tokenClaims?.role ?? "").toLowerCase() === "super");
      if (needsSync) {
        claimsSyncAttemptedRef.current = true;
        try {
          const { callFn } = await import("../../services/functionsClient");
          await callFn<any, any>("syncMyClaims")({});
          await currentUser.getIdToken(true);
          const synced = await fetchTokenClaims(currentUser);
          setClaims(synced);
          const allowSynced = allowFromClaims(email, synced);
          if (allowSynced) {
            effectiveAllow = allowSynced;
            setAllow(allowSynced);
          }
        } catch {}
      }
    }

    await upsertBaseUserProfile(currentUser, email);
    setUserProfile(
      await loadUiUserProfile({
        user: currentUser,
        email,
        effectiveAllow: effectiveAllow ?? allowFromToken,
      })
    );

    if ((effectiveAllow ?? allowFromToken) && currentUser.uid && !loggedThisSessionRef.current) {
      loggedThisSessionRef.current = true;
      await writeActivityLog((effectiveAllow ?? allowFromToken)!.tenantId, {
        level: "info",
        action: "LOGIN",
        actorUid: currentUser.uid,
        actorEmail: email,
        actorDisplayName: currentUser.displayName || "",
        message: "User signed in",
      });
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(true);
      try {
        if (!u?.email) {
          setAllow(null);
          setUserProfile(null);
          setClaims(null);
          return;
        }
        await refreshAllow(u);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);


  return {
    user,
    allow,
    userProfile,
    claims,
    loading,
    refreshAllow,
    setAllow,
    setUserProfile,
    setClaims,
  };
}
