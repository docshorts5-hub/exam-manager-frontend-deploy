import { useEffect, useRef, useState } from "react";
import { multiFactor, onAuthStateChanged, type User } from "firebase/auth";
import type { AllowDoc, TokenClaims, UserProfile } from "../types";
import { auth } from "../../firebase/firebase";

import { writeActivityLog } from "../../services/activityLog.service";
import { allowFromClaims, fetchTokenClaims, mapAllowRoleToSaaSRoles, normalizeAllowlistRole, normalizeStoredSaaSRoles } from "../auth-helpers";
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
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaSatisfied, setMfaSatisfied] = useState(false);
  const loggedThisSessionRef = useRef(false);
  const claimsSyncAttemptedRef = useRef(false);

  const refreshMfaState = async (targetUser?: User | null) => {
    const currentUser = targetUser ?? auth.currentUser ?? user;

    if (!currentUser) {
      setMfaEnrolled(false);
      setMfaSatisfied(false);
      return;
    }

    const hasTotpEnrollment = multiFactor(currentUser).enrolledFactors.some(
      (factor) => String(factor.factorId || "").toLowerCase() === "totp"
    );

    let hasSatisfiedTotp = false;

    try {
      const token = await currentUser.getIdTokenResult();
      const firebaseClaims = (token.claims as any)?.firebase;

      hasSatisfiedTotp =
        String(firebaseClaims?.sign_in_second_factor ?? "").toLowerCase() ===
        "totp";
    } catch {
      hasSatisfiedTotp = false;
    }

    setMfaEnrolled(hasTotpEnrollment);
    setMfaSatisfied(hasSatisfiedTotp);
  };

  const refreshAllow = async (targetUser?: User | null) => {
    const currentUser = targetUser ?? auth.currentUser ?? user;
    const email = currentUser?.email ? String(currentUser.email).toLowerCase().trim() : "";
    if (!email || !currentUser) {
      setAllow(null);
      setUserProfile(null);
      return;
    }


    const tokenClaims = await fetchTokenClaims(currentUser);
    setClaims(tokenClaims);
    const allowFromToken = allowFromClaims(email, tokenClaims);

    let effectiveAllow = allowFromToken;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../../firebase/firebase");
      const aSnap = await getDoc(doc(db, "allowlist", email));
      if (aSnap.exists()) {
        const a = aSnap.data() as any;
        if (a?.enabled === true) {
          const roleBase = a?.role ?? effectiveAllow?.role;
          const r = normalizeAllowlistRole(roleBase, email, a?.governorate);
          const roles = normalizeStoredSaaSRoles(a?.roles);
          const isGlobalRole = r === "super" || r === "ministry_super" || r === "super_admin";
          const tenantFromDoc = String(a?.tenantId ?? effectiveAllow?.tenantId ?? "").trim();
          const tenantId = isGlobalRole ? SUPER_ADMIN_TENANT_ID : tenantFromDoc;

          // سوبر المحافظة قد لا يكون مرتبطًا بمدرسة محددة، لذلك لا نرفضه بسبب غياب tenantId.
          if (tenantId || isGlobalRole) {
            effectiveAllow = {
              email,
              enabled: true,
              role: r,
              roles: roles.length ? roles : mapAllowRoleToSaaSRoles({ allowRole: r, email, governorate: a?.governorate }),
              tenantId: tenantId || SUPER_ADMIN_TENANT_ID,
              userName: a?.userName ?? undefined,
              schoolName: a?.schoolName ?? undefined,
              governorate: a?.governorate ?? undefined,
              name: a?.name ?? undefined,
            } as AllowDoc;
          }
        }
      }
    } catch {}

    setAllow(effectiveAllow);

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
          setMfaEnrolled(false);
          setMfaSatisfied(false);
          return;
        }
        await refreshMfaState(u);
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
    mfaEnrolled,
    mfaSatisfied,
    refreshMfaState,
    loading,
    refreshAllow,
    setAllow,
    setUserProfile,
    setClaims,
  };
}
