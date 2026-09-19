import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import type { TrustedDevice } from "./deviceTypes";


export async function addTrustedDevice(
  userId: string,
  device: TrustedDevice
): Promise<void> {
  const ref = doc(
    collection(db, "users", userId, "devices"),
    device.deviceId
  );

  await setDoc(ref, device);
}


export async function getTrustedDevices(
  userId: string
): Promise<TrustedDevice[]> {

  const snapshot = await getDocs(
    collection(db, "users", userId, "devices")
  );

  return snapshot.docs.map(
    (item) =>
      item.data() as TrustedDevice
  );
}


export async function revokeTrustedDevice(
  userId: string,
  deviceId: string
): Promise<void> {

  const ref = doc(
    db,
    "users",
    userId,
    "devices",
    deviceId
  );

  await updateDoc(ref, {
    status: "revoked",
  });
}
