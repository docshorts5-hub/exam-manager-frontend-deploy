import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { isTenantReadOnlyView } from "../features/cloud-storage/readOnlyTenantGuard";
import type { DistributionRun } from "../contracts/taskDistributionContract";

const STORAGE_VERSION = "v1";
const ARCHIVE_VERSION = "v1";

export type ArchivedDistributionRun = {
  archiveId: string;
  name: string;
  createdAtISO: string;
  run: DistributionRun;
};

const LATEST_RUN_DOC_ID = "taskDistributionRun";
const ARCHIVE_COLLECTION = "archive";
const REALTIME_COLLECTION = "realtime";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeTenantId(tenantId: string | undefined | null) {
  return clean(tenantId) || "default";
}

function getCurrentLang(): "ar" | "en" {
  try {
    const htmlLang =
      typeof document !== "undefined"
        ? String(document.documentElement?.lang || "").trim().toLowerCase()
        : "";
    if (htmlLang === "en") return "en";
  } catch {}

  try {
    const raw =
      typeof localStorage !== "undefined"
        ? String(localStorage.getItem("lang") || localStorage.getItem("i18n-lang") || "").trim().toLowerCase()
        : "";
    if (raw === "en") return "en";
  } catch {}

  return "ar";
}

export function formatArchiveTitle(item: ArchivedDistributionRun): string {
  const name = String(item?.name || "").trim();
  if (name) return name;

  const lang = getCurrentLang();
  const date = String(item?.createdAtISO || "").slice(0, 10) || "ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹ط¢آ©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â€ڑآ¬ط¹â€کط·آ¢ط¢آ¬ط·آ·ط¢آ¹ط£آ¢أ¢â€ڑآ¬ط¹آ©ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¥ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط£آ¢أ¢â‚¬â€چط¢آ¢";
  const runId = String(item?.run?.runId || item?.archiveId || "").trim();

  if (lang === "en") {
    return `Archived Copy ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹ط¢آ©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ ${date}${runId ? ` ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹ط¢آ©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ ${runId}` : ""}`;
  }

  return `ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â€ڑآ¬ط¹â€کط·آ¢ط¢آ¬ط·آ·ط¢آ¹ط£آ¢أ¢â€ڑآ¬ط¹آ©ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ®ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â€ڑآ¬ط¹â€کط·آ¢ط¢آ¬ط·آ·ط¢آ¹ط£آ¢أ¢â€ڑآ¬ط¹آ©ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¤ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ´ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹ط¢آ©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ ${date}${runId ? ` ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ£ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ£ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ£ط·آ¢ط¢آ¢ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹أ¢â‚¬ع©ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ£ط¢آ¢ط£آ¢أ¢â‚¬ع‘ط¢آ¬ط·آ¹ط¢آ©ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ·ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ط·آ·ط¢آ·ط·آ¢ط¢آ¢ط·آ·ط¢آ¢ط·آ¢ط¢آ¢ ${runId}` : ""}`;
}

export const RUN_UPDATED_EVENT = "exam-manager:task-distribution:run-updated";
export const MASTER_TABLE_UPDATED_EVENT = "exam-manager:task-distribution:master-table-updated";
export const ARCHIVE_UPDATED_EVENT = "exam-manager:task-distribution:archive-updated";

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";
const RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";

function stableRunSignature(run: any) {
  try {
    const assignments = Array.isArray(run?.assignments) ? run.assignments : [];
    return JSON.stringify({
      runId: String(run?.runId || ""),
      createdAtISO: String(run?.createdAtISO || ""),
      count: assignments.length,
      assignments: assignments.map((assignment: any, index: number) => ({
        id: String(assignment?.__uid || assignment?.id || index),
        teacherId: String(assignment?.teacherId || ""),
        teacherName: String(assignment?.teacherName || ""),
        dateISO: String(assignment?.dateISO || assignment?.date || ""),
        period: String(assignment?.period || ""),
        taskType: String(assignment?.taskType || ""),
        subject: String(assignment?.subject || ""),
        roomNo: String(assignment?.roomNo || assignment?.committeeNo || ""),
        invigilatorIndex: String(assignment?.invigilatorIndex || ""),
      })),
    });
  } catch {
    return "";
  }
}

function safeReadRunSignature(tenantId: string) {
  try {
    const raw = localStorage.getItem(taskDistributionKey(tenantId));
    if (!raw) return "";
    return stableRunSignature(JSON.parse(raw));
  } catch {
    return "";
  }
}

function dispatchMasterTableUpdated(detail: Record<string, any> = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(MASTER_TABLE_UPDATED_EVENT, { detail: { ...detail, ts: Date.now() } })
    );
  } catch {}
}

function dispatchRunUpdated(tenantId: string, source: string) {
  try {
    window.dispatchEvent(
      new CustomEvent(RUN_UPDATED_EVENT, {
        detail: {
          tenantId,
          ts: Date.now(),
          source,
        },
      })
    );
  } catch {}
}

function dispatchArchiveUpdated(detail: Record<string, any> = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(ARCHIVE_UPDATED_EVENT, {
        detail: { ...detail, ts: Date.now() },
      })
    );
  } catch {}
}

function syncMasterTableWithRun(run: DistributionRun | null) {
  if (!run) return;

  const payload = {
    rows: run.assignments || [],
    data: run.assignments || [],
    meta: {
      runId: run.runId,
      runCreatedAtISO: run.createdAtISO,
      ts: Date.now(),
      source: "run",
    },
  };

  const raw = JSON.stringify(payload);

  const previous =
    localStorage.getItem(MASTER_TABLE_KEY) ||
    localStorage.getItem(ALL_TABLE_KEY) ||
    localStorage.getItem(RESULTS_TABLE_KEY) ||
    "";

  localStorage.setItem(MASTER_TABLE_KEY, raw);
  localStorage.setItem(ALL_TABLE_KEY, raw);
  localStorage.setItem(RESULTS_TABLE_KEY, raw);

  if (previous !== raw) {
    dispatchMasterTableUpdated({ source: "run", runId: run.runId });
  }
}

export const taskDistributionKey = (tenantId: string) =>
  `exam-manager:task-distribution:${safeTenantId(tenantId)}:${STORAGE_VERSION}`;

const taskDistributionArchiveKey = (tenantId: string) =>
  `exam-manager:task-distribution:archives:${safeTenantId(tenantId)}:${ARCHIVE_VERSION}`;

function runDocRef(tenantId: string) {
  return doc(db, "tenants", safeTenantId(tenantId), REALTIME_COLLECTION, LATEST_RUN_DOC_ID);
}

function archiveDocRef(tenantId: string, archiveId: string) {
  return doc(db, "tenants", safeTenantId(tenantId), ARCHIVE_COLLECTION, clean(archiveId));
}

function archiveCollectionRef(tenantId: string) {
  return collection(db, "tenants", safeTenantId(tenantId), ARCHIVE_COLLECTION);
}

function writeRunLocal(tenantId: string, run: DistributionRun | null, source: string) {
  const tid = safeTenantId(tenantId);

  if (!run) {
    localStorage.removeItem(taskDistributionKey(tid));
    return;
  }

  localStorage.setItem(taskDistributionKey(tid), JSON.stringify(run));
  syncMasterTableWithRun(run);
  dispatchRunUpdated(tid, source);
}

export function listArchivedRuns(tenantId: string): ArchivedDistributionRun[] {
  const raw = localStorage.getItem(taskDistributionArchiveKey(tenantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ArchivedDistributionRun[];
  } catch {
    return [];
  }
}

export function getArchivedRun(
  tenantId: string,
  archiveId: string
): ArchivedDistributionRun | null {
  const list = listArchivedRuns(tenantId);
  return list.find((x) => String(x?.archiveId) === String(archiveId)) || null;
}

/**
 * Merge incoming archive items into local archive WITHOUT deleting existing items.
 * - Dedup by archiveId
 * - If same archiveId exists, keep the newest by createdAtISO when possible
 * - Keeps maxKeep items sorted by createdAtISO desc
 */
export function mergeArchivedRuns(
  tenantId: string,
  incoming: ArchivedDistributionRun[],
  maxKeep = 60
) {
  const local = listArchivedRuns(tenantId);
  const map = new Map<string, ArchivedDistributionRun>();

  for (const it of local) {
    if (!it?.archiveId) continue;
    map.set(String(it.archiveId), it);
  }

  let added = 0;
  let updated = 0;

  for (const it of incoming || []) {
    if (!it?.archiveId) continue;
    const id = String(it.archiveId);
    const prev = map.get(id);

    if (!prev) {
      map.set(id, it);
      added++;
      continue;
    }

    const a = String(prev.createdAtISO || "");
    const b = String(it.createdAtISO || "");
    const pickIncoming = b && a ? b > a : !!b && !a;

    if (pickIncoming) {
      map.set(id, it);
      updated++;
    }
  }

  const next = Array.from(map.values())
    .sort((a, b) =>
      String(b?.createdAtISO || "").localeCompare(String(a?.createdAtISO || ""))
    )
    .slice(0, maxKeep);

  localStorage.setItem(taskDistributionArchiveKey(tenantId), JSON.stringify(next));

  dispatchArchiveUpdated({ tenantId: safeTenantId(tenantId), added, updated });

  return { added, updated, total: next.length };
}

export async function saveArchiveCloud(
  tenantId: string,
  item: ArchivedDistributionRun
) {
  const tid = safeTenantId(tenantId);
  const archiveId = clean(item?.archiveId);
  if (!archiveId) return;

  if (isTenantReadOnlyView(tid)) return;

  await setDoc(
    archiveDocRef(tid, archiveId),
    {
      ...item,
      archiveId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function loadArchiveCloud(tenantId: string): Promise<ArchivedDistributionRun[]> {
  const tid = safeTenantId(tenantId);
  try {
    const snap = await getDocs(query(archiveCollectionRef(tid), orderBy("createdAtISO", "desc")));
    return snap.docs.map((d) => ({ archiveId: d.id, ...(d.data() as any) })) as ArchivedDistributionRun[];
  } catch {
    const snap = await getDocs(archiveCollectionRef(tid));
    return snap.docs.map((d) => ({ archiveId: d.id, ...(d.data() as any) })) as ArchivedDistributionRun[];
  }
}

export async function syncArchiveFromCloud(tenantId: string, maxKeep = 60) {
  const cloud = await loadArchiveCloud(tenantId);
  return mergeArchivedRuns(tenantId, cloud, maxKeep);
}

export function addRunToArchive(
  tenantId: string,
  item: ArchivedDistributionRun,
  maxKeep = 60
) {
  if (isTenantReadOnlyView(tenantId)) return;

  const list = listArchivedRuns(tenantId);
  const next = [item, ...list.filter((x) => x?.archiveId !== item.archiveId)].slice(
    0,
    maxKeep
  );
  localStorage.setItem(taskDistributionArchiveKey(tenantId), JSON.stringify(next));

  dispatchArchiveUpdated({ tenantId: safeTenantId(tenantId), archiveId: item.archiveId, name: item.name });

  void saveArchiveCloud(tenantId, item).catch((e) => console.error("cloud archive error", e));
}

export async function deleteArchiveCloud(tenantId: string, archiveId: string) {
  const id = clean(archiveId);
  if (!id) return;
  
  if (isTenantReadOnlyView(tenantId)) return;

  await deleteDoc(archiveDocRef(tenantId, id));
}

export function deleteArchivedRun(tenantId: string, archiveId: string) {
  if (isTenantReadOnlyView(tenantId)) return;

  const list = listArchivedRuns(tenantId);
  const next = list.filter((x) => String(x?.archiveId) !== String(archiveId));
  localStorage.setItem(taskDistributionArchiveKey(tenantId), JSON.stringify(next));

  dispatchArchiveUpdated({ tenantId: safeTenantId(tenantId) });
  void deleteArchiveCloud(tenantId, archiveId).catch(() => undefined);
}

export async function clearArchiveCloud(tenantId: string) {
  if (isTenantReadOnlyView(tenantId)) return;

  const snap = await getDocs(archiveCollectionRef(tenantId));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export function clearArchive(tenantId: string) {
  if (isTenantReadOnlyView(tenantId)) return;

  localStorage.removeItem(taskDistributionArchiveKey(tenantId));
  dispatchArchiveUpdated({ tenantId: safeTenantId(tenantId) });
  void clearArchiveCloud(tenantId).catch(() => undefined);
}

export async function saveRunCloud(
  tenantId: string,
  run: DistributionRun,
  options?: { source?: string }
) {
  const tid = safeTenantId(tenantId);
  if (isTenantReadOnlyView(tid)) return;
  await setDoc(
    runDocRef(tid),
    {
      id: LATEST_RUN_DOC_ID,
      tenantId: tid,
      run,
      runId: clean((run as any)?.runId),
      createdAtISO: clean((run as any)?.createdAtISO),
      source: options?.source || "saveRun",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function loadRunCloud(tenantId: string): Promise<DistributionRun | null> {
  const snap = await getDoc(runDocRef(tenantId));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return (data?.run || null) as DistributionRun | null;
}

export async function syncRunFromCloud(tenantId: string): Promise<DistributionRun | null> {
  const run = await loadRunCloud(tenantId);
  if (!run) return loadRun(tenantId);
  writeRunLocal(tenantId, run, "cloud-sync");
  return run;
}

export function saveRun(
  tenantId: string,
  run: DistributionRun,
  options?: {
    silent?: boolean;
    source?: string;
    force?: boolean;
    syncMaster?: boolean;
  }
) {
  const tid = safeTenantId(tenantId);
  if (isTenantReadOnlyView(tid)) return false;
  const previousSignature = safeReadRunSignature(tid);
  const nextSignature = stableRunSignature(run);
  const changed = options?.force || !previousSignature || previousSignature !== nextSignature;

  if (!changed) {
    return false;
  }

  localStorage.setItem(taskDistributionKey(tid), JSON.stringify(run));

  if (options?.syncMaster !== false) {
    try {
      syncMasterTableWithRun(run);
    } catch {}
  }

  if (!options?.silent) {
    dispatchRunUpdated(tid, options?.source || "saveRun");
  }

  void saveRunCloud(tid, run, { source: options?.source || "saveRun" }).catch((e) => {
    console.error("cloud task distribution run error", e);
  });

  return true;
}

export function loadRun(tenantId: string): DistributionRun | null {
  const raw = localStorage.getItem(taskDistributionKey(tenantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DistributionRun;
  } catch {
    return null;
  }
}

export async function clearRunCloud(tenantId: string) {
  if (isTenantReadOnlyView(tenantId)) return;

  await deleteDoc(runDocRef(tenantId));
}

export function clearRun(tenantId: string) {
  const tid = safeTenantId(tenantId);
  if (isTenantReadOnlyView(tid)) return;
  localStorage.removeItem(taskDistributionKey(tid));

  try {
    localStorage.removeItem(MASTER_TABLE_KEY);
    localStorage.removeItem(ALL_TABLE_KEY);
    localStorage.removeItem(RESULTS_TABLE_KEY);
    dispatchMasterTableUpdated({ source: "clear" });
  } catch {}

  dispatchRunUpdated(tid, "clearRun");
  void clearRunCloud(tid).catch(() => undefined);
}
