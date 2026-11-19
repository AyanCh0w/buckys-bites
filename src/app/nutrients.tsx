import { totalIncludesEstimate } from "../lib/nutrition-display";
import { useTheme } from "../state/ThemeProvider";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Art, FixedScreen, T } from "../components/ui";
import { NutrientAmount } from "../components/nutrient-display";
import { isDailyLimit } from "../lib/nutrition-goals";
import { useApp } from "../state/AppProvider";
import {
  campusDate,
  dateLabel,
  formatAmount,
  NUTRIENTS,
  nutritionTotals,
} from "../lib/domain";

export default function Nutrients() {
  const { colors, s } = useTheme();
  const { date = campusDate() } = useLocalSearchParams<{ date?: string }>();
  const { data } = useApp();
  const logs = data.logs.filter((l) => l.local_date === date);
  const totals = nutritionTotals(logs);
  return (
    <FixedScreen back title="All Nutrients">
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[s.inset, { paddingBottom: 24 }]}
      >
        <T style={[s.caption, { marginBottom: 12 }]}>
          {dateLabel(date, { weekday: "long", month: "short", day: "numeric" })}
        </T>
        {NUTRIENTS.map((n) => (
          <View key={n.key} style={[s.row, { paddingVertical: 13 }]}>
            <View style={s.between}>
              <Art name={`icons/${n.icon}`} size={32} />
              <T style={{ fontSize: 17, flex: 1, marginLeft: 12 }}>{n.label}</T>
              <NutrientAmount
                value={formatAmount(
                  totals[n.key].value,
                  1,
                  totalIncludesEstimate(logs, n),
                )}
                unit={n.unit}
              />
            </View>
            {data.profile.goals[n.key] && (
              <T style={s.caption}>
                {isDailyLimit(n.key) ? "Personal limit" : "Personal target"}:{" "}
                {data.profile.goals[n.key]} {n.unit}
                {isDailyLimit(n.key) &&
                totals[n.key].value > data.profile.goals[n.key]!
                  ? " · Above limit"
                  : ""}
              </T>
            )}
            {totals[n.key].missing > 0 && (
              <T style={{ fontSize: 11, color: colors.muted }}>
                Partial · {totals[n.key].missing} missing values
              </T>
            )}
          </View>
        ))}
      </ScrollView>
    </FixedScreen>
  );
}
