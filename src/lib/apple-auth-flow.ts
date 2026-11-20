import type { Session } from "@supabase/supabase-js";

import { accountSession } from "./account-auth";

export type AppleChallenge = {
  nonce: string;
  hashedNonce: string;
  state: string;
};

type AppleAuthServices = {
  createChallenge: () => Promise<AppleChallenge>;
  requestCredential: (request: { nonce: string; state: string }) => Promise<{
    identityToken: string | null;
    state: string | null;
  }>;
  exchangeToken: (request: {
    provider: "apple";
    token: string;
    nonce: string;
  }) => Promise<{
    data: { session: Session | null };
    error: { message: string } | null;
  }>;
};

// Apple receives the SHA-256 challenge; Supabase verifies the original nonce
// against the signed token. No credentials are retained outside Supabase's
// existing SecureStore-backed session storage.
export async function performAppleSignIn(services: AppleAuthServices) {
  const challenge = await services.createChallenge();
  const credential = await services.requestCredential({
    nonce: challenge.hashedNonce,
    state: challenge.state,
  });
  if (credential.state !== challenge.state) {
    throw new Error(
      "Apple sign-in returned an unexpected response. Please try again.",
    );
  }
  if (!credential.identityToken) {
    throw new Error("Apple did not provide a sign-in token. Please try again.");
  }
  const { data, error } = await services.exchangeToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: challenge.nonce,
  });
  if (error) throw error;
  if (!data.session)
    throw new Error(
      "Apple sign-in did not create a session. Please try again.",
    );
  if (!accountSession(data.session, "apple"))
    throw new Error(
      "Apple sign-in did not return an Apple account. Please try again.",
    );
  return data.session;
}

export function isAppleSignInCancelled(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  );
}

export function appleSignInErrorMessage(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  if (/provider.*(not enabled|disabled)|unsupported provider/i.test(message)) {
    return "Apple sign-in isn’t enabled yet. Please try again later.";
  }
  if (/audience|unacceptable audience|client.?id/i.test(message)) {
    return "Apple sign-in isn’t configured for this app yet. Please try again later.";
  }
  if (/network|fetch|offline|timeout/i.test(message)) {
    return "Couldn’t connect. Check your connection and try again.";
  }
  return "Couldn’t sign in with Apple. Please try again.";
}
