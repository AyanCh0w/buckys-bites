import { useTheme } from "../state/ThemeProvider";
import { View } from "react-native";
import { Art, T } from "./ui";
import { NutrientAmount } from "./nutrient-display";
import {
  additionalNutrients,
  nutrientValue,
  type PublishedNutrition,
} from "../lib/nutrition-display";
export type { PublishedNutrition } from "../lib/nutrition-display";
import { NUTRIENTS } from "../lib/domain";

export function NutritionSummary({
  published,
  serving,
}: {
  published?: PublishedNutrition | null;
  serving?: string | null;
}) {
  const { colors, s } = useTheme();
  return (
    <View>
      {Boolean(serving) && (
        <T style={[s.caption, { marginBottom: 12 }]}>{serving} serving</T>
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {NUTRIENTS.slice(0, 4).map((n) => {
          const value = nutrientValue(published?.[n.factKey]?.value);
          return (
            <View key={n.key} style={{ flex: 1, alignItems: "center", gap: 3 }}>
              <Art name={"icons/" + n.icon} size={29} />
              <View style={{ minHeight: 34, justifyContent: "center" }}>
                <NutrientAmount value={value} unit={n.unit} size="title" />
              </View>
              <T style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
                {n.label}
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function NutritionDetails({
  published,
  showMissing = false,
}: {
  published?: PublishedNutrition | null;
  showMissing?: boolean;
}) {
  const { s } = useTheme();
  const knownKeys = new Set([
    ...NUTRIENTS.map((n) => n.factKey),
    "servingSize",
    ...additionalNutrients.map((n) => n.key),
  ]);
  const extras = Object.entries(published ?? {}).filter(
    ([key]) => !knownKeys.has(key),
  );
  return (
    <View style={{ marginTop: 24 }}>
      {additionalNutrients.map((n, i) => {
        const v = nutrientValue(published?.[n.key]?.value);
        if (i >= 4 && !published?.[n.key] && !showMissing) return null;
        return (
          <View
            key={n.key}
            style={[
              s.row,
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 14,
              },
            ]}
          >
            <Art name={"icons/" + n.art} size={38} />
            <T style={{ flex: 1, fontSize: 16 }}>{n.label}</T>
            <NutrientAmount value={v} unit={n.unit} />
          </View>
        );
      })}
      {extras.map(([key, n]) => (
        <View key={key} style={[s.row, s.between]}>
          <T>{n.label ?? key}</T>
          <NutrientAmount value={nutrientValue(n.value)} unit={n.unit} />
        </View>
      ))}
    </View>
  );
}
