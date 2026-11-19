import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  cubicBezier,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Art, Button, Icon, T, Tap } from "./ui";
import { useTheme } from "../state/ThemeProvider";
import { useApp } from "../state/AppProvider";
import { fontFamily } from "../lib/fonts";
import snapshot from "../data/catalog.json";
import type { Catalog } from "../lib/types";
import { stationSpecials } from "../lib/home";
import { displayName } from "../lib/domain";
import { foodArtwork } from "./Food";
import { AssetImage } from "./ui";
import { RatingScore } from "./rating-score";
import { ReviewAuthor, ReviewLayout } from "./review-layout";
import { ReviewVotes } from "./review-votes";
import { NutritionDetails } from "./NutritionSummary";
import { NutrientAmount } from "./nutrient-display";
import { FoodOrbit } from "./food-orbit";

const easeOut = cubicBezier(0.23, 1, 0.32, 1);
const chapters = ["Welcome", "Menus", "Reviews", "Nutrition"];
const previewCatalog = snapshot as Catalog;
const previewStations = stationSpecials(
  previewCatalog,
  "2026-11-19",
  [],
  "Lunch",
).slice(0, 2);
const nutritionFoodId = previewCatalog.images.find(
  (image) => image.key === "dish:teriyaki-chicken-bowl",
)?.foodId;
const nutritionFood = previewCatalog.foods.find(
  (food) => food.food_item_id === nutritionFoodId,
);

export function IntroTitle({
  children,
  centered = false,
}: React.PropsWithChildren<{ centered?: boolean }>) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fontFamily("700"),
        fontSize: 38,
        lineHeight: 42,
        letterSpacing: -1.5,
        color: colors.ink,
        textAlign: centered ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}

export function IntroProgress({
  step,
  onBack,
  disabled = false,
  total = 4,
}: {
  step: number;
  onBack?: () => void;
  disabled?: boolean;
  total?: number;
}) {
  const { colors, s } = useTheme();
  const reduced = useReducedMotion();
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 8 }}>
      <View style={s.between}>
        {onBack ? (
          <Tap
            padding="row"
            style={{ marginLeft: -12 }}
            disabled={disabled}
            onPress={onBack}
            accessibilityLabel="Previous onboarding step"
          >
            <View style={s.inline}>
              <Icon name="chevron-back" size={18} />
              <T style={s.caption}>Back</T>
            </View>
          </Tap>
        ) : (
          <T style={[s.caption, { letterSpacing: 1.4, paddingVertical: 12 }]}>
            BUCKY’S BITES
          </T>
        )}
        <T numeric style={s.caption}>
          {step + 1} / {total}
        </T>
      </View>
      <View
        accessibilityLabel={`Step ${step + 1} of ${total}: ${chapters[step]}`}
        style={{ flexDirection: "row", gap: 6 }}
      >
        {chapters.slice(0, total).map((chapter, i) => (
          <View
            key={chapter}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.rule,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: colors.accent,
                opacity: i <= step ? 1 : 0,
                transitionProperty: "opacity",
                transitionDuration: reduced ? 0 : 200,
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function Reveal({
  children,
  delay = 0,
}: React.PropsWithChildren<{ delay?: number }>) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={
        reduced
          ? undefined
          : {
              animationName: {
                from: { opacity: 0, transform: [{ translateY: 14 }] },
                to: { opacity: 1, transform: [{ translateY: 0 }] },
              },
              animationDuration: 280,
              animationDelay: delay,
              animationFillMode: "both",
              animationTimingFunction: easeOut,
            }
      }
    >
      {children}
    </Animated.View>
  );
}

function Welcome() {
  const { colors, s } = useTheme();
  return (
    <View style={{ gap: 20 }}>
      <FoodOrbit />
      <Reveal delay={1050}>
        <View style={{ gap: 14, alignItems: "center", paddingHorizontal: 8 }}>
          <IntroTitle centered>{"Meet Bucky’s\nBites."}</IntroTitle>
          <T style={[s.body, { textAlign: "center", maxWidth: 330 }]}>
            Your inside scoop on eating at SCU. Find your next meal, hear from
            fellow Broncos, and keep track of what fuels you.
          </T>
        </View>
      </Reveal>
      <Reveal delay={1200}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          {(
            [
              ["restaurant-outline", "Explore"],
              ["chatbubbles-outline", "Review"],
              ["heart-outline", "Track"],
            ] as const
          ).map(([icon, label]) => (
            <View key={label} style={[s.inline, { gap: 5 }]}>
              <Icon name={icon} color={colors.accent} size={16} />
              <T style={s.caption}>{label}</T>
            </View>
          ))}
        </View>
      </Reveal>
    </View>
  );
}

function MenuPreview() {
  const { colors, s } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 12 }}>
        <IntroTitle>{"See what’s\ncooking."}</IntroTitle>
        <T style={s.body}>
          Lunch and dinner across campus, right on your home screen.
        </T>
      </View>
      <View style={{ gap: 16 }}>
        <View style={s.between}>
          <T style={s.title}>Today’s Specials</T>
          <Art name="icons/bucky-chef" size={40} />
        </View>
        {previewStations.map((station, stationIndex) => (
          <Reveal key={station.key} delay={120 + stationIndex * 120}>
            <View
              style={{
                borderTopWidth: 1,
                borderColor: colors.rule,
                paddingTop: 14,
                gap: 12,
              }}
            >
              <T style={s.sectionTitle}>{station.name}</T>
              <View style={{ flexDirection: "row", gap: 18 }}>
                {station.periods.map((period) => {
                  const food = period.options[0]?.food;
                  if (!food) return null;
                  return (
                    <Tap
                      padding="card"
                      key={period.label}
                      style={{ flex: 1, minWidth: 0 }}
                      accessibilityLabel={`Preview ${food.name}, ${period.label}`}
                      accessibilityState={{ selected: selected === food.id }}
                      onPress={() =>
                        setSelected(selected === food.id ? null : food.id)
                      }
                    >
                      <View style={{ gap: 6 }}>
                        <T style={{ color: colors.accent, fontSize: 14 }}>
                          {period.label}
                        </T>
                        <AssetImage
                          source={foodArtwork(previewCatalog, food)}
                          accessibilityLabel={food.name}
                          style={{ width: "100%", aspectRatio: 1.3 }}
                        />
                        <T style={{ fontWeight: "500" }}>
                          {displayName(food.name)}
                        </T>
                        {selected === food.id && (
                          <Reveal>
                            <View style={{ gap: 6, paddingTop: 4 }}>
                              <View style={s.inline}>
                                <Art name="icons/calories" size={23} />
                                <NutrientAmount
                                  value={food.calories_kcal}
                                  unit="cal"
                                  size="secondary"
                                />
                              </View>
                              <View style={s.inline}>
                                <Art name="icons/protein" size={23} />
                                <NutrientAmount
                                  value={food.protein_g}
                                  unit="g protein"
                                  size="secondary"
                                />
                              </View>
                            </View>
                          </Reveal>
                        )}
                      </View>
                    </Tap>
                  );
                })}
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </View>
  );
}

function NutritionPreview() {
  const { colors, s } = useTheme();
  const reduced = useReducedMotion();
  const [more, setMore] = useState(false);
  const macros = [
    {
      icon: "calories",
      label: "Calories",
      value: nutritionFood?.calories_kcal,
      unit: "cal",
    },
    {
      icon: "protein",
      label: "Protein",
      value: nutritionFood?.protein_g,
      unit: "g",
    },
    {
      icon: "carbohydrates",
      label: "Carbs",
      value: nutritionFood?.carbohydrate_g,
      unit: "g",
    },
    { icon: "fat", label: "Fat", value: nutritionFood?.total_fat_g, unit: "g" },
  ];
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 12 }}>
        <IntroTitle>{"Know what’s\nin your meal."}</IntroTitle>
        <T style={s.body}>
          Calories, macros, and the rest of the published nutrition. Log a meal
          to see it add up through your day.
        </T>
      </View>
      <Animated.View
        style={[
          { alignItems: "center", gap: 8 },
          !reduced && {
            animationName: {
              from: {
                opacity: 0,
                transform: [
                  { translateY: 18 },
                  { rotate: "-8deg" },
                  { scale: 0.94 },
                ],
              },
              to: {
                opacity: 1,
                transform: [
                  { translateY: 0 },
                  { rotate: "0deg" },
                  { scale: 1 },
                ],
              },
            },
            animationDuration: 500,
            animationTimingFunction: easeOut,
            animationFillMode: "both",
          },
        ]}
      >
        <Art name="dishes/teriyaki-chicken-bowl" size={180} />
        <T style={{ fontWeight: "600" }}>Teriyaki chicken bowl</T>
        <T style={s.caption}>13 oz serving</T>
      </Animated.View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {macros.map((nutrient, i) => (
          <Animated.View
            key={nutrient.icon}
            style={[
              {
                width: "47%",
                flexGrow: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderTopWidth: 1,
                borderColor: colors.rule,
                paddingVertical: 14,
              },
              !reduced && {
                animationName: {
                  from: {
                    opacity: 0,
                    transform: [
                      { translateX: i % 2 ? 36 : -36 },
                      { translateY: 12 },
                    ],
                  },
                  to: {
                    opacity: 1,
                    transform: [{ translateX: 0 }, { translateY: 0 }],
                  },
                },
                animationDuration: 350,
                animationDelay: 250 + i * 120,
                animationTimingFunction: easeOut,
                animationFillMode: "both",
              },
            ]}
          >
            <Art name={`icons/${nutrient.icon}`} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <NutrientAmount
                value={nutrient.value ?? null}
                unit={nutrient.unit}
                size="title"
              />
              <T style={s.caption}>{nutrient.label}</T>
            </View>
          </Animated.View>
        ))}
      </View>
      <Tap
        padding="row"
        style={{ marginHorizontal: -12 }}
        onPress={() => setMore(!more)}
        accessibilityState={{ expanded: more }}
      >
        <View style={s.between}>
          <T style={s.link}>
            {more ? "Fewer nutrients" : "Fiber, sugar, sodium & more"}
          </T>
          <Icon
            name={more ? "chevron-up" : "chevron-down"}
            sf={more ? "chevron.up" : "chevron.down"}
            color={colors.accent}
            size={16}
          />
        </View>
      </Tap>
      {more && (
        <Reveal>
          <NutritionDetails published={nutritionFood?.published_nutrition} />
        </Reveal>
      )}
    </View>
  );
}

const exampleReviews = [
  {
    name: "Maya",
    avatar: "bucky-beanie",
    karma: 128,
    stars: 5,
    food: "Teriyaki chicken bowl",
    art: "teriyaki-chicken-bowl",
    meal: "Lunch",
    comment:
      "Chicken was juicy, veggies still had a crunch. Ask for sauce on the side. Would get again!",
    up: 24,
    down: 1,
  },
  {
    name: "Leo",
    avatar: "bucky-scholar",
    karma: 64,
    stars: 2,
    food: "Chicken supreme pizza",
    art: "chicken-supreme-pizza",
    meal: "Dinner",
    comment:
      "Good toppings, but my slice was lukewarm and the crust was dry. I’d wait for a fresh tray.",
    up: 18,
    down: 2,
  },
];

function DemoReview({ review }: { review: (typeof exampleReviews)[number] }) {
  const { colors } = useTheme();
  const [vote, setVote] = useState(0);
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.rule,
        gap: 8,
      }}
    >
      <ReviewLayout
        photo={
          <Art
            name={`dishes/${review.art}`}
            style={{ width: "100%", height: undefined, aspectRatio: 1 }}
          />
        }
      >
        <T style={{ fontWeight: "600" }}>{review.food}</T>
        <RatingScore value={review.stars} size={30} />
      </ReviewLayout>
      <T>{review.comment}</T>
      <ReviewAuthor
        avatar={<Art name={`icons/${review.avatar}`} size={28} />}
        name={review.name}
        time="Today"
        trailing={
          <ReviewVotes
            upvotes={review.up + (vote === 1 ? 1 : 0)}
            downvotes={review.down + (vote === -1 ? 1 : 0)}
            selectedVote={vote}
            subject={`${review.name}’s example review`}
            onVote={(direction) => setVote(vote === direction ? 0 : direction)}
          />
        }
      />
    </View>
  );
}

function ReviewsPreview() {
  const { s } = useTheme();
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 12 }}>
        <IntroTitle>{"Reviews from\nfellow Broncos."}</IntroTitle>
        <T style={s.body}>
          What tasted great. What could be better. Rate the meals you’ve eaten,
          and help someone find their next favorite.
        </T>
      </View>
      {exampleReviews.map((review, i) => (
        <Reveal key={review.name} delay={120 + i * 100}>
          <DemoReview review={review} />
        </Reveal>
      ))}
    </View>
  );
}

export function Onboarding({
  onFinish,
  replay = false,
}: {
  onFinish: () => Promise<void> | void;
  replay?: boolean;
}) {
  const { colors, s } = useTheme();
  const { data } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const pending = useRef(false);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(chapters[step]);
  }, [step]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      if (step > 0) {
        setStep(step - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, busy]);
  const finish = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onFinish();
    } catch {
      setError("Couldn’t finish the intro. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const next = () => {
    if (step === 3) {
      void finish();
      return;
    }
    if (Platform.OS !== "web" && data.profile.haptics)
      void Haptics.selectionAsync().catch(() => {});
    setStep(step + 1);
  };
  return (
    <View
      style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}
    >
      <IntroProgress
        step={step}
        total={4}
        onBack={step ? () => setStep(step - 1) : undefined}
        disabled={busy}
      />
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: step ? 28 : 12,
          paddingBottom: 24,
          justifyContent: "center",
        }}
      >
        <Reveal key={step}>
          {step === 0 ? (
            <Welcome />
          ) : step === 1 ? (
            <MenuPreview />
          ) : step === 2 ? (
            <ReviewsPreview />
          ) : (
            <NutritionPreview />
          )}
        </Reveal>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 18),
          gap: 10,
          borderTopWidth: 1,
          borderColor: colors.rule,
          backgroundColor: colors.paper,
        }}
      >
        {Boolean(error) && (
          <T accessibilityRole="alert" style={{ color: colors.red }}>
            {error}
          </T>
        )}
        <Button
          title={
            busy
              ? "One moment…"
              : step === 0
                ? "Get started"
                : step < 3
                  ? "Continue"
                  : replay
                    ? "Done"
                    : "Let’s eat"
          }
          onPress={next}
          disabled={busy}
        />
      </View>
    </View>
  );
}
