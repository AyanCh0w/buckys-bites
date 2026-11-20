import { useTheme } from "../state/ThemeProvider";
import React, { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Art, BackHeader, Button, T } from "./ui";
import { Input } from "./input";
import {
  accountSession,
  loginEmail,
  passwordErrorMessage,
} from "../lib/account-auth";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppProvider";
import AppleSignIn from "./apple-sign-in";
import { signInWithApple } from "../lib/apple-auth";
import {
  appleSignInErrorMessage,
  isAppleSignInCancelled,
} from "../lib/apple-auth-flow";

export default function AccountPrompt({
  prompt = "Sign in to write reviews and add items to your food log.",
  inSheet = false,
}: {
  prompt?: string;
  inSheet?: boolean;
}) {
  const { colors, s } = useTheme();
  const { signingOut } = useApp();
  const [message, setMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"apple" | "password" | null>(null);
  const pending = useRef(false);
  async function signIn(method: "apple" | "password") {
    if (pending.current || signingOut) return;
    if (method === "password" && (!username.trim() || !password)) {
      setMessage("Enter your username and password.");
      return;
    }
    pending.current = true;
    setBusy(method);
    setMessage("");
    try {
      if (method === "apple") {
        await signInWithApple();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail(username),
          password,
        });
        if (error) throw error;
        if (!accountSession(data.session))
          throw new Error("Missing account session");
        setPassword("");
      }
    } catch (error) {
      if (method === "password") setMessage(passwordErrorMessage(error));
      else if (!isAppleSignInCancelled(error))
        setMessage(appleSignInErrorMessage(error));
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={
        inSheet
          ? {
              flexGrow: 1,
              justifyContent: "center",
              paddingTop: 32,
              paddingBottom: 24,
            }
          : { paddingBottom: 45 }
      }
    >
      {!inSheet && <BackHeader />}
      <View style={[s.inset, { gap: 20 }]}>
        <View style={{ alignItems: "center" }}>
          <Art name="ratings/bucky-5-star" size={inSheet ? 88 : 112} />
          <T
            style={{
              fontSize: 31,
              lineHeight: 38,
              letterSpacing: -0.8,
              fontWeight: "700",
              textAlign: "center",
              marginTop: inSheet ? 12 : 20,
            }}
          >
            Your Bucky’s Bites
          </T>
          <T style={[s.body, { textAlign: "center", marginTop: 10 }]}>
            {signingOut ? "Finishing sign-out…" : prompt}
          </T>
        </View>
        <AppleSignIn
          disabled={busy !== null || signingOut}
          busy={busy === "apple"}
          onPress={() => signIn("apple")}
        />
        {showPasswordForm ? (
          <View style={{ gap: 12 }}>
            <Input
              accessibilityLabel="Username or email"
              placeholder="Username or email"
              value={username}
              onChangeText={setUsername}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
            />
            <Input
              accessibilityLabel="Password"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={() => signIn("password")}
            />
            <Button
              title={busy === "password" ? "Signing in…" : "Sign in"}
              onPress={() => signIn("password")}
              disabled={busy !== null || signingOut}
            />
          </View>
        ) : (
          <Button
            secondary
            title="Sign in with username and password"
            disabled={busy !== null || signingOut}
            onPress={() => {
              setMessage("");
              setShowPasswordForm(true);
            }}
          />
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
