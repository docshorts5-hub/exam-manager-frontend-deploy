import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

export const SECURITY_JOURNAL_VERSION =
  "YR_SECURITY_JOURNAL_R1" as const;

export const SECURITY_JOURNAL_HASH_ALGORITHM =
  "SHA256" as const;

export const SECURITY_JOURNAL_CANONICALIZATION =
  "SORTED_JSON_R1" as const;

const JOURNAL_CONTROL_COLLECTION =
  "__securityJournalControl";

const JOURNAL_HEAD_DOCUMENT =
  "HEAD_R1";

const JOURNAL_EVENT_COLLECTION =
  "__securityJournalEvents";

const ZERO_SHA256 =
  "0".repeat(64);

const MAX_DETAILS_UTF8_BYTES =
  16 * 1024;

const MAX_TEXT_LENGTH =
  512;

const SERVER_CORRELATION_ID_PATTERN =
  /^yr-[a-z0-9]+-[a-f0-9]{32}$/;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const SENSITIVE_DETAIL_KEY_PATTERN =
  /password|passphrase|secret|authorization|cookie|api[_-]?key|private[_-]?key|gmailpass|gmail_app_password|changetoken|tokenhash|codehash/i;

export type SecurityJournalActor = {
  uid: string;
  email?: string;
  role?: string;
  tenantId?: string;
  governorate?: string;
};

export type SecurityJournalEventInput = {
  correlationId: string;
  action: string;
  scope: string;
  actor: SecurityJournalActor;

  tenantId?: string;
  targetType?: string;
  targetId?: string;

  outcome?: "SUCCESS" | "DENIED" | "FAILURE" | "ATTEMPT";

  details?: unknown;
};

export type SecurityJournalAppendResult = {
  journalVersion: typeof SECURITY_JOURNAL_VERSION;

  eventId: string;
  sequence: number;

  correlationId: string;

  previousEventHash: string;
  eventHash: string;

  createdAtISO: string;
};

function cleanText(
  value: unknown,
  maxLength: number = MAX_TEXT_LENGTH
) {
  const text =
    String(value ?? "").trim();

  return text.slice(0, maxLength);
}

function requiredText(
  value: unknown,
  label: string
) {
  const text =
    cleanText(value);

  if (!text) {
    throw new Error(
      `SECURITY_JOURNAL_REQUIRED_FIELD:${label}`
    );
  }

  return text;
}

function securitySha256(
  value: string
) {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function normalizeSecurityValue(
  value: unknown,
  parentKey: string = ""
): unknown {

  if (
    parentKey &&
    SENSITIVE_DETAIL_KEY_PATTERN.test(parentKey)
  ) {
    return "[REDACTED]";
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeSecurityValue(item)
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const source =
      value as Record<string, unknown>;

    const result:
      Record<string, unknown> = {};

    for (
      const key of
      Object.keys(source).sort()
    ) {
      const item =
        source[key];

      if (
        typeof item === "undefined" ||
        typeof item === "function" ||
        typeof item === "symbol"
      ) {
        continue;
      }

      result[key] =
        normalizeSecurityValue(
          item,
          key
        );
    }

    return result;
  }

  if (typeof value === "undefined") {
    return null;
  }

  return String(value);
}

function stableSecurityJson(
  value: unknown
) {
  return JSON.stringify(
    normalizeSecurityValue(value)
  );
}

function createJournalEventId() {
  return (
    "sje-" +
    crypto
      .randomBytes(16)
      .toString("hex")
  );
}

function validateCorrelationId(
  value: unknown
) {
  const correlationId =
    requiredText(
      value,
      "correlationId"
    );

  if (
    !SERVER_CORRELATION_ID_PATTERN.test(
      correlationId
    )
  ) {
    throw new Error(
      "SECURITY_JOURNAL_INVALID_CORRELATION_ID"
    );
  }

  return correlationId;
}

function normalizeDetails(
  details: unknown
) {
  const normalized =
    normalizeSecurityValue(details);

  const encoded =
    JSON.stringify(normalized);

  const bytes =
    Buffer.byteLength(
      encoded,
      "utf8"
    );

  if (
    bytes >
    MAX_DETAILS_UTF8_BYTES
  ) {
    throw new Error(
      "SECURITY_JOURNAL_DETAILS_TOO_LARGE"
    );
  }

  return normalized;
}

export async function appendSecurityJournalEvent(
  input: SecurityJournalEventInput,
  mutation?: (
    transaction: FirebaseFirestore.Transaction
  ) => void | Promise<void>
): Promise<SecurityJournalAppendResult> {

  if (
    !input ||
    typeof input !== "object"
  ) {
    throw new Error(
      "SECURITY_JOURNAL_INPUT_REQUIRED"
    );
  }

  const correlationId =
    validateCorrelationId(
      input.correlationId
    );

  const action =
    requiredText(
      input.action,
      "action"
    );

  const scope =
    requiredText(
      input.scope,
      "scope"
    );

  if (
    !input.actor ||
    typeof input.actor !== "object"
  ) {
    throw new Error(
      "SECURITY_JOURNAL_ACTOR_REQUIRED"
    );
  }

  const actorUid =
    requiredText(
      input.actor.uid,
      "actor.uid"
    );

  const actorEmail =
    cleanText(
      input.actor.email
    );

  const actorRole =
    cleanText(
      input.actor.role
    );

  const actorTenantId =
    cleanText(
      input.actor.tenantId
    );

  const actorGovernorate =
    cleanText(
      input.actor.governorate
    );

  const tenantId =
    cleanText(
      input.tenantId
    );

  const targetType =
    cleanText(
      input.targetType
    );

  const targetId =
    cleanText(
      input.targetId
    );

  const outcome =
    input.outcome ||
    "ATTEMPT";

  if (
    ![
      "SUCCESS",
      "DENIED",
      "FAILURE",
      "ATTEMPT",
    ].includes(outcome)
  ) {
    throw new Error(
      "SECURITY_JOURNAL_INVALID_OUTCOME"
    );
  }

  const details =
    normalizeDetails(
      input.details ?? null
    );

  const eventId =
    createJournalEventId();

  const createdAtISO =
    new Date().toISOString();

  const db =
    admin.firestore();

  const headRef =
    db
      .collection(
        JOURNAL_CONTROL_COLLECTION
      )
      .doc(
        JOURNAL_HEAD_DOCUMENT
      );

  const eventRef =
    db
      .collection(
        JOURNAL_EVENT_COLLECTION
      )
      .doc(
        eventId
      );

  return db.runTransaction(
    async (transaction) => {

      const headSnap =
        await transaction.get(
          headRef
        );

      let previousSequence =
        0;

      let previousEventHash =
        ZERO_SHA256;

      if (headSnap.exists) {
        const head =
          headSnap.data() || {};

        const rawSequence =
          Number(
            head.lastSequence
          );

        if (
          !Number.isSafeInteger(
            rawSequence
          ) ||
          rawSequence < 1
        ) {
          throw new Error(
            "SECURITY_JOURNAL_HEAD_SEQUENCE_INVALID"
          );
        }

        const rawHash =
          cleanText(
            head.lastEventHash
          ).toLowerCase();

        if (
          !SHA256_PATTERN.test(
            rawHash
          )
        ) {
          throw new Error(
            "SECURITY_JOURNAL_HEAD_HASH_INVALID"
          );
        }

        if (
          cleanText(
            head.journalVersion
          ) !==
          SECURITY_JOURNAL_VERSION
        ) {
          throw new Error(
            "SECURITY_JOURNAL_HEAD_VERSION_MISMATCH"
          );
        }

        previousSequence =
          rawSequence;

        previousEventHash =
          rawHash;
      }

      const sequence =
        previousSequence + 1;

      if (
        !Number.isSafeInteger(
          sequence
        )
      ) {
        throw new Error(
          "SECURITY_JOURNAL_SEQUENCE_OVERFLOW"
        );
      }

      const eventCore = {
        journalVersion:
          SECURITY_JOURNAL_VERSION,

        sequence,
        eventId,
        correlationId,

        action,
        scope,
        outcome,

        tenantId,
        targetType,
        targetId,

        actorUid,
        actorEmail,
        actorRole,
        actorTenantId,
        actorGovernorate,

        actorTrust:
          "SERVER_BOUND_AUTH_CONTEXT",

        createdAtISO,

        details,
      };

      const hashMaterial =
        stableSecurityJson({
          previousEventHash,
          event: eventCore,
        });

      const eventHash =
        securitySha256(
          hashMaterial
        );

      if (mutation) {
        await mutation(transaction);
      }

      transaction.create(
        eventRef,
        {
          ...eventCore,

          previousEventHash,
          eventHash,

          hashAlgorithm:
            SECURITY_JOURNAL_HASH_ALGORITHM,

          canonicalization:
            SECURITY_JOURNAL_CANONICALIZATION,

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );

      transaction.set(
        headRef,
        {
          journalVersion:
            SECURITY_JOURNAL_VERSION,

          lastSequence:
            sequence,

          lastEventId:
            eventId,

          lastEventHash:
            eventHash,

          hashAlgorithm:
            SECURITY_JOURNAL_HASH_ALGORITHM,

          canonicalization:
            SECURITY_JOURNAL_CANONICALIZATION,

          updatedAtISO:
            createdAtISO,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: false,
        }
      );

      return {
        journalVersion:
          SECURITY_JOURNAL_VERSION,

        eventId,
        sequence,

        correlationId,

        previousEventHash,
        eventHash,

        createdAtISO,
      };
    }
  );
}