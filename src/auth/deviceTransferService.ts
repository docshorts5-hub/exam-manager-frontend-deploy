import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import type { DeviceTransferRequest } from "./deviceTypes";


export async function createDeviceTransferRequest(
  request: DeviceTransferRequest
): Promise<void> {

  const ref = doc(
    collection(
      db,
      "users",
      request.userId,
      "deviceTransfers"
    ),
    request.requestId
  );

  await setDoc(ref, request);
}


export async function getDeviceTransferRequest(
  userId: string,
  requestId: string
): Promise<DeviceTransferRequest | null> {

  const ref = doc(
    db,
    "users",
    userId,
    "deviceTransfers",
    requestId
  );

  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as DeviceTransferRequest;
}


export async function completeDeviceTransfer(
  userId: string,
  requestId: string
): Promise<void> {

  const ref = doc(
    db,
    "users",
    userId,
    "deviceTransfers",
    requestId
  );

  await updateDoc(ref, {
    status: "completed",
    completedAt: new Date(),
  });
}
