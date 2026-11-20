import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../state/ThemeProvider";

export function ScrollEdgeFade({
  edge,
  id,
  length = 12,
  inline = false,
}: {
  edge: "top" | "bottom";
  id: string;
  length?: number;
  inline?: boolean;
}) {
  const { colors } = useTheme();
  const reversed = edge === "bottom";
  return (
    <View
      pointerEvents="none"
      style={
        inline
          ? { height: length, flexShrink: 0, marginBottom: -length, zIndex: 1 }
          : [
              StyleSheet.absoluteFill,
              reversed ? { top: -length } : { bottom: -length },
            ]
      }
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient
            id={id}
            x2="0%"
            y1={reversed ? "100%" : "0%"}
            y2={reversed ? "0%" : "100%"}
          >
            <Stop offset="0%" stopColor={colors.paper} />
            <Stop
              offset="65%"
              stopColor={colors.paper}
              stopOpacity={inline ? 0.35 : 0.9}
            />
            <Stop offset="100%" stopColor={colors.paper} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function ScrollUnderBar({
  bar,
  children,
  edge = "top",
  fadeId,
  initialInset = 0,
}: {
  bar: ReactNode;
  children: (inset: number) => ReactNode;
  edge?: "top" | "bottom";
  fadeId: string;
  initialInset?: number;
}) {
  const [barHeight, setBarHeight] = useState(initialInset);
  return (
    <View style={{ flex: 1 }}>
      {children(bar ? barHeight : 0)}
      {bar && (
        <View
          pointerEvents="box-none"
          onLayout={({ nativeEvent }) =>
            setBarHeight(nativeEvent.layout.height)
          }
          style={{ position: "absolute", [edge]: 0, left: 0, right: 0 }}
        >
          <ScrollEdgeFade edge={edge} id={fadeId} />
          {bar}
        </View>
      )}
    </View>
  );
}
