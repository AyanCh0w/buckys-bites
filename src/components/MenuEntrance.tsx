import type { ViewProps } from "react-native";
import { useIsFocused } from "expo-router";
import Animated, {
  cubicBezier,
  useReducedMotion,
} from "react-native-reanimated";

// Flip this to false to disable the menu-motion experiment in one place.
const MENU_ENTRANCE_ENABLED = false;
const STAGGER_MS = 30;
const MAX_DELAY_MS = 120;

export function MenuEntrance({
  sequence = 0,
  style,
  ...props
}: ViewProps & { sequence?: number }) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();

  return (
    <Animated.View
      {...props}
      style={[
        style,
        // Tabs can mount offscreen; start the sequence when this screen is shown.
        MENU_ENTRANCE_ENABLED &&
          focused && {
            animationName: reduced
              ? { from: { opacity: 0 }, to: { opacity: 1 } }
              : {
                  from: { opacity: 0, transform: [{ scale: 0.98 }] },
                  to: { opacity: 1, transform: [{ scale: 1 }] },
                },
            animationDuration: reduced ? 100 : 140,
            // Keep even long menus fully visible within 260 ms.
            animationDelay: reduced
              ? 0
              : Math.min(sequence * STAGGER_MS, MAX_DELAY_MS),
            animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
            animationFillMode: "backwards",
            transformOrigin: "top center",
          },
      ]}
    />
  );
}
