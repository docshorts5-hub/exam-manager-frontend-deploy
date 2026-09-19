const DEFAULT_ACCESS_WORKER_URL = "https://teachers12-access-worker.moe-exam-manager.workers.dev";

export function getAccessWorkerUrl(): string {
  const configured = String(import.meta.env.VITE_ACCESS_WORKER_URL || "").trim();
  return (configured || DEFAULT_ACCESS_WORKER_URL).replace(/\/+$/, "");
}