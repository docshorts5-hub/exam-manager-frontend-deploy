import { generateRegistrationOptions } from "@simplewebauthn/server";
import { WEBAUTHN_CONFIG } from "./config";
import { saveChallenge } from "./challengeStore";

export async function createRegistrationOptions(
  userId: string,
  userName: string
) {
  const options = await generateRegistrationOptions({
    rpName: WEBAUTHN_CONFIG.rpName,
    rpID: WEBAUTHN_CONFIG.rpID,

    userName,

    userID: Buffer.from(userId),

    timeout: WEBAUTHN_CONFIG.timeout,

    attestationType: "none",

    authenticatorSelection: {
      userVerification:
        WEBAUTHN_CONFIG.userVerification,
      residentKey: "preferred",
    },
  });

  saveChallenge(userId, {
    challenge: options.challenge,
    userId,
    type: "registration",
    expiresAt:
      Date.now() + WEBAUTHN_CONFIG.timeout,
  });

  return options;
}
