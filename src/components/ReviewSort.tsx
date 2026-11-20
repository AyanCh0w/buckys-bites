import { StyleSheet, View } from "react-native";
import ChoiceMenu from "./ChoiceMenu";
import Segments from "./Segments";
import { Glass } from "./ui";
import type { FeedMode, TopPeriod } from "../lib/discovery";

const feedModes: FeedMode[] = ["Top", "For You", "New"];
const topPeriods: TopPeriod[] = ["Day", "Week", "All time"];
const periodOptions = topPeriods.map((value) => ({ value, label: value }));

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
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
      }}
    >
      <View style={{ flex: 1 }}>
        <Segments
          values={feedModes}
          value={mode}
          onChange={(value) => onMode(value as FeedMode)}
        />
      </View>
      <View
        style={{
          minHeight: 44,
          minWidth: 44,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 4,
        }}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { justifyContent: "center" }]}
        >
          <Glass style={{ height: 32, borderRadius: 16 }} />
        </View>
        <ChoiceMenu
          label={period}
          accessibilityLabel={`Top timeframe, ${period}`}
          selected={period}
          options={periodOptions}
          onSelect={(value) => {
            onPeriod(value as TopPeriod);
            onMode("Top");
          }}
        />
      </View>
    </View>
  );
}
