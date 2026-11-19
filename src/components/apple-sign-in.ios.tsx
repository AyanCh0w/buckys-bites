import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useTheme } from "../state/ThemeProvider";
import { T } from "./ui";
import type { AppleSignInProps } from "./apple-sign-in.types";

export default function AppleSignIn({
  disabled,
  busy,
  onPress,
}: AppleSignInProps) {
  const { colors, scheme, s } = useTheme();
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AppleAuthentication.isAvailableAsync().then(
      (value) => {
        if (active) setAvailable(value);
      },
      () => {
        if (active) setAvailable(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  if (available === null) {
    return (
      <ActivityIndicator
        color={colors.accent}
        accessibilityLabel="Checking Sign in with Apple availability"
      />
    );
  }
  if (!available) {
    return (
      <T style={[s.body, { textAlign: "center" }]}>
        Sign in with Apple is not available on this device.
      </T>
    );
  }
  return (
    <View style={{ gap: 16 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          scheme === "dark"
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={26}
        style={{ width: "100%", height: 52, opacity: disabled ? 0.55 : 1 }}
        pointerEvents={disabled ? "none" : "auto"}
        accessibilityState={{ disabled, busy }}
        onPress={() => {
          if (!disabled) onPress();
        }}
      />
      {busy && (
        <ActivityIndicator
          color={colors.accent}
          accessibilityLabel="Signing in with Apple"
        />
      )}
    </View>
  );
}
