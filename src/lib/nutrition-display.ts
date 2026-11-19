import { formatAmount } from "./domain";
import type { Food, FoodLog, Nutrient } from "./types";

export function isEstimatedNutrient(food: Food, factKey: string) {
  return food.estimated_nutrition
    ? food.estimated_nutrition.nutrients[factKey] != null
    : food.nutrition_source === "estimated";
}

export function totalIncludesEstimate(
  logs: FoodLog[],
  nutrient: { key: Nutrient; factKey: string },
) {
  return logs.some(
    ({ food }) =>
      food[nutrient.key] != null && isEstimatedNutrient(food, nutrient.factKey),
  );
}

export function roundedNutritionFacts(
  facts: PublishedNutrition,
  estimates = facts,
): PublishedNutrition {
  const result = { ...facts };
  for (const key of Object.keys(estimates)) {
    const fact = facts[key];
    if (!fact || key === "servingSize") continue;
    const value = nutrientValue(fact.value);
    if (value !== null && Number.isFinite(Number(value))) {
      result[key] = { ...fact, value: formatAmount(Number(value), 1, true) };
    }
  }
  return result;
}

export function foodNutritionFacts(food: Food): PublishedNutrition {
  const estimates = food.estimated_nutrition?.nutrients;
  const facts = { ...estimates, ...food.published_nutrition };
  return estimates || food.nutrition_source === "estimated"
    ? roundedNutritionFacts(facts, estimates)
    : facts;
}

export const mainNutritionKeys = [
  "calories",
  "proteinContent",
  "carbohydrateContent",
  "fatContent",
];
export type PublishedNutrition = Record<
  string,
  { value: string; unit: string; label?: string }
>;
export function nutrientValue(value: string | number | null | undefined) {
  if (value == null || String(value).trim() === "") return null;
  // A few source records include the unit in both fields.
  return String(value)
    .trim()
    .replace(/\s*(?:kcal|cal|mg|g)\s*$/i, "");
}
export const additionalNutrients = [
  {
    key: "fiberContent",
    label: "Fiber",
    unit: "g",
    art: "fiber",
    icon: "leaf-outline",
    sf: "leaf",
  },
  {
    key: "sugarContent",
    label: "Sugar",
    unit: "g",
    art: "sugar",
    icon: "cube-outline",
    sf: "cube",
  },
  {
    key: "sodiumContent",
    label: "Sodium",
    unit: "mg",
    art: "sodium",
    icon: "grid-outline",
    sf: "square.grid.3x3",
  },
  {
    key: "saturatedFatContent",
    label: "Saturated fat",
    unit: "g",
    art: "saturated-fat",
    icon: "water-outline",
    sf: "drop",
  },
  {
    key: "transFatContent",
    label: "Trans fat",
    unit: "g",
    art: "trans-fat",
    icon: "swap-horizontal-outline",
    sf: "arrow.left.arrow.right",
  },
  {
    key: "cholesterolContent",
    label: "Cholesterol",
    unit: "mg",
    art: "cholesterol",
    icon: "ellipse-outline",
    sf: "circle",
  },
] as const;
