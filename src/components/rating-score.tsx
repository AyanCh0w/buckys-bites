import { Text, View } from "react-native";
import { secondaryFont } from "../lib/fonts";
import { useTheme } from "../state/ThemeProvider";
import { Art } from "./ui";

function RatingIcon({ value, size }: { value: number; size: number }) {
  return (
    <Art
      name={`ratings/bucky-${Math.max(0, Math.min(5, Math.round(value)))}-star`}
      size={size}
    />
  );
}

export function RatingBadge({ value, size }: { value: number; size: number }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={{
        position: "absolute",
        top: 2,
        right: 2,
        padding: 2,
        borderRadius: 100,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.rule,
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      <RatingIcon value={value} size={size} />
    </View>
  );
}

export function RatingScore({
  value,
  size = 32,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label ?? value} out of 5`}
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <RatingIcon value={value} size={size} />
      <Text
        style={{
          fontFamily: secondaryFont,
          fontSize: size,
          lineHeight: size * 1.15,
          color: colors.ink,
          fontVariant: ["tabular-nums"],
        }}
      >
        {label ?? value}
      </Text>
    </View>
  );
}
