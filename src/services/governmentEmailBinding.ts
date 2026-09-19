export type GovernmentEmailBindingState =
  | "BOUND"
  | "UNVERIFIED"
  | "NO_EMAIL"
  | "REVIEW_REQUIRED";

export interface GovernmentEmailBindingResult {
  email: string;
  verified: boolean;
  provider: string;
  state: GovernmentEmailBindingState;
  readiness: string;
}

export function resolveGovernmentEmailBinding(input: {
  email?: string;
  emailVerified?: boolean;
  provider?: string;
}): GovernmentEmailBindingResult {

  const email = String(input.email || "").trim();
  const verified = Boolean(input.emailVerified);
  const provider = String(input.provider || "").trim();

  if (!email) {
    return {
      email: "",
      verified,
      provider,
      state: "NO_EMAIL",
      readiness: "Email unavailable",
    };
  }

  if (!verified) {
    return {
      email,
      verified,
      provider,
      state: "UNVERIFIED",
      readiness: "Verification required",
    };
  }

  return {
    email,
    verified,
    provider,
    state: "BOUND",
    readiness: "Ready for binding review",
  };
}
