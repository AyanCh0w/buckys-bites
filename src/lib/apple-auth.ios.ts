import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { performAppleSignIn } from "./apple-auth-flow";

export async function signInWithApple() {
  return performAppleSignIn({
    createChallenge: async () => {
      const bytes = await Crypto.getRandomBytesAsync(32);
      const nonce = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      return {
        nonce,
        hashedNonce: await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          nonce,
        ),
        state: Crypto.randomUUID(),
      };
    },
    requestCredential: ({ nonce, state }) =>
      AppleAuthentication.signInAsync({
        nonce,
        state,
        // A public display name is chosen in the profile editor. Signing in
        // should not replace it with someone's Apple account/legal name.
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      }),
    exchangeToken: (credentials) =>
      supabase.auth.signInWithIdToken(credentials),
  });
}
