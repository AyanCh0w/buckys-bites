import type { Session } from "@supabase/supabase-js";

type AccountProvider = "apple" | "email";

export function accountSession(
  session: Session | null,
  provider?: AccountProvider,
) {
  const user = session?.user;
  if (!user || user.is_anonymous) return null;
  const metadata = user.app_metadata;
  const allowed = provider ? [provider] : ["apple", "email"];
  return allowed.some(
    (name) =>
      metadata?.provider === name ||
      (Array.isArray(metadata?.providers) && metadata.providers.includes(name)),
  )
    ? session
    : null;
}

// Supabase authenticates email identities. Provision short usernames under
// this domain so signing in never needs a lookup of private account details.
export function loginEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  return normalized.includes("@")
    ? normalized
    : normalized + "@accounts.bucky.eat";
}

export function passwordErrorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "invalid_credentials") return "Incorrect username or password.";
  if (code === "over_request_rate_limit")
    return "Too many attempts. Try again in a few minutes.";
  return "Couldn’t sign in. Check your connection and try again.";
}
