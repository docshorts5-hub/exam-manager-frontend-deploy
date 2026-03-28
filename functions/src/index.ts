/**
 * Firebase Cloud Functions (TypeScript)
 * Add this file to your /functions project (firebase init functions).
 *
 * ✅ New callable: tenantListDocs
 * - Lists documents under tenants/{tenantId}/{sub}
 * - Supports orderBy + limit
 *
 * Deploy:
 *   cd functions
 *   npm i
 *   firebase deploy --only functions
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

try {
  admin.app();
} catch {
  admin.initializeApp();
}

type TenantListDocsReq = {
  tenantId: string;
  sub: string; // e.g. "archive"
  limit?: number;
  orderBy?: string; // e.g. "createdAt"
  orderDir?: "asc" | "desc";
};

export const tenantListDocs = functions.https.onCall(async (req: TenantListDocsReq, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const tenantId = String(req?.tenantId || "").trim();
  const sub = String(req?.sub || "").trim();

  if (!tenantId || !sub) {
    throw new functions.https.HttpsError("invalid-argument", "tenantId/sub required");
  }

  const limit = Math.min(Math.max(Number(req?.limit || 200), 1), 1000);
  const orderByField = String(req?.orderBy || "createdAt");
  const dir = (req?.orderDir || "desc") as "asc" | "desc";

  // Path: tenants/{tenantId}/{sub}
  let q = admin.firestore().collection("tenants").doc(tenantId).collection(sub) as FirebaseFirestore.Query;
  try {
    q = q.orderBy(orderByField, dir).limit(limit);
  } catch {
    // If field not indexed / doesn't exist, fallback to limit only
    q = q.limit(limit);
  }

  const snap = await q.get();
  const items = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  return { items };
});
