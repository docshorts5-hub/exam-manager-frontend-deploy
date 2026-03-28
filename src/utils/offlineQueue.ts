const QUEUE_KEY = "exam-manager-offline-queue";

type OfflineAction = Record<string, unknown>;

export function addOfflineAction(action: OfflineAction): void {
  const raw = localStorage.getItem(QUEUE_KEY);
  const list: OfflineAction[] = raw ? JSON.parse(raw) : [];

  list.push({
    ...action,
    ts: Date.now(),
  });

  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export function getOfflineActions(): OfflineAction[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as OfflineAction[];
  } catch {
    return [];
  }
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
