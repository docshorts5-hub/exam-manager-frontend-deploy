import { getOfflineActions, clearOfflineQueue } from "./offlineQueue";

type OfflineAction = Record<string, unknown>;

export function startOfflineSync(processAction: (action: OfflineAction) => Promise<void> | void): void {
  async function sync() {
    if (!navigator.onLine) return;

    const actions = getOfflineActions();

    for (const act of actions) {
      try {
        await processAction(act);
      } catch (e) {
        console.error("Sync error", e);
        return;
      }
    }

    clearOfflineQueue();
  }

  window.addEventListener("online", () => {
    void sync();
  });

  setInterval(() => {
    void sync();
  }, 30000);
}
