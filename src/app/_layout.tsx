import { useTheme } from "../state/ThemeProvider";
import React from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import {
  usePathname,
  ThemeProvider as NavigationThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useReducedMotion } from "react-native-reanimated";
import { AppProvider, useApp } from "../state/AppProvider";
import { fontAssets } from "../lib/fonts";
import { BAKERY_KEY } from "../lib/menu";
import { ToastHost } from "../components/ui";
import { ThemeProvider } from "../state/ThemeProvider";
import Stack from "../components/navigation-stack";
import { GoalEstimateDraftProvider } from "../state/GoalEstimateDraftProvider";
export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}
function ThemedRoot() {
  const { colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <AppProvider>
          <GoalEstimateDraftProvider>
            <AppShell />
          </GoalEstimateDraftProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
function AppShell() {
  const bakeryMenu = usePathname() === `/kitchen/${BAKERY_KEY}`;
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const { ready, userId, session, profileStatus, introComplete } = useApp();
  const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.paper,
      card: colors.surface,
      text: colors.ink,
      border: colors.rule,
      notification: colors.accent,
    },
  };
  if (
    !ready ||
    introComplete === null ||
    (introComplete && userId && profileStatus === "loading")
  )
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: colors.paper,
        }}
      >
        <ActivityIndicator
          accessibilityLabel="Loading account"
          color={colors.accent}
        />
      </View>
    );
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth:
            Platform.OS === "web" ? (bakeryMenu ? 720 : 520) : undefined,
          alignSelf: "center",
          backgroundColor: colors.paper,
          overflow: "hidden",
          ...(Platform.OS === "web"
            ? { boxShadow: "0 0 70px rgba(35,45,30,0.07)" }
            : {}),
        }}
      >
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            ...(Platform.OS === "web" && {
              cardStyle: { backgroundColor: colors.paper },
            }),
            animation: reduced ? "fade" : "default",
            gestureEnabled: true,
          }}
        >
          <Stack.Protected guard={introComplete && Boolean(userId)}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="dish/[id]" />
            <Stack.Screen name="component/[id]" />
            <Stack.Screen
              name="log"
              options={{
                presentation: Platform.OS === "web" ? "modal" : "formSheet",
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.85, 1],
                sheetCornerRadius: 32,
              }}
            />
            <Stack.Screen
              name="review"
              options={({ route }) => ({
                presentation: "modal",
                // Changing an iOS modal's header visibility remounts its form.
                // Configure it here, before the review screen first renders.
                headerShown: Platform.OS === "ios",
                title: (route.params as { edit?: string } | undefined)?.edit
                  ? "Edit review"
                  : "Review dish",
                headerBackButtonDisplayMode: "minimal",
                headerShadowVisible: false,
                headerTintColor: colors.ink,
                headerTitleStyle: {
                  fontFamily: "BDOGrotesk-Bold",
                  fontSize: 28,
                },
              })}
            />
            <Stack.Screen
              name="settings"
              options={{
                presentation: "card",
                animation: reduced ? "fade" : "slide_from_right",
                animationMatchesGesture: true,
              }}
            />
            <Stack.Screen
              name="goal-estimate"
              options={{
                presentation: "card",
                animation: reduced ? "fade" : "slide_from_right",
                animationMatchesGesture: true,
              }}
            />
            <Stack.Screen name="kitchen/[key]" />
            <Stack.Screen name="dish-info" />
            <Stack.Screen name="food-history" />
            <Stack.Screen name="nutrients" />
          </Stack.Protected>
          <Stack.Protected guard={introComplete && !session}>
            <Stack.Screen name="auth" />
          </Stack.Protected>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        </Stack>
        <ToastHost />
      </View>
    </NavigationThemeProvider>
  );
}
