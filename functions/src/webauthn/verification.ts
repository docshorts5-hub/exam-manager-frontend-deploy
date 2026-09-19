import {
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import {
  getChallenge,
  consumeChallenge,
} from "./challengeStore";

import {
  saveCredential,
} from "./credentialStore";

import {
  WEBAUTHN_CONFIG,
} from "./config";


export async function verifyRegistration(
  userId: string,
  response: any
) {

  const stored =
    getChallenge(userId);

  if (!stored) {
    throw new Error(
      "WEBAUTHN_CHALLENGE_NOT_FOUND"
    );
  }

  if (
    stored.type !== "registration"
  ) {
    throw new Error(
      "INVALID_WEBAUTHN_CHALLENGE_TYPE"
    );
  }


  const verification =
    await verifyRegistrationResponse({

      response,

      expectedChallenge:
        stored.challenge,

      expectedOrigin:
        WEBAUTHN_CONFIG.origin,

      expectedRPID:
        WEBAUTHN_CONFIG.rpID,

    });


  if (!verification.verified) {

    throw new Error(
      "WEBAUTHN_REGISTRATION_FAILED"
    );

  }


  const info =
    verification.registrationInfo;


  if (!info) {

    throw new Error(
      "WEBAUTHN_REGISTRATION_INFO_MISSING"
    );

  }


  const credential = {

    credentialID:
      Buffer.from(
        info.credential.id
      ).toString("base64url"),

    credentialPublicKey:
      Buffer.from(
        info.credential.publicKey
      ).toString("base64url"),

    counter:
      info.credential.counter,

    userId,

  };


  await saveCredential(
    userId,
    credential
  );


  consumeChallenge(userId);


  return {
    verified: true,
    credentialID:
      credential.credentialID,
  };
}

