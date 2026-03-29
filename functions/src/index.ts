/**
 * Firebase Cloud Functions (TypeScript)
 *
 * الموجود في هذا الملف:
 * 1) tenantListDocs  -> callable
 * 2) writeActivityLog -> onRequest مع CORS
 *
 * Deploy:
 *   cd functions
 *   npm i
 *   firebase deploy --only functions
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";

try {
  admin.app();
} catch {
  admin.initializeApp();
}

const db = admin.firestore();

const corsHandler = cors({
  origin: ["http://localhost:5173"],
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

type TenantListDocsReq = {
  tenantId: string;
  sub: string;
  limit?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
};

export const tenantListDocs = functions.https.onCall(
  async (req: TenantListDocsReq, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "AUTH_REQUIRED");
    }

    const tenantId = String(req?.tenantId || "").trim();
    const sub = String(req?.sub || "").trim();

    if (!tenantId || !sub) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "tenantId/sub required"
      );
    }

    const limit = Math.min(Math.max(Number(req?.limit || 200), 1), 1000);
    const orderByField = String(req?.orderBy || "createdAt");
    const dir = (req?.orderDir || "desc") as "asc" | "desc";

    let q = db
      .collection("tenants")
      .doc(tenantId)
      .collection(sub) as FirebaseFirestore.Query;

    try {
      q = q.orderBy(orderByField, dir).limit(limit);
    } catch {
      q = q.limit(limit);
    }

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    return { items };
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
        res.status(405).json({
          ok: false,
          error: "Method not allowed",
        });
        return;
      }

      const body = (req.body || {}) as WriteActivityLogBody;
      const tenantId = String(body.tenantId || "").trim();

      if (!tenantId) {
        res.status(400).json({
          ok: false,
          error: "tenantId is required",
        });
        return;
      }

      const payload = {
        tenantId,
        userId: body.userId ?? null,
        action: body.action ?? null,
        page: body.page ?? null,
        targetType: body.targetType ?? null,
        targetId: body.targetId ?? null,
        details: body.details ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "web",
        ...body,
      };

      await db
        .collection("tenants")
        .doc(tenantId)
        .collection("activityLogs")
        .add(payload);

      res.status(200).json({
        ok: true,
      });
    } catch (error: any) {
      console.error("writeActivityLog error:", error);

      res.status(500).json({
        ok: false,
        error: error?.message || "Unknown error",
      });
    }
  });
});