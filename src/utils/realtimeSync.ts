import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export function startRealtimeSync<T>(
  tenantId: string,
  getLocalData: () => Promise<T> | T,
  applyRemoteData: (data: T) => void,
) {
  const ref = doc(db, "tenants", tenantId, "realtime", "state");

  async function pushUpdate() {
    const data = await getLocalData();
    await setDoc(ref, {
      data,
      updatedAt: Date.now(),
    });
  }

  const unsubscribe = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const remote = snap.data().data as T;
    applyRemoteData(remote);
  });

  return {
    pushUpdate,
    stop: unsubscribe,
  };
}
