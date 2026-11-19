import { totalIncludesEstimate } from "../../lib/nutrition-display";
import { useTheme } from "../../state/ThemeProvider";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { router } from "expo-router";
import { isDailyLimit } from "../../lib/nutrition-goals";
import type { Nutrient } from "../../lib/types";
import { useApp } from "../../state/AppProvider";
import {
  Art,
  DateNav,
  FixedScreen,
  IconButton,
  Segments,
  T,
  Tap,
  tabContentBottomPadding,
} from "../../components/ui";
import { FoodImage, openDish } from "../../components/Food";
import {
  campusDate,
  dateLabel,
  displayName,
  formatAmount,
  NUTRIENTS,
  nutritionTotals,
  shiftDate,
} from "../../lib/domain";

import {
  FoodNutrition,
  NutrientAmount,
} from "../../components/nutrient-display";
function ProgressRing({
  children,
  size,
  ratio,
  color,
}: React.PropsWithChildren<{
  size: number;
  ratio?: number;
  color: string;
}>) {
  const { scheme } = useTheme();
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        aria-hidden
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Circle
          cx={48}
          cy={48}
          r={radius}
          stroke={color}
          strokeOpacity={scheme === "dark" ? 0.24 : 0.11}
          strokeWidth={6}
          fill="none"
        />
        {ratio != null && ratio > 0 && (
          <Circle
            cx={48}
            cy={48}
            r={radius}
            stroke={color}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * Math.min(1, ratio)} ${circumference}`}
            transform="rotate(-90 48 48)"
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

function percentage(ratio: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

export default function Nutrition() {
  const { colors, s } = useTheme();
  const { data, local } = useApp();
  const [date, setDate] = useState(campusDate());
  const [period, setPeriod] = useState("Day");
  const logs = data.logs.filter((l) => l.local_date === date);
  const totals = nutritionTotals(logs);
  const partial = NUTRIENTS.some((n) => totals[n.key].missing > 0);
  const amount = (key: Nutrient) => {
    return logs.length > 0 && logs.every((log) => log.food[key] == null)
      ? null
      : totals[key].value;
  };
  const displayAmount = (nutrient: (typeof NUTRIENTS)[number]) =>
    formatAmount(
      amount(nutrient.key),
      1,
      totalIncludesEstimate(logs, nutrient),
    );
  const progress = (key: Nutrient) => {
    const goal = data.profile.goals[key];
    const value = amount(key);
    return goal && goal > 0 && value != null ? value / goal : undefined;
  };
  const calorieGoal = data.profile.goals.calories_kcal;
  const calorieProgress = progress("calories_kcal");
  const days = period === "Month" ? 30 : 7;
  const history = Array.from({ length: days }, (_, i) => {
    const d = shiftDate(date, i - days + 1);
    const l = data.logs.filter((x) => x.local_date === d);
    return {
      date: d,
      count: l.length,
      estimated: totalIncludesEstimate(l, NUTRIENTS[0]),
      ...nutritionTotals(l).calories_kcal,
    };
  });
  const max = Math.max(...history.map((h) => h.value), 1);
  return (
    <FixedScreen
      title="Nutrition"
      tab
      right={
        <IconButton
          name="options-outline"
          sf="slider.horizontal.3"
          label="Nutrition settings"
          onPress={() =>
            router.push({
              pathname: "/settings",
              params: { section: "nutrition" },
            })
          }
        />
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: tabContentBottomPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.inset}>
          <Segments
            values={["Day", "Week", "Month"]}
            value={period}
            onChange={setPeriod}
          />
        </View>
        <DateNav
          value={date}
          onChange={(value) => {
            setDate(value);
          }}
          compact
        />
        <View style={{ paddingHorizontal: 24, flexGrow: 1 }}>
          {period === "Day" ? (
            <>
              <View style={[s.between, { paddingVertical: 8 }]}>
                <View>
                  <T style={s.caption}>Energy consumed</T>
                  <NutrientAmount
                    value={displayAmount(NUTRIENTS[0])}
                    unit="cal"
                    size="title"
                  />
                  {calorieGoal != null && (
                    <T style={s.caption}>
                      of {formatAmount(calorieGoal)} cal
                      {calorieProgress != null &&
                        ` · ${percentage(calorieProgress)}`}
                    </T>
                  )}
                </View>
                {calorieGoal ? (
                  <ProgressRing
                    size={64}
                    ratio={calorieProgress}
                    color={colors.accent}
                  >
                    <Art name="icons/calories" size={40} />
                  </ProgressRing>
                ) : (
                  <Art name="icons/calories" size={51} />
                )}
              </View>
              <View
                style={{ flexDirection: "row", marginTop: 9, marginBottom: 17 }}
              >
                {NUTRIENTS.slice(1, 4).map((n, i) => {
                  const ratio = progress(n.key);
                  const goal = data.profile.goals[n.key];
                  const value = displayAmount(n);
                  return (
                    <View key={n.key} style={{ flex: 1, alignItems: "center" }}>
                      <ProgressRing
                        size={90}
                        ratio={ratio}
                        color={[colors.protein, colors.carbs, colors.fat][i]}
                      >
                        <NutrientAmount
                          value={value}
                          unit={n.unit}
                          size={value.length > 4 ? "body" : "title"}
                        />
                      </ProgressRing>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 4,
                        }}
                      >
                        <Art name={`icons/${n.icon}`} size={26} />
                        <T style={{ fontSize: 14 }}>{n.label}</T>
                      </View>
                      {goal != null && (
                        <T numeric style={[s.caption, { textAlign: "center" }]}>
                          of {formatAmount(goal)} {n.unit}
                          {ratio != null && ` · ${percentage(ratio)}`}
                        </T>
                      )}
                    </View>
                  );
                })}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  rowGap: 14,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.rule,
                  paddingVertical: 14,
                }}
              >
                {NUTRIENTS.slice(4).map((n) => {
                  const ratio = progress(n.key);
                  const goal = data.profile.goals[n.key];
                  const limit = isDailyLimit(n.key);
                  const art = <Art name={`icons/${n.icon}`} size={28} />;
                  return (
                    <View
                      key={n.key}
                      style={{
                        width: "50%",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {goal != null ? (
                        <ProgressRing
                          size={42}
                          ratio={ratio}
                          color={limit ? colors.muted : colors.protein}
                        >
                          {art}
                        </ProgressRing>
                      ) : (
                        <View style={{ width: 42, alignItems: "center" }}>
                          {art}
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <T style={{ fontSize: 14 }}>{n.label}</T>
                        <T numeric style={s.caption}>
                          {displayAmount(n)}
                          {goal != null && ` / ${formatAmount(goal)}`} {n.unit}
                        </T>
                        {ratio != null && (
                          <T numeric style={s.caption}>
                            {percentage(ratio)} of {limit ? "limit" : "goal"}
                          </T>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
              {partial && (
                <T style={[s.caption, { fontSize: 10, marginTop: 7 }]}>
                  Partial totals · Some nutrition values are unavailable.
                </T>
              )}
              <View style={[s.between, { marginTop: 21, marginBottom: 7 }]}>
                <T
                  style={{
                    fontSize: 20,
                    fontWeight: "600",
                    letterSpacing: -0.5,
                  }}
                >
                  Your Food
                </T>
                <IconButton
                  name="add"
                  label="Find food to add"
                  onPress={() => router.push("/(tabs)/menu")}
                />
              </View>
              <View style={{ flexGrow: 1 }}>
                {logs.length ? (
                  logs.slice(0, 2).map((log) => (
                    <View
                      key={log.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderColor: colors.rule,
                      }}
                    >
                      <Tap
                        padding="row"
                        onPress={() =>
                          openDish(log.food, log.local_date, log.meal_label)
                        }
                        style={{ flex: 1, marginLeft: -12 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <FoodImage food={log.food} size={62} />
                          <View style={{ flex: 1 }}>
                            <T
                              numberOfLines={2}
                              style={{
                                fontSize: 14,
                                lineHeight: 19,
                                fontWeight: "500",
                              }}
                            >
                              {displayName(log.food.name)}
                            </T>
                            <T style={{ fontSize: 11, color: colors.muted }}>
                              {log.meal_label} · {log.servings}×
                            </T>
                            <FoodNutrition
                              food={log.food}
                              servings={log.servings}
                            />
                          </View>
                        </View>
                      </Tap>
                      <IconButton
                        name="ellipsis-horizontal"
                        label={`Edit ${log.food.name} food log`}
                        onPress={() =>
                          router.push({
                            pathname: "/log",
                            params: { edit: log.id },
                          })
                        }
                      />
                    </View>
                  ))
                ) : (
                  <Tap onPress={() => router.push("/(tabs)/menu")}>
                    <View style={{ alignItems: "center", gap: 8 }}>
                      <Art name="icons/no-meals-logged" size={70} />
                      <T style={{ fontSize: 15, fontWeight: "500" }}>
                        Your first bite goes here.
                      </T>
                      <T style={s.link}>Find something good</T>
                    </View>
                  </Tap>
                )}
              </View>
              <>
                {logs.length > 2 && (
                  <Tap
                    onPress={() =>
                      router.push({
                        pathname: "/food-history",
                        params: { date },
                      })
                    }
                  >
                    <T style={[s.link, { textAlign: "center" }]}>
                      All {logs.length} dishes
                    </T>
                  </Tap>
                )}
              </>
            </>
          ) : (
            <>
              <T style={[s.caption, { marginTop: 15 }]}>
                {days} days ending {dateLabel(date)}
              </T>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <Art name="icons/calories" size={38} />
                <NutrientAmount
                  value={formatAmount(
                    history.reduce((v, h) => v + h.value, 0),
                    1,
                    history.some((h) => h.estimated),
                  )}
                  unit="cal"
                  size="title"
                />
              </View>
              <View
                style={{
                  height: 190,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: period === "Month" ? 3 : 10,
                  marginTop: 18,
                }}
              >
                {history.map((h) => (
                  <Tap
                    key={h.date}
                    padding="none"
                    highlightRadius={6}
                    contentStyle={{
                      paddingHorizontal: period === "Month" ? 1 : 4,
                      paddingVertical: 4,
                    }}
                    onPress={() => {
                      setDate(h.date);
                      setPeriod("Day");
                    }}
                    accessibilityLabel={`${h.date}, ${h.count ? `${formatAmount(h.value, 1, h.estimated)} calories` : "no logs"}`}
                    style={{ flex: 1 }}
                  >
                    <View style={{ height: 152, justifyContent: "flex-end" }}>
                      <View
                        style={{
                          height: h.count
                            ? Math.max(5, (h.value / max) * 152)
                            : 3,
                          backgroundColor: h.count
                            ? colors.accent
                            : colors.chartEmpty,
                          borderRadius: 5,
                        }}
                      />
                    </View>
                    {period === "Week" && (
                      <T
                        style={{
                          fontSize: 10,
                          color: colors.muted,
                          textAlign: "center",
                          marginTop: 8,
                        }}
                      >
                        {dateLabel(h.date, { weekday: "narrow" })}
                      </T>
                    )}
                  </Tap>
                ))}
              </View>
              <View
                style={[
                  s.between,
                  {
                    marginTop: 30,
                    paddingVertical: 20,
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: colors.rule,
                  },
                ]}
              >
                <View>
                  <T numeric style={{ fontSize: 26, fontWeight: "600" }}>
                    {history.filter((h) => h.count > 0).length}
                  </T>
                  <T style={s.caption}>days logged</T>
                </View>
                <View>
                  <T numeric style={{ fontSize: 26, fontWeight: "600" }}>
                    {history.reduce((n, h) => n + h.count, 0)}
                  </T>
                  <T style={s.caption}>dishes recorded</T>
                </View>
              </View>
              <T style={[s.body, { marginTop: 22 }]}>
                Tap a day to see its food. Gray marks mean no logs, rather than
                zero consumption.
              </T>
            </>
          )}
        </View>
      </ScrollView>
    </FixedScreen>
  );
}
