import { useTheme } from "../state/ThemeProvider";
import React, { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Food, Offering } from "../lib/types";
import { displayName } from "../lib/domain";
import { kitchenDishSections } from "../lib/menu";

import { BuckyRating, FoodImage, FoodRow, openDish } from "./Food";
import { Icon, T, Tap } from "./ui";
import { FoodNutrition } from "./nutrient-display";
import { MenuEntrance } from "./MenuEntrance";

/** One generous hero, or two equal image-first sections, in the measured space. */
export function KitchenDishes({
  kitchen,
  foods,
  date,
  meal,
  placements,
}: {
  kitchen: string;
  foods: Food[];
  date?: string;
  meal?: string;
  placements?: Map<string, Offering>;
}) {
  const { colors, s } = useTheme();
  const [height, setHeight] = useState(0);
  const { bottom } = useSafeAreaInsets();
  const availableHeight = height - bottom;
  const { width, fontScale } = useWindowDimensions();
  const sections = kitchenDishSections(kitchen, foods, placements);
  const single = foods.length === 1;
  const fits =
    foods.length <= 2 &&
    fontScale <= 1.2 &&
    availableHeight >= (single ? 380 : 540);
  const featuredFoods = fits ? [...sections.values()].flat() : [];
  let nextRow = 0;
  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {fits ? (
        <View style={{ paddingHorizontal: 24, flex: 1 }}>
          {featuredFoods.map((food, i) => {
            const sectionHeight = (availableHeight - 16) / foods.length;
            const imageHeight = single
              ? Math.min(width - 32, sectionHeight - 200)
              : Math.min(205, sectionHeight - 142);
            return (
              <MenuEntrance key={food.id} sequence={i}>
                <Tap
                  padding="none"
                  style={{ marginHorizontal: -12 }}
                  contentStyle={{ paddingHorizontal: 12 }}
                  onPress={() =>
                    openDish(food, date, meal, placements?.get(food.id)?.id)
                  }
                  accessibilityLabel={`View ${food.name}`}
                >
                  <View
                    style={{
                      height: sectionHeight,
                      justifyContent: "center",
                      gap: single ? 18 : 8,
                      borderTopWidth: i ? 0.5 : 0,
                      borderColor: colors.rule,
                    }}
                  >
                    <FoodImage
                      food={food}
                      style={{
                        width: "100%",
                        height: imageHeight,
                        aspectRatio: undefined,
                      }}
                    />
                    <View style={{ gap: 8, paddingHorizontal: single ? 4 : 0 }}>
                      <T
                        numberOfLines={single ? 3 : 2}
                        style={{
                          fontSize: single ? 27 : 21,
                          lineHeight: single ? 32 : 25,
                          fontWeight: "600",
                          letterSpacing: -0.5,
                        }}
                      >
                        {displayName(food.name)}
                      </T>
                      <View style={s.between}>
                        <BuckyRating foodId={food.food_item_id} />
                        <Icon
                          name="arrow-forward"
                          size={18}
                          color={colors.accent}
                        />
                      </View>
                      <FoodNutrition food={food} />
                    </View>
                  </View>
                </Tap>
              </MenuEntrance>
            );
          })}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: bottom + 20,
          }}
        >
          {Array.from(sections, ([section, entries]) => (
            <View key={section}>
              {section !== "" && (
                <T
                  accessibilityRole="header"
                  style={{ fontWeight: "600", marginTop: 14 }}
                >
                  {section}
                </T>
              )}
              {entries.map((food) => (
                <MenuEntrance key={food.id} sequence={nextRow++}>
                  <FoodRow
                    food={food}
                    date={date}
                    meal={meal}
                    offering={placements?.get(food.id)}
                  />
                </MenuEntrance>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function MealHighlights({
  foods,
  date,
  meal,
  sequence = 0,
}: {
  foods: Food[];
  date: string;
  meal: string;
  sequence?: number;
}) {
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.2;
  return (
    <View style={{ marginBottom: 14 }}>
      <T
        accessibilityRole="header"
        style={{
          fontSize: 18,
          fontWeight: "600",
          marginTop: 6,
          marginBottom: 4,
        }}
      >
        {meal}
      </T>
      {compact ? (
        foods.map((food, index) => (
          <MenuEntrance key={food.id} sequence={sequence + index}>
            <FoodRow food={food} date={date} meal={meal} />
          </MenuEntrance>
        ))
      ) : (
        <View style={{ flexDirection: "row", gap: 20 }}>
          {foods.map((food) => (
            <MenuEntrance key={food.id} sequence={sequence} style={{ flex: 1 }}>
              <Tap
                padding="card"
                style={{ marginHorizontal: -8 }}
                onPress={() => openDish(food, date, meal)}
                accessibilityLabel={`View ${food.name}`}
              >
                <View style={{ gap: 8 }}>
                  <FoodImage
                    food={food}
                    style={{
                      width: "100%",
                      height: 142,
                      aspectRatio: undefined,
                    }}
                  />
                  <T
                    numberOfLines={2}
                    style={{
                      fontSize: 16,
                      lineHeight: 21,
                      fontWeight: "600",
                      letterSpacing: -0.3,
                    }}
                  >
                    {displayName(food.name)}
                  </T>
                  <BuckyRating foodId={food.food_item_id} />
                </View>
              </Tap>
            </MenuEntrance>
          ))}
        </View>
      )}
    </View>
  );
}
