import { DIRECTORATES } from "../../constants/directorates";
import { callFn } from "../../services/functionsClient";

export type OwnerDiplomaCenterRejectReason =
  | "deleted"
  | "identity_conflict"
  | "school_not_center"
  | "unknown_identity"
  | "missing_governorate"
  | "governorate_conflict"
  | "non_official_governorate";

export type OwnerDiplomaCenterRecord = {
  id: string;
  name: string;
  governorate: string;
  enabled: boolean;
};

export type OwnerDiplomaCenterRejected = {
  id: string;
  reason: OwnerDiplomaCenterRejectReason;
  governorates: string[];
};

export type OwnerDiplomaCenterReadResult = {
  centers: OwnerDiplomaCenterRecord[];
  rejected: OwnerDiplomaCenterRejected[];
};

type DiplomaCenterCallableItem = {
  id: unknown;
  name: unknown;
  governorate: unknown;
  enabled: unknown;
};

type DiplomaCenterCallableResponse = {
  items?: unknown;
};

const EXPECTED_ITEM_KEYS = [
  "enabled",
  "governorate",
  "id",
  "name",
];

function cleanText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\u200f|\u200e/g, "");
}

export function canonicalDiplomaCenterGovernorate(
  value: unknown,
) {
  let normalized = cleanText(value);

  for (const prefix of [
    "المديرية العامة للتعليم بمحافظة ",
    "المديرية العامة للتعليم ",
    "بمحافظة ",
    "محافظة ",
  ]) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length).trim();
      break;
    }
  }

  const match = DIRECTORATES.find((directorate) => {
    const rawDirectorate = cleanText(directorate);
    const rawGovernorate = cleanText(
      rawDirectorate
        .replace("المديرية العامة للتعليم بمحافظة ", "")
        .replace("المديرية العامة للتعليم ", ""),
    );

    return (
      normalized === rawGovernorate ||
      normalized === rawDirectorate
    );
  });

  if (!match) {
    return "";
  }

  return cleanText(match)
    .replace("المديرية العامة للتعليم بمحافظة ", "")
    .replace("المديرية العامة للتعليم ", "");
}

function parseCallableItem(
  value: unknown,
): OwnerDiplomaCenterRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("DIPLOMA_CENTER_RESPONSE_ITEM_INVALID");
  }

  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();

  if (
    keys.length !== EXPECTED_ITEM_KEYS.length ||
    keys.some(
      (key, index) => key !== EXPECTED_ITEM_KEYS[index],
    )
  ) {
    throw new Error("DIPLOMA_CENTER_RESPONSE_SCHEMA_INVALID");
  }

  const item = row as DiplomaCenterCallableItem;
  const id = cleanText(item.id);
  const name = cleanText(item.name);
  const governorate =
    canonicalDiplomaCenterGovernorate(item.governorate);

  if (!id) {
    throw new Error("DIPLOMA_CENTER_RESPONSE_ID_INVALID");
  }

  if (!name) {
    throw new Error("DIPLOMA_CENTER_RESPONSE_NAME_INVALID");
  }

  if (!governorate) {
    throw new Error(
      "DIPLOMA_CENTER_RESPONSE_GOVERNORATE_INVALID",
    );
  }

  if (typeof item.enabled !== "boolean") {
    throw new Error(
      "DIPLOMA_CENTER_RESPONSE_ENABLED_INVALID",
    );
  }

  return {
    id,
    name,
    governorate,
    enabled: item.enabled,
  };
}

const listDiplomaCenterTenants = callFn<
  Record<string, never>,
  DiplomaCenterCallableResponse
>("adminListDiplomaCenterTenants");

export async function loadOwnerDiplomaCenterReadModel(
  input: { isPlatformOwner: boolean },
): Promise<OwnerDiplomaCenterReadResult> {
  if (!input?.isPlatformOwner) {
    throw new Error("PLATFORM_OWNER_REQUIRED");
  }

  const response = await listDiplomaCenterTenants({});

  if (!response || !Array.isArray(response.items)) {
    throw new Error("DIPLOMA_CENTER_RESPONSE_INVALID");
  }

  const centers = response.items.map(parseCallableItem);

  centers.sort((left, right) =>
    left.name.localeCompare(right.name, "ar"),
  );

  return {
    centers,
    rejected: [],
  };
}