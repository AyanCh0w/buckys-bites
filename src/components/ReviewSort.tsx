import { useTheme } from "../state/ThemeProvider";
import { View } from "react-native";
import { T, Tap } from "./ui";
import ChoiceMenu from "./ChoiceMenu";
import type { FeedMode, TopPeriod } from "../lib/discovery";

export function ReviewSort({
  mode,
  period,
  onMode,
  onPeriod,
}: {
  mode: FeedMode;
  period: TopPeriod;
  onMode: (mode: FeedMode) => void;
  onPeriod: (period: TopPeriod) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 12,
        padding: 3,
        backgroundColor: colors.canvas,
        gap: 2,
      }}
    >
      <View
        style={{
          flex: 1.3,
          borderRadius: 9,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mode === "Top" ? colors.selected : "transparent",
          boxShadow: mode === "Top" ? "0 1px 4px #0001" : undefined,
        }}
      >
        <Tap
          padding="none"
          highlightRadius={9}
          accessibilityRole="tab"
          accessibilityLabel="Top"
          accessibilityState={{ selected: mode === "Top" }}
          onPress={() => onMode("Top")}
        >
          <View
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            <T style={{ fontSize: 13, fontWeight: "600" }}>Top</T>
          </View>
        </Tap>
        <ChoiceMenu
          label={period}
          accessibilityLabel={`Top timeframe, ${period}`}
          selected={period}
          options={["Day", "Week", "All time"].map((value) => ({
            value,
            label: value,
          }))}
          onSelect={(value) => {
            onPeriod(value as TopPeriod);
            onMode("Top");
          }}
        />
      </View>
      {(["For You", "New"] as const).map((value) => (
        <Tap
          key={value}
          padding="none"
          highlightRadius={9}
          style={{ flex: 1 }}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === value }}
          onPress={() => onMode(value)}
        >
          <View
            style={{
              minHeight: 44,
              paddingHorizontal: 8,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 9,
              backgroundColor: mode === value ? colors.selected : "transparent",
              boxShadow: mode === value ? "0 1px 4px #0001" : undefined,
            }}
          >
            <T
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: mode === value ? colors.ink : colors.muted,
              }}
            >
              {value}
            </T>
          </View>
        </Tap>
      ))}
    </View>
  );
}
