import React, { createContext, use, useEffect, useMemo } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors } from "../lib/theme";
import { createThemeStyles } from "../lib/styles";

const themes = {
  light: { colors: lightColors, s: createThemeStyles(lightColors) },
  dark: { colors: darkColors, s: createThemeStyles(darkColors) },
};
type ThemeContextValue = (typeof themes)["light"] & {
  scheme: "light" | "dark";
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  useEffect(() => {
    // Clear overrides from earlier versions and follow subsequent system changes.
    if (Platform.OS !== "web") Appearance.setColorScheme("auto");
    void AsyncStorage.removeItem("buckys-bites:appearance:v1").catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.style.colorScheme = scheme;
      document.body.style.backgroundColor = themes[scheme].colors.canvas;
    }
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...themes[scheme], scheme }),
    [scheme],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const theme = use(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}
