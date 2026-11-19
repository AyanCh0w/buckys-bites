# Sign in with Apple

The iPhone app uses Expo's native Apple button and authentication sheet, followed
by Supabase `signInWithIdToken`. It uses the existing SecureStore-backed session,
account refresh, and database permissions. Sign in with Apple is the only login
option in the app; there are no email/password, sign-up, or preview-login controls.
Apple is offered only when iOS reports it is supported. Other platforms direct
users to the iPhone app, and unsupported iOS devices show an availability message.

Each attempt generates a fresh cryptographic nonce and request state. Apple
receives SHA-256(nonce), and Supabase receives the original nonce with Apple's
signed ID token. Missing tokens and mismatched state are rejected before the
exchange. Cancellation stays on the sign-in screen without an error. Concurrent
Apple submissions are blocked, and errors allow retry.

Only the email scope is requested. Apple may supply a private relay email; the
app does not require or reveal a person's Apple account name. Existing public
profile names and avatars remain intact. New accounts start as Bronco and can
choose a public name and Bucky avatar in Me's profile editor.

## Required Supabase activation

The app code and native configuration are ready. Live Apple-provider activation
and a successful sign-in have **not been verified**: browser permission to the
Supabase dashboard was declined during setup, and the owner continued manually.
Removing email controls in the app does not change Supabase provider settings.

1. Open [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/wyofqdyqfsculpvkzrjc/auth/providers)
   in the connected `benson` project.
2. Open Apple and enable Sign in with Apple.
3. Add these to Client IDs, preserving any existing IDs:
   - `com.buckysbites.app` — the app's iOS bundle identifier.
   - `host.exp.Exponent` — for the current Expo Go testing workflow.
4. Save. Native ID-token sign-in does not require an OAuth secret, Services ID,
   website redirect, or a `.p8` key in this app.
5. Reload Expo Go on the iPhone, open **Me → Sign in → Sign in with Apple**, and
   complete Apple's sign-in sheet yourself.

Expo Go and the standalone app can return different Apple identities. Treat Expo
Go accounts as development accounts; remove its Client ID when retiring Expo Go
testing. Do not manually merge users by their email address.

## Standalone iOS build

`app.json` has `ios.usesAppleSignIn: true` and the
`expo-apple-authentication` config plugin. The next iOS build must include these
native changes. Its App ID in the Apple Developer account must have the Sign in
with Apple capability enabled; EAS can synchronize this during credential setup.
Expo Go already includes the required native modules and only needs a reload.

## Verification

- Unit coverage verifies hashed/raw nonce boundaries, state validation, missing
  tokens, cancellation, exchange failures, missing sessions, retries, and safe
  error messages.
- End-to-end Apple sign-in still needs provider activation and the owner's
  confirmation on a physical iPhone. No Apple credentials are requested in chat.

References: [Supabase native Apple configuration](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple),
[Expo SDK 58 AppleAuthentication](https://docs.expo.dev/versions/v58.0.0/sdk/apple-authentication/).
