import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

try {
  admin.app();
} catch {
  admin.initializeApp();
}

const db = admin.firestore();

const OWNER_EMAIL = "3asal2030@gmail.com";
const MAX_ADMIN_SESSION_AGE_SECONDS = 30 * 60;
const TOTP_RESET_LOCK_TTL_MS = 2 * 60 * 1000;
const TOTP_RESET_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

type ActorContext = {
  uid: string;
  email: string;
  role: string;
  governorate: string;
  isOwner: boolean;
  isGovernorateSupervisor: boolean;
};

type TargetContext = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  emailVerified: boolean;
  providerIds: string[];
  allowlistExists: boolean;
  allowlistEnabled: boolean;
  role: string;
  tenantId: string;
  governorate: string;
  tenantKind: string;
  factors: Array<{
    uid: string;
    factorId: string;
    displayName: string;
    enrollmentTime: string;
  }>;
};

type InspectRequest = {
  email?: string;
};

type ResetRequest = {
  requestId?: string;
  email?: string;
  confirmTargetEmail?: string;
  reason?: string;
  confirmSelfReset?: boolean;
};

type ResetResult = {
  ok: true;
  auditId: string;
  requestId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS";
  targetUid: string;
  targetEmail: string;
  removedTotpFactors: number;
  preservedOtherFactors: number;
  refreshTokensRevoked: boolean;
  selfReset: boolean;
  requiresNewTotpEnrollment: true;
  warningCode?: string;
};

type AuditRequest = {
  limit?: number;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeResetRequestId(value: unknown) {
  const requestId = text(value);

  if (!TOTP_RESET_REQUEST_ID_PATTERN.test(requestId)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "INVALID_REQUEST_ID"
    );
  }

  return requestId;
}

function firestoreValueMillis(value: unknown) {
  const candidate = value as {
    toMillis?: () => number;
  };

  if (typeof candidate?.toMillis === "function") {
    return Number(candidate.toMillis()) || 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function completedResetResult(
  entry: FirebaseFirestore.DocumentData,
  auditId: string
): ResetResult | null {
  const status = text(entry.status);

  if (
    status !== "SUCCESS" &&
    status !== "PARTIAL_SUCCESS"
  ) {
    return null;
  }

  return {
    ok: true,
    auditId,
    requestId: text(entry.requestId),
    status,
    targetUid: text(entry.targetUid),
    targetEmail: text(entry.targetEmail),
    removedTotpFactors: Number(
      entry.removedTotpFactors ||
        entry.requestedTotpFactors ||
        0
    ),
    preservedOtherFactors: Number(
      entry.preservedOtherFactors || 0
    ),
    refreshTokensRevoked:
      entry.refreshTokensRevoked === true,
    selfReset: entry.selfReset === true,
    requiresNewTotpEnrollment: true,
    warningCode:
      text(entry.warningCode) || undefined,
  };
}

async function releaseResetLock(
  lockRef: FirebaseFirestore.DocumentReference,
  requestId: string
) {
  await db.runTransaction(async (transaction) => {
    const lockSnap =
      await transaction.get(lockRef);

    if (
      lockSnap.exists &&
      text(lockSnap.data()?.requestId) === requestId
    ) {
      transaction.delete(lockRef);
    }
  });
}

function normalizeRole(value: unknown) {
  const role = text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "super_admin",
      "superadmin",
      "owner",
      "platform_owner",
      "مالك_المنصة",
    ].includes(role)
  ) {
    return "super_admin";
  }

  if (
    [
      "ministry_super",
      "super_ministry",
      "مشرف_الوزارة",
      "سوبر_الوزارة",
    ].includes(role)
  ) {
    return "ministry_super";
  }

  if (
    [
      "super",
      "governorate_super",
      "super_governorate",
      "مشرف_المحافظة",
      "مشرف_المديرية",
      "سوبر_المحافظة",
    ].includes(role)
  ) {
    return "super";
  }

  if (
    [
      "tenant_admin",
      "school_admin",
      "مدير_مدرسة",
      "أدمن_المدرسة",
    ].includes(role)
  ) {
    return "tenant_admin";
  }

  if (
    [
      "exam_super",
      "super_exam",
      "رئيس_مركز",
      "رئيس_مركز_دبلوم",
      "مشرف_امتحانات_الدبلوم",
    ].includes(role)
  ) {
    return "exam_super";
  }

  if (role === "admin") return "admin";
  if (role === "user") return "user";

  return role || "user";
}

function normalizeGovernorate(value: unknown) {
  return text(value)
    .replace(
      /^المديرية العامة للتربية والتعليم بمحافظة\s*/u,
      ""
    )
    .replace(
      /^المديرية العامة للتعليم بمحافظة\s*/u,
      ""
    )
    .replace(/^محافظة\s*/u, "")
    .replace(/^بمحافظة\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectTenantKind(
  data: FirebaseFirestore.DocumentData
): "school" | "exam_center" | "" {
  const normalizedKinds = [
    data?.type,
    data?.tenantType,
    data?.kind,
    data?.category,
    data?.programType,
  ]
    .map((value) =>
      text(value)
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
    )
    .filter(Boolean);

  const centerKinds = new Set([
    "exam",
    "exam_center",
    "examcenter",
    "diploma",
    "diploma_center",
    "center",
    "مركز",
    "دبلوم",
  ]);

  const schoolKinds = new Set([
    "school",
    "مدرسة",
  ]);

  if (normalizedKinds.some((kind) => centerKinds.has(kind))) {
    return "exam_center";
  }

  if (normalizedKinds.some((kind) => schoolKinds.has(kind))) {
    return "school";
  }

  const hasCenterName = Boolean(
    text(
      data?.centerName ||
        data?.centerNameAr ||
        data?.examCenterName ||
        data?.diplomaCenterName
    )
  );

  const hasSchoolName = Boolean(
    text(
      data?.schoolName ||
        data?.schoolNameAr
    )
  );

  if (hasCenterName && !hasSchoolName) {
    return "exam_center";
  }

  if (hasSchoolName && !hasCenterName) {
    return "school";
  }

  return "";
}

async function getAllowlist(email: string) {
  const snap =
    await db.collection("allowlist").doc(email).get();

  return {
    exists: snap.exists,
    data: snap.exists ? snap.data() || {} : {},
  };
}

function serializedFactors(
  user: admin.auth.UserRecord
): Array<Record<string, unknown>> {
  const multiFactorJson =
    user.multiFactor?.toJSON?.() as
      | {
          enrolledFactors?: unknown[];
        }
      | undefined;

  const rawFactors =
    multiFactorJson?.enrolledFactors;

  if (!Array.isArray(rawFactors)) {
    return [];
  }

  return rawFactors.filter(
    (
      factor
    ): factor is Record<string, unknown> =>
      factor !== null &&
      typeof factor === "object" &&
      !Array.isArray(factor)
  );
}

function publicFactors(user: admin.auth.UserRecord) {
  return (user.multiFactor?.enrolledFactors || []).map(
    (factor) => ({
      uid: text(factor.uid),
      factorId: text(factor.factorId).toLowerCase(),
      displayName: text(factor.displayName),
      enrollmentTime: text(factor.enrollmentTime),
    })
  );
}

async function requireRecentTotpAdminSession(
  context: functions.https.CallableContext
): Promise<ActorContext> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "AUTH_REQUIRED"
    );
  }

  const token: any = context.auth.token || {};
  const email = normalizeEmail(token.email);

  if (!email) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "AUTH_EMAIL_REQUIRED"
    );
  }

  const allow = await getAllowlist(email);
  const isOwner = email === OWNER_EMAIL;

  const role = isOwner
    ? "super_admin"
    : normalizeRole(
        allow.data?.role || "user"
      );

  const enabled =
    isOwner ||
    (allow.exists &&
      allow.data?.enabled === true);

  if (!enabled) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "USER_DISABLED_OR_NOT_ALLOWED"
    );
  }

  const permittedActor =
    isOwner ||
    role === "ministry_super" ||
    role === "super";

  if (!permittedActor) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "TOTP_RESET_ADMIN_ROLE_REQUIRED"
    );
  }

  const firebaseClaims = token.firebase || {};

  const claimValues = [
    text(firebaseClaims.sign_in_second_factor),
    text(firebaseClaims.second_factor_identifier),
  ].filter(Boolean);

  if (claimValues.length < 1) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SECOND_FACTOR_ADMIN_SESSION_REQUIRED"
    );
  }

  const authTime = Number(token.auth_time || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    !Number.isFinite(authTime) ||
    authTime <= 0 ||
    nowSeconds - authTime >
      MAX_ADMIN_SESSION_AGE_SECONDS
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "RECENT_MFA_SIGN_IN_REQUIRED"
    );
  }

  const actorUser =
    await admin.auth().getUser(context.auth.uid);

  const actorFactors =
    actorUser.multiFactor?.enrolledFactors || [];

  const totpFactors = actorFactors.filter(
    (factor) =>
      text(factor.factorId).toLowerCase() === "totp"
  );

  if (totpFactors.length < 1) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "ACTOR_TOTP_ENROLLMENT_REQUIRED"
    );
  }

  const matchedTotp = totpFactors.some(
    (factor) =>
      claimValues.includes(text(factor.uid)) ||
      claimValues.includes(
        text(factor.factorId).toLowerCase()
      )
  );

  if (!matchedTotp) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "TOTP_SESSION_FACTOR_COULD_NOT_BE_VERIFIED"
    );
  }

  return {
    uid: context.auth.uid,
    email,
    role,
    governorate: text(allow.data?.governorate || ""),
    isOwner,
    isGovernorateSupervisor: role === "super",
  };
}

async function loadTarget(
  rawEmail: unknown
): Promise<TargetContext> {
  const email = normalizeEmail(rawEmail);

  if (!email || !validEmail(email)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "INVALID_EMAIL"
    );
  }

  const allow = await getAllowlist(email);

  let user: admin.auth.UserRecord;

  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (error: any) {
    if (
      String(error?.code || "") ===
      "auth/user-not-found"
    ) {
      throw new functions.https.HttpsError(
        "not-found",
        "AUTH_USER_NOT_FOUND"
      );
    }

    throw error;
  }

  const claims = user.customClaims || {};

  const role =
    email === OWNER_EMAIL
      ? "super_admin"
      : normalizeRole(
          allow.data?.role ||
            claims.role ||
            "user"
        );

  const tenantId = text(
    allow.data?.tenantId ||
      claims.tenantId ||
      ""
  );

  let governorate = text(
    allow.data?.governorate ||
      claims.governorate ||
      ""
  );

  let tenantKind = "";

  if (tenantId) {
    const tenantRef =
      db.collection("tenants").doc(tenantId);

    const [tenantSnap, metaSnap] =
      await Promise.all([
        tenantRef.get(),
        tenantRef
          .collection("meta")
          .doc("config")
          .get(),
      ]);

    if (tenantSnap.exists || metaSnap.exists) {
      const tenantData = {
        ...(tenantSnap.data() || {}),
        ...(metaSnap.data() || {}),
      };

      tenantKind = detectTenantKind(tenantData);

      if (!governorate) {
        governorate = text(
          tenantData.governorate ||
            tenantData.regionAr ||
            ""
        );
      }
    }
  }

  return {
    uid: user.uid,
    email,
    displayName: text(user.displayName),
    disabled: user.disabled === true,
    emailVerified: user.emailVerified === true,
    providerIds: user.providerData
      .map((provider) => text(provider.providerId))
      .filter(Boolean),
    allowlistExists: allow.exists,
    allowlistEnabled: allow.data?.enabled === true,
    role,
    tenantId,
    governorate,
    tenantKind,
    factors: publicFactors(user),
  };
}

async function resolveScope(
  actor: ActorContext,
  target: TargetContext
) {
  if (actor.isOwner) {
    return "platform_owner";
  }

  if (actor.role === "ministry_super") {
    if (
      !target.allowlistExists ||
      target.role !== "super"
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "MINISTRY_CAN_RESET_GOVERNORATE_SUPERS_ONLY"
      );
    }

    return "ministry_governorate_supers";
  }

  if (actor.isGovernorateSupervisor) {
    if (actor.email === target.email) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "GOVERNORATE_SUPER_SELF_RESET_DENIED"
      );
    }

    if (
      !target.allowlistExists ||
      !target.tenantId
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "TARGET_TENANT_LINK_REQUIRED"
      );
    }

    const schoolAdmin =
      (
        target.role === "tenant_admin" ||
        target.role === "admin"
      ) &&
      target.tenantKind === "school";

    const diplomaAdmin =
      target.role === "exam_super" &&
      target.tenantKind === "exam_center";

    if (!schoolAdmin && !diplomaAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "GOVERNORATE_CAN_RESET_SCHOOL_AND_DIPLOMA_ADMINS_ONLY"
      );
    }

    const actorGov =
      normalizeGovernorate(actor.governorate);

    const targetGov =
      normalizeGovernorate(target.governorate);

    if (
      !actorGov ||
      !targetGov ||
      actorGov !== targetGov
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "CROSS_GOVERNORATE_TOTP_RESET_DENIED"
      );
    }

    return "governorate_schools_diploma";
  }

  throw new functions.https.HttpsError(
    "permission-denied",
    "TOTP_RESET_ADMIN_ROLE_REQUIRED"
  );
}

function publicTarget(
  target: TargetContext,
  scope: string
) {
  const totpFactors = target.factors.filter(
    (factor) => factor.factorId === "totp"
  );

  return {
    ...target,
    factorCount: target.factors.length,
    totpFactorCount: totpFactors.length,
    otherFactorCount:
      target.factors.length - totpFactors.length,
    totpEnrolled: totpFactors.length > 0,
    scope,
  };
}

function timestampIso(value: any) {
  try {
    if (
      value &&
      typeof value.toDate === "function"
    ) {
      return value.toDate().toISOString();
    }
  } catch {
    return "";
  }

  return "";
}

function canViewAudit(
  actor: ActorContext,
  entry: FirebaseFirestore.DocumentData
) {
  if (actor.isOwner) return true;

  const targetRole =
    normalizeRole(entry.targetRole);

  if (actor.role === "ministry_super") {
    return targetRole === "super";
  }

  if (actor.isGovernorateSupervisor) {
    const sameGovernorate =
      normalizeGovernorate(
        entry.targetGovernorate
      ) ===
      normalizeGovernorate(
        actor.governorate
      );

    return (
      sameGovernorate &&
      [
        "tenant_admin",
        "admin",
        "exam_super",
      ].includes(targetRole)
    );
  }

  return false;
}

export const totpAdminInspectUser =
  functions
    .region("us-central1")
    .https.onCall(
      async (data: InspectRequest, context) => {
        const actor =
          await requireRecentTotpAdminSession(context);

        const target =
          await loadTarget(data?.email);

        const scope =
          await resolveScope(actor, target);

        return {
          ok: true,
          target: publicTarget(target, scope),
        };
      }
    );

export const totpAdminResetUser =
  functions
    .region("us-central1")
    .https.onCall(
      async (data: ResetRequest, context) => {
        const actor =
          await requireRecentTotpAdminSession(context);

        const requestId =
          normalizeResetRequestId(data?.requestId);

        const email =
          normalizeEmail(data?.email);

        const confirmedEmail =
          normalizeEmail(data?.confirmTargetEmail);

        const reason = text(data?.reason);

        if (!email || !validEmail(email)) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "INVALID_EMAIL"
          );
        }

        if (confirmedEmail !== email) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "TARGET_EMAIL_CONFIRMATION_MISMATCH"
          );
        }

        if (
          reason.length < 10 ||
          reason.length > 500
        ) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "RESET_REASON_MUST_BE_10_TO_500_CHARACTERS"
          );
        }

        const target = await loadTarget(email);
        const scope =
          await resolveScope(actor, target);

        const selfReset =
          actor.email === target.email;

        if (
          selfReset &&
          (
            !actor.isOwner ||
            data?.confirmSelfReset !== true
          )
        ) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "OWNER_SELF_RESET_CONFIRMATION_REQUIRED"
          );
        }

        const auditRef =
          db.collection("securityAudit").doc(requestId);

        const lockRef =
          db
            .collection("securityOperationLocks")
            .doc(target.uid);

        const nowMillis = Date.now();
        const lockExpiresAt =
          admin.firestore.Timestamp.fromMillis(
            nowMillis + TOTP_RESET_LOCK_TTL_MS
          );

        const previousResult =
          await db.runTransaction<ResetResult | null>(
            async (transaction) => {
              const [auditSnap, lockSnap] =
                await Promise.all([
                  transaction.get(auditRef),
                  transaction.get(lockRef),
                ]);

              if (auditSnap.exists) {
                const existing =
                  auditSnap.data() || {};

                const sameRequest =
                  existing.type === "TOTP_RESET" &&
                  text(existing.source) ===
                    "totpAdminResetUser" &&
                  text(existing.requestId) === requestId &&
                  text(existing.actorUid) === actor.uid &&
                  text(existing.targetUid) === target.uid;

                if (!sameRequest) {
                  throw new functions.https.HttpsError(
                    "already-exists",
                    "REQUEST_ID_COLLISION"
                  );
                }

                const completed =
                  completedResetResult(
                    existing,
                    auditRef.id
                  );

                if (completed) {
                  return completed;
                }

                if (
                  text(existing.status) === "PENDING" ||
                  text(existing.status) === "TOTP_REMOVED"
                ) {
                  throw new functions.https.HttpsError(
                    "aborted",
                    "TOTP_RESET_ALREADY_IN_PROGRESS"
                  );
                }

                throw new functions.https.HttpsError(
                  "failed-precondition",
                  "REQUEST_ID_PREVIOUSLY_FAILED"
                );
              }

              if (lockSnap.exists) {
                const activeLock =
                  lockSnap.data() || {};

                const activeRequestId =
                  text(activeLock.requestId);

                const activeUntil =
                  firestoreValueMillis(
                    activeLock.expiresAt
                  );

                if (
                  activeRequestId !== requestId &&
                  activeUntil > nowMillis
                ) {
                  throw new functions.https.HttpsError(
                    "aborted",
                    "TOTP_RESET_ALREADY_IN_PROGRESS"
                  );
                }
              }

              transaction.set(lockRef, {
                type: "TOTP_RESET_LOCK",
                requestId,
                actorUid: actor.uid,
                actorEmail: actor.email,
                targetUid: target.uid,
                targetEmail: target.email,
                createdAt:
                  FieldValue.serverTimestamp(),
                expiresAt: lockExpiresAt,
              });

              transaction.set(auditRef, {
                type: "TOTP_RESET",
                status: "PENDING",
                source: "totpAdminResetUser",
                requestId,
                scope,
                actorUid: actor.uid,
                actorEmail: actor.email,
                actorRole: actor.role,
                actorGovernorate: actor.governorate,
                targetUid: target.uid,
                targetEmail: target.email,
                targetRole: target.role,
                targetTenantId: target.tenantId,
                targetGovernorate: target.governorate,
                targetTenantKind: target.tenantKind,
                selfReset,
                reason,
                lockExpiresAt,
                createdAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp(),
              });

              return null;
            }
          );

        if (previousResult) {
          return previousResult;
        }

        let removedTotpFactors = 0;
        let preservedOtherFactors = 0;
        let mutationAttempted = false;
        let mutationApplied = false;

        try {
          const user =
            await admin.auth().getUser(target.uid);

          const currentFactors =
            user.multiFactor?.enrolledFactors || [];

          const totpFactors =
            currentFactors.filter(
              (factor) =>
                text(factor.factorId)
                  .toLowerCase() === "totp"
            );

          if (totpFactors.length < 1) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "TOTP_NOT_ENROLLED"
            );
          }

          const allSerialized =
            serializedFactors(user);

          const preserved =
            allSerialized.filter(
              (factor) =>
                text(factor.factorId)
                  .toLowerCase() !== "totp"
            );

          if (
            preserved.length !==
            currentFactors.length -
              totpFactors.length
          ) {
            throw new functions.https.HttpsError(
              "internal",
              "MFA_FACTOR_PRESERVATION_VALIDATION_FAILED"
            );
          }

          removedTotpFactors =
            totpFactors.length;

          preservedOtherFactors =
            preserved.length;

          await auditRef.set(
            {
              requestedTotpFactors:
                removedTotpFactors,
              preservedOtherFactors,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          mutationAttempted = true;

          await admin.auth().updateUser(
            target.uid,
            {
              multiFactor: {
                enrolledFactors:
                  preserved as any,
              },
            }
          );

          let verifiedUser: admin.auth.UserRecord | null = null;
          let verificationError: unknown = null;

          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              verifiedUser =
                await admin.auth().getUser(target.uid);
              break;
            } catch (error) {
              verificationError = error;
            }
          }

          if (!verifiedUser) {
            throw verificationError ||
              new Error(
                "TOTP_RESET_VERIFICATION_FAILED"
              );
          }

          const verifiedFactors =
            verifiedUser.multiFactor
              ?.enrolledFactors || [];

          const remainingTotp =
            verifiedFactors.filter(
              (factor) =>
                text(factor.factorId)
                  .toLowerCase() === "totp"
            );

          if (remainingTotp.length !== 0) {
            throw new Error(
              "TOTP_FACTOR_REMAINED_AFTER_RESET"
            );
          }

          if (
            verifiedFactors.length !==
            preservedOtherFactors
          ) {
            throw new Error(
              "PRESERVED_FACTOR_COUNT_MISMATCH"
            );
          }

          mutationApplied = true;

          try {
            await auditRef.set(
              {
                status: "TOTP_REMOVED",
                mutationApplied: true,
                removedTotpFactors,
                preservedOtherFactors,
                totpRemovedAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } catch (auditError) {
            console.error(
              "TOTP reset intermediate audit update failed",
              auditError
            );
          }

          let refreshTokensRevoked = false;
          let revocationError: any = null;

          try {
            await admin
              .auth()
              .revokeRefreshTokens(target.uid);

            refreshTokensRevoked = true;
          } catch (error: any) {
            revocationError = error;
          }

          let status:
            | "SUCCESS"
            | "PARTIAL_SUCCESS" =
              refreshTokensRevoked
                ? "SUCCESS"
                : "PARTIAL_SUCCESS";

          let warningCode =
            refreshTokensRevoked
              ? ""
              : "REFRESH_TOKEN_REVOCATION_FAILED";

          try {
            await auditRef.set(
              {
                status,
                mutationApplied: true,
                removedTotpFactors,
                preservedOtherFactors,
                refreshTokensRevoked,
                warningCode:
                  warningCode || null,
                sessionRevocationErrorCode:
                  text(revocationError?.code) || null,
                sessionRevocationErrorMessage:
                  text(revocationError?.message)
                    .slice(0, 500) || null,
                completedAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } catch (auditError) {
            console.error(
              "TOTP reset completion audit update failed",
              auditError
            );

            status = "PARTIAL_SUCCESS";

            if (!warningCode) {
              warningCode =
                "AUDIT_COMPLETION_WRITE_FAILED";
            }
          }

          return {
            ok: true,
            auditId: auditRef.id,
            requestId,
            status,
            targetUid: target.uid,
            targetEmail: target.email,
            removedTotpFactors,
            preservedOtherFactors,
            refreshTokensRevoked,
            selfReset,
            requiresNewTotpEnrollment: true,
            warningCode:
              warningCode || undefined,
          } satisfies ResetResult;
        } catch (error: any) {
          if (mutationAttempted && !mutationApplied) {
            try {
              const recoveryUser =
                await admin.auth().getUser(target.uid);

              const recoveryFactors =
                recoveryUser.multiFactor
                  ?.enrolledFactors || [];

              const recoveryTotp =
                recoveryFactors.filter(
                  (factor) =>
                    text(factor.factorId)
                      .toLowerCase() === "totp"
                );

              mutationApplied =
                recoveryTotp.length === 0 &&
                recoveryFactors.length ===
                  preservedOtherFactors;
            } catch (recoveryError) {
              console.error(
                "TOTP reset recovery verification failed",
                recoveryError
              );
            }
          }

          if (mutationApplied) {
            const warningCode =
              "POST_RESET_PROCESSING_FAILED";

            try {
              await auditRef.set(
                {
                  status: "PARTIAL_SUCCESS",
                  mutationApplied: true,
                  removedTotpFactors,
                  preservedOtherFactors,
                  refreshTokensRevoked: false,
                  warningCode,
                  errorCode: text(error?.code),
                  errorMessage: text(error?.message)
                    .slice(0, 500),
                  completedAt:
                    FieldValue.serverTimestamp(),
                  updatedAt:
                    FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            } catch (auditError) {
              console.error(
                "TOTP partial-success audit update failed",
                auditError
              );
            }

            return {
              ok: true,
              auditId: auditRef.id,
              requestId,
              status: "PARTIAL_SUCCESS",
              targetUid: target.uid,
              targetEmail: target.email,
              removedTotpFactors,
              preservedOtherFactors,
              refreshTokensRevoked: false,
              selfReset,
              requiresNewTotpEnrollment: true,
              warningCode,
            } satisfies ResetResult;
          }

          try {
            await auditRef.set(
              {
                status: "FAILED",
                mutationApplied: false,
                errorCode: text(error?.code),
                errorMessage: text(error?.message)
                  .slice(0, 500),
                failedAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } catch (auditError) {
            console.error(
              "TOTP reset failure audit update failed",
              auditError
            );
          }

          throw error;
        } finally {
          try {
            await releaseResetLock(
              lockRef,
              requestId
            );
          } catch (lockError: any) {
            console.error(
              "TOTP reset lock release failed",
              lockError
            );

            try {
              await auditRef.set(
                {
                  lockReleaseFailed: true,
                  lockReleaseErrorCode:
                    text(lockError?.code),
                  lockReleaseErrorMessage:
                    text(lockError?.message)
                      .slice(0, 500),
                  updatedAt:
                    FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            } catch {
              // The lock expires automatically.
            }
          }
        }
      }
    );
export const totpAdminListResetAudit =
  functions
    .region("us-central1")
    .https.onCall(
      async (data: AuditRequest, context) => {
        const actor =
          await requireRecentTotpAdminSession(context);

        const requestedLimit =
          Math.min(
            Math.max(
              Number(data?.limit || 50),
              1
            ),
            100
          );

        const scanLimit =
          Math.min(
            requestedLimit * 5,
            500
          );

        const snap =
          await db
            .collection("securityAudit")
            .orderBy("createdAt", "desc")
            .limit(scanLimit)
            .get();

        const items = snap.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }))
          .filter(
            (entry: any) =>
              entry.type === "TOTP_RESET" &&
              canViewAudit(actor, entry)
          )
          .slice(0, requestedLimit)
          .map((entry: any) => ({
            id: text(entry.id),
            status: text(entry.status),
            actorEmail: text(entry.actorEmail),
            actorRole: text(entry.actorRole),
            targetEmail: text(entry.targetEmail),
            targetRole: text(entry.targetRole),
            targetTenantId:
              text(entry.targetTenantId),
            targetGovernorate:
              text(entry.targetGovernorate),
            targetTenantKind:
              text(entry.targetTenantKind),
            removedTotpFactors:
              Number(
                entry.removedTotpFactors ||
                  entry.requestedTotpFactors ||
                  0
              ),
            preservedOtherFactors:
              Number(
                entry.preservedOtherFactors || 0
              ),
            refreshTokensRevoked:
              entry.refreshTokensRevoked === true,
            selfReset:
              entry.selfReset === true,
            reason: text(entry.reason),
            scope: text(entry.scope),
            createdAt:
              timestampIso(entry.createdAt),
            completedAt:
              timestampIso(entry.completedAt),
          }));

        return {
          ok: true,
          items,
        };
      }
    );