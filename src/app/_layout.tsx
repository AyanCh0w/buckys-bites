import { useTheme } from "../state/ThemeProvider";
import React, { useState } from "react";
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
import {
  BakeryThumbnailProvider,
  useBakeryThumbnails,
} from "../components/bakery-thumbnail";
import { ToastHost } from "../components/ui";
import { NutrientRain } from "../components/NutrientRain";
import { ThemeProvider } from "../state/ThemeProvider";
import Stack from "../components/navigation-stack";
import { GoalEstimateDraftProvider } from "../state/GoalEstimateDraftProvider";

function detailOptions({ route }: { route: { params?: object } }) {
  const modal =
    (route.params as { presentation?: string } | undefined)?.presentation ===
    "modal";
  return {
    presentation: modal ? "modal" : "card",
    headerShown: Platform.OS === "ios",
  } as const;
}
export default function RootLayout() {
  return (
    <ThemeProvider>
      <BakeryThumbnailProvider>
        <ThemedRoot />
      </BakeryThumbnailProvider>
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
  const pathname = usePathname();
  const bakeryPath = `/kitchen/${BAKERY_KEY}`;
  const bakeryMenu =
    pathname === bakeryPath || pathname.startsWith(`${bakeryPath}/`);
  const [opensOnMenu] = useState(pathname === "/menu" || bakeryMenu);
  const { pending: thumbnailsPending } = useBakeryThumbnails();
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const { ready, session, introComplete, toast } = useApp();
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
  if (!ready || introComplete === null || (opensOnMenu && thumbnailsPending))
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
          <Stack.Protected guard={introComplete}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="dish/[id]" options={detailOptions} />
            <Stack.Screen name="component/[id]" options={detailOptions} />
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
            <Stack.Screen name="kitchen/[key]/[category]" />
            <Stack.Screen name="cafe/[key]/[category]" />
            <Stack.Screen name="dish-info" />
            <Stack.Screen name="food-history" />
            <Stack.Screen name="nutrients" />
            <Stack.Screen
              name="log"
              options={({ route }) => ({
                // A multi-detent sheet resizes its first scroll view to the
                // whole sheet during a swipe, covering a sibling action bar.
                presentation:
                  Platform.OS === "web" ||
                  (session &&
                    (route.params as { offering?: string } | undefined)
                      ?.offering)
                    ? "modal"
                    : "formSheet",
                headerShown: Platform.OS === "ios" && Boolean(session),
                title: (route.params as { edit?: string } | undefined)?.edit
                  ? "Edit Your Food"
                  : "A Bite for Your Day",
                headerBackButtonDisplayMode: "minimal",
                headerShadowVisible: false,
                headerTintColor: colors.ink,
                headerTitleStyle: {
                  fontFamily: "BDOGrotesk-Bold",
                  fontSize: 28,
                },
                sheetGrabberVisible: true,
                sheetAllowedDetents: [
                  Platform.OS === "ios" && !session ? 0.5 : 0.85,
                  1,
                ],
                sheetCornerRadius: 32,
              })}
            />
            <Stack.Screen name="auth" />
          </Stack.Protected>
          <Stack.Protected guard={introComplete && Boolean(session)}>
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
          </Stack.Protected>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        </Stack>
        {toast?.nutrientRain?.icons.length ? (
          <NutrientRain
            key={toast.nutrientRain.logId}
            icons={toast.nutrientRain.icons}
          />
        ) : null}
        <ToastHost />
      </View>
    </NavigationThemeProvider>
  );
}
