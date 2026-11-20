import { useTheme } from "../../state/ThemeProvider";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../../state/AppProvider";
import {
  Art,
  AssetImage,
  Button,
  EmptyState,
  FixedScreen,
  Segments,
  SectionHeading,
  T,
  Tap,
} from "../../components/ui";
import { assets } from "../../data/assets";
import { BuckyRating, FoodImage } from "../../components/Food";
import {
  NutritionSummary,
  NutritionDetails,
} from "../../components/NutritionSummary";
import { MenuOptions } from "../../components/MenuOptions";
import { IngredientRow } from "../../components/ingredient-row";
import { ReviewCard } from "../../components/ReviewCard";
import {
  ScrollEdgeFade,
  ScrollUnderBar,
} from "../../components/scroll-under-bar";
import { FoodNutrition } from "../../components/nutrient-display";
import {
  displayName,
  dishContext,
  nextReviewTime,
  recentDishReview,
} from "../../lib/domain";
import { hasReviewText } from "../../lib/discovery";
import { kitchenName } from "../../lib/theme";
import {
  initialChoices,
  initialSize,
  savedChoiceKeys,
} from "../../lib/menu-options";
import { menuNutrition, menuNutritionNote } from "../../lib/menu-nutrition";
import { foodNutritionFacts } from "../../lib/nutrition-display";
import type { MenuSelection } from "../../lib/types";

export default function DishDetail() {
  const { colors, s } = useTheme();
  const {
    id,
    date,
    meal,
    offering: offeringId,
    log: logId,
  } = useLocalSearchParams<{
    id: string;
    date?: string;
    meal?: string;
    offering?: string;
    log?: string;
  }>();
  const { catalog, data, userId, session, resolveId } = useApp();
  const { height, width } = useWindowDimensions();
  const [section, setSection] = useState("Reviews");
  const [draft, setDraft] = useState<MenuSelection>();
  const [showFullIngredients, setShowFullIngredients] = useState(false);
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  useEffect(() => {
    setSection("Reviews");
    setDraft(undefined);
    setShowFullIngredients(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [id, logId, offeringId]);
  const logged = logId
    ? data.logs.find(
        (entry) =>
          entry.id === resolveId(logId) &&
          (entry.food_version_id === id ||
            catalog.offerings.some(
              (o) =>
                o.id === entry.menu_selection?.offering_id &&
                o.food_version_id === id,
            )),
      )
    : undefined;
  const saved = logged?.menu_selection;
  const original =
    saved &&
    catalog.offerings.find(
      (entry) => entry.id === saved.offering_id && entry.is_listed,
    );
  const food =
    catalog.foods.find((f) => f.id === (original?.food_version_id ?? id)) ??
    logged?.food ??
    data.logs.find((l) => l.food_version_id === id)?.food;
  const [now, setNow] = useState(() => new Date());
  const recentReview =
    food && recentDishReview(data.reviews, userId, food.food_item_id, now);
  const nextReviewAt = recentReview && nextReviewTime(recentReview.created_at);
  useEffect(() => {
    if (!nextReviewAt) return;
    const timer = setTimeout(
      () => setNow(new Date()),
      Math.max(0, nextReviewAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [nextReviewAt]);
  if (!food)
    return (
      <FixedScreen back title="Dish">
        <EmptyState
          title="Dish Unavailable"
          text="This dish is not in the saved catalog."
        />
      </FixedScreen>
    );
  const { station, service, offering } = dishContext(
    catalog,
    food,
    date,
    meal,
    original?.id ?? offeringId,
  );
  const hasOptions = Boolean(
    offering?.modifier_groups?.length || offering?.serving_options?.length,
  );
  const selection = draft?.offering_id === offering?.id && draft;
  const size = selection ? selection.size : initialSize(offering, saved?.size);
  const choices = selection
    ? selection.choices
    : offering && saved && offering.id === saved.offering_id
      ? savedChoiceKeys(
          offering,
          saved,
          logged?.food_version_id === offering.food_version_id,
        )
      : initialChoices(offering);
  const nutrition =
    logged && !selection
      ? logged.food
      : menuNutrition(food, offering, catalog.components, size, choices);
  const nutritionNote = hasOptions ? menuNutritionNote(nutrition) : undefined;
  const facts = foodNutritionFacts(nutrition);
  const ingredients = catalog.links
    .filter((l) => l.food_version_id === food.id)
    .sort((a, b) => a.position - b.position);
  const reviews = data.reviews
    .filter((r) => r.food_item_id === food.food_item_id && hasReviewText(r))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const imageSize = Math.min(156, (width - 48) * 0.46);
  const openReview = () => {
    router.push({
      pathname: "/review",
      params: { food: food.id, ...(recentReview && { edit: recentReview.id }) },
    });
  };
  return (
    <FixedScreen back title={kitchenName(station?.name ?? "Dish")}>
      <ScrollEdgeFade inline edge="top" id="dishHeaderEdge" />
      <ScrollUnderBar
        edge="bottom"
        fadeId="dishActionsFade"
        initialInset={60}
        bar={
          <View style={{ paddingHorizontal: 24, paddingTop: 10 }}>
            <Button
              title="Add to today’s food"
              icon="add"
              onPress={() => {
                router.push({
                  pathname: "/log",
                  params: {
                    food: food.id,
                    meal:
                      service?.name === "Brunch"
                        ? (meal ?? "Breakfast")
                        : (meal ?? service?.name ?? ""),
                    ...(offering ? { offering: offering.id } : {}),
                    ...(selection || (saved && original)
                      ? { size, choices: JSON.stringify(choices) }
                      : {}),
                  },
                });
              }}
            />
          </View>
        }
      >
        {(bottomInset) => (
          <ScrollView
            key={id}
            ref={scroll}
            style={{ flex: 1 }}
            contentInsetAdjustmentBehavior="never"
            alwaysBounceVertical
            stickyHeaderIndices={[1]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
          >
            <View style={s.inset}>
              <FoodImage
                food={food}
                style={{
                  width: "100%",
                  height: height < 760 ? 190 : 230,
                  aspectRatio: undefined,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 7,
                }}
              >
                <T
                  style={{
                    flex: 1,
                    fontSize: 27,
                    lineHeight: 32,
                    fontWeight: "700",
                    letterSpacing: -0.8,
                  }}
                >
                  {displayName(food.name)}
                </T>
                {food.dietary_tags.length > 0 && (
                  <View
                    style={{ maxWidth: "40%", gap: 4, alignItems: "flex-end" }}
                  >
                    {food.dietary_tags.map((tag) => (
                      <View
                        key={tag}
                        style={[s.inline, { gap: 4, maxWidth: "100%" }]}
                      >
                        <AssetImage
                          source={
                            assets[
                              `icons/${tag.trim().toLowerCase().replace(/\s+/g, "-")}`
                            ]
                          }
                          style={{ width: 16, height: 16, flexShrink: 0 }}
                          fallback={null}
                        />
                        <T
                          style={{
                            fontSize: 14,
                            color: colors.positive,
                            flexShrink: 1,
                          }}
                        >
                          {tag}
                        </T>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 24,
                  marginTop: 8,
                  marginBottom: 12,
                }}
              >
                <BuckyRating foodId={food.food_item_id} compact />
                <FoodNutrition food={nutrition} compact />
              </View>
            </View>
            <View style={{ backgroundColor: colors.paper }}>
              <View style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
                <Segments
                  values={
                    hasOptions
                      ? ["Reviews", "Customize", "Nutrition"]
                      : ["Reviews", "Nutrition"]
                  }
                  value={section}
                  onChange={(value) => {
                    setSection(value);
                    scroll.current?.scrollTo({ y: 0, animated: false });
                  }}
                />
              </View>
              <ScrollEdgeFade inline edge="top" id="dishSectionEdge" />
            </View>
            {section === "Reviews" ? (
              <View style={s.inset}>
                <View style={{ alignItems: "flex-end", marginTop: 8 }}>
                  {session ? (
                    <Tap onPress={openReview}>
                      <T style={s.link}>
                        {recentReview ? "Edit review" : "Write a review"}
                      </T>
                    </Tap>
                  ) : (
                    <T style={s.caption}>Log this dish to write a review.</T>
                  )}
                </View>
                {reviews.length ? (
                  reviews
                    .slice(0, 5)
                    .map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        showFood={false}
                      />
                    ))
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 20 }}>
                    <Art name="icons/leave-a-review" size={88} />
                    <T style={[s.body, { marginTop: 12 }]}>No comments yet.</T>
                  </View>
                )}
                {reviews.length > 5 && (
                  <Tap
                    onPress={() =>
                      router.push({
                        pathname: "/ratings",
                        params: { dish: food.name },
                      })
                    }
                  >
                    <T style={s.link}>All comments</T>
                  </Tap>
                )}
              </View>
            ) : section === "Customize" && offering ? (
              <View style={[s.inset, { paddingTop: 16, gap: 18 }]}>
                {nutritionNote && <T style={s.caption}>{nutritionNote}</T>}
                <MenuOptions
                  offering={offering}
                  serviceDate={service?.service_date}
                  showDetails
                  selection={{
                    size,
                    choices,
                    onSize: (size) =>
                      setDraft({ offering_id: offering.id, size, choices }),
                    onChoices: (choices) =>
                      setDraft({ offering_id: offering.id, size, choices }),
                  }}
                />
              </View>
            ) : (
              <View>
                <View style={[s.inset, { paddingTop: 20 }]}>
                  <NutritionSummary
                    published={facts}
                    serving={nutrition.serving_description}
                  />
                  {nutritionNote && (
                    <T style={[s.caption, { marginTop: 8 }]}>{nutritionNote}</T>
                  )}
                  {Boolean(food.description) && (
                    <T style={[s.body, { marginTop: 8 }]}>{food.description}</T>
                  )}
                </View>
                <SectionHeading title="Ingredients" />
                <View style={s.inset}>
                  {ingredients.map((link, i) => (
                    <IngredientRow
                      key={link.component_id + i}
                      componentId={link.component_id}
                      label={link.display_label}
                      imageSize={imageSize}
                    />
                  ))}
                </View>
                {food.ingredients_text && ingredients.length > 0 && (
                  <Tap
                    style={s.inset}
                    aria-expanded={showFullIngredients}
                    haptic={showFullIngredients ? "release" : "tap"}
                    onPress={() =>
                      setShowFullIngredients((previous) => !previous)
                    }
                  >
                    <T style={s.link}>
                      {showFullIngredients
                        ? "Hide full ingredient list"
                        : "Show full ingredient list"}
                    </T>
                  </Tap>
                )}
                {food.ingredients_text &&
                  (!ingredients.length || showFullIngredients) && (
                    <T style={[s.body, s.inset]}>{food.ingredients_text}</T>
                  )}
                {!ingredients.length && !food.ingredients_text && (
                  <T style={[s.body, s.inset]}>Not available</T>
                )}
                <View style={s.inset}>
                  <NutritionDetails
                    published={facts}
                    showMissing={Boolean(nutrition.estimated_nutrition)}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </ScrollUnderBar>
    </FixedScreen>
  );
}
