import { WebAuthnChallengeRecord } from "./types";

const challenges = new Map<string, WebAuthnChallengeRecord>();

export function saveChallenge(
  userId: string,
  record: WebAuthnChallengeRecord
) {
  challenges.set(userId, record);
}

export function getChallenge(userId: string) {
  return challenges.get(userId) ?? null;
}

export function consumeChallenge(userId: string) {
  const value = challenges.get(userId) ?? null;

  if (value) {
    challenges.delete(userId);
  }

  return value;
}

export function clearExpiredChallenges() {
  const now = Date.now();

  for (const [userId, record] of challenges.entries()) {
    if (record.expiresAt < now) {
      challenges.delete(userId);
    }
  }
}
