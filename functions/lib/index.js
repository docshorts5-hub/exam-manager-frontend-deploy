"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeActivityLog = exports.tenantListDocs = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
try {
    admin.app();
}
catch {
    admin.initializeApp();
}
const db = admin.firestore();
const corsHandler = (0, cors_1.default)({
    origin: ["http://localhost:5173"],
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});
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
    let q = db
        .collection("tenants")
        .doc(tenantId)
        .collection(sub);
    try {
        q = q.orderBy(orderByField, dir).limit(limit);
    }
    catch {
        q = q.limit(limit);
    }
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    return { items };
});
exports.writeActivityLog = functions.https.onRequest((req, res) => {
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
            const body = (req.body || {});
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
        }
        catch (error) {
            console.error("writeActivityLog error:", error);
            res.status(500).json({
                ok: false,
                error: error?.message || "Unknown error",
            });
        }
    });
});
