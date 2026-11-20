import AccountPrompt from "../components/account-prompt";
import { useTheme } from "../state/ThemeProvider";
import { backOrReplace } from "../lib/navigation";
import React, { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useApp } from "../state/AppProvider";
import { Art, BackHeader, Button, Chip, T } from "../components/ui";
import { MenuOptions } from "../components/MenuOptions";
import { menuNutrition, menuNutritionNote } from "../lib/menu-nutrition";
import { initialChoices, initialSize, validChoices } from "../lib/menu-options";
import { FoodImage } from "../components/Food";
import {
  currentMeal,
  displayName,
  formatAmount,
  NUTRIENTS,
} from "../lib/domain";
import { isEstimatedNutrient } from "../lib/nutrition-display";
import { NutrientAmount } from "../components/nutrient-display";

export default function LogFood() {
  const { session } = useApp();
  const { food, edit } = useLocalSearchParams<{ food?: string; edit?: string }>();
  if (!session) {
    if (edit || !food) return <Redirect href={edit ? "/nutrition" : "/menu"} />;
    return (
      <AccountPrompt
        inSheet={Platform.OS === "ios"}
        prompt="Sign in to log your food."
      />
    );
  }
  return <FoodLogForm />;
}

function FoodLogForm() {
  const { colors, s } = useTheme();
  const {
    food: foodId,
    meal,
    edit,
    offering: offeringId,
    size: requestedSize,
    choices: requestedChoices,
  } = useLocalSearchParams<{
    food?: string;
    meal?: string;
    edit?: string;
    offering?: string;
    size?: string;
    choices?: string;
  }>();
  const { catalog, data, addFood, updateLog, deleteLog, notify } = useApp();
  const previous = data.logs.find((l) => l.id === edit);
  const food = edit
    ? previous?.food
    : catalog.foods.find((f) => f.id === foodId);
  const offering = catalog.offerings.find(
    (entry) => entry.id === offeringId && entry.food_version_id === food?.id,
  );
  const hasOptions = Boolean(
    offering?.modifier_groups?.length || offering?.serving_options?.length,
  );
  const [sizeOverride, setSize] = useState<string>();
  const [choiceOverride, setChoices] = useState<string[]>();
  const size = sizeOverride ?? initialSize(offering, requestedSize);
  const choices = choiceOverride ?? initialChoices(offering, requestedChoices);
  const valid =
    (!offering?.serving_options?.length || Boolean(size)) &&
    validChoices(offering, choices);
  const servings = previous?.servings ?? 1;
  const [period, setPeriod] = useState(
    previous?.meal_label ??
      (["Breakfast", "Lunch", "Dinner", "Dessert", "Snack"].includes(meal ?? "")
        ? meal!
        : currentMeal()),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [selectedReview, setSelectedReview] = useState<string | undefined>();
  if (!food)
    return (
      <>
        <BackHeader />
        <T style={s.inset}>
          {edit
            ? "Food log unavailable."
            : "Choose a dish from the menu first."}
        </T>
      </>
    );
  const nutrition = previous
    ? food
    : menuNutrition(food, offering, catalog.components, size, choices);
  const nutritionNote =
    hasOptions || previous?.menu_selection
      ? menuNutritionNote(nutrition)
      : undefined;
  const history = data.history.filter((h) => h.log_id === edit);
  const reviews = data.reviews.filter(
    (r) => r.eating_id && history.some((h) => h.id === r.eating_id),
  );
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (previous) {
        await updateLog(previous.id, previous.servings, period);
        backOrReplace("/nutrition");
        notify("Food log updated");
      } else {
        const id = await addFood(
          food,
          period,
          undefined,
          offering && hasOptions
            ? { offering_id: offering.id, size, choices }
            : undefined,
        );
        backOrReplace("/nutrition");
        notify("Added to your food", "Undo", () =>
          deleteLog(id, undefined, true),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 50 }}
    >
      <BackHeader title={edit ? "Edit Your Food" : "A Bite for Your Day"} />
      <View style={[s.inset, { gap: 19, paddingTop: 10 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
          <View>
            <FoodImage food={food} size={100} />
          </View>
          <View style={{ flex: 1 }}>
            <T
              style={{
                fontSize: 21,
                lineHeight: 27,
                fontWeight: "600",
                letterSpacing: -0.5,
              }}
            >
              {displayName(food.name)}
            </T>
            <T style={[s.caption, { marginTop: 6 }]}>
              1 serving
              {previous?.menu_selection?.size ||
              size ||
              food.serving_description
                ? ` · ${previous?.menu_selection?.size ?? size ?? food.serving_description}`
                : ""}
            </T>
          </View>
        </View>
        {!previous && offering && hasOptions && (
          <MenuOptions
            offering={offering}
            serviceDate={
              catalog.services.find(
                (service) => service.id === offering.menu_service_id,
              )?.service_date
            }
            selection={{
              size,
              choices,
              onSize: setSize,
              onChoices: setChoices,
            }}
          />
        )}
        {Boolean(previous?.menu_selection?.choices.length) && (
          <T style={s.body}>
            {previous?.menu_selection?.choices
              .map((choice) => displayName(choice.label))
              .join(" · ")}
          </T>
        )}
        <View>
          <T style={{ fontWeight: "600", marginBottom: 12 }}>Which Meal?</T>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {["Breakfast", "Lunch", "Dinner", "Dessert", "Snack"].map(
              (value) => (
                <Chip
                  key={value}
                  title={value}
                  selected={period === value}
                  onPress={() => setPeriod(value)}
                />
              ),
            )}
          </ScrollView>
        </View>
        <View style={{ gap: 12 }}>
          <T style={{ fontSize: 14 }}>
            Added to your nutrition
            {servings !== 1 ? ` · ${servings} servings logged` : ""}
          </T>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {NUTRIENTS.slice(0, 4).map((nutrient) => (
              <View
                key={nutrient.key}
                style={{ flex: 1, alignItems: "center", gap: 4 }}
              >
                <Art name={`icons/${nutrient.icon}`} size={32} />
                <NutrientAmount
                  value={formatAmount(
                    nutrition[nutrient.key],
                    servings,
                    isEstimatedNutrient(nutrition, nutrient.factKey),
                  )}
                  unit={nutrient.unit}
                />
                <T style={s.caption}>{nutrient.label}</T>
              </View>
            ))}
          </View>
          {nutritionNote && <T style={s.caption}>{nutritionNote}</T>}
        </View>
        {Boolean(error) && (
          <T
            accessibilityRole="alert"
            style={{ color: colors.red, fontSize: 14 }}
          >
            {error}
          </T>
        )}
        <Button
          title={
            busy
              ? "Saving…"
              : edit
                ? "Save changes"
                : "I ate this · Add to my food"
          }
          disabled={busy || (!previous && !valid)}
          onPress={submit}
        />
        {Boolean(edit) && (
          <Button
            secondary
            title="Delete food log"
            onPress={() => setDeleting(true)}
          />
        )}
        {deleting && (
          <View style={[s.note, { gap: 12 }]}>
            <T style={{ fontWeight: "600" }}>Choose What to Remove</T>
            <T style={s.caption}>
              Deleting only the log preserves your review and your history of
              having eaten this dish.
            </T>
            {reviews.map((r) => (
              <Chip
                key={r.id}
                title={`Also delete ${r.stars}-star review`}
                selected={selectedReview === r.id}
                onPress={() =>
                  setSelectedReview(selectedReview === r.id ? undefined : r.id)
                }
              />
            ))}
            <Button
              title={
                busy
                  ? "Deleting…"
                  : selectedReview
                    ? "Delete log and selected review"
                    : "Delete log only"
              }
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await deleteLog(edit!, selectedReview);
                  backOrReplace("/nutrition");
                  notify("Food log deleted");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button
              secondary
              title="Keep my log"
              onPress={() => setDeleting(false)}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
