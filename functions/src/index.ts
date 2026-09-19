import * as functions from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import cors from "cors";
import nodemailer from "nodemailer";
import {
  createAuthenticationOptions,
} from "./webauthn/authentication";

import {
  verifyWebAuthnAuthentication,
} from "./webauthn/authenticationVerification";

import {
  listCredentials,
} from "./webauthn/credentialStore";

import * as crypto from "crypto";
import { appendSecurityJournalEvent } from "./securityJournal";

try {
  admin.app();
} catch {
  admin.initializeApp();
}

const db = admin.firestore();

function createSecurityCorrelationId() {
  return `yr-${Date.now().toString(36)}-${crypto.randomBytes(16).toString("hex")}`;
}

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
  const email = clean(token.email).toLowerCase();

  const ownerEmail = "3asal2030@gmail.com";
  const isOwner = email === ownerEmail;

  const allow = isOwner
    ? null
    : await getAllowlistByEmail(email);

  if (!isOwner && !allow) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "USER_NOT_ALLOWLISTED",
    );
  }

  if (!isOwner && allow?.enabled !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "USER_DISABLED_OR_NOT_ALLOWED",
    );
  }

  const roleValue = isOwner
    ? "super_admin"
    : clean(allow?.role).toLowerCase();

  if (
    ![
      "super_admin",
      "super",
      "ministry_super",
      "exam_super",
      "tenant_admin",
      "admin",
      "user",
    ].includes(roleValue)
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "ALLOWLIST_ROLE_INVALID",
    );
  }

  const role = roleValue as Role;

  const tenantId = isOwner
    ? ""
    : clean(allow?.tenantId);

  const governorate = isOwner
    ? ""
    : clean(allow?.governorate);

  return {
    uid: context.auth.uid,
    email,
    role,
    tenantId,
    governorate,
    isOwner,
    isSuperAdmin: isOwner || role === "super_admin",
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

  const email = clean(token.email).toLowerCase();

  const ownerEmail = "3asal2030@gmail.com";
  const isOwner = email === ownerEmail;

  const allow = isOwner
    ? null
    : await getAllowlistByEmail(email);

  if (!isOwner && !allow) {
    return null;
  }

  if (!isOwner && allow?.enabled !== true) {
    return null;
  }

  const roleValue = isOwner
    ? "super_admin"
    : clean(allow?.role).toLowerCase();

  if (
    ![
      "super_admin",
      "super",
      "ministry_super",
      "exam_super",
      "tenant_admin",
      "admin",
      "user",
    ].includes(roleValue)
  ) {
    return null;
  }

  const role = roleValue as Role;

  const tenantId = isOwner
    ? ""
    : clean(allow?.tenantId);

  const governorate = isOwner
    ? ""
    : clean(allow?.governorate);

  return {
    uid: token.uid,
    email,
    displayName: clean(token.name),
    role,
    tenantId,
    governorate,
    isOwner,
    isSuperAdmin: isOwner || role === "super_admin",
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
    if (auth.governorate === "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©") return true;
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
  const now = FieldValue.serverTimestamp();

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
      createdAt: FieldValue.serverTimestamp(),
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
      createdAt: FieldValue.serverTimestamp(),
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

      const correlationId = createSecurityCorrelationId();

      const payload = {
        ...body,
        tenantId,
        actorUid: auth.uid,
        actorEmail: auth.email,
        actorDisplayName: auth.displayName || null,
        correlationId,
        actorTrust: "SERVER_BOUND_FIREBASE_AUTH",
        createdAt: FieldValue.serverTimestamp(),
        source: "web",
      };

      await db.collection("tenants").doc(tenantId).collection("activityLogs").add(payload);

      res.status(200).json({ ok: true, correlationId });
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
  // Supports both the older env name used in this project and the app-password name used by suggestions.ts.
  const gmailPass = clean(process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD);
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
        throw new functions.https.HttpsError("invalid-argument", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨.");
      }

      if (!schoolName) {
        throw new functions.https.HttpsError("invalid-argument", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨.");
      }

      if (!schoolEmail || !isValidEmail(schoolEmail)) {
        throw new functions.https.HttpsError("invalid-argument", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­.");
      }

      if (!notes) {
        throw new functions.https.HttpsError("invalid-argument", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©.");
      }

      const { gmailUser, gmailPass } = gmailConfig();

      if (!gmailUser || !gmailPass) {
        throw new functions.https.HttpsError("failed-precondition", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ Gmail ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©.");
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
        subject: `ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ - ${title}`,
        text: `
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­: ${title}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©: ${schoolName}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©: ${schoolEmail}

ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾:
${notes}
        `.trim(),
        html: `
          <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; line-height: 1.9;">
            <h2>ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬</h2>
            <p><strong>ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­:</strong> ${escapeHtml(title)}</p>
            <p><strong>ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©:</strong> ${escapeHtml(schoolName)}</p>
            <p><strong>ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©:</strong> ${escapeHtml(schoolEmail)}</p>
            <p><strong>ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾:</strong></p>
            <div style="white-space: pre-wrap; padding: 12px; background: #f5f5f5; border-radius: 8px;">
              ${escapeHtml(notes)}
            </div>
          </div>
        `,
      });

      return {
        ok: true,
        message: "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­.",
      };
    } catch (error: any) {
      console.error("sendSuggestionEmailCallable failed:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        error?.message || "ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ´ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹."
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


type AdminUpsertTenantReq = {
  tenantId?: string;
  name?: string;
  schoolName?: string;
  centerName?: string;
  title?: string;
  enabled?: boolean;
  governorate?: string;
  regionAr?: string;
  wilayatAr?: string;
  logoUrl?: string;
  type?: string;
  programType?: string;
};

type AdminDeleteTenantReq = {
  tenantId?: string;
  alsoDeleteUsers?: boolean;
};

function assertPlatformOwnerOnly(auth: Awaited<ReturnType<typeof getAuthContext>>) {
  if (auth.isOwner) return;
  throw new functions.https.HttpsError("permission-denied", "PLATFORM_OWNER_REQUIRED");
}

function safeCallableTenantId(value: unknown) {
  const tenantId = clean(value);

  if (!tenantId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "TENANT_ID_REQUIRED",
    );
  }

  if (
    tenantId.includes("/") ||
    tenantId.includes("\\")
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "INVALID_TENANT_ID",
    );
  }

  if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "INVALID_TENANT_ID_FORMAT",
    );
  }

  return tenantId;
}

function validateSchoolTenantId(value: unknown) {
  const tenantId = safeCallableTenantId(value);

  if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "INVALID_SCHOOL_TENANT_ID_FORMAT",
    );
  }

  return tenantId;
}

function normalizeTenantKindInput(data: AdminUpsertTenantReq) {
  const raw = clean(data?.type || data?.programType).toLowerCase();
  if (!raw) return "";
  if (["diploma", "exam_center", "exam-center", "examcenter", "center"].includes(raw)) return "exam_center";
  if (["school", "tenant", "general"].includes(raw)) return "school";
  return raw;
}

export const adminUpsertTenant = functions
  .region("us-central1")
  .https.onCall(async (data: AdminUpsertTenantReq, context) => {
    const auth = await getAuthContext(context);
    assertPlatformOwnerOnly(auth);

    const tenantId = safeCallableTenantId(data?.tenantId);
    const now = FieldValue.serverTimestamp();

    const name = clean(data?.name || data?.schoolName || data?.centerName || data?.title || tenantId);
    const governorate = clean(data?.governorate || data?.regionAr || "");
    const tenantKind = normalizeTenantKindInput(data);
    const enabled = data?.enabled !== false;

    const rootPayload: FirebaseFirestore.DocumentData = {
      tenantId,
      id: tenantId,
      name,
      enabled,
      deleted: false,
      updatedAt: now,
      updatedBy: auth.email,
    };

    if (governorate) rootPayload.governorate = governorate;
    if (tenantKind) {
      rootPayload.type = tenantKind;
      rootPayload.programType = tenantKind === "exam_center" ? "diploma" : tenantKind;
    }

    const metaPayload: FirebaseFirestore.DocumentData = {
      tenantId,
      schoolNameAr: clean(data?.schoolName || name),
      centerNameAr: clean(data?.centerName || ""),
      title: clean(data?.title || name),
      governorate,
      regionAr: clean(data?.regionAr || governorate),
      wilayatAr: clean(data?.wilayatAr || ""),
      logoUrl: clean(data?.logoUrl || ""),
      enabled,
      updatedAt: now,
      updatedBy: auth.email,
    };

    if (tenantKind) {
      metaPayload.type = tenantKind;
      metaPayload.programType = tenantKind === "exam_center" ? "diploma" : tenantKind;
    }

    const correlationId = createSecurityCorrelationId();

    const tenantRef =
      db.collection("tenants").doc(tenantId);

    const tenantMetaRef =
      tenantRef.collection("meta").doc("config");

    const journal =
      await appendSecurityJournalEvent(
        {
          correlationId,
          action: "ADMIN_UPSERT_TENANT",
          scope: "CONTROL_PLANE",
          actor: {
            uid: auth.uid,
            email: auth.email,
            role: auth.role,
            tenantId: auth.tenantId,
            governorate: auth.governorate,
          },
          tenantId,
          targetType: "tenant",
          targetId: tenantId,
          outcome: "SUCCESS",
          details: {
            enabled,
            governorate,
            tenantKind: tenantKind || "",
          },
        },
        (transaction) => {
          transaction.set(
            tenantRef,
            rootPayload,
            { merge: true }
          );

          transaction.set(
            tenantMetaRef,
            metaPayload,
            { merge: true }
          );
        }
      );


    return {
      ok: true,
      tenantId,
      enabled,
      governorate,
      type: tenantKind || null,
      correlationId,
      securityJournalEventId: journal.eventId,
      securityJournalSequence: journal.sequence,
      securityJournalEventHash: journal.eventHash,
    };
  });

type AdminUpsertSchoolTenantReq = {
  tenantId?: string;
  name?: string;
  schoolName?: string;
  enabled?: boolean;
  governorate?: string;
};

const OFFICIAL_SCHOOL_GOVERNORATES = new Set<string>([
  "\u0645\u0633\u0642\u0637",
  "\u0638\u0641\u0627\u0631",
  "\u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629",
  "\u0627\u0644\u0638\u0627\u0647\u0631\u0629",
  "\u0627\u0644\u0628\u0631\u064a\u0645\u064a",
  "\u0634\u0645\u0627\u0644 \u0627\u0644\u0634\u0631\u0642\u064a\u0629",
  "\u062c\u0646\u0648\u0628 \u0627\u0644\u0634\u0631\u0642\u064a\u0629",
  "\u0627\u0644\u0648\u0633\u0637\u0649",
  "\u0634\u0645\u0627\u0644 \u0627\u0644\u0628\u0627\u0637\u0646\u0629",
  "\u062c\u0646\u0648\u0628 \u0627\u0644\u0628\u0627\u0637\u0646\u0629",
  "\u0645\u0633\u0646\u062f\u0645",
]);

function schoolTenantMarker(value: unknown) {
  return clean(value).toLowerCase().replace(/\s+/g, "_");
}

function existingTenantHasCenterMarker(data: FirebaseFirestore.DocumentData) {
  if (
    data?.isExamCenter === true ||
    data?.isDiplomaCenter === true ||
    data?.examCenter === true ||
    data?.diplomaCenter === true
  ) {
    return true;
  }

  const markers = [
    data?.type,
    data?.tenantType,
    data?.entityType,
    data?.kind,
    data?.category,
    data?.programType,
    data?.program,
    data?.centerType,
  ]
    .map(schoolTenantMarker)
    .filter(Boolean);

  return markers.some(
    (value) =>
      value === "exam_center" ||
      value === "exam-center" ||
      value === "examcenter" ||
      value === "diploma" ||
      value === "diploma_center" ||
      value === "diploma-center" ||
      value === "diplomacenter" ||
      value.includes("exam_center") ||
      value.includes("exam-center") ||
      value.includes("diploma"),
  );
}

function existingTenantHasExplicitSchoolMarker(data: FirebaseFirestore.DocumentData) {
  const markers = [
    data?.type,
    data?.tenantType,
    data?.entityType,
    data?.kind,
    data?.category,
    data?.programType,
    data?.program,
  ]
    .map(schoolTenantMarker)
    .filter(Boolean);

  return markers.some(
    (value) =>
      value === "school" ||
      value === "tenant_school" ||
      value === "school_tenant" ||
      value === "school-tenant",
  );
}


export const adminCreateSchoolTenant = functions
  .region("us-central1")
  .https.onCall(async (data: AdminUpsertSchoolTenantReq, context) => {
    const auth = await getAuthContext(context);
    assertPlatformOwnerOnly(auth);

    const tenantId = validateSchoolTenantId(data?.tenantId);
    const schoolName = clean(data?.schoolName || data?.name || "");
    const governorate = clean(data?.governorate || "");
    const enabled = data?.enabled !== false;

    if (!schoolName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "SCHOOL_NAME_REQUIRED",
      );
    }

    if (!OFFICIAL_SCHOOL_GOVERNORATES.has(governorate)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "OFFICIAL_GOVERNORATE_REQUIRED",
      );
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const metaRef = tenantRef.collection("meta").doc("config");
    const now = FieldValue.serverTimestamp();
    const correlationId = createSecurityCorrelationId();

    const journal = await appendSecurityJournalEvent(
      {
        correlationId,
        action: "ADMIN_CREATE_SCHOOL_TENANT",
        scope: "CONTROL_PLANE",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId,
        targetType: "school_tenant",
        targetId: tenantId,
        outcome: "SUCCESS",
        details: {
          governorate,
          enabled,
          schoolKind: "school",
        },
      },
      async (transaction) => {
        const existing = await transaction.get(tenantRef);

        if (existing.exists) {
          throw new functions.https.HttpsError(
            "already-exists",
            "TENANT_ID_ALREADY_EXISTS",
          );
        }

        transaction.set(tenantRef, {
          tenantId,
          id: tenantId,
          name: schoolName,
          schoolName,
          tenantName: schoolName,
          governorate,
          tenantGovernorate: governorate,
          regionAr: governorate,
          enabled,
          deleted: false,
          type: "school",
          tenantType: "school",
          entityType: "school",
          kind: "school",
          category: "school",
          isExamCenter: false,
          isDiplomaCenter: false,
          createdAt: now,
          updatedAt: now,
          createdBy: auth.email,
          updatedBy: auth.email,
        });

        transaction.set(metaRef, {
          tenantId,
          schoolNameAr: schoolName,
          title: schoolName,
          governorate,
          enabled,
          deleted: false,
          type: "school",
          tenantType: "school",
          entityType: "school",
          createdAt: now,
          updatedAt: now,
          createdBy: auth.email,
          updatedBy: auth.email,
        });
      },
    );

    return {
      ok: true,
      tenantId,
      schoolName,
      governorate,
      enabled,
      securityJournalEventHash: journal.eventHash,
    };
  });
export const adminUpsertSchoolTenant = functions
  .region("us-central1")
  .https.onCall(async (data: AdminUpsertSchoolTenantReq, context) => {
    const auth = await getAuthContext(context);
    assertPlatformOwnerOnly(auth);

    
    const requestedTenantId = safeCallableTenantId(data?.tenantId);

    const tenantId =
      requestedTenantId ||
      db.collection("tenants").doc().id;
    const schoolName = clean(data?.schoolName || data?.name || "");
    const governorate = clean(data?.governorate || "");
    const enabled = data?.enabled !== false;

    if (!schoolName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "SCHOOL_NAME_REQUIRED",
      );
    }

    if (!OFFICIAL_SCHOOL_GOVERNORATES.has(governorate)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "OFFICIAL_GOVERNORATE_REQUIRED",
      );
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantMetaRef = tenantRef.collection("meta").doc("config");
    const now = FieldValue.serverTimestamp();
    const correlationId = createSecurityCorrelationId();

    const journal = await appendSecurityJournalEvent(
      {
        correlationId,
        action: "ADMIN_UPSERT_SCHOOL_TENANT",
        scope: "CONTROL_PLANE",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId,
        targetType: "school_tenant",
        targetId: tenantId,
        outcome: "SUCCESS",
        details: {
          governorate,
          enabled,
          schoolKind: "school",
        },
      },
      async (transaction) => {
        const [tenantSnap, metaSnap] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(tenantMetaRef),
        ]);

        if (!tenantSnap.exists && metaSnap.exists) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "ORPHAN_TENANT_META_CONFLICT",
          );
        }

        const existingRoot = tenantSnap.exists
          ? tenantSnap.data() || {}
          : {};
        const existingMeta = metaSnap.exists
          ? metaSnap.data() || {}
          : {};
        if (tenantSnap.exists) {
          if (
            existingRoot?.deleted === true ||
            existingMeta?.deleted === true
          ) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "DELETED_TENANT_REQUIRES_SEPARATE_RECOVERY",
            );
          }

          const rootHasCenterMarker =
            existingTenantHasCenterMarker(existingRoot);
          const metaHasCenterMarker =
            existingTenantHasCenterMarker(existingMeta);

          if (rootHasCenterMarker || metaHasCenterMarker) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "TENANT_KIND_CONFLICT",
            );
          }

          const rootHasExplicitSchoolMarker =
            existingTenantHasExplicitSchoolMarker(existingRoot);
          const metaHasExplicitSchoolMarker =
            existingTenantHasExplicitSchoolMarker(existingMeta);

          if (
            !rootHasExplicitSchoolMarker &&
            !metaHasExplicitSchoolMarker
          ) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "EXISTING_TENANT_NOT_EXPLICIT_SCHOOL",
            );
          }

          const existingGovernorate = clean(
            existingRoot?.governorate ||
              existingRoot?.tenantGovernorate ||
              existingMeta?.governorate ||
              existingMeta?.regionAr ||
              "",
          );

          if (
            existingGovernorate &&
            existingGovernorate !== governorate
          ) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "SCHOOL_GOVERNORATE_CHANGE_REQUIRES_SEPARATE_GATE",
            );
          }
        }

        const rootPayload: FirebaseFirestore.DocumentData = {
          tenantId,
          id: tenantId,
          name: schoolName,
          schoolName,
          tenantName: schoolName,
          governorate,
          tenantGovernorate: governorate,
          regionAr: governorate,
          enabled,
          deleted: false,
          type: "school",
          tenantType: "school",
          entityType: "school",
          kind: "school",
          category: "school",
          programType: "school",
          program: "school",
          isExamCenter: false,
          isDiplomaCenter: false,
          updatedAt: now,
          updatedBy: auth.email,
        };

        if (!tenantSnap.exists) {
          rootPayload.createdAt = now;
          rootPayload.createdBy = auth.email;
        }

        const metaPayload: FirebaseFirestore.DocumentData = {
          tenantId,
          schoolNameAr: schoolName,
          title: schoolName,
          governorate,
          regionAr: governorate,
          enabled,
          deleted: false,
          type: "school",
          tenantType: "school",
          entityType: "school",
          kind: "school",
          category: "school",
          programType: "school",
          program: "school",
          isExamCenter: false,
          isDiplomaCenter: false,
          updatedAt: now,
          updatedBy: auth.email,
        };

        if (!metaSnap.exists) {
          metaPayload.createdAt = now;
          metaPayload.createdBy = auth.email;
        }

        transaction.set(tenantRef, rootPayload, { merge: true });
        transaction.set(tenantMetaRef, metaPayload, { merge: true });
      },
    );

    return {
      ok: true,
      tenantId,
      governorate,
      schoolName,
      enabled,
      securityCorrelationId: correlationId,
      securityJournalEventHash: journal.eventHash,
    };
  });

export const adminUpdateSchoolTenant = functions
  .region("us-central1")
  .https.onCall(async (data: AdminUpsertSchoolTenantReq, context) => {
    const auth = await getAuthContext(context);
    assertPlatformOwnerOnly(auth);

    const tenantId = validateSchoolTenantId(data?.tenantId);
    const schoolName = clean(data?.schoolName || data?.name || "");
    const enabled = data?.enabled !== false;

    if (!schoolName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "SCHOOL_NAME_REQUIRED",
      );
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantMetaRef = tenantRef.collection("meta").doc("config");

    const now = FieldValue.serverTimestamp();
    const correlationId = createSecurityCorrelationId();

    const journal = await appendSecurityJournalEvent(
      {
        correlationId,
        action: "ADMIN_UPDATE_SCHOOL_TENANT",
        scope: "CONTROL_PLANE",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId,
        targetType: "school_tenant",
        targetId: tenantId,
        outcome: "SUCCESS",
        details: {
          enabled,
          schoolKind: "school",
        },
      },
      async (transaction) => {
        const [tenantSnap, metaSnap] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(tenantMetaRef),
        ]);

        if (!tenantSnap.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "SCHOOL_TENANT_NOT_FOUND",
          );
        }

        const existing = tenantSnap.data() || {};
        const existingMeta = metaSnap.exists ? metaSnap.data() || {} : {};

        if (
          existingTenantHasCenterMarker(existing) ||
          existingTenantHasCenterMarker(existingMeta)
        ) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "TENANT_KIND_CONFLICT",
          );
        }

        const existingGovernorate = clean(
          existing.governorate ||
          existing.tenantGovernorate ||
          existingMeta.governorate ||
          "",
        );

        transaction.set(
          tenantRef,
          {
            name: schoolName,
            schoolName,
            tenantName: schoolName,
            enabled,
            updatedAt: now,
            updatedBy: auth.email,
            type: "school",
            tenantType: "school",
            entityType: "school",
            kind: "school",
            category: "school",
            isExamCenter: false,
            isDiplomaCenter: false,
          },
          { merge: true },
        );

        transaction.set(
          tenantMetaRef,
          {
            tenantId,
            schoolNameAr: schoolName,
            title: schoolName,
            governorate: existingGovernorate,
            enabled,
            updatedAt: now,
            updatedBy: auth.email,
            type: "school",
            tenantType: "school",
            entityType: "school",
          },
          { merge: true },
        );
      },
    );

    return {
      ok: true,
      tenantId,
      schoolName,
      enabled,
      securityJournalEventHash: journal.eventHash,
    };
  });

export const adminUpdateSchoolStatus = functions
  .region("us-central1")
  .https.onCall(async (
    data: {
      tenantId?: string;
      enabled?: boolean;
    },
    context,
  ) => {

    const auth = await getAuthContext(context);

    assertPlatformOwnerOnly(auth);

    const tenantId =
      validateSchoolTenantId(data?.tenantId);

    if (typeof data?.enabled !== "boolean") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "SCHOOL_STATUS_BOOLEAN_REQUIRED",
      );
    }

    const enabled = data.enabled;

    const tenantRef =
      db.collection("tenants").doc(tenantId);

    const metaRef =
      tenantRef.collection("meta").doc("config");

    const correlationId =
      createSecurityCorrelationId();

    const now =
      FieldValue.serverTimestamp();


    const journal =
      await appendSecurityJournalEvent(
        {
          correlationId,

          action: enabled
            ? "ADMIN_ENABLE_SCHOOL_TENANT"
            : "ADMIN_DISABLE_SCHOOL_TENANT",

          scope:"CONTROL_PLANE",

          actor:{
            uid:auth.uid,
            email:auth.email,
            role:auth.role,
            tenantId:auth.tenantId,
            governorate:auth.governorate,
          },

          tenantId,

          targetType:"school_tenant",

          targetId:tenantId,

          outcome:"SUCCESS",

          details:{
            enabled,
          },
        },

        async(transaction)=>{

          const [
            tenantSnap,
            metaSnap,
          ] = await Promise.all([
            transaction.get(tenantRef),
            transaction.get(metaRef),
          ]);

          if(!tenantSnap.exists){
            throw new functions.https.HttpsError(
              "not-found",
              "SCHOOL_TENANT_NOT_FOUND",
            );
          }

          const root =
            tenantSnap.data() || {};

          const meta =
            metaSnap.exists
            ? metaSnap.data() || {}
            : {};

          const isSchool =
            root.type === "school" ||
            root.tenantType === "school" ||
            root.entityType === "school" ||
            meta.type === "school" ||
            meta.tenantType === "school";

          if(!isSchool){
            throw new functions.https.HttpsError(
              "failed-precondition",
              "TARGET_IS_NOT_SCHOOL_TENANT",
            );
          }

          transaction.set(
            tenantRef,
            {
              enabled,
              updatedAt:now,
              updatedBy:auth.email,
            },
            {
              merge:true,
            },
          );

          transaction.set(
            metaRef,
            {
              enabled,
              updatedAt:now,
              updatedBy:auth.email,
            },
            {
              merge:true,
            },
          );

        },
      );

    const verify =
      await tenantRef.get();

    if(
      !verify.exists ||
      verify.data()?.enabled !== enabled
    ){
      throw new functions.https.HttpsError(
        "internal",
        "SCHOOL_STATUS_VERIFY_FAILED",
      );
    }

    return {
      ok:true,
      tenantId,
      enabled,
      securityJournalEventHash:
        journal.eventHash,
    };

  });

export const adminDeleteSchoolTenant = functions
  .region("us-central1")
  .https.onCall(async (
    data:{
      tenantId?: string;
    },
    context,
  ) => {

    const auth = await getAuthContext(context);

    assertPlatformOwnerOnly(auth);

    const tenantId =
      validateSchoolTenantId(data?.tenantId);

    const tenantRef =
      db.collection("tenants").doc(tenantId);

    const metaRef =
      tenantRef.collection("meta").doc("config");

    const archiveRef =
      db.collection("deletedSchoolTenants").doc(tenantId);

    const correlationId =
      createSecurityCorrelationId();

    const now =
      FieldValue.serverTimestamp();

    const restoreExpiresAt =
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const journal =
      await appendSecurityJournalEvent(
        {
          correlationId,

          action:"ADMIN_DELETE_SCHOOL_TENANT",

          scope:"CONTROL_PLANE",

          actor:{
            uid:auth.uid,
            email:auth.email,
            role:auth.role,
            tenantId:auth.tenantId,
            governorate:auth.governorate,
          },

          tenantId,

          targetType:"school_tenant",

          targetId:tenantId,

          outcome:"SUCCESS",

        },

        async(transaction)=>{

          const [
            tenantSnap,
            metaSnap,
          ] = await Promise.all([
            transaction.get(tenantRef),
            transaction.get(metaRef),
          ]);


          if(!tenantSnap.exists){
            throw new functions.https.HttpsError(
              "not-found",
              "SCHOOL_TENANT_NOT_FOUND",
            );
          }


          const root =
            tenantSnap.data() || {};

          const meta =
            metaSnap.exists
            ? metaSnap.data() || {}
            : {};


          const isSchool =
            root.type==="school" ||
            root.tenantType==="school" ||
            root.entityType==="school" ||
            meta.type==="school" ||
            meta.tenantType==="school";


          if(!isSchool){
            throw new functions.https.HttpsError(
              "failed-precondition",
              "TARGET_IS_NOT_SCHOOL_TENANT",
            );
          }


          transaction.set(
            archiveRef,
            {
              tenantId,
              root,
              meta,
              deletedAt:now,
              restoreExpiresAt,
              deleteExpiresAt:restoreExpiresAt,
              deletedBy:auth.email || auth.uid,
              source:"adminDeleteSchoolTenant",
            },
            {
              merge:true,
            },
          );


          transaction.set(
            tenantRef,
            {
              enabled:false,
              deleted:true,
              deletedAt:now,
              deletedBy:auth.email || auth.uid,
              updatedAt:now,
              updatedBy:auth.email,
            },
            {
              merge:true,
            },
          );


          transaction.set(
            metaRef,
            {
              enabled:false,
              deleted:true,
              deletedAt:now,
              updatedAt:now,
              updatedBy:auth.email,
            },
            {
              merge:true,
            },
          );

        },
      );


    const verify =
      await tenantRef.get();


    if(
      !verify.exists ||
      verify.data()?.deleted !== true
    ){
      throw new functions.https.HttpsError(
        "internal",
        "SCHOOL_DELETE_VERIFY_FAILED",
      );
    }


    return {
      ok:true,
      tenantId,
      deleted:true,
      securityJournalEventHash:
        journal.eventHash,
    };

  });

export const adminRestoreSchoolTenant = functions
  .region("us-central1")
  .https.onCall(async (
    data:{
      tenantId?: string;
    },
    context,
  ) => {

    const auth = await getAuthContext(context);

    assertPlatformOwnerOnly(auth);

    const tenantId =
      validateSchoolTenantId(data?.tenantId);

    const archiveRef =
      db.collection("deletedSchoolTenants").doc(tenantId);

    const tenantRef =
      db.collection("tenants").doc(tenantId);

    const metaRef =
      tenantRef.collection("meta").doc("config");

    const archiveSnap =
      await archiveRef.get();

    if(!archiveSnap.exists){
      throw new functions.https.HttpsError(
        "not-found",
        "DELETED_SCHOOL_NOT_FOUND",
      );
    }

    const archive =
      archiveSnap.data() || {};

    const expiresAt =
      archive.restoreExpiresAt;

    if(
      expiresAt &&
      typeof expiresAt.toDate === "function" &&
      expiresAt.toDate().getTime() < Date.now()
    ){
      throw new functions.https.HttpsError(
        "failed-precondition",
        "RESTORE_WINDOW_EXPIRED",
      );
    }

    await db.runTransaction(async(transaction)=>{

      transaction.set(
        tenantRef,
        {
          ...(archive.root || {}),
          enabled:true,
          deleted:false,
          restoredAt:FieldValue.serverTimestamp(),
          restoredBy:auth.email || auth.uid,
          updatedAt:FieldValue.serverTimestamp(),
        },
        {
          merge:true,
        },
      );

      transaction.set(
        metaRef,
        {
          ...(archive.meta || {}),
          enabled:true,
          deleted:false,
          restoredAt:FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp(),
        },
        {
          merge:true,
        },
      );

      transaction.delete(archiveRef);

    });

    return {
      ok:true,
      tenantId,
      restored:true,
    };

  });
export const adminDeleteTenant = functions
  .region("us-central1")
  .https.onCall(async (data: AdminDeleteTenantReq, context) => {
    const auth = await getAuthContext(context);
    assertPlatformOwnerOnly(auth);

    const tenantId = safeCallableTenantId(data?.tenantId);
    const now = FieldValue.serverTimestamp();

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantMetaRef = tenantRef.collection("meta").doc("config");
    const archiveTenantRef = db.collection("archiveTenants").doc(tenantId);

    const correlationId = createSecurityCorrelationId();

    const primaryJournal = await appendSecurityJournalEvent(
      {
        correlationId,
        action: "ADMIN_DELETE_TENANT",
        scope: "CONTROL_PLANE",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId,
        targetType: "tenant",
        targetId: tenantId,
        outcome: "SUCCESS",
        details: {
          userDisableRequested: data?.alsoDeleteUsers === true,
        },
      },
      async (transaction) => {
        const tenantSnap = await transaction.get(tenantRef);

        const tenantData = tenantSnap.exists
          ? tenantSnap.data() || {}
          : {};

        if (tenantSnap.exists) {
          transaction.set(
            archiveTenantRef,
            {
              ...tenantData,
              id: tenantId,
              tenantId,
              deletedAt: now,
              deletedBy: auth.email || auth.uid,
              source: "adminDeleteTenant",
            },
            { merge: true },
          );
        }

        transaction.set(
          tenantRef,
          {
            enabled: false,
            deleted: true,
            deletedAt: now,
            deletedBy: auth.email || auth.uid,
            updatedAt: now,
            updatedBy: auth.email || auth.uid,
          },
          { merge: true },
        );

        transaction.set(
          tenantMetaRef,
          {
            enabled: false,
            deleted: true,
            deletedAt: now,
            updatedAt: now,
            updatedBy: auth.email || auth.uid,
          },
          { merge: true },
        );
      },
    );

    let disabledUsers = 0;
    let userDisableJournalEvents = 0;

    if (data?.alsoDeleteUsers) {
      const usersSnap = await db
        .collection("allowlist")
        .where("tenantId", "==", tenantId)
        .get();

      const userDocs = usersSnap.docs;

      // Keep the transaction comfortably below Firestore write limits.
      // Each chunk also writes one journal event and the chain HEAD.
      const userChunkSize = 350;

      for (
        let offset = 0;
        offset < userDocs.length;
        offset += userChunkSize
      ) {
        const chunk = userDocs.slice(
          offset,
          offset + userChunkSize,
        );

        const chunkIndex =
          Math.floor(offset / userChunkSize) + 1;

        await appendSecurityJournalEvent(
          {
            correlationId,
            action: "ADMIN_DELETE_TENANT_DISABLE_USERS_CHUNK",
            scope: "AUTHORITY_MIGRATION",
            actor: {
              uid: auth.uid,
              email: auth.email,
              role: auth.role,
              tenantId: auth.tenantId,
              governorate: auth.governorate,
            },
            tenantId,
            targetType: "tenant_users",
            targetId: tenantId,
            outcome: "SUCCESS",
            details: {
              chunkIndex,
              chunkSize: chunk.length,
              totalUsers: userDocs.length,
            },
          },
          (transaction) => {
            for (const userDoc of chunk) {
              transaction.set(
                userDoc.ref,
                {
                  enabled: false,
                  disabledAt: now,
                  disabledBy: auth.email || auth.uid,
                  updatedAt: now,
                },
                { merge: true },
              );
            }
          },
        );

        disabledUsers += chunk.length;
        userDisableJournalEvents += 1;
      }

      await appendSecurityJournalEvent({
        correlationId,
        action: "ADMIN_DELETE_TENANT_DISABLE_USERS_COMPLETE",
        scope: "AUTHORITY_MIGRATION",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId,
        targetType: "tenant_users",
        targetId: tenantId,
        outcome: "SUCCESS",
        details: {
          disabledUsers,
          totalUsers: userDocs.length,
        },
      });

      userDisableJournalEvents += 1;
    }

    return {
      ok: true,
      tenantId,
      deleted: true,
      disabledUsers,
      correlationId,
      securityJournalEventId: primaryJournal.eventId,
      securityJournalSequence: primaryJournal.sequence,
      securityJournalEventHash: primaryJournal.eventHash,
      userDisableJournalEvents,
    };
  });
type AdminUpsertAllowlistReq = {
  
  createOnly?: boolean;email?: string;
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
    raw.includes("ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²") ||
    raw.includes("ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦") ||
    hasCenterName
  ) {
    return "exam_center";
  }

  if (
    raw.includes("school") ||
    raw.includes("ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³") ||
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

  // Ministry-level supervisor is read-only.
  // It may list/view managed users and tenants, but it must never create,
  // update, delete, or change allowlist/custom claims.
  if (auth.role === "ministry_super") {
    return false;
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
    // Ministry-wide write access is not allowed through governorate supervisor permissions.

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

    const platformOwnerEmail = "3asal2030@gmail.com";

    if (email === platformOwnerEmail && !auth.isOwner) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "PLATFORM_OWNER_ACCOUNT_MANAGEMENT_DENIED",
      );
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

    // YR: One administrative supervisor per school / diploma center.
    // This is enforced server-side and excludes the user currently being edited.
    if (isTenantScopedRole(role) && tenantId) {

      const assignedUsersSnap =
        await db
          .collection("allowlist")
          .where("tenantId", "==", tenantId)
          .limit(25)
          .get();


      const conflictingUser =
        assignedUsersSnap.docs.find((candidate) => {

          const candidateEmail =
            clean(candidate.id).toLowerCase();

          const currentEmail =
            clean(email).toLowerCase();


          // Allow updating the same user
          if (
            candidateEmail === currentEmail
          ) {
            return false;
          }


          const candidateData =
            candidate.data() || {};

          const candidateRole =
            normalizeManagedRole(
              candidateData.role || "user"
            );


          if (role === "exam_super") {
            return candidateRole === "exam_super";
          }


          if (
            role === "tenant_admin" ||
            role === "admin"
          ) {
            return (
              candidateRole === "tenant_admin" ||
              candidateRole === "admin"
            );
          }


          return false;
        });


      if (conflictingUser) {

        throw new functions.https.HttpsError(
          "already-exists",
          "TENANT_SUPERVISOR_ALREADY_ASSIGNED"
        );

      }

    }

    const allowRef = db.collection("allowlist").doc(email);
    const oldAllowSnap = await allowRef.get();

    if (data?.createOnly === true && oldAllowSnap.exists) {
      throw new functions.https.HttpsError(
        "already-exists",
        "EMAIL_ALREADY_EXISTS",
      );
    }
    const oldAllow = oldAllowSnap.exists ? oldAllowSnap.data() || {} : {};

    const oldRole: Role | null = oldAllowSnap.exists
      ? normalizeManagedRole(oldAllow.role || "user")
      : null;

    const oldTenantId = oldAllowSnap.exists
      ? clean(oldAllow.tenantId)
      : "";

    const oldGovernorate = oldAllowSnap.exists
      ? clean(oldAllow.governorate)
      : "";

    const oldEnabled = oldAllowSnap.exists
      ? oldAllow.enabled === true
      : false;

    // Existing authority must be manageable before it can be changed.
    if (
      oldAllowSnap.exists &&
      oldRole &&
      !(await canManageTargetUser(
        auth,
        oldRole,
        oldTenantId,
        oldGovernorate,
      ))
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "CURRENT_USER_MANAGEMENT_DENIED",
      );
    }

    // The proposed new authority must also be manageable.
    if (
      !(await canManageTargetUser(
        auth,
        role,
        tenantId,
        effectiveGovernorate,
      ))
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "NEW_USER_MANAGEMENT_DENIED",
      );
    }

    const displayName =
      name || clean(oldAllow.name) || email;

    const { userRecord, created } =
      await getOrCreateAuthUserByEmail(email, displayName);

    const now =
      FieldValue.serverTimestamp();

    const allowPayload = {
      email,
      enabled,
      role,
      tenantId: role === "super" ? "" : tenantId || "system",
      governorate: effectiveGovernorate || "",
      name: displayName,
      schoolName:
        schoolName || clean(tenantData.name || tenantData.schoolName || ""),
      tenantName:
        schoolName || clean(tenantData.name || tenantData.schoolName || ""),
      updatedAt: now,
      updatedBy: auth.email || auth.uid || "",
      ...(oldAllowSnap.exists
        ? {}
        : {
            createdAt: now,
            createdBy: auth.email || auth.uid || "",
          }),
    };

    const oldMemberRef =
      oldTenantId &&
      oldTenantId !== "system" &&
      oldTenantId !== tenantId
        ? db
            .collection("tenants")
            .doc(oldTenantId)
            .collection("members")
            .doc(userRecord.uid)
        : null;

    const newMemberRef =
      tenantId && isTenantScopedRole(role)
        ? db
            .collection("tenants")
            .doc(tenantId)
            .collection("members")
            .doc(userRecord.uid)
        : null;

    const activityRef = tenantId
      ? db
          .collection("tenants")
          .doc(tenantId)
          .collection("activityLogs")
          .doc()
      : null;

    const correlationId = createSecurityCorrelationId();

    const targetEmailSha256 = crypto
      .createHash("sha256")
      .update(email, "utf8")
      .digest("hex");

    const authorityJournal = await appendSecurityJournalEvent(
      {
        correlationId,
        action: "ADMIN_UPSERT_ALLOWLIST_AUTHORITY_COMMIT",
        scope: "AUTHORITY_MIGRATION",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId: tenantId || oldTenantId || "system",
        targetType: "allowlist_user",
        targetId: userRecord.uid,
        outcome: "SUCCESS",
        details: {
          targetEmailSha256,
          previousExists: oldAllowSnap.exists,
          previousEnabled: oldEnabled,
          previousRole: oldRole || "",
          previousTenantId: oldTenantId,
          previousGovernorate: oldGovernorate,
          nextEnabled: enabled,
          nextRole: role,
          nextTenantId: tenantId || "system",
          nextGovernorate: effectiveGovernorate || "",
          createdAuthUser: created,
        },
      },
      async (transaction) => {
        // Re-read target authority in the same transaction.
        const currentAllowSnap =
          await transaction.get(allowRef);

        if (currentAllowSnap.exists !== oldAllowSnap.exists) {
          throw new Error("ALLOWLIST_TARGET_CHANGED_DURING_OPERATION");
        }

        if (currentAllowSnap.exists) {
          const currentAllow = currentAllowSnap.data() || {};
          const currentRole =
            normalizeManagedRole(currentAllow.role || "user");
          const currentTenantId = clean(currentAllow.tenantId);
          const currentGovernorate = clean(currentAllow.governorate);
          const currentEnabled = currentAllow.enabled === true;

          if (
            currentRole !== oldRole ||
            currentTenantId !== oldTenantId ||
            currentGovernorate !== oldGovernorate ||
            currentEnabled !== oldEnabled
          ) {
            throw new Error("ALLOWLIST_TARGET_AUTHORITY_CHANGED_DURING_OPERATION");
          }
        }

        // Revalidate the actor authority at commit time.
        if (!auth.isOwner) {
          const actorAllowSnap =
            auth.email === email
              ? currentAllowSnap
              : await transaction.get(
                  db.collection("allowlist").doc(auth.email),
                );

          if (!actorAllowSnap.exists) {
            throw new Error("ACTOR_ALLOWLIST_AUTHORITY_MISSING_DURING_OPERATION");
          }

          const actorAllow = actorAllowSnap.data() || {};
          const actorRole =
            normalizeManagedRole(actorAllow.role || "user");

          if (
            actorAllow.enabled !== true ||
            actorRole !== auth.role ||
            clean(actorAllow.tenantId) !== clean(auth.tenantId) ||
            clean(actorAllow.governorate) !== clean(auth.governorate)
          ) {
            throw new Error("ACTOR_AUTHORITY_CHANGED_DURING_OPERATION");
          }
        }

        transaction.set(
          allowRef,
          allowPayload,
          { merge: true },
        );

        if (oldMemberRef) {
          transaction.delete(oldMemberRef);
        }

        if (newMemberRef) {
          transaction.set(
            newMemberRef,
            {
              uid: userRecord.uid,
              email,
              enabled,
              role,
              tenantId,
              governorate: effectiveGovernorate || "",
              name: displayName,
              schoolName:
                schoolName || clean(tenantData.name || tenantData.schoolName || ""),
              updatedAt: now,
              updatedByUid: auth.uid,
              updatedByEmail: auth.email || "",
              ...(created
                ? {
                    createdAt: now,
                    createdByUid: auth.uid,
                    createdByEmail: auth.email || "",
                  }
                : {}),
            },
            { merge: true },
          );
        }

        if (activityRef) {
          transaction.create(activityRef, {
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
            correlationId,
            createdAt: now,
            source: "adminUpsertAllowlist",
          });
        }
      },
    );

    // Custom claims are compatibility state only.
    // Their failure must not roll back or falsify the authoritative
    // Firestore allowlist result that already committed with its journal.
    let claimsSync = true;
    let claimsSyncErrorCode = "";

    try {
      await setCompatibleClaims(userRecord.uid, {
        enabled,
        role,
        tenantId: role === "super" ? "" : tenantId || "system",
        governorate: effectiveGovernorate || "",
      });
    } catch (error: any) {
      claimsSync = false;
      claimsSyncErrorCode = clean(
        error?.code ||
        error?.name ||
        "CLAIMS_SYNC_FAILED",
      ).slice(0, 128);
    }

    let claimsSyncJournalRecorded = false;

    try {
      await appendSecurityJournalEvent({
        correlationId,
        action: "ADMIN_UPSERT_ALLOWLIST_COMPATIBILITY_CLAIMS_SYNC",
        scope: "AUTHORITY_MIGRATION",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId: tenantId || oldTenantId || "system",
        targetType: "firebase_auth_claims",
        targetId: userRecord.uid,
        outcome: claimsSync ? "SUCCESS" : "FAILURE",
        details: {
          claimsSync,
          errorCode: claimsSyncErrorCode,
          authorityEventHash: authorityJournal.eventHash,
        },
      });

      claimsSyncJournalRecorded = true;
    } catch (journalError) {
      console.error(
        "adminUpsertAllowlist claims compatibility journal failed:",
        journalError,
      );
    }

    return {
      ok: true,
      uid: userRecord.uid,
      email,
      role,
      tenantId: role === "super" ? "" : tenantId || "system",
      createdAuthUser: created,
      correlationId,
      securityJournalEventId: authorityJournal.eventId,
      securityJournalSequence: authorityJournal.sequence,
      securityJournalEventHash: authorityJournal.eventHash,
      claimsSync,
      claimsSyncJournalRecorded,
      claimsSyncErrorCode: claimsSync ? null : claimsSyncErrorCode,
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

type AdminListDiplomaCenterTenantItem = {
  id: string;
  name: string;
  governorate: string;
  enabled: boolean;
};

const DIPLOMA_READ_IDENTITY_FIELDS = [
  "type",
  "tenantType",
  "entityType",
  "kind",
  "category",
  "programType",
  "program",
] as const;

const DIPLOMA_READ_GOVERNORATE_FIELDS = [
  "governorate",
  "tenantGovernorate",
  "regionAr",
  "governorateAr",
  "scopeGovernorate",
  "gov",
] as const;

const DIPLOMA_READ_SCHOOL_MARKERS = new Set([
  "school",
  "tenant_school",
  "school_tenant",
  "school-tenant",
]);

function diplomaReadMarker(value: unknown) {
  return clean(value).toLowerCase().replace(/\s+/g, "_");
}

function diplomaReadHasSchoolMarker(
  data: FirebaseFirestore.DocumentData,
) {
  return DIPLOMA_READ_IDENTITY_FIELDS.some((field) =>
    DIPLOMA_READ_SCHOOL_MARKERS.has(
      diplomaReadMarker(data?.[field]),
    ),
  );
}

function diplomaReadBooleanValues(values: unknown[]) {
  return values.filter(
    (value): value is boolean => typeof value === "boolean",
  );
}

function diplomaReadDistinctTextValues(
  root: FirebaseFirestore.DocumentData,
  meta: FirebaseFirestore.DocumentData,
  fields: readonly string[],
) {
  return Array.from(
    new Set(
      fields
        .flatMap((field) => [
          clean(root?.[field]),
          clean(meta?.[field]),
        ])
        .filter(Boolean),
    ),
  );
}

function diplomaReadIsExplicitCenter(
  root: FirebaseFirestore.DocumentData,
  meta: FirebaseFirestore.DocumentData,
) {
  if (
    root?.deleted === true ||
    meta?.deleted === true
  ) {
    return false;
  }

  if (
    diplomaReadHasSchoolMarker(root) ||
    diplomaReadHasSchoolMarker(meta)
  ) {
    return false;
  }

  const centerTypes = [
    diplomaReadMarker(root?.centerType),
    diplomaReadMarker(meta?.centerType),
  ].filter(Boolean);

  if (
    centerTypes.length === 0 ||
    centerTypes.some((value) => value !== "diploma_center")
  ) {
    return false;
  }

  const diplomaFlags = diplomaReadBooleanValues([
    root?.isDiplomaCenter,
    meta?.isDiplomaCenter,
  ]);

  if (
    diplomaFlags.length === 0 ||
    !diplomaFlags.every((value) => value === true)
  ) {
    return false;
  }

  const examFlags = diplomaReadBooleanValues([
    root?.isExamCenter,
    meta?.isExamCenter,
  ]);

  if (
    examFlags.length === 0 ||
    !examFlags.every((value) => value === true)
  ) {
    return false;
  }

  const aliasFlags = diplomaReadBooleanValues([
    root?.diplomaCenter,
    meta?.diplomaCenter,
    root?.examCenter,
    meta?.examCenter,
  ]);

  if (aliasFlags.some((value) => value === false)) {
    return false;
  }

  return true;
}

type AdminUpsertDiplomaCenterTenantReq = {
  id?: unknown;
  name?: unknown;
  governorate?: unknown;
  enabled?: unknown;
};

const DIPLOMA_WRITE_REQUEST_FIELDS = new Set([
  "id",
  "name",
  "governorate",
  "enabled",
]);

const DIPLOMA_WRITE_CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

function diplomaWriteDenyReason(error: unknown) {
  const candidate = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
  };

  const message = clean(candidate.message);
  if (/^[A-Z0-9_:-]{1,120}$/.test(message)) {
    return message;
  }

  const code = clean(candidate.code);
  if (code) {
    return code.slice(0, 120);
  }

  return "DIPLOMA_CENTER_WRITE_DENIED";
}

function diplomaWriteNormalizeName(value: unknown) {
  if (typeof value !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "DIPLOMA_CENTER_NAME_REQUIRED",
    );
  }

  if (DIPLOMA_WRITE_CONTROL_CHAR_PATTERN.test(value)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "DIPLOMA_CENTER_NAME_CONTROL_CHARACTERS_DENIED",
    );
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "DIPLOMA_CENTER_NAME_REQUIRED",
    );
  }

  if (normalized.length > 160) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "DIPLOMA_CENTER_NAME_TOO_LONG",
    );
  }

  return normalized;
}

function diplomaWriteNormalizeGovernorate(value: unknown) {
  if (typeof value !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "OFFICIAL_GOVERNORATE_REQUIRED",
    );
  }

  if (
    DIPLOMA_WRITE_CONTROL_CHAR_PATTERN.test(value) ||
    value.length > 80
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "OFFICIAL_GOVERNORATE_REQUIRED",
    );
  }

  const governorate = clean(value);

  if (!OFFICIAL_SCHOOL_GOVERNORATES.has(governorate)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "OFFICIAL_GOVERNORATE_REQUIRED",
    );
  }

  return governorate;
}

function diplomaWriteNormalizeUpdateId(value: unknown) {
  if (typeof value !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "DIPLOMA_CENTER_UPDATE_ID_REQUIRED",
    );
  }

  if (
    DIPLOMA_WRITE_CONTROL_CHAR_PATTERN.test(value) ||
    value.length > 128
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "INVALID_TENANT_ID",
    );
  }

  return safeCallableTenantId(value);
}

function diplomaWriteExistingKindConflict(
  root: FirebaseFirestore.DocumentData,
  meta: FirebaseFirestore.DocumentData,
) {
  const canonicalKindValues = diplomaReadDistinctTextValues(
    root,
    meta,
    ["type", "tenantType"],
  ).map(diplomaReadMarker);

  if (
    canonicalKindValues.some((value) => value !== "diploma")
  ) {
    return true;
  }

  const legacyClassificationFields = [
    "entityType",
    "kind",
    "category",
    "programType",
    "program",
  ] as const;

  return legacyClassificationFields.some((field) =>
    [
      diplomaReadMarker(root?.[field]),
      diplomaReadMarker(meta?.[field]),
    ].some(Boolean),
  );
}

function diplomaWriteHasSchoolNameShadow(
  root: FirebaseFirestore.DocumentData,
  meta: FirebaseFirestore.DocumentData,
) {
  return [
    root?.schoolName,
    root?.schoolNameAr,
    meta?.schoolName,
    meta?.schoolNameAr,
  ].some((value) => Boolean(clean(value)));
}

async function diplomaWriteAppendAuthenticatedDenyJournal(input: {
  context: functions.https.CallableContext;
  auth?: Awaited<ReturnType<typeof getAuthContext>>;
  correlationId?: string;
  tenantId?: string;
  stage: string;
  error: unknown;
}) {
  if (!input.context.auth) {
    return;
  }

  const token: any = input.context.auth.token ?? {};
  const actorUid = clean(input.auth?.uid ?? input.context.auth.uid);

  if (!actorUid) {
    return;
  }

  const actorEmail = clean(input.auth?.email ?? token.email).toLowerCase();
  const actorRole = clean(input.auth?.role ?? token.role).toLowerCase();
  const actorTenantId = clean(input.auth?.tenantId ?? token.tenantId);
  const actorGovernorate = clean(
    input.auth?.governorate ?? token.governorate,
  );
  const tenantId = clean(input.tenantId) || "system";
  const correlationId =
    input.correlationId || createSecurityCorrelationId();

  try {
    await appendSecurityJournalEvent({
      correlationId,
      action: "DIPLOMA_CENTER_WRITE_DENIED",
      scope: "CONTROL_PLANE",
      actor: {
        uid: actorUid,
        email: actorEmail,
        role: actorRole,
        tenantId: actorTenantId,
        governorate: actorGovernorate,
      },
      tenantId,
      targetType: "diploma_center_tenant",
      targetId: tenantId,
      outcome: "FAILURE",
      details: {
        stage: input.stage,
        reason: diplomaWriteDenyReason(input.error),
      },
    });
  } catch (journalError) {
    console.error(
      "adminUpsertDiplomaCenterTenant deny journal failed",
      journalError,
    );
  }
}

export const adminUpsertDiplomaCenterTenant = functions
  .region("us-central1")
  .https.onCall(async (data: AdminUpsertDiplomaCenterTenantReq, context) => {
    let auth: Awaited<ReturnType<typeof getAuthContext>>;

    try {
      auth = await getAuthContext(context);
    } catch (error) {
      await diplomaWriteAppendAuthenticatedDenyJournal({
        context,
        tenantId: "system",
        stage: "AUTH_CONTEXT",
        error,
      });
      throw error;
    }

    try {
      assertPlatformOwnerOnly(auth);
    } catch (error) {
      await diplomaWriteAppendAuthenticatedDenyJournal({
        context,
        auth,
        tenantId: "system",
        stage: "PLATFORM_OWNER_GUARD",
        error,
      });
      throw error;
    }

    const correlationId = createSecurityCorrelationId();
    let tenantIdForDeny = "system";
    let tenantId = "";
    let centerName = "";
    let governorate = "";
    let enabled = false;
    let operation: "CREATE" | "UPDATE" = "CREATE";

    try {
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "DIPLOMA_CENTER_REQUEST_OBJECT_REQUIRED",
        );
      }

      const request = data as Record<string, unknown>;
      const unknownField = Object.keys(request).find(
        (field) => !DIPLOMA_WRITE_REQUEST_FIELDS.has(field),
      );

      if (unknownField) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "UNKNOWN_REQUEST_FIELD",
        );
      }

      const hasId = Object.prototype.hasOwnProperty.call(request, "id");
      operation = hasId ? "UPDATE" : "CREATE";

      tenantId = hasId
        ? diplomaWriteNormalizeUpdateId(request.id)
        : db.collection("tenants").doc().id;
      tenantIdForDeny = tenantId;

      centerName = diplomaWriteNormalizeName(request.name);
      governorate = diplomaWriteNormalizeGovernorate(
        request.governorate,
      );

      if (
        !Object.prototype.hasOwnProperty.call(request, "enabled") ||
        typeof request.enabled !== "boolean"
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "DIPLOMA_CENTER_ENABLED_BOOLEAN_REQUIRED",
        );
      }

      enabled = request.enabled;

      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenantMetaRef = tenantRef.collection("meta").doc("config");
      const now = FieldValue.serverTimestamp();

      await appendSecurityJournalEvent(
        {
          correlationId,
          action:
            operation === "CREATE"
              ? "DIPLOMA_CENTER_CREATE"
              : "DIPLOMA_CENTER_UPDATE",
          scope: "CONTROL_PLANE",
          actor: {
            uid: auth.uid,
            email: auth.email,
            role: auth.role,
            tenantId: auth.tenantId,
            governorate: auth.governorate,
          },
          tenantId,
          targetType: "diploma_center_tenant",
          targetId: tenantId,
          outcome: "SUCCESS",
          details: {
            operation,
            governorate,
            enabled,
            centerType: "diploma_center",
          },
        },
        async (transaction) => {
          const [tenantSnap, metaSnap] = await Promise.all([
            transaction.get(tenantRef),
            transaction.get(tenantMetaRef),
          ]);

          if (operation === "CREATE") {
            if (tenantSnap.exists || metaSnap.exists) {
              throw new functions.https.HttpsError(
                "already-exists",
                "DIPLOMA_CENTER_CREATE_ID_COLLISION",
              );
            }
          } else {
            if (!tenantSnap.exists) {
              if (metaSnap.exists) {
                throw new functions.https.HttpsError(
                  "failed-precondition",
                  "ORPHAN_TENANT_META_CONFLICT",
                );
              }

              throw new functions.https.HttpsError(
                "not-found",
                "DIPLOMA_CENTER_UPDATE_TARGET_NOT_FOUND",
              );
            }

            const existingRoot = tenantSnap.data() ?? {};
            const existingMeta = metaSnap.exists
              ? metaSnap.data() ?? {}
              : {};

            if (
              existingRoot?.deleted === true ||
              existingMeta?.deleted === true
            ) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "DELETED_TENANT_REQUIRES_SEPARATE_RECOVERY",
              );
            }

            if (
              diplomaReadHasSchoolMarker(existingRoot) ||
              diplomaReadHasSchoolMarker(existingMeta) ||
              diplomaWriteHasSchoolNameShadow(
                existingRoot,
                existingMeta,
              )
            ) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "SCHOOL_TENANT_CANNOT_BECOME_DIPLOMA_CENTER",
              );
            }

            if (
              !diplomaReadIsExplicitCenter(
                existingRoot,
                existingMeta,
              )
            ) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "EXISTING_TENANT_NOT_EXPLICIT_DIPLOMA_CENTER",
              );
            }

            if (
              diplomaWriteExistingKindConflict(
                existingRoot,
                existingMeta,
              )
            ) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "DIPLOMA_CENTER_TENANT_KIND_CONFLICT",
              );
            }

            const identityValues = diplomaReadDistinctTextValues(
              existingRoot,
              existingMeta,
              ["tenantId", "id"],
            );

            if (identityValues.some((value) => value !== tenantId)) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "DIPLOMA_CENTER_IDENTITY_CONFLICT",
              );
            }

            const existingGovernorates =
              diplomaReadDistinctTextValues(
                existingRoot,
                existingMeta,
                DIPLOMA_READ_GOVERNORATE_FIELDS,
              );

            if (existingGovernorates.length !== 1) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "DIPLOMA_CENTER_GOVERNORATE_CONFLICT",
              );
            }

            if (existingGovernorates[0] !== governorate) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "DIPLOMA_CENTER_GOVERNORATE_CHANGE_REQUIRES_SEPARATE_GATE",
              );
            }

            const existingNames = diplomaReadDistinctTextValues(
              existingRoot,
              existingMeta,
              ["centerName", "name", "title"],
            );

            if (existingNames.length !== 1) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "DIPLOMA_CENTER_NAME_CONFLICT",
              );
            }

            const existingEnabledValues = diplomaReadBooleanValues([
              existingRoot?.enabled,
              existingMeta?.enabled,
            ]);

            if (
              existingEnabledValues.length > 1 &&
              new Set(existingEnabledValues).size !== 1
            ) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "DIPLOMA_CENTER_ENABLED_CONFLICT",
              );
            }
          }

          const rootPayload: FirebaseFirestore.DocumentData = {
            tenantId,
            id: tenantId,
            name: centerName,
            centerName,
            title: centerName,
            governorate,
            tenantGovernorate: governorate,
            regionAr: governorate,
            enabled,
            type: "diploma",
            tenantType: "diploma",
            centerType: "diploma_center",
            isDiplomaCenter: true,
            isExamCenter: true,
            diplomaCenter: true,
            examCenter: true,
            updatedAt: now,
            updatedBy: auth.email,
          };

          const metaPayload: FirebaseFirestore.DocumentData = {
            tenantId,
            id: tenantId,
            name: centerName,
            centerName,
            title: centerName,
            governorate,
            tenantGovernorate: governorate,
            regionAr: governorate,
            enabled,
            type: "diploma",
            tenantType: "diploma",
            centerType: "diploma_center",
            isDiplomaCenter: true,
            isExamCenter: true,
            diplomaCenter: true,
            examCenter: true,
            updatedAt: now,
            updatedBy: auth.email,
          };

          if (!tenantSnap.exists) {
            rootPayload.createdAt = now;
            rootPayload.createdBy = auth.email;
          }

          if (!metaSnap.exists) {
            metaPayload.createdAt = now;
            metaPayload.createdBy = auth.email;
          }

          transaction.set(tenantRef, rootPayload, { merge: true });
          transaction.set(tenantMetaRef, metaPayload, { merge: true });
        },
      );
    } catch (error) {
      await diplomaWriteAppendAuthenticatedDenyJournal({
        context,
        auth,
        correlationId,
        tenantId: tenantIdForDeny,
        stage: "BUSINESS_VALIDATION_OR_ATOMIC_COMMIT",
        error,
      });
      throw error;
    }

    const verifyRef = db.collection("tenants").doc(tenantId);
    const [verifyRootSnap, verifyMetaSnap] = await Promise.all([
      verifyRef.get(),
      verifyRef.collection("meta").doc("config").get(),
    ]);

    if (!verifyRootSnap.exists || !verifyMetaSnap.exists) {
      console.error("DIPLOMA_CENTER_POST_WRITE_VERIFY_MISSING", {
        tenantId,
        correlationId,
      });
      throw new functions.https.HttpsError(
        "internal",
        "DIPLOMA_CENTER_POST_WRITE_VERIFY_FAILED",
      );
    }

    const verifyRoot = verifyRootSnap.data() ?? {};
    const verifyMeta = verifyMetaSnap.data() ?? {};
    const verifyGovernorates = diplomaReadDistinctTextValues(
      verifyRoot,
      verifyMeta,
      DIPLOMA_READ_GOVERNORATE_FIELDS,
    );
    const verifyNames = diplomaReadDistinctTextValues(
      verifyRoot,
      verifyMeta,
      ["centerName", "name", "title"],
    );
    const verifyEnabledValues = diplomaReadBooleanValues([
      verifyRoot?.enabled,
      verifyMeta?.enabled,
    ]);
    const verifyIdentityValues = diplomaReadDistinctTextValues(
      verifyRoot,
      verifyMeta,
      ["tenantId", "id"],
    );

    const verifyPass =
      diplomaReadIsExplicitCenter(verifyRoot, verifyMeta) &&
      !diplomaReadHasSchoolMarker(verifyRoot) &&
      !diplomaReadHasSchoolMarker(verifyMeta) &&
      !diplomaWriteHasSchoolNameShadow(verifyRoot, verifyMeta) &&
      !diplomaWriteExistingKindConflict(verifyRoot, verifyMeta) &&
      verifyGovernorates.length === 1 &&
      verifyGovernorates[0] === governorate &&
      verifyNames.length === 1 &&
      verifyNames[0] === centerName &&
      verifyEnabledValues.length === 2 &&
      verifyEnabledValues.every((value) => value === enabled) &&
      verifyIdentityValues.length >= 1 &&
      verifyIdentityValues.every((value) => value === tenantId);

    if (!verifyPass) {
      console.error("DIPLOMA_CENTER_POST_WRITE_VERIFY_FAILED", {
        tenantId,
        correlationId,
      });
      throw new functions.https.HttpsError(
        "internal",
        "DIPLOMA_CENTER_POST_WRITE_VERIFY_FAILED",
      );
    }

    return {
      id: tenantId,
      name: centerName,
      governorate,
      enabled,
    };
  });


export const adminUpdateDiplomaCenterStatus = functions
  .region("us-central1")
  .https.onCall(async (data: {
    id?: unknown;
    enabled?: unknown;
  }, context) => {

    const auth = await getAuthContext(context);

    assertPlatformOwnerOnly(auth);


    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "DIPLOMA_STATUS_REQUEST_REQUIRED",
      );
    }


    const tenantId = diplomaWriteNormalizeUpdateId(
      data.id,
    );


    if(typeof data.enabled !== "boolean"){
      throw new functions.https.HttpsError(
        "invalid-argument",
        "DIPLOMA_STATUS_BOOLEAN_REQUIRED",
      );
    }


    const enabled = data.enabled;


    const tenantRef =
      db.collection("tenants").doc(tenantId);


    const metaRef =
      tenantRef.collection("meta").doc("config");


    const now = FieldValue.serverTimestamp();


    const correlationId =
      createSecurityCorrelationId();



    await appendSecurityJournalEvent(
      {
        correlationId,

        action: enabled
          ? "DIPLOMA_CENTER_ENABLED"
          : "DIPLOMA_CENTER_DISABLED",

        scope:"CONTROL_PLANE",

        actor:{
          uid:auth.uid,
          email:auth.email,
          role:auth.role,
          tenantId:auth.tenantId,
          governorate:auth.governorate,
        },

        tenantId,

        targetType:
          "diploma_center_tenant",

        targetId:
          tenantId,

        outcome:"SUCCESS",

        details:{
          enabled,
        },
      },

      async(transaction)=>{

        const [
          tenantSnap,
          metaSnap
        ] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(metaRef),
        ]);


        if(!tenantSnap.exists){
          throw new functions.https.HttpsError(
            "not-found",
            "DIPLOMA_CENTER_NOT_FOUND",
          );
        }


        const root =
          tenantSnap.data() ?? {};

        const meta =
          metaSnap.exists
          ? metaSnap.data() ?? {}
          : {};


        if(
          !diplomaReadIsExplicitCenter(
            root,
            meta
          )
        ){
          throw new functions.https.HttpsError(
            "failed-precondition",
            "NOT_DIPLOMA_CENTER",
          );
        }


        transaction.set(
          tenantRef,
          {
            enabled,
            updatedAt:now,
            updatedBy:auth.email,
          },
          {
            merge:true,
          }
        );


        transaction.set(
          metaRef,
          {
            enabled,
            updatedAt:now,
            updatedBy:auth.email,
          },
          {
            merge:true,
          }
        );

      },
    );


    const verify =
      await tenantRef.get();


    if(!verify.exists ||
       verify.data()?.enabled !== enabled
    ){
      throw new functions.https.HttpsError(
        "internal",
        "DIPLOMA_STATUS_VERIFY_FAILED",
      );
    }


    return {
      id:tenantId,
      enabled,
    };

  });


type AdminDeleteDiplomaCenterTenantReq = {
  id?: unknown;
};

export const adminDeleteDiplomaCenterTenant = functions
  .region("us-central1")
  .https.onCall(async (
    data: AdminDeleteDiplomaCenterTenantReq,
    context
  ) => {

    const auth = await getAuthContext(context);

    assertPlatformOwnerOnly(auth);

    const tenantId =
      diplomaWriteNormalizeUpdateId(data?.id);

    const tenantRef =
      db.collection("tenants").doc(tenantId);

    const metaRef =
      tenantRef.collection("meta").doc("config");

    const trashRef =
      db.collection("deletedDiplomaCenters").doc(tenantId);

    const correlationId =
      createSecurityCorrelationId();

    const now =
      Timestamp.now();

    const deleteExpiresAt =
      Timestamp.fromMillis(
        Date.now() + 48 * 60 * 60 * 1000
      );


    await appendSecurityJournalEvent(
      {
        correlationId,
        action:
          "DIPLOMA_CENTER_DELETE_REQUESTED",

        scope:
          "CONTROL_PLANE",

        actor:{
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },

        tenantId,
        targetType:
          "diploma_center_tenant",

        targetId:
          tenantId,

        outcome:
          "SUCCESS",

        details:{
          recoveryWindowHours:48,
        },
      },

      async(transaction)=>{

        const tenantSnap =
          await transaction.get(tenantRef);

        const metaSnap =
          await transaction.get(metaRef);


        if(!tenantSnap.exists){
          throw new functions.https.HttpsError(
            "not-found",
            "DIPLOMA_CENTER_NOT_FOUND",
          );
        }


        const root =
          tenantSnap.data() ?? {};

        const meta =
          metaSnap.exists
          ? metaSnap.data() ?? {}
          : {};


        if(
          !diplomaReadIsExplicitCenter(
            root,
            meta
          )
        ){
          throw new functions.https.HttpsError(
            "failed-precondition",
            "NOT_DIPLOMA_CENTER",
          );
        }


        transaction.set(
          trashRef,
          {
            id: tenantId,
            tenantId,

            root,
            meta,

            deletedAt: now,
            deleteExpiresAt,

            deletedBy:
              auth.email || auth.uid,

            source:
              "adminDeleteDiplomaCenterTenant",
          },
          {
            merge:true,
          }
        );


        transaction.set(
          tenantRef,
          {
            deleted:true,
            enabled:false,

            deletedAt:now,

            deletedBy:
              auth.email || auth.uid,

            updatedAt:now,

            updatedBy:
              auth.email || auth.uid,
          },
          {
            merge:true,
          }
        );


        transaction.set(
          metaRef,
          {
            deleted:true,
            enabled:false,

            deletedAt:now,

            updatedAt:now,

            updatedBy:
              auth.email || auth.uid,
          },
          {
            merge:true,
          }
        );

      }
    );


    return {
      ok:true,
      id:tenantId,
      deleteExpiresAt,
      correlationId,
    };

  });


export const adminRestoreDeletedDiplomaCenter = functions
  .region("us-central1")
  .https.onCall(async (
    data: { id?: unknown },
    context
  ) => {

    const auth = await getAuthContext(context);

    assertPlatformOwnerOnly(auth);

    const tenantId =
      diplomaWriteNormalizeUpdateId(data?.id);

    const trashRef =
      db.collection("deletedDiplomaCenters").doc(tenantId);

    const tenantRef =
      db.collection("tenants").doc(tenantId);

    const metaRef =
      tenantRef.collection("meta").doc("config");

    const correlationId =
      createSecurityCorrelationId();

    const now =
      Timestamp.now();


    await appendSecurityJournalEvent(
      {
        correlationId,

        action:
          "DIPLOMA_CENTER_RESTORE_REQUESTED",

        scope:
          "CONTROL_PLANE",

        actor:{
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },

        tenantId,

        targetType:
          "diploma_center_tenant",

        targetId:
          tenantId,

        outcome:
          "SUCCESS",
      },

      async(transaction)=>{

        const trashSnap =
          await transaction.get(trashRef);


        if(!trashSnap.exists){

          throw new functions.https.HttpsError(
            "not-found",
            "DELETED_DIPLOMA_CENTER_NOT_FOUND",
          );

        }


        const trash =
          trashSnap.data() || {};


        const deleteExpiresAt =
          trash.deleteExpiresAt;


        if(
          deleteExpiresAt &&
          typeof deleteExpiresAt.toMillis === "function" &&
          deleteExpiresAt.toMillis() < Date.now()
        ){

          throw new functions.https.HttpsError(
            "failed-precondition",
            "RESTORE_WINDOW_EXPIRED",
          );

        }


        transaction.set(
          tenantRef,
          {
            ...(trash.root || {}),

            deleted:false,

            updatedAt:now,

            restoredAt:now,

            restoredBy:
              auth.email || auth.uid,
          },

          {
            merge:false,
          }
        );


        transaction.set(
          metaRef,
          {
            ...(trash.meta || {}),

            deleted:false,

            updatedAt:now,

            restoredAt:now,

            restoredBy:
              auth.email || auth.uid,
          },

          {
            merge:false,
          }
        );


        transaction.delete(trashRef);

      }
    );


    return {
      ok:true,
      id:tenantId,
      correlationId,
    };

  });

export const adminListDiplomaCenterTenants = functions
  .region("us-central1")
  .https.onCall(async (_data: unknown, context) => {
    const auth = await getAuthContext(context);
    assertPlatformOwnerOnly(auth);

    const tenantsSnap = await db.collection("tenants").get();
    const items: AdminListDiplomaCenterTenantItem[] = [];

    for (const tenantDoc of tenantsSnap.docs) {
      const root = tenantDoc.data() || {};
      const metaSnap = await tenantDoc.ref
        .collection("meta")
        .doc("config")
        .get();
      const meta = metaSnap.exists
        ? metaSnap.data() || {}
        : {};

      if (!diplomaReadIsExplicitCenter(root, meta)) {
        continue;
      }

      const governorates = diplomaReadDistinctTextValues(
        root,
        meta,
        DIPLOMA_READ_GOVERNORATE_FIELDS,
      );

      if (governorates.length !== 1) {
        continue;
      }

      const governorate = governorates[0];

      if (!OFFICIAL_SCHOOL_GOVERNORATES.has(governorate)) {
        continue;
      }

      const names = Array.from(
        new Set(
          [
            clean(root?.centerName),
            clean(root?.name),
            clean(root?.title),
            clean(meta?.centerName),
            clean(meta?.name),
            clean(meta?.title),
          ].filter(Boolean),
        ),
      );

      if (names.length !== 1) {
        continue;
      }

      const enabledValues = diplomaReadBooleanValues([
        root?.enabled,
        meta?.enabled,
      ]);

      if (
        enabledValues.length > 1 &&
        new Set(enabledValues).size !== 1
      ) {
        continue;
      }

      items.push({
        id: tenantDoc.id,
        name: names[0],
        governorate,
        enabled:
          enabledValues.length === 0
            ? true
            : enabledValues[0],
      });
    }

    items.sort((left, right) =>
      left.name.localeCompare(right.name, "ar"),
    );

    return { items };
  });


export const adminListSchoolTenants = functions
  .region("us-central1")
  .https.onCall(async (_data: unknown, context) => {

    const auth = await getAuthContext(context);
    assertPlatformOwnerOnly(auth);

    const tenantsSnap = await db.collection("tenants").get();

    const items: Array<{
      id:string;
      name:string;
      governorate:string;
      enabled:boolean;
      deleted:boolean;
    }> = [];

    for (const tenantDoc of tenantsSnap.docs) {

      const root = tenantDoc.data() || {};

      const metaSnap = await tenantDoc.ref
        .collection("meta")
        .doc("config")
        .get();

      const meta = metaSnap.exists
        ? metaSnap.data() || {}
        : {};

      const isSchool =
        [
          root?.tenantType,
          root?.type,
          root?.entityType,
          meta?.tenantType,
          meta?.type,
          meta?.entityType,
        ]
        .map((x)=>clean(x).toLowerCase())
        .some(
          (x)=>
            x==="school" ||
            x==="tenant_school" ||
            x==="school_tenant"
        );

      if (!isSchool) {
        continue;
      }


      const governorate =
        clean(
          root?.governorate ||
          meta?.governorate ||
          root?.regionAr ||
          meta?.regionAr
        );


      if (!OFFICIAL_SCHOOL_GOVERNORATES.has(governorate)) {
        continue;
      }


      const name =
        clean(
          root?.name ||
          meta?.schoolNameAr ||
          meta?.name
        );


      if (!name) {
        continue;
      }


      items.push({
        id:tenantDoc.id,
        name,
        governorate,
        enabled:
          root?.enabled !== false &&
          meta?.enabled !== false,
        deleted: root?.deleted === true,
      });

    }


    items.sort(
      (a,b)=>a.name.localeCompare(b.name,"ar")
    );


    return {items};

  });
export const adminListDeletedDiplomaCenters = functions
  .region("us-central1")
  .https.onCall(async (_data: unknown, context) => {

    const auth = await getAuthContext(context);

    assertPlatformOwnerOnly(auth);


    const snap =
      await db
        .collection("deletedDiplomaCenters")
        .orderBy("deletedAt", "desc")
        .get();


    const items =
      snap.docs.map((doc) => {

        const x =
          doc.data() || {};


        const root =
          x.root || {};

        const meta =
          x.meta || {};


        return {

          id: doc.id,

          name:
            clean(
              root.centerName ||
              root.name ||
              meta.centerName ||
              meta.name ||
              doc.id
            ),

          governorate:
            clean(
              root.governorate ||
              meta.governorate ||
              ""
            ),

          deletedAt:
            x.deletedAt || null,

          deleteExpiresAt:
            x.deleteExpiresAt || null,

          deletedBy:
            clean(
              x.deletedBy || ""
            ),
        };
      });


    return {
      items,
    };
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
      throw new functions.https.HttpsError(
        "invalid-argument",
        "INVALID_EMAIL",
      );
    }

    const platformOwnerEmail = "3asal2030@gmail.com";

    // The platform owner retains full administrative authority.
    // No non-owner identity may alter the owner authority record.
    if (email === platformOwnerEmail && !auth.isOwner) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "PLATFORM_OWNER_ACCOUNT_MANAGEMENT_DENIED",
      );
    }

    const allowRef =
      db.collection("allowlist").doc(email);

    const allowSnap =
      await allowRef.get();

    if (!allowSnap.exists) {
      return {
        ok: true,
        deleted: false,
      };
    }

    const allow =
      allowSnap.data() || {};

    const tenantId =
      clean(allow.tenantId);

    const role =
      normalizeManagedRole(allow.role || "user");

    const governorate =
      clean(allow.governorate);

    const enabled =
      allow.enabled === true;

    if (
      !(await canManageTargetUser(
        auth,
        role,
        tenantId,
        governorate,
      ))
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "USER_DELETE_DENIED",
      );
    }

    let uid = "";

    try {
      const target =
        await admin.auth().getUserByEmail(email);

      uid = target.uid;
    } catch (error: any) {
      if (
        String(error?.code || "") !==
        "auth/user-not-found"
      ) {
        throw error;
      }
    }

    const now =
      FieldValue.serverTimestamp();

    const memberRef =
      tenantId && uid
        ? db
            .collection("tenants")
            .doc(tenantId)
            .collection("members")
            .doc(uid)
        : null;

    const activityRef =
      tenantId
        ? db
            .collection("tenants")
            .doc(tenantId)
            .collection("activityLogs")
            .doc()
        : null;

    const correlationId =
      createSecurityCorrelationId();

    const targetEmailSha256 = crypto
      .createHash("sha256")
      .update(email, "utf8")
      .digest("hex");

    const authorityJournal =
      await appendSecurityJournalEvent(
        {
          correlationId,
          action: "ADMIN_DELETE_ALLOWLIST_AUTHORITY_COMMIT",
          scope: "AUTHORITY_MIGRATION",
          actor: {
            uid: auth.uid,
            email: auth.email,
            role: auth.role,
            tenantId: auth.tenantId,
            governorate: auth.governorate,
          },
          tenantId: role === "super" ? "" : tenantId || "system",
          targetType: "allowlist_user",
          targetId: uid || targetEmailSha256,
          outcome: "SUCCESS",
          details: {
            targetEmailSha256,
            previousEnabled: enabled,
            previousRole: role,
            previousTenantId: tenantId,
            previousGovernorate: governorate,
            authUserFound: !!uid,
          },
        },
        async (transaction) => {
          // Re-read the target authority in the same transaction.
          const currentAllowSnap =
            await transaction.get(allowRef);

          if (!currentAllowSnap.exists) {
            throw new Error(
              "ALLOWLIST_TARGET_CHANGED_DURING_DELETE",
            );
          }

          const currentAllow =
            currentAllowSnap.data() || {};

          const currentRole =
            normalizeManagedRole(
              currentAllow.role || "user",
            );

          const currentTenantId =
            clean(currentAllow.tenantId);

          const currentGovernorate =
            clean(currentAllow.governorate);

          const currentEnabled =
            currentAllow.enabled === true;

          if (
            currentRole !== role ||
            currentTenantId !== tenantId ||
            currentGovernorate !== governorate ||
            currentEnabled !== enabled
          ) {
            throw new Error(
              "ALLOWLIST_TARGET_AUTHORITY_CHANGED_DURING_DELETE",
            );
          }

          // Revalidate the actor authority at commit time.
          if (!auth.isOwner) {
            const actorAllowSnap =
              auth.email === email
                ? currentAllowSnap
                : await transaction.get(
                    db
                      .collection("allowlist")
                      .doc(auth.email),
                  );

            if (!actorAllowSnap.exists) {
              throw new Error(
                "ACTOR_ALLOWLIST_AUTHORITY_MISSING_DURING_DELETE",
              );
            }

            const actorAllow =
              actorAllowSnap.data() || {};

            const actorRole =
              normalizeManagedRole(
                actorAllow.role || "user",
              );

            if (
              actorAllow.enabled !== true ||
              actorRole !== auth.role ||
              clean(actorAllow.tenantId) !==
                clean(auth.tenantId) ||
              clean(actorAllow.governorate) !==
                clean(auth.governorate)
            ) {
              throw new Error(
                "ACTOR_AUTHORITY_CHANGED_DURING_DELETE",
              );
            }
          }

          // Governorate supervisor authority also depends on
          // the live tenant governorate. Bind that state to
          // the same transaction to close the scope TOCTOU.
          if (auth.isSuperRegional) {
            if (!tenantId) {
              throw new Error(
                "TARGET_TENANT_MISSING_DURING_DELETE",
              );
            }

            const tenantSnap =
              await transaction.get(
                db.collection("tenants").doc(tenantId),
              );

            if (!tenantSnap.exists) {
              throw new Error(
                "TARGET_TENANT_MISSING_DURING_DELETE",
              );
            }

            const liveTenantGovernorate =
              clean(
                (tenantSnap.data() || {}).governorate,
              );

            if (
              liveTenantGovernorate !==
              clean(auth.governorate)
            ) {
              throw new Error(
                "TARGET_TENANT_GOVERNORATE_CHANGED_DURING_DELETE",
              );
            }
          }

          transaction.delete(allowRef);

          if (memberRef) {
            transaction.delete(memberRef);
          }

          if (activityRef) {
            transaction.create(activityRef, {
              tenantId,
              action: "USER_DELETE",
              entityType: "member",
              entityId: uid || email,
              actorUid: auth.uid,
              actorEmail: auth.email,
              targetEmail: email,
              targetUid: uid,
              role,
              correlationId,
              createdAt: now,
              source: "adminDeleteAllowlist",
            });
          }
        },
      );

    // Custom claims are compatibility state only.
    // The authoritative allowlist authority has already been
    // removed atomically with the trusted Security Journal.
    let claimsSyncRequired = !!uid;
    let claimsSync = true;
    let claimsSyncErrorCode = "";

    if (uid) {
      try {
        await setCompatibleClaims(uid, {
          enabled: false,
          role,
          tenantId: role === "super" ? "" : tenantId || "system",
          governorate,
        });
      } catch (error: any) {
        claimsSync = false;
        claimsSyncErrorCode = clean(
          error?.code ||
          error?.name ||
          "CLAIMS_SYNC_FAILED",
        ).slice(0, 128);
      }
    }

    let claimsSyncJournalRecorded = false;

    try {
      await appendSecurityJournalEvent({
        correlationId,
        action: "ADMIN_DELETE_ALLOWLIST_COMPATIBILITY_CLAIMS_SYNC",
        scope: "AUTHORITY_MIGRATION",
        actor: {
          uid: auth.uid,
          email: auth.email,
          role: auth.role,
          tenantId: auth.tenantId,
          governorate: auth.governorate,
        },
        tenantId: role === "super" ? "" : tenantId || "system",
        targetType: "firebase_auth_claims",
        targetId: uid || targetEmailSha256,
        outcome: claimsSync ? "SUCCESS" : "FAILURE",
        details: {
          claimsSyncRequired,
          claimsSync,
          errorCode: claimsSyncErrorCode,
          authorityEventHash:
            authorityJournal.eventHash,
        },
      });

      claimsSyncJournalRecorded = true;
    } catch (journalError) {
      console.error(
        "adminDeleteAllowlist claims compatibility journal failed:",
        journalError,
      );
    }

    return {
      ok: true,
      deleted: true,
      uid,
      correlationId,
      securityJournalEventId:
        authorityJournal.eventId,
      securityJournalSequence:
        authorityJournal.sequence,
      securityJournalEventHash:
        authorityJournal.eventHash,
      claimsSyncRequired,
      claimsSync,
      claimsSyncJournalRecorded,
      claimsSyncErrorCode:
        claimsSync ? null : claimsSyncErrorCode,
    };
  });

// =====================================================
// Phone change request email
// Sends a real email to the requester with a secure change link.
// A copy is sent to the platform owner for audit/visibility.
// Path: tenants/{tenantId}/phoneChangeRequests/{requestId}
// =====================================================

function maskEmailForLog(email: string) {
  const value = clean(email).toLowerCase();
  const [name, domain] = value.split("@");
  if (!name || !domain) return "";
  if (name.length <= 2) return `${name[0] || "*"}***@${domain}`;
  return `${name[0]}${"*".repeat(Math.max(3, name.length - 2))}${name[name.length - 1]}@${domain}`;
}

function getRequesterEmail(data: FirebaseFirestore.DocumentData) {
  return clean(
    data.requesterEmail ||
      data.requestEmail ||
      data.userEmail ||
      data.email ||
      data.schoolEmail ||
      data.centerEmail ||
      ""
  ).toLowerCase();
}

function getPhoneChangeBaseUrl() {
  return clean(
    process.env.APP_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.VITE_APP_BASE_URL ||
      "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function makeSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}


function getGovernorateFromData(data: FirebaseFirestore.DocumentData) {
  return clean(
    data.governorate ||
      data.governorateAr ||
      data.tenantGovernorate ||
      data.regionAr ||
      data.scopeGovernorate ||
      data.gov ||
      ""
  );
}

function isGovernorateSuperRoleValue(role: string) {
  const value = clean(role);
  return [
    "super",
    "super_regional",
    "regional_super",
    "governorate_super",
    "governorate-super",
    "super_governorate",
    "governorate_supervisor",
    "province_super",
    "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©",
    "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾",
    "ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ´ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©",
    "ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ´ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾",
    "ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ´ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©",
  ].includes(value);
}

async function getGovernorateSuperEmails(governorate: string, excludeEmails: string[] = []) {
  const targetGovernorate = clean(governorate);
  if (!targetGovernorate) return [] as string[];

  const excluded = new Set(
    excludeEmails
      .map((email) => clean(email).toLowerCase())
      .filter(Boolean)
  );

  const result: string[] = [];
  const seen = new Set<string>();

  const snap = await db.collection("allowlist").get();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const enabled = data.enabled === true || data.active === true;
    const role = clean(data.role || data.originalRole || "");
    const docGovernorate = getGovernorateFromData(data);
    const email = clean(data.email || doc.id).toLowerCase();

    if (!enabled) return;
    if (!isGovernorateSuperRoleValue(role)) return;
    if (!email || !isValidEmail(email)) return;
    if (docGovernorate !== targetGovernorate) return;
    if (excluded.has(email)) return;
    if (seen.has(email)) return;

    seen.add(email);
    result.push(email);
  });

  return result;
}

export const sendPhoneChangeRequestEmail = functions
  .region("us-central1")
  .firestore.document("tenants/{tenantId}/phoneChangeRequests/{requestId}")
  .onCreate(async (snap, context) => {
    const tenantId = clean(context.params.tenantId);
    const requestId = clean(context.params.requestId);
    const data = snap.data() || {};

    const requesterEmail = getRequesterEmail(data);
    const platformOwnerEmail = "3asal2030@gmail.com";

    if (!tenantId || !requestId) {
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailError: "TENANT_OR_REQUEST_ID_MISSING",
          emailFailedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    if (!requesterEmail || !isValidEmail(requesterEmail)) {
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailError: "REQUESTER_EMAIL_MISSING_OR_INVALID",
          emailFailedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const { gmailUser, gmailPass } = gmailConfig();
    if (!gmailUser || !gmailPass) {
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailError: "GMAIL_CONFIG_MISSING",
          emailFailedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const rawToken = makeSecureToken();
    const tokenHash = sha256(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
    const baseUrl = getPhoneChangeBaseUrl();
    const changeUrl = `${baseUrl}/t/${encodeURIComponent(tenantId)}/change-phone?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(rawToken)}`;

    const schoolOrCenterName = clean(
      data.tenantName ||
        data.centerName ||
        data.schoolName ||
        data.entityName ||
        data.name ||
        tenantId
    );
    const governorate = getGovernorateFromData(data);
    const maskedPhone = clean(data.maskedPhone || data.phoneMasked || data.currentPhoneMasked || "");
    const page = clean(data.page || "");
    const requestType = clean(data.requestType || "phone_change");
    const status = clean(data.status || "pending");
    const createdAtISO = clean(data.createdAtISO || now.toISOString());
    const governorateSuperEmails = await getGovernorateSuperEmails(governorate, [
      requesterEmail,
      platformOwnerEmail,
    ]);
    const ccEmails = Array.from(new Set([
      platformOwnerEmail,
      ...governorateSuperEmails,
    ].map((email) => clean(email).toLowerCase()).filter(Boolean)));

    const subject = `ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ - ${schoolOrCenterName}`;
    const textBody = `
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±.

ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© / ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²: ${schoolOrCenterName}
ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© / ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²: ${tenantId}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©: ${governorate || "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©"}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±: ${requesterEmail}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹: ${maskedPhone || "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±"}
ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨: ${requestType}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨: ${status}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©: ${page || "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©"}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨: ${requestId}
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ® ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨: ${createdAtISO}
ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ°: ${ccEmails.length ? ccEmails.join(", ") : "ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯"}

ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ· ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾:
${changeUrl}

ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·: 30 ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·.
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¥ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¤ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦.
    `.trim();

    const htmlBody = `
      <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; line-height: 1.9; color: #111;">
        <h2 style="margin: 0 0 16px;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾</h2>
        <p>ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 760px; border: 1px solid #ddd;">
          <tbody>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© / ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(schoolOrCenterName)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© / ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(tenantId)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(governorate || "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©")}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±</th><td style="border:1px solid #ddd; padding:10px;"><a href="mailto:${escapeHtml(requesterEmail)}">${escapeHtml(requesterEmail)}</a></td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(maskedPhone || "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±")}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(requestType)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(status)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(page || "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©")}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(requestId)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ® ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(createdAtISO)}</td></tr>
            <tr>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7; color:#111; font-weight:bold;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ· ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾</th>
              <td style="border:1px solid #ddd; padding:12px; color:#111; font-weight:bold;">
                <a href="${escapeHtml(changeUrl)}" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:10px; font-weight:bold; border:1px solid #0b5f59;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¶ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ· ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾</a>
                <div style="margin-top:10px; font-size:12px; color:#111; font-weight:bold; word-break:break-all; direction:ltr; text-align:left;">${escapeHtml(changeUrl)}</div>
              </td>
            </tr>
            <tr>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#fff7ed; color:#7f1d1d; font-weight:bold;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·</th>
              <td style="border:1px solid #ddd; padding:10px; color:#7f1d1d; font-weight:bold;">30 ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¥ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ· ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©.</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 16px; color:#7f1d1d;"><strong>ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·:</strong> 30 ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·.</p>
        <p style="font-size: 13px; color:#555;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¥ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¤ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦.</p>
      </div>
    `;

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const info = await transporter.sendMail({
        from: gmailUser,
        to: requesterEmail,
        cc: ccEmails,
        replyTo: platformOwnerEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });

      await snap.ref.set(
        {
          emailStatus: "sent",
          emailTo: requesterEmail,
          emailCc: ccEmails,
          emailSentAt: FieldValue.serverTimestamp(),
          emailMessageId: clean((info as any)?.messageId || ""),
          changeUrl,
          changeTokenHash: tokenHash,
          changeTokenCreatedAtISO: now.toISOString(),
          changeTokenExpiresAtISO: expiresAt.toISOString(),
          changeTokenUsedAtISO: "",
          maskedRequesterEmail: maskEmailForLog(requesterEmail),
        },
        { merge: true }
      );
    } catch (error: any) {
      console.error("sendPhoneChangeRequestEmail failed:", error);
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailTo: requesterEmail,
          emailCc: ccEmails,
          emailError: clean(error?.message || "UNKNOWN_EMAIL_ERROR"),
          emailFailedAt: FieldValue.serverTimestamp(),
          maskedRequesterEmail: maskEmailForLog(requesterEmail),
        },
        { merge: true }
      );
    }
  });

// =====================================================
// Complete phone change request
// Validates the email link token server-side, updates tenant settings,
// marks the request completed, and prevents reuse.
// =====================================================

type CompletePhoneChangeReq = {
  tenantId?: string;
  requestId?: string;
  token?: string;
  newPhone?: string;
};

function phoneDigitsOnly(value: unknown) {
  return clean(value).replace(/[^0-9]/g, "");
}

function maskPhoneFirstLastServer(value: string) {
  const digits = phoneDigitsOnly(value);
  if (!digits) return "";
  if (digits.length === 1) return digits;
  if (digits.length === 2) return `${digits[0]}x`;
  return `${digits[0]}${"x".repeat(Math.max(1, digits.length - 2))}${digits[digits.length - 1]}`;
}
function normalizePhoneChangeSourcePage(value: unknown) {
  const page = clean(value).toLowerCase();
  if (page === "settings1" || page === "school" || page === "school_settings") return "Settings1";
  return "Settings12";
}

function phoneChangeReturnPath(tenantId: string, sourcePage: string) {
  return sourcePage === "Settings1"
    ? `/t/${encodeURIComponent(tenantId)}/settings1`
    : `/t/${encodeURIComponent(tenantId)}/settings12`;
}


async function updateExistingTenantPhoneDocs(tenantId: string, sourcePage: string, payload: Record<string, any>) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const now = FieldValue.serverTimestamp();
  const updatePayload = {
    ...payload,
    phoneLocked: true,
    phoneUpdatedAt: now,
    phoneUpdatedAtISO: new Date().toISOString(),
    updatedAt: now,
    updatedAtISO: new Date().toISOString(),
  };

  // Always maintain the current tenant meta/config copy.
  // The tenant itself is already separated by /t/:tenantId, so this does not mix school and diploma tenants.
  await tenantRef.collection("meta").doc("config").set(updatePayload, { merge: true });

  // Keep school and diploma settings documents separated by the request source page.
  const settingsDocIds = sourcePage === "Settings1"
    ? ["school", "schoolSettings", "config", "default", "settings"]
    : ["diplomaExamCenter", "examCenter", "config", "default", "settings"];

  const refs = settingsDocIds.map((id) => tenantRef.collection("settings").doc(id));
  const snaps = await Promise.all(refs.map((ref) => ref.get()));

  const batch = db.batch();
  snaps.forEach((snap, index) => {
    if (snap.exists) {
      batch.set(refs[index], updatePayload, { merge: true });
    }
  });

  await batch.commit();
}

export const completePhoneChangeRequest = functions
  .region("us-central1")
  .https.onCall(async (data: CompletePhoneChangeReq, context) => {
    const auth = await getAuthContext(context);

    const tenantId = safeSegment(String(data?.tenantId || ""), "tenantId");
    const requestId = safeSegment(String(data?.requestId || ""), "requestId");
    const token = clean(data?.token || "");
    const newPhone = phoneDigitsOnly(data?.newPhone || "");

    if (!token) {
      throw new functions.https.HttpsError("invalid-argument", "TOKEN_REQUIRED");
    }

    if (!newPhone || newPhone.length < 6 || newPhone.length > 15) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_PHONE");
    }

    if (!(await canWriteTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_WRITE_DENIED");
    }

    const requestRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("phoneChangeRequests")
      .doc(requestId);

    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      throw new functions.https.HttpsError("not-found", "REQUEST_NOT_FOUND");
    }

    const requestData = requestSnap.data() || {};
    const sourcePage = normalizePhoneChangeSourcePage(requestData.page || requestData.sourcePage || requestData.originPage);
    const returnPath = phoneChangeReturnPath(tenantId, sourcePage);
    const requesterEmail = getRequesterEmail(requestData);
    const authEmailLower = clean(auth.email).toLowerCase();

    if (requesterEmail && requesterEmail !== authEmailLower && !auth.isSuperAdmin) {
      throw new functions.https.HttpsError("permission-denied", "AUTH_EMAIL_MISMATCH");
    }

    const status = clean(requestData.status || "pending").toLowerCase();
    if (status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "REQUEST_ALREADY_COMPLETED");
    }

    if (clean(requestData.changeTokenUsedAtISO)) {
      throw new functions.https.HttpsError("failed-precondition", "REQUEST_ALREADY_COMPLETED");
    }

    const expectedHash = clean(requestData.changeTokenHash);
    if (!expectedHash || sha256(token) !== expectedHash) {
      throw new functions.https.HttpsError("permission-denied", "TOKEN_INVALID");
    }

    const expiresAtISO = clean(requestData.changeTokenExpiresAtISO);
    if (expiresAtISO) {
      const expiresAt = Date.parse(expiresAtISO);
      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        throw new functions.https.HttpsError("deadline-exceeded", "TOKEN_EXPIRED");
      }
    }

    const maskedPhone = maskPhoneFirstLastServer(newPhone);
    const nowISO = new Date().toISOString();

    await updateExistingTenantPhoneDocs(tenantId, sourcePage, {
      phone: newPhone,
      phoneMasked: maskedPhone,
      maskedPhone,
      phoneChangeRequestId: requestId,
      phoneChangeCompletedAtISO: nowISO,
    });

    await requestRef.set(
      {
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
        completedAtISO: nowISO,
        completedBy: auth.email || auth.uid || "",
        newPhoneMasked: maskedPhone,
        sourcePage,
        returnPath,
        changeTokenUsedAtISO: nowISO,
      },
      { merge: true }
    );

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: "PHONE_CHANGE_COMPLETED",
      entityType: "phoneChangeRequest",
      entityId: requestId,
      actorUid: auth.uid,
      actorEmail: auth.email,
      newPhoneMasked: maskedPhone,
      sourcePage,
      returnPath,
      createdAt: FieldValue.serverTimestamp(),
      createdAtISO: nowISO,
      source: "completePhoneChangeRequest",
    });

    return {
      ok: true,
      maskedPhone,
      sourcePage,
      returnPath,
      tenantKind: sourcePage === "Settings1" ? "school" : "diploma",
      message: "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­.",
    };
  });

// =====================================================
// Control12 email access code gate
// Sends a one-time 6-digit code to the authenticated user's email.
// The code is stored hashed and expires quickly.
// =====================================================

function controlAccessHash(value: string) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function controlAccessDocRef(tenantId: string, uid: string) {
  return db
    .collection("tenants")
    .doc(tenantId)
    .collection("controlAccessCodes")
    .doc(uid);
}

const CONTROL_ACCESS_MAX_ATTEMPTS = 5;
const CONTROL_ACCESS_LOCK_MINUTES = 15;

function controlAccessLockUntilTimestamp() {
  return Timestamp.fromMillis(Date.now() + CONTROL_ACCESS_LOCK_MINUTES * 60 * 1000);
}

function timestampToMillis(value: unknown) {
  if (value && typeof (value as admin.firestore.Timestamp).toMillis === "function") {
    return (value as admin.firestore.Timestamp).toMillis();
  }
  return 0;
}

export const sendControl12AccessCodeEmail = functions
  .region("us-central1")
  .https.onCall(async (data: { tenantId?: string }, context) => {
    const auth = await getAuthContext(context);
    const tenantId = safeSegment(String(data?.tenantId || ""), "tenantId");

    if (!(await canReadTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_ACCESS_DENIED");
    }

    if (!auth.email || !isValidEmail(auth.email)) {
      throw new functions.https.HttpsError("failed-precondition", "ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹.");
    }

    const { gmailUser, gmailPass } = gmailConfig();
    if (!gmailUser || !gmailPass) {
      throw new functions.https.HttpsError("failed-precondition", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ Gmail ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©.");
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = controlAccessHash(`${tenantId}:${auth.uid}:${code}`);

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenantData = tenantSnap.exists ? tenantSnap.data() || {} : {};

    const metaSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("meta")
      .doc("config")
      .get();
    const metaData = metaSnap.exists ? metaSnap.data() || {} : {};

    const centerName = clean(
      metaData.schoolNameAr ||
        metaData.centerNameAr ||
        metaData.tenantName ||
        tenantData.schoolName ||
        tenantData.tenantName ||
        tenantId
    );

    await controlAccessDocRef(tenantId, auth.uid).set(
      {
        tenantId,
        uid: auth.uid,
        email: auth.email,
        page: "Control12",
        codeHash,
        attempts: 0,
        lockedUntil: null,
        lockedAt: null,
        lockedReason: null,
        used: false,
        createdAt: now,
        expiresAt,
        lastSentAt: now,
      },
      { merge: true }
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    const subject = `ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ° ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  - ${centerName}`;
    const textBody = `
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ° ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ 

ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²: ${centerName}
ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²: ${tenantId}

ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ :
${code}

ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² 10 ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·.
ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¥ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©.
    `.trim();

    const htmlBody = `
      <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; color:#000000; font-weight:700; line-height:1.9;">
        <h2 style="color:#000000;font-weight:900;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ° ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ </h2>
        <table style="width:100%;border-collapse:collapse;color:#000000;font-weight:700;">
          <tr>
            <td style="border:1px solid #ddd;padding:12px;background:#f8f8f8;font-weight:900;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²</td>
            <td style="border:1px solid #ddd;padding:12px;">${escapeHtml(centerName)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px;background:#f8f8f8;font-weight:900;">ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ²</td>
            <td style="border:1px solid #ddd;padding:12px;">${escapeHtml(tenantId)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px;background:#f8f8f8;font-weight:900;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ </td>
            <td style="border:1px solid #ddd;padding:12px;font-size:28px;font-weight:900;letter-spacing:5px;color:#000000;">${code}</td>
          </tr>
        </table>
        <p style="color:#000000;font-weight:900;margin-top:18px;">ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² 10 ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¥ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: gmailUser,
      to: auth.email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    await controlAccessDocRef(tenantId, auth.uid).set(
      {
        emailStatus: "sent",
        emailMessageId: clean(info.messageId),
        emailSentAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      ok: true,
      message: "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ° ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨.",
      expiresInMinutes: 10,
    };
  });

export const verifyControl12AccessCode = functions
  .region("us-central1")
  .https.onCall(async (data: { tenantId?: string; code?: string }, context) => {
    const auth = await getAuthContext(context);
    const tenantId = safeSegment(String(data?.tenantId || ""), "tenantId");
    const code = clean(data?.code || "").replace(/\D/g, "");

    if (!(await canReadTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_ACCESS_DENIED");
    }

    if (!/^\d{6}$/.test(code)) {
      throw new functions.https.HttpsError("invalid-argument", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¦ط£آ¢أ¢â€ڑآ¬أ¢â€‍آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  6 ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦.");
    }

    const ref = controlAccessDocRef(tenantId, auth.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ«ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ° ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ´ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·. ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ².");
    }

    const record = snap.data() || {};
    const attempts = Number(record.attempts || 0);
    const expiresAt = record.expiresAt as admin.firestore.Timestamp | undefined;
    const used = record.used === true;
    const lockedUntilMillis = timestampToMillis(record.lockedUntil);

    if (lockedUntilMillis > Date.now()) {
      const minutesLeft = Math.ceil((lockedUntilMillis - Date.now()) / 60000);
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¤ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾. ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ${minutesLeft} ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©.`
      );
    }

    if (used) {
      throw new functions.https.HttpsError("failed-precondition", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§.");
    }

    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      await ref.set(
        {
          expired: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw new functions.https.HttpsError("deadline-exceeded", "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ·ط¥â€™ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ². ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯.");
    }

    if (attempts >= CONTROL_ACCESS_MAX_ATTEMPTS) {
      const lockedUntil = controlAccessLockUntilTimestamp();
      await ref.set(
        {
          lockedAt: FieldValue.serverTimestamp(),
          lockedUntil,
          lockedReason: "too_many_failed_attempts",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¤ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¦ ${CONTROL_ACCESS_MAX_ATTEMPTS} ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾. ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ${CONTROL_ACCESS_LOCK_MINUTES} ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§.`
      );
    }

    const expectedHash = clean(record.codeHash);
    const receivedHash = controlAccessHash(`${tenantId}:${auth.uid}:${code}`);

    if (!expectedHash || expectedHash !== receivedHash) {
      const nextAttempts = attempts + 1;
      const shouldLock = nextAttempts >= CONTROL_ACCESS_MAX_ATTEMPTS;
      const lockedUntil = shouldLock ? controlAccessLockUntilTimestamp() : null;

      await ref.set(
        {
          attempts: nextAttempts,
          lastFailedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...(shouldLock
            ? {
                lockedAt: FieldValue.serverTimestamp(),
                lockedUntil,
                lockedReason: "too_many_failed_attempts",
              }
            : {}),
        },
        { merge: true }
      );

      if (shouldLock) {
        await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
          tenantId,
          action: "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS",
          entityType: "controlAccess",
          entityId: auth.uid,
          actorUid: auth.uid,
          actorEmail: auth.email,
          attempts: nextAttempts,
          lockedMinutes: CONTROL_ACCESS_LOCK_MINUTES,
          createdAt: FieldValue.serverTimestamp(),
          source: "verifyControl12AccessCode",
        });

        throw new functions.https.HttpsError(
          "resource-exhausted",
          `ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¤ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¦ ${CONTROL_ACCESS_MAX_ATTEMPTS} ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾. ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ${CONTROL_ACCESS_LOCK_MINUTES} ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§.`
        );
      }

      const remainingAttempts = Math.max(CONTROL_ACCESS_MAX_ATTEMPTS - nextAttempts, 0);
      throw new functions.https.HttpsError(
        "permission-denied",
        `ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ·ط£آ¢أ¢â€ڑآ¬ط·â€؛ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ± ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آµط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­. ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ¸ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ©: ${remainingAttempts}.`
      );
    }

    await ref.set(
      {
        used: true,
        verifiedAt: FieldValue.serverTimestamp(),
        attempts: 0,
        lockedUntil: null,
        lockedAt: null,
        lockedReason: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: "CONTROL12_EMAIL_CODE_VERIFIED",
      entityType: "controlAccess",
      entityId: auth.uid,
      actorUid: auth.uid,
      actorEmail: auth.email,
      createdAt: FieldValue.serverTimestamp(),
      source: "verifyControl12AccessCode",
    });

    return {
      ok: true,
      message: "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¹ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع© ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ² ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ«ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â€ڑآ¬ط¹â€  ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ­.",
    };
  });


// YR_SYSTEM_AUDIT_BACKEND_V1
export const adminListSystemAuditLogs = functions.region("us-central1").https.onCall(async (data: { limit?: number }, context) => {
  const auth = await getAuthContext(context);
  if (!(auth.isSuperAdmin || auth.isOwner)) throw new functions.https.HttpsError("permission-denied","PLATFORM_OWNER_REQUIRED");
  const max = Math.min(Math.max(Number(data?.limit || 200),1),500);
  const snap = await db.collection("systemAuditLogs").orderBy("at","desc").limit(max).get();
  return { ok: true, items: snap.docs.map((d) => ({ ...(d.data() || {}), id: d.id })) };
});

// YR_TOTP_RESET_ADMIN_BACKEND_V2
export { totpAdminInspectUser, totpAdminResetUser, totpAdminListResetAudit } from "./totpAdmin";












// YR_PURGE_EXPIRED_DELETED_SCHOOLS

export const createWebAuthnAuthenticationOptions =
functions.https.onCall(async (_data, context) => {

  const auth = await getAuthContext(context);

  const credentials =
    await listCredentials(auth.uid);

  if (!credentials.length) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "WEBAUTHN_NO_CREDENTIALS"
    );
  }

  const options =
    await createAuthenticationOptions(
      auth.uid,
      credentials.map(
        (item) => item.id
      )
    );

  return options;
});

export const purgeExpiredDeletedSchools = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "Asia/Muscat",
    region: "us-central1",
  },
  async () => {

    const now = Date.now();

    const snap =
      await db
        .collection("deletedSchoolTenants")
        .limit(500)
        .get();


    let removed = 0;


    for (const doc of snap.docs) {

      const data =
        doc.data() || {};


      const expires =
        data.deleteExpiresAt ||
        data.restoreExpiresAt;


      if (
        !expires ||
        typeof expires.toMillis !== "function"
      ) {
        continue;
      }


      if (expires.toMillis() > now) {
        continue;
      }


      const tenantId = doc.id;


      await appendSecurityJournalEvent(
        {
          correlationId: createSecurityCorrelationId(),

          action:
            "PURGE_EXPIRED_DELETED_SCHOOL",

          scope:
            "CONTROL_PLANE",

          actor:{
            uid:"system",
            email:"system",
            role:"scheduler",
            tenantId:"",
            governorate:"",
          },

          tenantId,

          targetType:
            "school_tenant",

          targetId:
            tenantId,

          outcome:
            "SUCCESS",

        },
        async () => {},
      );


      await db.runTransaction(
        async (transaction) => {

          transaction.delete(
            db.collection("deletedSchoolTenants").doc(tenantId)
          );


          transaction.delete(
            db.collection("tenants").doc(tenantId)
          );

        },
      );


      removed++;

    }


    console.log(
      "PURGE_EXPIRED_DELETED_SCHOOLS",
      {
        removed,
      },
    );

  },
);










