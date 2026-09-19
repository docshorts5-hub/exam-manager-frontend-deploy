import {
  generateAuthenticationOptions,
} from "@simplewebauthn/server";

import {
  WEBAUTHN_CONFIG,
} from "./config";

import {
  saveChallenge,
} from "./challengeStore";


export async function createAuthenticationOptions(
  userId: string,
  credentialIds: string[]
) {

  if (!credentialIds.length) {
    throw new Error(
      "WEBAUTHN_NO_CREDENTIALS"
    );
  }


  const options =
    await generateAuthenticationOptions({

      rpID:
        WEBAUTHN_CONFIG.rpID,

      timeout:
        WEBAUTHN_CONFIG.timeout,

      userVerification:
        WEBAUTHN_CONFIG.userVerification,

      allowCredentials:
        credentialIds.map((id)=>({
          id,
          type:"public-key",
        })),

    });


  saveChallenge(
    userId,
    {
      challenge:
        options.challenge,

      userId,

      type:
        "authentication",

      expiresAt:
        Date.now()
        +
        WEBAUTHN_CONFIG.timeout,
    }
  );


  return options;
}
