"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantListDocs = void 0;
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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
try {
    admin.app();
}
catch {
    admin.initializeApp();
}
exports.tenantListDocs = functions.https.onCall(async (req, context) => {
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
    const dir = (req?.orderDir || "desc");
    // Path: tenants/{tenantId}/{sub}
    let q = admin.firestore().collection("tenants").doc(tenantId).collection(sub);
    try {
        q = q.orderBy(orderByField, dir).limit(limit);
    }
    catch {
        // If field not indexed / doesn't exist, fallback to limit only
        q = q.limit(limit);
    }
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    return { items };
});
