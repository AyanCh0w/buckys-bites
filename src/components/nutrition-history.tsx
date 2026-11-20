import { View } from "react-native";
import {
  dateLabel,
  formatAmount,
  NUTRIENTS,
  nutritionTotals,
  shiftDate,
} from "../lib/domain";
import { calorieStack, totalIncludesEstimate } from "../lib/nutrition-display";
import type { FoodLog } from "../lib/types";
import { useTheme } from "../state/ThemeProvider";
import { NutrientAmount } from "./nutrient-display";
import { Art, T, Tap } from "./ui";

const chartHeight = 152;
const [calories, protein, carbs, fat] = NUTRIENTS;
const macros = [
  { nutrient: protein, color: "protein" },
  { nutrient: carbs, color: "carbs" },
  { nutrient: fat, color: "fat" },
] as const;

function summary(logs: FoodLog[]) {
  const totals = nutritionTotals(logs);
  function amount(nutrient: typeof calories) {
    if (logs.length && logs.every(({ food }) => food[nutrient.key] == null))
      return null;
    return formatAmount(
      totals[nutrient.key].value,
      1,
      totalIncludesEstimate(logs, nutrient),
    );
  }
  return {
    energy: totals.calories_kcal.value,
    calories: amount(calories),
    macros: macros.map(({ nutrient, color }) => ({
      label: nutrient.label,
      color,
      grams: amount(nutrient),
    })),
    partial: [calories, protein, carbs, fat].some(
      ({ key }) => totals[key].missing > 0,
    ),
  };
}

export function NutritionHistory({
  logs,
  endDate,
  days,
  onSelectDay,
}: {
  logs: FoodLog[];
  endDate: string;
  days: 7 | 30;
  onSelectDay: (date: string) => void;
}) {
  const { colors, s } = useTheme();
  const startDate = shiftDate(endDate, 1 - days);
  const periodLogs = logs.filter(
    ({ local_date }) => local_date >= startDate && local_date <= endDate,
  );
  const total = summary(periodLogs);
  const history = Array.from({ length: days }, (_, i) => {
    const date = shiftDate(startDate, i);
    const entries = periodLogs.filter((log) => log.local_date === date);
    return {
      date,
      count: entries.length,
      stack: calorieStack(entries),
      ...summary(entries),
    };
  });
  const max = Math.max(...history.map((day) => day.energy));
  const unassigned = history.reduce(
    (sum, day) => sum + day.stack.unassigned,
    0,
  );
  const legend = total.macros.map(({ label, color, grams }) => ({
    label,
    color: colors[color],
    amount: grams == null ? "—" : `${grams} g`,
  }));
  if (unassigned > 0) {
    legend.push({
      label: "Unassigned",
      color: colors.accent,
      amount: `${formatAmount(unassigned)} cal`,
    });
  }
  const week = days === 7;

  return (
    <>
      <T style={[s.caption, { marginTop: 15 }]}>
        {days} days ending {dateLabel(endDate)}
      </T>
      <View style={[s.inline, { marginTop: 8 }]}>
        <Art name="icons/calories" size={38} />
        <NutrientAmount value={total.calories} unit="cal" size="title" />
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: 16,
          rowGap: 6,
          marginTop: 10,
        }}
      >
        {legend.map(({ label, color, amount }) => (
          <View key={label} style={[s.inline, { gap: 5 }]}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
            <T numeric style={s.caption}>
              {label} {amount}
            </T>
          </View>
        ))}
      </View>
      <T style={[s.caption, { marginTop: 22, marginBottom: 8 }]}>
        Daily calories
      </T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {max > 0 && (
          <View
            style={{
              height: chartHeight,
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <T numeric style={s.caption}>
              {formatAmount(max)}
            </T>
            <T numeric style={s.caption}>
              0
            </T>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: chartHeight,
              justifyContent: "space-between",
            }}
          >
            {[0, 1, 2].map((line) => (
              <View
                key={line}
                style={{ height: 1, backgroundColor: colors.rule }}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row" }}>
            {history.map((day) => {
              const description = day.count
                ? [
                    day.calories == null
                      ? "calories unavailable"
                      : `${day.calories} calories`,
                    ...day.macros.map(({ label, grams }) =>
                      grams == null
                        ? `${label} unavailable`
                        : `${grams} grams ${label}`,
                    ),
                    ...(day.partial ? ["partial totals"] : []),
                  ].join(", ")
                : "no logs";
              return (
                <Tap
                  key={day.date}
                  padding="none"
                  highlightRadius={4}
                  contentStyle={{ paddingHorizontal: week ? 4 : 1 }}
                  onPress={() => onSelectDay(day.date)}
                  accessibilityLabel={`${dateLabel(day.date)}, ${description}`}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <View
                    style={{ height: chartHeight, justifyContent: "flex-end" }}
                  >
                    {day.energy > 0 ? (
                      <View
                        style={{
                          height: Math.max(1, (chartHeight * day.energy) / max),
                          flexDirection: "column-reverse",
                          backgroundColor: colors.accent,
                          borderTopLeftRadius: week ? 5 : 2,
                          borderTopRightRadius: week ? 5 : 2,
                          overflow: "hidden",
                        }}
                      >
                        {macros.map(({ color }) => (
                          <View
                            key={color}
                            style={{
                              height: `${(100 * day.stack[color]) / day.energy}%`,
                              backgroundColor: colors[color],
                            }}
                          />
                        ))}
                      </View>
                    ) : (
                      <View
                        style={{
                          height: 3,
                          borderRadius: 2,
                          borderWidth: day.calories == null ? 1 : 0,
                          borderColor: colors.muted,
                          backgroundColor:
                            day.count && day.calories != null
                              ? colors.muted
                              : day.count
                                ? colors.paper
                                : colors.chartEmpty,
                        }}
                      />
                    )}
                  </View>
                  {week && (
                    <T
                      style={[s.caption, { textAlign: "center", marginTop: 6 }]}
                    >
                      {dateLabel(day.date, { weekday: "narrow" })}
                    </T>
                  )}
                </Tap>
              );
            })}
          </View>
          {!week && (
            <View style={[s.between, { marginTop: 6 }]}>
              <T style={s.caption}>{dateLabel(startDate)}</T>
              <T style={s.caption}>{dateLabel(endDate)}</T>
            </View>
          )}
        </View>
      </View>
      {total.partial && (
        <T style={[s.caption, { marginTop: 8 }]}>
          Partial totals · Some nutrition values are unavailable.
        </T>
      )}
      <View
        style={[
          s.between,
          {
            marginTop: 24,
            paddingVertical: 20,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.rule,
          },
        ]}
      >
        <View>
          <T numeric style={{ fontSize: 26, fontWeight: "600" }}>
            {history.filter((day) => day.count > 0).length}
          </T>
          <T style={s.caption}>days logged</T>
        </View>
        <View>
          <T numeric style={{ fontSize: 26, fontWeight: "600" }}>
            {periodLogs.length}
          </T>
          <T style={s.caption}>dishes recorded</T>
        </View>
      </View>
      <T style={[s.body, { marginTop: 22 }]}>
        Tap a day to see its food. Light gray marks show days with no logs.
      </T>
    </>
  );
}
