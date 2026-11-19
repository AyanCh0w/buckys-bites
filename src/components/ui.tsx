import { useTheme } from "../state/ThemeProvider";
import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView as NativeSafeAreaView } from "react-native-screens/experimental";
import { router, Stack } from "expo-router";
import NativeSegments from "./Segments";
import { Tap } from "./Tap";
export { Tap } from "./Tap";
export { Input } from "./input";

import { assets } from "../data/assets";
import { useApp } from "../state/AppProvider";
import { campusDate, dateLabel, shiftDate } from "../lib/domain";
import { fontFamily, secondaryFont, textSize } from "../lib/fonts";

export function T({
  style,
  numeric = false,
  ...props
}: TextProps & { numeric?: boolean }) {
  const { s } = useTheme();
  const flat = StyleSheet.flatten(style);
  const size = textSize(flat?.fontSize);
  return (
    <Text
      {...props}
      style={[
        s.text,
        style,
        {
          fontFamily:
            numeric || size === 14
              ? secondaryFont
              : fontFamily(flat?.fontWeight),
          fontWeight: "normal",
          fontSize: size,
          lineHeight: size === 14 ? 20 : size === 17 ? 24 : 34,
        },
      ]}
    />
  );
}
export function Icon({
  name,
  sf,
  size = 22,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  sf?: string;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const symbol =
    sf ??
    (
      {
        "chevron-back": "chevron.left",
        "chevron-forward": "chevron.right",
        "chevron-down": "chevron.down",
        add: "plus",
        close: "xmark",
        bookmark: "bookmark.fill",
        "bookmark-outline": "bookmark",
        "time-outline": "clock",
        "calendar-outline": "calendar",
        "options-outline": "slider.horizontal.3",
        "arrow-forward": "arrow.right",
        "checkmark-circle": "checkmark.circle.fill",
        checkmark: "checkmark",
        star: "star.fill",
        "restaurant-outline": "fork.knife",
        "chatbubbles-outline": "bubble.left.and.bubble.right",
        "keypad-outline": "keyboard.chevron.compact.down",
        "ellipsis-horizontal": "ellipsis",
        "alert-circle-outline": "exclamationmark.circle",
        "open-outline": "arrow.up.right.square",
        "create-outline": "square.and.pencil",
        "arrow-up": "arrow.up",
        "arrow-down": "arrow.down",
        "thumbs-up-outline": "hand.thumbsup",
        "thumbs-down-outline": "hand.thumbsdown",
        "trash-outline": "trash",
        "flag-outline": "flag",
        "heart-outline": "heart",
        "person-outline": "person",
        "settings-outline": "gearshape",
      } as Record<string, string>
    )[name];
  if (Platform.OS === "ios") {
    return symbol ? (
      <SymbolView
        name={symbol as any}
        size={size}
        tintColor={color ?? colors.ink}
      />
    ) : null;
  }
  return <Ionicons name={name} size={size} color={color ?? colors.ink} />;
}
export function AssetImage({
  source,
  style,
  accessibilityLabel,
  fallback,
}: {
  source?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  fallback?: React.ReactNode;
}) {
  const { s } = useTheme();
  const [failedSource, setFailedSource] = useState<number>();

  if (source == null || failedSource === source) {
    if (fallback === null) return null;
    return (
      <View style={[style, { alignItems: "center", justifyContent: "center" }]}>
        {fallback ?? (
          <T
            style={[s.caption, { textAlign: "center" }]}
            accessibilityLabel={
              accessibilityLabel
                ? `${accessibilityLabel}. Image not found`
                : "Image not found"
            }
          >
            Image not found
          </T>
        )}
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={style as any}
      contentFit="contain"
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
      onError={() => setFailedSource(source)}
      onLoad={() => setFailedSource(undefined)}
    />
  );
}

export function Art({
  name,
  size = 44,
  style,
}: {
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <AssetImage
      source={name ? assets[name] : undefined}
      style={[{ width: size, height: size }, style]}
      fallback={
        name?.startsWith("ratings/") ? (
          <Icon name="star" size={size * 0.7} color={colors.accent} />
        ) : undefined
      }
    />
  );
}
export function Glass({
  children,
  style,
  interactive = false,
}: React.PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}>) {
  const { colors, scheme } = useTheme();
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setSolid);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setSolid,
    );
    return () => subscription.remove();
  }, []);
  if (
    !solid &&
    Platform.OS === "ios" &&
    isLiquidGlassAvailable() &&
    isGlassEffectAPIAvailable()
  )
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={scheme}
        isInteractive={interactive}
        style={style}
      >
        {children}
      </GlassView>
    );
  if (solid)
    return (
      <View style={[{ backgroundColor: colors.surface }, style]}>
        {children}
      </View>
    );
  return (
    <BlurView
      intensity={65}
      tint={
        scheme === "dark"
          ? "systemChromeMaterialDark"
          : "systemChromeMaterialLight"
      }
      style={[
        {
          backgroundColor: colors.glass,
          borderColor: colors.glassBorder,
          borderWidth: 1,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}
export function Button({
  title,
  onPress,
  secondary,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Icon>["name"];
}) {
  const { colors, s } = useTheme();
  return (
    <Tap
      feedback="scale"
      padding="none"
      highlightRadius={28}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={title}
    >
      <View
        style={[s.button, secondary && { backgroundColor: colors.accentLight }]}
      >
        {icon && (
          <Icon
            name={icon}
            color={secondary ? colors.accent : colors.onAccent}
            size={19}
          />
        )}
        <T style={[s.buttonText, secondary && { color: colors.accent }]}>
          {title}
        </T>
      </View>
    </Tap>
  );
}
export function IconButton({
  name,
  sf,
  label,
  onPress,
  color,
  glass = false,
}: {
  name: React.ComponentProps<typeof Icon>["name"];
  sf?: string;
  label: string;
  onPress: () => void;
  color?: string;
  glass?: boolean;
}) {
  const { s } = useTheme();
  const content = (
    <View style={s.iconButton}>
      <Icon name={name} sf={sf} color={color} />
    </View>
  );
  return (
    <Tap
      feedback="scale"
      padding="none"
      highlightRadius={24}
      onPress={onPress}
      accessibilityLabel={label}
    >
      {glass ? (
        <Glass style={{ borderRadius: 24 }} interactive>
          {content}
        </Glass>
      ) : (
        content
      )}
    </Tap>
  );
}
export function Page({
  children,
  title,
  subtitle,
  right,
  refreshControl,
}: React.PropsWithChildren<{
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  refreshControl?: React.ReactElement;
}>) {
  const { s } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={s.page}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop:
          Platform.OS === "web"
            ? 26
            : Platform.OS === "ios"
              ? 8
              : insets.top + 8,
        paddingBottom: Platform.OS === "web" ? 112 : 24,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {Boolean(title) && (
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            {Boolean(subtitle) && <T style={s.eyebrow}>{subtitle}</T>}
            <T accessibilityRole="header" style={s.title}>
              {title}
            </T>
          </View>
          {right}
        </View>
      )}
      {children}
    </ScrollView>
  );
}
export function SectionHeading({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail?: string;
  onPress?: () => void;
}) {
  const { colors, s } = useTheme();
  return (
    <View style={s.sectionHeading}>
      <T accessibilityRole="header" style={s.sectionTitle}>
        {title}
      </T>
      {Boolean(detail) &&
        (onPress ? (
          <Tap onPress={onPress}>
            <View style={s.inline}>
              <T style={s.link}>{detail}</T>
              <Icon name="chevron-forward" size={14} color={colors.accent} />
            </View>
          </Tap>
        ) : (
          <T style={s.caption}>{detail}</T>
        ))}
    </View>
  );
}
export function Chip({
  title,
  selected,
  onPress,
  icon,
  disabled = false,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
}) {
  const { colors, s } = useTheme();
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      padding="none"
      highlightRadius={24}
      accessibilityState={{ selected, disabled }}
    >
      <View
        style={[
          s.chip,
          selected && {
            backgroundColor: colors.action,
            borderColor: colors.action,
          },
        ]}
      >
        {icon && <Art name={`icons/${icon}`} size={22} />}
        <T style={[s.chipText, selected && { color: colors.onAccent }]}>
          {title}
        </T>
      </View>
    </Tap>
  );
}
export const Segments = NativeSegments;
export function DateNav({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const { colors, s } = useTheme();
  return (
    <View style={[s.dateNav, compact && { marginVertical: 4 }]}>
      <IconButton
        name="chevron-back"
        label="Previous day"
        onPress={() => onChange(shiftDate(value, -1))}
      />
      <Tap onPress={() => onChange(campusDate())}>
        <View style={s.inline}>
          <Icon
            name="calendar-outline"
            sf="calendar"
            size={17}
            color={colors.muted}
          />
          <T style={{ fontSize: 15, fontWeight: "600" }}>
            {value === campusDate() ? "Today, " : ""}
            {dateLabel(value, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </T>
        </View>
      </Tap>
      <IconButton
        name="chevron-forward"
        label="Next day"
        onPress={() => onChange(shiftDate(value, 1))}
      />
    </View>
  );
}
export function EmptyState({
  art = "no-meals-logged",
  title,
  text,
  action,
  onPress,
}: {
  art?: string;
  title: string;
  text: string;
  action?: string;
  onPress?: () => void;
}) {
  const { s } = useTheme();
  return (
    <View style={s.empty}>
      <Art name={`icons/${art}`} size={112} />
      <T style={s.emptyTitle}>{title}</T>
      <T style={s.emptyBody}>{text}</T>
      {action && onPress && (
        <Button secondary title={action} onPress={onPress} />
      )}
    </View>
  );
}
export function BackHeader({
  title,
  right,
}: {
  title?: string;
  right?: React.ReactNode;
}) {
  const { colors, s } = useTheme();
  const insets = useSafeAreaInsets();
  if (Platform.OS === "ios")
    return (
      <Stack.Screen
        options={{
          headerShown: true,
          title: title ?? "",
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: "BDOGrotesk-Bold", fontSize: 28 },
          headerRight: right ? () => right : undefined,
        }}
      />
    );
  return (
    <View
      style={[
        s.backHeader,
        { paddingTop: Platform.OS === "web" ? 12 : insets.top + 4 },
      ]}
    >
      <IconButton
        name="chevron-back"
        sf="chevron.left"
        label="Back"
        glass
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      />
      <T
        numberOfLines={1}
        style={{ fontWeight: "600", flex: 1, textAlign: "center" }}
      >
        {title}
      </T>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}
export function ToastHost() {
  const { colors, s } = useTheme();
  const { toast, dismissToast, notify } = useApp();
  const inset = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[
        s.toastPosition,
        { bottom: Platform.OS === "web" ? 96 : inset.bottom + 84 },
      ]}
    >
      <Glass style={s.toast}>
        <View style={s.inline}>
          <Icon name="checkmark-circle" color={colors.accent} size={22} />
          <T
            accessibilityRole="alert"
            style={{ flex: 1, fontSize: 14, fontWeight: "500" }}
          >
            {toast.message}
          </T>
          {toast.action && (
            <Tap
              onPress={async () => {
                try {
                  await toast.onAction?.();
                  dismissToast();
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <T style={s.link}>{toast.action}</T>
            </Tap>
          )}
          <Tap
            padding="none"
            contentStyle={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
            highlightRadius={22}
            accessibilityLabel="Dismiss notification"
            onPress={dismissToast}
          >
            <Icon name="close" size={18} color={colors.muted} />
          </Tap>
        </View>
      </Glass>
    </View>
  );
}

// Keep tab-bar clearance inside scroll content so the viewport reaches behind glass.
// iOS adds its native tab-bar inset through contentInsetAdjustmentBehavior.
export const tabContentBottomPadding =
  Platform.OS === "web" ? 118 : Platform.OS === "ios" ? 36 : 24;

export function FixedScreen({
  children,
  title,
  right,
  back = false,
  tab = false,
}: React.PropsWithChildren<{
  title: string;
  right?: React.ReactNode;
  back?: boolean;
  tab?: boolean;
}>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <NativeSafeAreaView
      // Floating tab bars overlay the scroll view; other screens keep their
      // native bottom inset for fixed footers.
      edges={{
        top: Platform.OS === "ios" && back,
        bottom: Platform.OS !== "web" && !(tab && Platform.OS === "ios"),
      }}
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        paddingTop: Platform.OS === "web" ? 12 : back ? 0 : insets.top + 4,
        paddingBottom: tab ? (Platform.OS === "android" ? 12 : 0) : 16,
      }}
    >
      {back && Platform.OS === "ios" ? (
        <Stack.Screen
          options={{
            headerShown: true,
            title,
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
            headerTintColor: colors.ink,
            headerTitleStyle: { fontFamily: "BDOGrotesk-Bold", fontSize: 28 },
            headerRight: right ? () => right : undefined,
          }}
        />
      ) : (
        <View
          style={{
            paddingHorizontal: back ? 14 : 24,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            minHeight: 54,
            paddingBottom: 8,
          }}
        >
          {back && (
            <IconButton
              name="chevron-back"
              sf="chevron.left"
              label="Back"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            />
          )}
          <T
            accessibilityRole={title ? "header" : undefined}
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: back ? 24 : 32,
              lineHeight: 39,
              letterSpacing: -0.8,
              fontWeight: "700",
            }}
          >
            {title}
          </T>
          {right}
        </View>
      )}
      {children}
    </NativeSafeAreaView>
  );
}
