import { useTheme } from "../state/ThemeProvider";
import React, { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Art, BackHeader, T } from "../components/ui";
import { useApp } from "../state/AppProvider";
import AppleSignIn from "../components/apple-sign-in";
import { signInWithApple } from "../lib/apple-auth";
import {
  appleSignInErrorMessage,
  isAppleSignInCancelled,
} from "../lib/apple-auth-flow";

export default function Auth() {
  const { colors, s } = useTheme();
  const { backendAvailable } = useApp();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 45 }}
    >
      <BackHeader />
      <View style={[s.inset, { gap: 20 }]}>
        <View style={{ alignItems: "center" }}>
          <Art name="ratings/bucky-5-star" size={112} />
          <T
            style={{
              fontSize: 31,
              lineHeight: 38,
              letterSpacing: -0.8,
              fontWeight: "700",
              marginTop: 20,
            }}
          >
            Your Bucky’s Bites
          </T>
          <T style={[s.body, { textAlign: "center", marginTop: 10 }]}>
            Save your meals and reviews.
          </T>
        </View>
        {backendAvailable ? (
          <AppleSignIn
            disabled={busy}
            busy={busy}
            onPress={async () => {
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setMessage("");
              try {
                await signInWithApple();
              } catch (error) {
                if (!isAppleSignInCancelled(error)) {
                  setMessage(appleSignInErrorMessage(error));
                }
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          />
        ) : (
          <T style={[s.body, { textAlign: "center" }]}>
            {backendAvailable === null
              ? "Checking account availability…"
              : "Sign-in is not available yet. Please try again later."}
          </T>
        )}
        {Boolean(message) && (
          <T
            accessibilityRole="alert"
            style={{ color: colors.red, fontSize: 14 }}
          >
            {message}
          </T>
        )}
        <T style={[s.caption, { textAlign: "center" }]}>
          Not affiliated with Santa Clara University.
        </T>
      </View>
    </ScrollView>
  );
}
