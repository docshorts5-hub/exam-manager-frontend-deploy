import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";
import nodemailer from "nodemailer";

try {
  admin.app();
} catch {
  admin.initializeApp();
}

const db = admin.firestore();

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

const corsHandler = cors({
  origin: getAllowedOrigins(),
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

type Role = "super_admin" | "super" | "tenant_admin" | "admin" | "user" | "exam_super" | "ministry_super";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeSegment(value: string, label: string) {
  const segment = clean(value);
  if (!segment) {
    throw new functions.https.HttpsError("invalid-argument", `${label} is required`);
  }

  if (segment.includes("/") || segment.includes("\\")) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid ${label}`);
  }

  return segment;
}

function safeOptionalSegment(value: string, label: string) {
  const segment = clean(value);
  if (!segment) return "";
  if (segment.includes("/") || segment.includes("\\")) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid ${label}`);
  }
  return segment;
}

async function getAllowlistByEmail(email: string) {
  const safeEmail = clean(email);
  if (!safeEmail) return null;

  const snap = await db.collection("allowlist").doc(safeEmail).get();
  return snap.exists ? snap.data() || null : null;
}

async function getAuthContext(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const token: any = context.auth.token || {};
  const email = clean(token.email);
  const allow = await getAllowlistByEmail(email);

  const ownerEmail = "3asal2030@gmail.com";
  const isOwner = email === ownerEmail;

  const role = isOwner
    ? "super_admin"
    : clean(token.role || allow?.role || "user");

  const enabled =
    isOwner ||
    token.enabled === true ||
    allow?.enabled === true;

  const tenantId = clean(token.tenantId || allow?.tenantId || "");
  const governorate = clean(token.governorate || allow?.governorate || "");

  if (!enabled) {
    throw new functions.https.HttpsError("permission-denied", "USER_DISABLED_OR_NOT_ALLOWED");
  }

  return {
    uid: context.auth.uid,
    email,
    role: role as Role,
    tenantId,
    governorate,
    isOwner,
    isSuperAdmin: isOwner || role === "super_admin" || token.isOwner === true,
    isSuperRegional: role === "super",
  };
}

async function verifyIdTokenFromRequest(req: functions.https.Request) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

async function getHttpAuthContext(req: functions.https.Request) {
  const token: any = await verifyIdTokenFromRequest(req);
  if (!token) return null;

  const email = clean(token.email);
  const allow = await getAllowlistByEmail(email);

  const ownerEmail = "3asal2030@gmail.com";
  const isOwner = email === ownerEmail;

  const role = isOwner
    ? "super_admin"
    : clean(token.role || allow?.role || "user");

  const enabled =
    isOwner ||
    token.enabled === true ||
    allow?.enabled === true;

  const tenantId = clean(token.tenantId || allow?.tenantId || "");
  const governorate = clean(token.governorate || allow?.governorate || "");

  if (!enabled) return null;

  return {
    uid: token.uid,
    email,
    displayName: clean(token.name),
    role: role as Role,
    tenantId,
    governorate,
    isOwner,
    isSuperAdmin: isOwner || role === "super_admin" || token.isOwner === true,
    isSuperRegional: role === "super",
  };
}

async function tenantGovernorate(tenantId: string) {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() || {} : {};

  const metaSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("meta")
    .doc("config")
    .get();

  const metaData = metaSnap.exists ? metaSnap.data() || {} : {};

  return clean(metaData.governorate || tenantData.governorate || "");
}

async function canReadTenant(
  auth:
    | Awaited<ReturnType<typeof getAuthContext>>
    | NonNullable<Awaited<ReturnType<typeof getHttpAuthContext>>>,
  tenantId: string
) {
  if (auth.isSuperAdmin) return true;
  if (auth.tenantId && auth.tenantId === tenantId) return true;

  if (auth.isSuperRegional) {
    if (auth.governorate === "الوزارة") return true;
    return (await tenantGovernorate(tenantId)) === auth.governorate;
  }

  return false;
}

async function canWriteTenant(
  auth:
    | Awaited<ReturnType<typeof getAuthContext>>
    | NonNullable<Awaited<ReturnType<typeof getHttpAuthContext>>>,
  tenantId: string
) {
  if (auth.isSuperAdmin) return true;

  // Commercial mode:
  // - Governorate supervisors can read tenants in their governorate, but they do not edit tenant files.
  // - School admins and diploma exam-center heads have full write permissions only in their own tenant.
  if (!auth.tenantId || auth.tenantId !== tenantId) return false;

  return ["tenant_admin", "exam_super", "admin"].includes(auth.role);
}

function sanitizeWriteData(data: any, id: string, auth: { uid?: string; email?: string }) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    ...(data || {}),
    id,
    updatedAt: now,
    updatedBy: auth.email || auth.uid || null,
  };
}

type TenantListDocsReq = {
  tenantId: string;
  sub: string;
  limit?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
};

export const tenantListDocs = functions.https.onCall(
  async (req: TenantListDocsReq, context) => {
    const auth = await getAuthContext(context);

    const tenantId = safeSegment(req?.tenantId, "tenantId");
    const sub = safeSegment(req?.sub, "subcollection");

    if (!(await canReadTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_ACCESS_DENIED");
    }

    const max = Math.min(Math.max(Number(req?.limit || 200), 1), 1000);
    const orderByField =
      safeOptionalSegment(String(req?.orderBy || "createdAt"), "orderBy") || "createdAt";
    const dir = (req?.orderDir || "desc") as "asc" | "desc";

    let q = db
      .collection("tenants")
      .doc(tenantId)
      .collection(sub) as FirebaseFirestore.Query;

    try {
      q = q.orderBy(orderByField, dir).limit(max);
    } catch {
      q = q.limit(max);
    }

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { items };
  }
);

type TenantUpsertDocReq = {
  tenantId: string;
  sub: string;
  id: string;
  data: any;
};

export const tenantUpsertDoc = functions.https.onCall(
  async (req: TenantUpsertDocReq, context) => {
    const auth = await getAuthContext(context);

    const tenantId = safeSegment(req?.tenantId, "tenantId");
    const sub = safeSegment(req?.sub, "subcollection");
    const id = safeSegment(req?.id, "doc id");

    if (!(await canWriteTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_WRITE_DENIED");
    }

    const ref = db.collection("tenants").doc(tenantId).collection(sub).doc(id);
    const before = await ref.get();

    await ref.set(sanitizeWriteData(req?.data || {}, id, auth), { merge: true });

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: before.exists ? "UPDATE" : "CREATE",
      entityType: sub,
      entityId: id,
      actorUid: auth.uid,
      actorEmail: auth.email,
      before: before.exists ? before.data() : null,
      after: req?.data || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "tenantUpsertDoc",
    });

    return { ok: true, id };
  }
);

type TenantDeleteDocReq = {
  path: string;
};

export const tenantDeleteDoc = functions.https.onCall(
  async (req: TenantDeleteDocReq, context) => {
    const auth = await getAuthContext(context);
    const path = clean(req?.path);

    const parts = path.split("/").filter(Boolean);
    if (parts.length < 4 || parts[0] !== "tenants") {
      throw new functions.https.HttpsError("invalid-argument", "TENANT_PATH_REQUIRED");
    }

    const tenantId = safeSegment(parts[1], "tenantId");

    if (!(await canWriteTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_WRITE_DENIED");
    }

    const ref = db.doc(path);
    const before = await ref.get();

    await ref.delete();

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: "DELETE",
      entityType: parts[2] || "unknown",
      entityId: parts[3] || "",
      actorUid: auth.uid,
      actorEmail: auth.email,
      before: before.exists ? before.data() : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "tenantDeleteDoc",
    });

    return { ok: true };
  }
);

type WriteActivityLogBody = {
  tenantId?: string;
  userId?: string;
  action?: string;
  page?: string;
  targetType?: string;
  targetId?: string;
  details?: unknown;
  [key: string]: unknown;
};

export const writeActivityLog = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }

      const auth = await getHttpAuthContext(req);
      if (!auth) {
        res.status(401).json({ ok: false, error: "AUTH_REQUIRED" });
        return;
      }

      const body = (req.body || {}) as WriteActivityLogBody;
      const tenantId = safeSegment(String(body.tenantId || ""), "tenantId");

      if (!(await canWriteTenant(auth, tenantId))) {
        res.status(403).json({ ok: false, error: "TENANT_WRITE_DENIED" });
        return;
      }

      const payload = {
        ...body,
        tenantId,
        actorUid: body.actorUid || auth.uid,
        actorEmail: body.actorEmail || auth.email,
        actorDisplayName: body.actorDisplayName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "web",
      };

      await db.collection("tenants").doc(tenantId).collection("activityLogs").add(payload);

      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error("writeActivityLog error:", error);

      res.status(500).json({
        ok: false,
        error: error?.message || "Unknown error",
      });
    }
  });
});

type SuggestionPayload = {
  title?: string;
  schoolName?: string;
  schoolEmail?: string;
  notes?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function gmailConfig() {
  const gmailUser = clean(process.env.GMAIL_USER);
  const gmailPass = clean(process.env.GMAIL_PASS);
  return { gmailUser, gmailPass };
}

export const sendSuggestionEmailCallable = functions
  .region("us-central1")
  .https.onCall(async (data: SuggestionPayload, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "AUTH_REQUIRED");
    }

    try {
      const title = String(data?.title || "").trim();
      const schoolName = String(data?.schoolName || "").trim();
      const schoolEmail = String(data?.schoolEmail || "").trim();
      const notes = String(data?.notes || "").trim();

      console.log("sendSuggestionEmailCallable called", {
        title,
        schoolName,
        schoolEmail,
        hasNotes: !!notes,
      });

      if (!title) {
        throw new functions.https.HttpsError("invalid-argument", "عنوان المقترح مطلوب.");
      }

      if (!schoolName) {
        throw new functions.https.HttpsError("invalid-argument", "اسم المدرسة مطلوب.");
      }

      if (!schoolEmail || !isValidEmail(schoolEmail)) {
        throw new functions.https.HttpsError("invalid-argument", "إيميل المدرسة غير صحيح.");
      }

      if (!notes) {
        throw new functions.https.HttpsError("invalid-argument", "الملاحظات والاقتراحات مطلوبة.");
      }

      const { gmailUser, gmailPass } = gmailConfig();

      if (!gmailUser || !gmailPass) {
        throw new functions.https.HttpsError("failed-precondition", "إعدادات Gmail غير موجودة.");
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      await transporter.sendMail({
        from: gmailUser,
        to: "3asal2030@gmail.com",
        replyTo: schoolEmail,
        subject: `مقترح تطوير البرنامج - ${title}`,
        text: `
عنوان المقترح: ${title}
اسم المدرسة: ${schoolName}
إيميل المدرسة: ${schoolEmail}

الملاحظات والاقتراحات:
${notes}
        `.trim(),
        html: `
          <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; line-height: 1.9;">
            <h2>مقترح جديد لتطوير البرنامج</h2>
            <p><strong>عنوان المقترح:</strong> ${escapeHtml(title)}</p>
            <p><strong>اسم المدرسة:</strong> ${escapeHtml(schoolName)}</p>
            <p><strong>إيميل المدرسة:</strong> ${escapeHtml(schoolEmail)}</p>
            <p><strong>الملاحظات والاقتراحات:</strong></p>
            <div style="white-space: pre-wrap; padding: 12px; background: #f5f5f5; border-radius: 8px;">
              ${escapeHtml(notes)}
            </div>
          </div>
        `,
      });

      return {
        ok: true,
        message: "تم إرسال المقترح بنجاح.",
      };
    } catch (error: any) {
      console.error("sendSuggestionEmailCallable failed:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        error?.message || "فشل إرسال البريد الإلكتروني."
      );
    }
  });


// =====================================================
// Commercial user provisioning
// Creates/updates BOTH:
// 1) allowlist/{email}
// 2) tenants/{tenantId}/members/{uid}
// Also refreshes Firebase Auth custom claims for compatibility.
// =====================================================

type AdminUpsertAllowlistReq = {
  email?: string;
  enabled?: boolean;
  role?: string;
  tenantId?: string;
  governorate?: string;
  name?: string;
  schoolName?: string;
};

function normalizeManagedRole(value: unknown): Role {
  const role = clean(value).toLowerCase();

  if (
    role === "super_admin" ||
    role === "super" ||
    role === "ministry_super" ||
    role === "exam_super" ||
    role === "tenant_admin" ||
    role === "admin" ||
    role === "user"
  ) {
    return role as Role;
  }

  throw new functions.https.HttpsError("invalid-argument", "INVALID_ROLE");
}

function isTenantScopedRole(role: Role) {
  return role === "exam_super" || role === "tenant_admin" || role === "admin" || role === "user";
}

async function getTenantDocOrThrow(tenantId: string) {
  const snap = await db.collection("tenants").doc(tenantId).get();

  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "TENANT_NOT_FOUND");
  }

  return snap;
}


function normalizedTenantKind(data: FirebaseFirestore.DocumentData) {
  const raw = clean(
    data.type ||
      data.tenantType ||
      data.kind ||
      data.category ||
      ""
  ).toLowerCase();

  const hasCenterName = !!clean(data.centerName || data.examCenterName || data.diplomaCenterName);
  const hasSchoolName = !!clean(data.schoolName || data.name);

  if (
    raw.includes("exam") ||
    raw.includes("diploma") ||
    raw.includes("center") ||
    raw.includes("مركز") ||
    raw.includes("دبلوم") ||
    hasCenterName
  ) {
    return "exam_center";
  }

  if (
    raw.includes("school") ||
    raw.includes("مدرس") ||
    hasSchoolName ||
    !raw
  ) {
    return "school";
  }

  return raw;
}

function assertRoleFitsTenant(role: Role, tenantId: string, tenantData: FirebaseFirestore.DocumentData) {
  if (!isTenantScopedRole(role) || !tenantId) return;

  const tenantKind = normalizedTenantKind(tenantData || {});

  // Commercial rule:
  // - School admin roles must be linked to schools only.
  // - Diploma exam-center head role must be linked to diploma/exam centers only.
  // - Legacy roles "admin" and "user" are allowed inside either tenant type for compatibility.
  if (role === "tenant_admin" && tenantKind !== "school") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "TENANT_ADMIN_MUST_BE_LINKED_TO_SCHOOL"
    );
  }

  if (role === "exam_super" && tenantKind !== "exam_center") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "EXAM_SUPER_MUST_BE_LINKED_TO_EXAM_CENTER"
    );
  }
}

async function canManageTargetUser(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  targetRole: Role,
  tenantId: string,
  targetGovernorate: string
) {
  if (auth.isSuperAdmin || auth.isOwner) return true;

  // Ministry-level supervisor can manage all non-owner roles.
  if (auth.role === "ministry_super") {
    return targetRole !== "super_admin";
  }

  // Governorate supervisor commercial permissions:
  // - Can create/update school admins and diploma exam-center admins inside the same governorate.
  // - Can also manage normal tenant users/admins inside the same governorate.
  // - Cannot create owner, platform admin, ministry supervisor, or another governorate supervisor.
  if (auth.isSuperRegional) {
    const allowedTargetRoles: Role[] = ["tenant_admin", "exam_super", "admin", "user"];
    if (!allowedTargetRoles.includes(targetRole)) return false;
    if (!tenantId) return false;

    const tenantGov = await tenantGovernorate(tenantId);
    if (auth.governorate === "الوزارة") return true;

    return clean(tenantGov || targetGovernorate) === clean(auth.governorate);
  }

  return false;
}

async function getOrCreateAuthUserByEmail(email: string, displayName: string) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    return { userRecord: existing, created: false };
  } catch (error: any) {
    if (String(error?.code || "") !== "auth/user-not-found") {
      throw error;
    }

    const created = await admin.auth().createUser({
      email,
      emailVerified: false,
      disabled: false,
      displayName: displayName || undefined,
    });

    return { userRecord: created, created: true };
  }
}

async function setCompatibleClaims(
  uid: string,
  payload: {
    enabled: boolean;
    role: Role;
    tenantId: string;
    governorate: string;
  }
) {
  const userRecord = await admin.auth().getUser(uid);
  const currentClaims = (userRecord.customClaims || {}) as Record<string, unknown>;

  await admin.auth().setCustomUserClaims(uid, {
    ...currentClaims,
    enabled: payload.enabled,
    role: payload.role,
    tenantId: payload.tenantId,
    governorate: payload.governorate || "",
  });
}

export const adminUpsertAllowlist = functions
  .region("us-central1")
  .https.onCall(async (data: AdminUpsertAllowlistReq, context) => {
    const auth = await getAuthContext(context);

    const email = clean(data?.email).toLowerCase();
    if (!email || !isValidEmail(email)) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_EMAIL");
    }

    const role = normalizeManagedRole(data?.role || "user");
    const enabled = data?.enabled !== false;
    const tenantId = clean(data?.tenantId);
    const inputGovernorate = clean(data?.governorate);
    const name = clean(data?.name);
    const schoolName = clean(data?.schoolName);

    if (isTenantScopedRole(role) && !tenantId) {
      throw new functions.https.HttpsError("invalid-argument", "TENANT_ID_REQUIRED");
    }

    let tenantData: FirebaseFirestore.DocumentData = {};
    let effectiveGovernorate = inputGovernorate;

    if (tenantId) {
      const tenantSnap = await getTenantDocOrThrow(tenantId);
      tenantData = tenantSnap.data() || {};

      if (!effectiveGovernorate) {
        effectiveGovernorate = clean(tenantData.governorate || "");
      }

      assertRoleFitsTenant(role, tenantId, tenantData);
    }

    if (!(await canManageTargetUser(auth, role, tenantId, effectiveGovernorate))) {
      throw new functions.https.HttpsError("permission-denied", "USER_MANAGEMENT_DENIED");
    }

    const oldAllowSnap = await db.collection("allowlist").doc(email).get();
    const oldAllow = oldAllowSnap.exists ? oldAllowSnap.data() || {} : {};
    const oldTenantId = clean(oldAllow.tenantId);

    const displayName = name || clean(oldAllow.name) || email;
    const { userRecord, created } = await getOrCreateAuthUserByEmail(email, displayName);

    const now = admin.firestore.FieldValue.serverTimestamp();

    const allowPayload = {
      email,
      enabled,
      role,
      tenantId: tenantId || "system",
      governorate: effectiveGovernorate || "",
      name: displayName,
      schoolName: schoolName || clean(tenantData.name || tenantData.schoolName || ""),
      tenantName: schoolName || clean(tenantData.name || tenantData.schoolName || ""),
      updatedAt: now,
      updatedBy: auth.email || auth.uid || "",
      ...(oldAllowSnap.exists ? {} : { createdAt: now, createdBy: auth.email || auth.uid || "" }),
    };

    const batch = db.batch();

    batch.set(db.collection("allowlist").doc(email), allowPayload, { merge: true });

    // Remove old tenant membership if user is transferred to another tenant.
    if (oldTenantId && oldTenantId !== tenantId) {
      batch.delete(
        db.collection("tenants")
          .doc(oldTenantId)
          .collection("members")
          .doc(userRecord.uid)
      );
    }

    if (tenantId && isTenantScopedRole(role)) {
      const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(userRecord.uid);

      batch.set(
        memberRef,
        {
          uid: userRecord.uid,
          email,
          enabled,
          role,
          tenantId,
          governorate: effectiveGovernorate || "",
          name: displayName,
          schoolName: schoolName || clean(tenantData.name || tenantData.schoolName || ""),
          updatedAt: now,
          updatedByUid: auth.uid,
          updatedByEmail: auth.email || "",
          ...(created ? { createdAt: now, createdByUid: auth.uid, createdByEmail: auth.email || "" } : {}),
        },
        { merge: true }
      );
    }

    await batch.commit();

    await setCompatibleClaims(userRecord.uid, {
      enabled,
      role,
      tenantId: tenantId || "system",
      governorate: effectiveGovernorate || "",
    });

    if (tenantId) {
      await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
        tenantId,
        action: "USER_UPSERT",
        entityType: "member",
        entityId: userRecord.uid,
        actorUid: auth.uid,
        actorEmail: auth.email,
        targetEmail: email,
        targetUid: userRecord.uid,
        role,
        enabled,
        createdAuthUser: created,
        createdAt: now,
        source: "adminUpsertAllowlist",
      });
    }

    return {
      ok: true,
      uid: userRecord.uid,
      email,
      role,
      tenantId: tenantId || "system",
      createdAuthUser: created,
    };
  });


type AdminListManagedUsersReq = {
  governorate?: string;
  limit?: number;
};

type AdminListManagedTenantsReq = {
  governorate?: string;
  limit?: number;
};

function canViewGovernorate(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  requestedGovernorate: string
) {
  if (auth.isSuperAdmin || auth.isOwner) return true;
  if (auth.role === "ministry_super") return true;
  if (auth.isSuperRegional) {
    return !requestedGovernorate || clean(requestedGovernorate) === clean(auth.governorate);
  }
  return false;
}

export const adminListManagedUsers = functions
  .region("us-central1")
  .https.onCall(async (data: AdminListManagedUsersReq, context) => {
    const auth = await getAuthContext(context);
    const requestedGovernorate = clean(data?.governorate);
    const max = Math.min(Math.max(Number(data?.limit || 500), 1), 1000);

    if (!canViewGovernorate(auth, requestedGovernorate)) {
      throw new functions.https.HttpsError("permission-denied", "GOVERNORATE_ACCESS_DENIED");
    }

    let q = db.collection("allowlist") as FirebaseFirestore.Query;

    if (!(auth.isSuperAdmin || auth.isOwner || auth.role === "ministry_super")) {
      q = q.where("governorate", "==", auth.governorate || "");
    } else if (requestedGovernorate) {
      q = q.where("governorate", "==", requestedGovernorate);
    }

    const snap = await q.limit(max).get();
    const items = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        email: clean(x.email || d.id),
        enabled: x.enabled === true,
        role: clean(x.role || "user"),
        tenantId: clean(x.tenantId || ""),
        governorate: clean(x.governorate || ""),
        name: clean(x.name || ""),
        schoolName: clean(x.schoolName || x.tenantName || ""),
        tenantName: clean(x.tenantName || x.schoolName || ""),
        updatedAt: x.updatedAt || null,
      };
    });

    return { items };
  });

export const adminListManagedTenants = functions
  .region("us-central1")
  .https.onCall(async (data: AdminListManagedTenantsReq, context) => {
    const auth = await getAuthContext(context);
    const requestedGovernorate = clean(data?.governorate);
    const max = Math.min(Math.max(Number(data?.limit || 500), 1), 1000);

    if (!canViewGovernorate(auth, requestedGovernorate)) {
      throw new functions.https.HttpsError("permission-denied", "GOVERNORATE_ACCESS_DENIED");
    }

    let q = db.collection("tenants") as FirebaseFirestore.Query;

    if (!(auth.isSuperAdmin || auth.isOwner || auth.role === "ministry_super")) {
      q = q.where("governorate", "==", auth.governorate || "");
    } else if (requestedGovernorate) {
      q = q.where("governorate", "==", requestedGovernorate);
    }

    const snap = await q.limit(max).get();
    const items = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        tenantId: d.id,
        name: clean(x.name || x.schoolName || x.centerName || d.id),
        schoolName: clean(x.schoolName || x.name || ""),
        centerName: clean(x.centerName || ""),
        type: normalizedTenantKind(x),
        governorate: clean(x.governorate || ""),
        enabled: x.enabled !== false,
        updatedAt: x.updatedAt || null,
      };
    });

    return { items };
  });

type AdminDeleteAllowlistReq = {
  email?: string;
};

export const adminDeleteAllowlist = functions
  .region("us-central1")
  .https.onCall(async (data: AdminDeleteAllowlistReq, context) => {
    const auth = await getAuthContext(context);

    const email = clean(data?.email).toLowerCase();
    if (!email || !isValidEmail(email)) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_EMAIL");
    }

    const allowSnap = await db.collection("allowlist").doc(email).get();
    if (!allowSnap.exists) {
      return { ok: true, deleted: false };
    }

    const allow = allowSnap.data() || {};
    const tenantId = clean(allow.tenantId);
    const role = normalizeManagedRole(allow.role || "user");
    const governorate = clean(allow.governorate);

    if (!(await canManageTargetUser(auth, role, tenantId, governorate))) {
      throw new functions.https.HttpsError("permission-denied", "USER_DELETE_DENIED");
    }

    let uid = "";
    try {
      const target = await admin.auth().getUserByEmail(email);
      uid = target.uid;
    } catch (error: any) {
      if (String(error?.code || "") !== "auth/user-not-found") {
        throw error;
      }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.delete(db.collection("allowlist").doc(email));

    if (tenantId && uid) {
      batch.delete(db.collection("tenants").doc(tenantId).collection("members").doc(uid));
    }

    await batch.commit();

    if (uid) {
      await setCompatibleClaims(uid, {
        enabled: false,
        role,
        tenantId: tenantId || "system",
        governorate,
      });
    }

    if (tenantId) {
      await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
        tenantId,
        action: "USER_DELETE",
        entityType: "member",
        entityId: uid || email,
        actorUid: auth.uid,
        actorEmail: auth.email,
        targetEmail: email,
        targetUid: uid || "",
        role,
        createdAt: now,
        source: "adminDeleteAllowlist",
      });
    }

    return { ok: true, deleted: true, uid };
  });

