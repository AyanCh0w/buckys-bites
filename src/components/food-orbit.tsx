import React, { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useTheme } from "../state/ThemeProvider";
import { Art } from "./ui";

const dishes = [
  "signature-smash-burger",
  "build-your-own-acai-bowl",
  "teriyaki-chicken-bowl",
  "chicken-supreme-pizza",
  "build-your-own-salad",
  "chocolate-chip-cookie",
];
const easeOut = Easing.bezierFn(0.23, 1, 0.32, 1);
const reviewFaces = [1, 2, 3, 4, 5];

function OrbitDish({
  dish,
  index,
  size,
  rotation,
  entrance,
}: {
  dish: string;
  index: number;
  size: number;
  rotation: SharedValue<number>;
  entrance: SharedValue<number>;
}) {
  const foodSize = size * 0.29;
  const style = useAnimatedStyle(() => {
    const progress = easeOut(
      Math.max(0, Math.min(1, (entrance.get() * 1125 - index * 105) / 600)),
    );
    const angle = ((index * 60 - 105 + rotation.get()) * Math.PI) / 180;
    // Move the center around the ring without rotating the artwork itself.
    return {
      opacity: progress,
      transform: [
        {
          translateX:
            Math.cos(angle) * size * 0.34 +
            (index % 2 ? 350 : -350) * (1 - progress),
        },
        { translateY: Math.sin(angle) * size * 0.34 },
        { scale: 0.92 + progress * 0.08 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: (size - foodSize) / 2,
          top: (size - foodSize) / 2,
          width: foodSize,
          height: foodSize,
        },
        style,
      ]}
    >
      <Art name={`dishes/${dish}`} size={foodSize} />
    </Animated.View>
  );
}

export function FoodOrbit() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [face, setFace] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const size = Math.min(width - 48, 360);
  const buckySize = size * 0.32;
  const rotation = useSharedValue(0);
  const lastAngle = useSharedValue(0);
  const outsideCenter = useSharedValue(false);
  const entrance = useSharedValue(reduced ? 1 : 0);
  const buckyScale = useSharedValue(1);

  useEffect(() => {
    entrance.set(
      reduced ? 1 : withTiming(1, { duration: 1125, easing: Easing.linear }),
    );
    return () => {
      cancelAnimation(entrance);
      cancelAnimation(rotation);
    };
  }, [entrance, reduced, rotation]);

  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    onBegin: (event) => {
      cancelAnimation(rotation);
      // Catch the ring immediately, including during its initial fly-in.
      entrance.set(
        reduced ? 1 : withTiming(1, { duration: 150, easing: easeOut }),
      );
      const x = event.x - size / 2;
      const y = event.y - size / 2;
      lastAngle.set(Math.atan2(y, x));
      outsideCenter.set(x * x + y * y >= (size * 0.15) ** 2);
    },
    onUpdate: (event) => {
      const x = event.x - size / 2;
      const y = event.y - size / 2;
      const angle = Math.atan2(y, x);
      const outside = x * x + y * y >= (size * 0.15) ** 2;
      if (outside && outsideCenter.get()) {
        const delta = angle - lastAngle.get();
        // Unwrap the angle so crossing the left edge never jumps a full turn.
        rotation.set(
          rotation.get() +
            (Math.atan2(Math.sin(delta), Math.cos(delta)) * 180) / Math.PI,
        );
      }
      lastAngle.set(angle);
      outsideCenter.set(outside);
    },
    onDeactivate: (event) => {
      if (event.canceled || reduced || !outsideCenter.get()) return;
      const x = event.x - size / 2;
      const y = event.y - size / 2;
      // Project the release velocity onto the circle's tangent (degrees/second).
      const velocity =
        ((x * event.velocityY - y * event.velocityX) /
          Math.max(x * x + y * y, (size * 0.15) ** 2)) *
        (180 / Math.PI);
      rotation.set(
        withDecay({ velocity: Math.max(-720, Math.min(720, velocity)) }),
      );
    },
  });

  const buckyStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, (entrance.get() - 0.7) / 0.3)),
  }));
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buckyScale.get() }],
  }));

  const turn = (direction: number) => {
    cancelAnimation(rotation);
    entrance.set(1);
    const next = rotation.get() + direction * 60;
    rotation.set(
      reduced ? next : withTiming(next, { duration: 200, easing: easeOut }),
    );
  };

  return (
    <View style={{ alignSelf: "center", width: size, height: size }}>
      <GestureDetector gesture={pan} touchAction="none">
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Spin six campus dishes around Bucky"
          accessibilityHint="Drag around the circle to spin. Swipe up or down to rotate one dish."
          accessibilityActions={[
            { name: "increment", label: "Spin clockwise" },
            { name: "decrement", label: "Spin counterclockwise" },
          ]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === "increment") turn(1);
            if (nativeEvent.actionName === "decrement") turn(-1);
          }}
          style={{ width: size, height: size }}
        >
          <View
            pointerEvents="none"
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <View
              style={{
                position: "absolute",
                width: size * 0.87,
                height: size * 0.87,
                backgroundColor: colors.ivory,
                borderRadius: size,
              }}
            />
            <View
              style={{
                position: "absolute",
                width: size * 0.68,
                height: size * 0.68,
                borderWidth: 1,
                borderColor: colors.accent + "20",
                borderRadius: size,
              }}
            />
            {dishes.map((dish, index) => (
              <OrbitDish
                key={dish}
                dish={dish}
                index={index}
                size={size}
                rotation={rotation}
                entrance={entrance}
              />
            ))}
          </View>
        </View>
      </GestureDetector>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: (size - buckySize) / 2,
            left: (size - buckySize) / 2,
          },
          buckyStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change Bucky’s expression"
          onPressIn={() => {
            if (!reduced)
              buckyScale.set(
                withTiming(0.82, { duration: 100, easing: easeOut }),
              );
          }}
          onPressOut={() => {
            if (!reduced)
              buckyScale.set(
                withSequence(
                  withTiming(1.14, { duration: 120, easing: easeOut }),
                  withSpring(1, { mass: 0.8, stiffness: 360, damping: 13 }),
                ),
              );
          }}
          onPress={() => {
            const choices = reviewFaces.filter((score) => score !== face);
            setFace(choices[Math.floor(Math.random() * choices.length)]);
          }}
        >
          <Animated.View style={faceStyle}>
            <Art
              name={
                face === null
                  ? "icons/bucky-classic"
                  : `ratings/bucky-${face}-star`
              }
              size={buckySize}
            />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
