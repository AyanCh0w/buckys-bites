import { useTheme } from "../state/ThemeProvider";
import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { assets } from "../data/assets";
import { useApp } from "../state/AppProvider";

import { dishContext, displayName, ratingFor } from "../lib/domain";
import type { Catalog, Food, FoodLog, Offering } from "../lib/types";
import { AssetImage, Icon, T, Tap } from "./ui";
import { money } from "../lib/menu-options";
import { FoodNutrition } from "./nutrient-display";
import { RatingBadge, RatingScore } from "./rating-score";
import { MenuEntrance } from "./MenuEntrance";

export function foodArtwork(catalog: Catalog, food: Food) {
  const key = catalog.images
    .find((image) => image.foodId === food.food_item_id && image.path)
    ?.path?.replace(/\.png$/, "");
  return key ? assets[key] : undefined;
}

export function FoodImage({
  food,
  size,
  style,
  hideIfUnavailable,
  fallback,
  rating,
  badgeSize = 26,
}: {
  food: Food;
  size?: number;
  style?: any;
  hideIfUnavailable?: boolean;
  fallback?: React.ReactNode;
  rating?: number;
  badgeSize?: number;
}) {
  const { catalog } = useApp();
  const image = (
    <AssetImage
      source={foodArtwork(catalog, food)}
      style={[{ width: size ?? "100%", height: size, aspectRatio: 1 }, style]}
      accessibilityLabel={`${displayName(food.name)}, illustrative image`}
      fallback={hideIfUnavailable ? null : fallback}
    />
  );
  if (rating == null) return image;
  return (
    <View>
      {image}
      <RatingBadge value={rating} size={badgeSize} />
    </View>
  );
}
export function BuckyRating({
  foodId,
  large = false,
  compact = false,
}: {
  foodId: string;
  large?: boolean;
  compact?: boolean;
}) {
  const { s } = useTheme();
  const { data } = useApp();
  const rating = ratingFor(data.reviews, foodId);
  return (
    <View
      style={[s.inline, compact && { gap: 4 }]}
      accessibilityLabel={
        rating.count
          ? `${rating.average.toFixed(1)} out of 5, ${rating.count} ratings`
          : "Not yet rated"
      }
    >
      {rating.count ? (
        <RatingScore
          value={rating.average}
          label={rating.average.toFixed(1)}
          size={large ? 38 : compact ? 20 : 24}
        />
      ) : (
        <T style={s.caption}>Unrated</T>
      )}
      {!compact && (
        <T style={s.caption}>{rating.count ? `(${rating.count})` : ""}</T>
      )}
    </View>
  );
}
export function openDish(
  food: Food,
  date?: string,
  meal?: string,
  offering?: string,
) {
  router.push({
    pathname: "/dish/[id]",
    params: {
      id: food.id,
      ...(date ? { date } : {}),
      ...(meal ? { meal } : {}),
      ...(offering ? { offering } : {}),
    },
  });
}
export function openLoggedDish(log: FoodLog) {
  router.push({
    pathname: "/dish/[id]",
    params: {
      id: log.food_version_id,
      date: log.local_date,
      meal: log.meal_label,
      log: log.id,
    },
  });
}
export function FoodRow({
  food,
  date,
  meal,
  showKitchen = false,
  compact = false,
  offering,
  photoRating,
}: {
  food: Food;
  date?: string;
  meal?: string;
  showKitchen?: boolean;
  compact?: boolean;
  offering?: Offering;
  photoRating?: number;
}) {
  const { colors, s } = useTheme();
  const { catalog } = useApp();
  const context = dishContext(catalog, food, date, meal, offering?.id);
  const { station } = context;
  const price = context.offering?.price;
  const { width } = useWindowDimensions();
  return (
    <View
      style={{
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.rule,
      }}
    >
      <Tap
        padding="none"
        onPress={() => openDish(food, date, meal, offering?.id)}
        accessibilityLabel={`View ${food.name}${photoRating == null ? "" : `, average rating ${photoRating.toFixed(1)} out of 5`}`}
        style={{ marginHorizontal: -12, marginVertical: 4 }}
        contentStyle={{ paddingHorizontal: 12 }}
      >
        <View style={styles.row}>
          <View>
            <FoodImage
              food={food}
              rating={photoRating}
              badgeSize={20}
              size={compact ? 64 : Math.min(148, (width - 48) * 0.43)}
            />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            {showKitchen && (
              <T
                style={[
                  s.caption,
                  {
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  },
                ]}
              >
                {station?.name}
              </T>
            )}
            <T style={styles.name}>{displayName(food.name)}</T>
            {!compact && (
              <>
                {price != null && <T style={s.caption}>{money(price)}</T>}
                <BuckyRating foodId={food.food_item_id} />
                <FoodNutrition food={food} />
              </>
            )}
          </View>
          <Icon name="chevron-forward" size={16} color={colors.faint} />
        </View>
      </Tap>
    </View>
  );
}
export function FoodHero({
  food,
  personalStars,
  date,
  meal,
  compact = false,
}: {
  food: Food;
  personalStars: number;
  date?: string;
  meal?: string;
  compact?: boolean;
}) {
  const { colors, s } = useTheme();
  return (
    <MenuEntrance>
      <Tap
        padding="row"
        style={{ marginHorizontal: -12 }}
        contentStyle={{ padding: 12 }}
        onPress={() => openDish(food, date, meal)}
        accessibilityLabel={`View ${food.name}, you rated it ${personalStars} out of 5`}
      >
        <FoodImage
          food={food}
          rating={personalStars}
          badgeSize={36}
          style={{
            width: "100%",
            height: compact ? 190 : 270,
            aspectRatio: undefined,
          }}
        />
        <View style={{ gap: 8 }}>
          <T
            style={{
              fontSize: 23,
              lineHeight: 28,
              letterSpacing: -0.6,
              fontWeight: "600",
            }}
          >
            {displayName(food.name)}
          </T>
          <View style={s.between}>
            <View style={s.inline}>
              <T style={s.body}>Your rating · {personalStars}/5</T>
            </View>
            <View style={styles.arrow}>
              <Icon name="arrow-forward" size={19} color={colors.accent} />
            </View>
          </View>
          <FoodNutrition food={food} />
        </View>
      </Tap>
    </MenuEntrance>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingVertical: 13,
  },
  name: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
