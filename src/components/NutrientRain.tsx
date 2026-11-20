import { memo, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  View,
  useWindowDimensions,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { Art } from "./ui";
import {
  createNutrientDrops,
  NUTRIENT_RAIN_DURATION_MS,
} from "../lib/nutrient-rain";

function transform(x: number, y: number, angle: number) {
  return [
    { translateX: x },
    { translateY: y },
    { rotate: `${angle}deg` as const },
  ];
}

export const NutrientRain = memo(function NutrientRain({
  icons,
}: {
  icons: string[];
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [drops, setDrops] = useState<ReturnType<typeof createNutrientDrops>>(
    [],
  );

  useEffect(() => {
    let active = true;
    // Read the current preference for each add, including changes since launch.
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active || reduced || !icons.length) return;
        setDrops(createNutrientDrops(icons));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [icons]);

  useEffect(() => {
    if (!drops.length) return;
    const timer = setTimeout(() => setDrops([]), NUTRIENT_RAIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [drops]);

  if (!drops.length) return null;
  const depth = Math.max(0, height - insets.top - insets.bottom);
  const rain = (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{
        position: "absolute",
        top: insets.top,
        alignSelf: "center",
        width: "100%",
        maxWidth: 600,
        height: depth,
        overflow: "hidden",
      }}
    >
      {drops.map((drop, i) => {
        const { angle, spin, sway, drift } = drop;
        const fall = Math.max(0, depth - drop.size) * drop.depth;
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: `${drop.left}%`,
              marginLeft: -drop.size / 2,
              opacity: 0,
              animationName: {
                from: {
                  opacity: 0,
                  transform: transform(0, -drop.size, angle),
                },
                "14%": { opacity: 0.95 },
                "40%": {
                  transform: transform(
                    drift * 0.4 + sway,
                    fall * 0.26,
                    angle + spin * 0.36,
                  ),
                },
                "72%": {
                  transform: transform(
                    drift * 0.72 + sway * 0.45,
                    fall * 0.6,
                    angle + spin * 0.73,
                  ),
                },
                "82%": { opacity: 0.9 },
                to: {
                  opacity: 0,
                  transform: transform(drift - sway * 0.4, fall, angle + spin),
                },
              },
              animationDuration: drop.duration,
              animationDelay: drop.delay,
              animationTimingFunction: "linear",
              animationFillMode: "both",
            }}
          >
            <Art name={`icons/${drop.icon}`} size={drop.size} />
          </Animated.View>
        );
      })}
    </View>
  );
  // A native form sheet may still be dismissing when the save completes.
  return Platform.OS === "ios" ? (
    <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>
      {rain}
    </FullWindowOverlay>
  ) : (
    rain
  );
});
