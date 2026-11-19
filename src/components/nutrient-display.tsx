import { useTheme } from "../state/ThemeProvider";
import { View } from "react-native";
import { Art, T } from "./ui";

import { textSizes } from "../lib/fonts";
import { formatAmount, NUTRIENTS } from "../lib/domain";
import { isEstimatedNutrient } from "../lib/nutrition-display";
import type { Food } from "../lib/types";

/** Keep a real gap and a shared baseline instead of nesting different line heights. */
export function NutrientAmount({
  value,
  unit,
  size = "body",
}: {
  value: string | number | null;
  unit: string;
  size?: keyof typeof textSizes;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={value == null ? "Not available" : `${value} ${unit}`}
      style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}
    >
      <T
        numeric
        style={{
          fontSize: value == null ? textSizes.secondary : textSizes[size],
          fontVariant: ["tabular-nums"],
          letterSpacing: 0,
          textAlign: "center",
        }}
      >
        {value ?? "Not available"}
      </T>
      {value != null && (
        <T
          numeric
          style={{ fontSize: textSizes.secondary, color: colors.muted }}
        >
          {unit}
        </T>
      )}
    </View>
  );
}

/** The same unboxed artwork accompanies nutrient summaries throughout the app. */
export function FoodNutrition({
  food,
  servings = 1,
  compact = false,
}: {
  food: Food;
  servings?: number;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        flexShrink: 0,
        maxWidth: "100%",
        gap: compact ? 6 : 10,
      }}
    >
      {NUTRIENTS.slice(0, compact ? 4 : 2).map((nutrient) => {
        const amount = food[nutrient.key];
        const value = formatAmount(
          amount,
          servings,
          isEstimatedNutrient(food, nutrient.factKey),
        );
        return (
          <View
            key={nutrient.key}
            accessible
            accessibilityLabel={`${nutrient.label}: ${amount == null ? "Not available" : `${value} ${nutrient.unit}`}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: compact ? 3 : 4,
            }}
          >
            <Art name={`icons/${nutrient.icon}`} size={compact ? 16 : 20} />
            {compact ? (
              <T numeric style={{ fontSize: textSizes.secondary }}>
                {value}
                {amount != null &&
                  (nutrient.unit === "g" ? "g" : ` ${nutrient.unit}`)}
              </T>
            ) : (
              <NutrientAmount
                value={value}
                unit={nutrient.unit}
                size="secondary"
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
