import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../state/ThemeProvider";
import { T } from "./ui";

/** A compact food header shared by rating-only and written reviews. */
export function ReviewLayout({
  photo,
  framedPhoto = true,
  children,
}: {
  photo: ReactNode;
  framedPhoto?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 88,
          height: 88,
          flexShrink: 0,
          justifyContent: "center",
          ...(framedPhoto && {
            backgroundColor: colors.canvas,
            borderRadius: 14,
            borderCurve: "continuous",
            overflow: "hidden",
          }),
        }}
      >
        {photo}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{children}</View>
    </View>
  );
}

export function ReviewAuthor({
  avatar,
  name,
  time,
  trailing,
}: {
  avatar: ReactNode;
  name: string;
  time: string;
  trailing?: ReactNode;
}) {
  const { s } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {avatar}
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 8,
        }}
      >
        <T style={{ fontSize: 14, fontWeight: "600", flexShrink: 1 }}>{name}</T>
        <T style={s.caption}>{time}</T>
      </View>
      {trailing}
    </View>
  );
}
