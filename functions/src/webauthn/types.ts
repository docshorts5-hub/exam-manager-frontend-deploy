export interface WebAuthnCredentialRecord {
  credentialID: string;

  credentialPublicKey: string;

  counter: number;

  transports?: string[];

  userId: string;

  createdAt?: number;

  lastUsedAt?: number;
}


export interface WebAuthnChallengeRecord {
  challenge: string;

  userId: string;

  type:
    | "registration"
    | "authentication";

  expiresAt: number;
}
