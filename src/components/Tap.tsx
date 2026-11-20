import React, { useState } from "react";
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cubicBezier,
  useReducedMotion,
} from "react-native-reanimated";
import { useTheme } from "../state/ThemeProvider";
import { useHaptic, type HapticCue } from "../lib/haptics";

const contentPadding = {
  card: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  none: undefined,
} satisfies Record<string, ViewStyle | undefined>;

export function Tap({
  children,
  style,
  accessibilityLabel,
  feedback = "highlight",
  haptic = "tap",
  onPress,
  highlightRadius = 16,
  padding = "card",
  contentStyle,
  ...props
}: PressableProps & {
  feedback?: "highlight" | "scale";
  /** Use false when the action handler supplies feedback at the state change. */
  haptic?: HapticCue | false;
  highlightRadius?: number;
  /** Unboxed content uses card/row spacing. Use none for an already padded control. */
  padding?: keyof typeof contentPadding;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const playHaptic = useHaptic();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  return (
    <Pressable
      {...props}
      onPress={
        onPress &&
        ((event) => {
          if (props.disabled) return;
          if (haptic) playHaptic(haptic);
          onPress(event);
        })
      }
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={props.accessibilityRole ?? "button"}
      onPressIn={(e) => {
        setPressed(true);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        props.onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        // Touch must not leave a sticky hover highlight after a tap.
        if (
          Platform.OS !== "web" ||
          window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          setHovered(true);
        props.onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        props.onHoverOut?.(e);
      }}
      pressRetentionOffset={16}
      style={(state) => [
        { borderRadius: highlightRadius, borderCurve: "continuous" },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Animated.View
        style={[
          contentPadding[padding],
          contentStyle,
          {
            opacity: props.disabled
              ? 0.45
              : pressed && feedback === "scale"
                ? 0.78
                : 1,
            transform: [
              { scale: pressed && !reduced && feedback === "scale" ? 0.97 : 1 },
            ],
            transitionProperty: ["transform", "opacity"],
            transitionDuration: reduced ? 0 : 120,
            transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
          },
        ]}
      >
        {typeof children === "function"
          ? children({ pressed, hovered })
          : children}
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: highlightRadius,
            borderCurve: "continuous",
            backgroundColor: colors.ink,
            opacity: props.disabled
              ? 0
              : pressed && feedback === "highlight"
                ? 0.065
                : hovered
                  ? 0.035
                  : 0,
            transitionProperty: "opacity",
            transitionDuration: reduced ? 0 : pressed ? 80 : 120,
            transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
