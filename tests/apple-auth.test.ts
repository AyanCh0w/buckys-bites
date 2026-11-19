import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Session } from "@supabase/supabase-js";
import {
  performAppleSignIn,
  isAppleSignInCancelled,
  appleSignInErrorMessage,
} from "../src/lib/apple-auth-flow";

const session = { user: { id: "apple-user" } } as Session;
function challenge() {
  const nonce = randomBytes(32).toString("hex");
  return {
    nonce,
    hashedNonce: createHash("sha256").update(nonce).digest("hex"),
    state: randomUUID(),
  };
}

test("Apple receives a hashed challenge; Supabase receives the original nonce and signed token", async () => {
  const expected = challenge();
  const result = await performAppleSignIn({
    createChallenge: async () => expected,
    requestCredential: async (request) => {
      assert.deepEqual(request, {
        nonce: expected.hashedNonce,
        state: expected.state,
      });
      assert.notEqual(request.nonce, expected.nonce);
      return { identityToken: "signed-apple-id-token", state: request.state };
    },
    exchangeToken: async (request) => {
      assert.deepEqual(request, {
        provider: "apple",
        token: "signed-apple-id-token",
        nonce: expected.nonce,
      });
      return { data: { session }, error: null };
    },
  });
  assert.equal(result, session);
});

test("Apple cancellation, a missing token, and a mismatched state never reach Supabase", async () => {
  const cancel = { code: "ERR_REQUEST_CANCELED" };
  for (const reason of ["cancel", "missing-token", "wrong-state"]) {
    let exchanged = false;
    await assert.rejects(
      performAppleSignIn({
        createChallenge: async () => challenge(),
        requestCredential: async (request) => {
          if (reason === "cancel") throw cancel;
          return {
            identityToken: reason === "missing-token" ? null : "token",
            state:
              reason === "wrong-state" ? "different-request" : request.state,
          };
        },
        exchangeToken: async () => {
          exchanged = true;
          return { data: { session }, error: null };
        },
      }),
    );
    assert.equal(exchanged, false);
  }
  assert.equal(isAppleSignInCancelled(cancel), true);
  assert.equal(isAppleSignInCancelled({ code: "ERR_REQUEST_FAILED" }), false);
  assert.equal(isAppleSignInCancelled(null), false);
});

test("Apple sign-in succeeds only after Supabase returns a session; retry gets a new challenge", async () => {
  const states = new Set<string>();
  const nonces = new Set<string>();
  let attempts = 0;
  const services = {
    createChallenge: async () => {
      const next = challenge();
      states.add(next.state);
      nonces.add(next.nonce);
      return next;
    },
    requestCredential: async (request: { state: string }) => ({
      identityToken: "token",
      state: request.state,
    }),
    exchangeToken: async () => {
      attempts++;
      return attempts === 1
        ? {
            data: { session: null },
            error: { message: "network request failed" },
          }
        : attempts === 2
          ? { data: { session: null }, error: null }
          : { data: { session }, error: null };
    },
  };
  await assert.rejects(performAppleSignIn(services));
  await assert.rejects(
    performAppleSignIn(services),
    /did not create a session/,
  );
  assert.equal(await performAppleSignIn(services), session);
  assert.equal(states.size, 3);
  assert.equal(nonces.size, 3);
});

test("Apple failures give a retry without offering another login method or exposing token details", () => {
  assert.match(
    appleSignInErrorMessage({ message: "provider is not enabled" }),
    /isn’t enabled yet\. Please try again later\./,
  );
  assert.match(
    appleSignInErrorMessage({ message: "Unacceptable audience in id_token" }),
    /isn’t configured for this app yet\. Please try again later\./,
  );
  assert.match(
    appleSignInErrorMessage({ message: "Network request failed" }),
    /connection/,
  );
  assert.equal(
    appleSignInErrorMessage({ message: "private token detail" }),
    "Couldn’t sign in with Apple. Please try again.",
  );
});
