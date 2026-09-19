import {
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import {
  getChallenge,
  consumeChallenge,
} from "./challengeStore";

import {
  getCredential,
  saveCredential,
} from "./credentialStore";

import {
  WEBAUTHN_CONFIG,
} from "./config";


export async function verifyWebAuthnAuthentication(
  userId: string,
  credentialId: string,
  response: any,
) {

  const storedChallenge =
    getChallenge(userId);

  if (!storedChallenge) {
    throw new Error(
      "WEBAUTHN_CHALLENGE_NOT_FOUND"
    );
  }


  if (
    storedChallenge.type !== "authentication"
  ) {
    throw new Error(
      "INVALID_WEBAUTHN_CHALLENGE_TYPE"
    );
  }


  const credential =
    await getCredential(
      userId,
      credentialId
    );


  if (!credential) {
    throw new Error(
      "WEBAUTHN_CREDENTIAL_NOT_FOUND"
    );
  }


  const verification =
    await verifyAuthenticationResponse({

      response,

      expectedChallenge:
        storedChallenge.challenge,

      expectedOrigin:
        WEBAUTHN_CONFIG.origin,

      expectedRPID:
        WEBAUTHN_CONFIG.rpID,

      credential: {

        id:
          credential.credentialID,

        publicKey:
          Buffer.from(
            credential.credentialPublicKey,
            "base64url"
          ),

        counter:
          credential.counter,

      },

    });


  if (!verification.verified) {
    throw new Error(
      "WEBAUTHN_AUTHENTICATION_FAILED"
    );
  }


  await saveCredential(
userId,
{
...credential,
credentialID:
credential.credentialID,
credentialPublicKey:
credential.credentialPublicKey,
userId,
counter:
verification.authenticationInfo.newCounter,
lastUsedAt:
Date.now(),
}
);


  consumeChallenge(userId);


  return {
    verified: true,
    credentialID:
      credentialId,
  };
}
