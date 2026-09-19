import * as admin from "firebase-admin";
import { WebAuthnCredentialRecord } from "./types";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

function safeSegment(value: string, label: string) {
  const v = String(value || "").trim();

  if (!v || v.includes("/") || v.includes("\\")) {
    throw new Error(`INVALID_${label}`);
  }

  return v;
}


export async function saveCredential(
  uid: string,
  record: WebAuthnCredentialRecord
) {
  const safeUid = safeSegment(uid, "UID");
  const safeCredentialId = safeSegment(
    record.credentialID,
    "CREDENTIAL_ID"
  );

  await db
    .collection("users")
    .doc(safeUid)
    .collection("passkeys")
    .doc(safeCredentialId)
    .set({
      ...record,
      uid: safeUid,
      credentialId: safeCredentialId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return {
    ok: true,
    credentialId: safeCredentialId,
  };
}


export async function getCredential(
  uid: string,
  credentialId: string
) {
  const safeUid = safeSegment(uid, "UID");
  const safeCredentialId = safeSegment(
    credentialId,
    "CREDENTIAL_ID"
  );

  const snap = await db
    .collection("users")
    .doc(safeUid)
    .collection("passkeys")
    .doc(safeCredentialId)
    .get();

  if (!snap.exists) {
    return null;
  }

  return snap.data() ?? null;
}


export async function listCredentials(uid: string) {
  const safeUid = safeSegment(uid, "UID");

  const snap = await db
    .collection("users")
    .doc(safeUid)
    .collection("passkeys")
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}


export async function removeCredential(
  uid: string,
  credentialId: string
) {
  const safeUid = safeSegment(uid, "UID");
  const safeCredentialId = safeSegment(
    credentialId,
    "CREDENTIAL_ID"
  );

  await db
    .collection("users")
    .doc(safeUid)
    .collection("passkeys")
    .doc(safeCredentialId)
    .delete();

  return {
    ok: true,
  };
}



