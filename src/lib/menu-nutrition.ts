import { ingredientNutrition } from "./menu";
import type { PublishedNutrition } from "./nutrition-display";
import type { Component, Food, NutritionField, Offering } from "./types";

const fields = [
  ["calories_kcal", "calories", "", "Calories"],
  ["protein_g", "proteinContent", "g", "Protein"],
  ["carbohydrate_g", "carbohydrateContent", "g", "Total Carbohydrate"],
  ["total_fat_g", "fatContent", "g", "Total Fat"],
  ["fiber_g", "fiberContent", "g", "Dietary Fiber"],
  ["sugar_g", "sugarContent", "g", "Sugars"],
  ["sodium_mg", "sodiumContent", "mg", "Sodium"],
  ["saturated_fat_g", "saturatedFatContent", "g", "Saturated Fat"],
  ["trans_fat_g", "transFatContent", "g", "Trans Fat"],
  ["cholesterol_mg", "cholesterolContent", "mg", "Cholesterol"],
] as const;

const builders = new Set([
  "acai-bowl",
  "poke-bowl",
  "deli-sandwich",
  "salad-bar",
  "parrilla-builder",
  "byo-pasta-full",
]);
const addOnGroups = new Set([
  "Add-ons",
  "Add-On",
  "Drink add-ons",
  "Toppings",
  "Fruit",
  "Breakfast",
]);

// Keep this calculation in sync with the save RPC in
// 20261119120400_benson_nutrition_estimates.sql.
export function menuNutrition(
  food: Food,
  offering: Offering | undefined,
  components: Component[],
  size: string | undefined,
  choices: string[],
): Food {
  const groups = offering?.modifier_groups ?? [];
  const builder = builders.has(
    offering?.source_occurrence_key?.split(":").at(-1) ?? "",
  );
  const selected = groups.flatMap((group) =>
    group.options
      .filter((option) => choices.includes(option.key))
      .map((option) => ({ group: group.name, option })),
  );
  const removedDefault = groups.some((group) =>
    group.options.some(
      (option) => option.default && !choices.includes(option.key),
    ),
  );
  const selectedSize = offering?.serving_options?.find(
    (option) => option.label === size,
  );
  const fluidOunces = selectedSize?.label.match(/^(\d+(?:\.\d+)?) fl oz$/i);
  const referenceSize = food.estimated_nutrition?.reference_fl_oz;
  const sizeFactor =
    fluidOunces && referenceSize
      ? Number(fluidOunces[1]) / referenceSize
      : null;
  const unsupportedSize =
    size != null && !selectedSize?.published_serving && sizeFactor == null;
  const addsOrChanges = selected.some(({ option }) => !option.default);
  const resized = sizeFactor != null && sizeFactor !== 1;
  if (
    !builder &&
    !removedDefault &&
    !unsupportedSize &&
    !addsOrChanges &&
    !resized
  )
    return food;

  const replacesDrink =
    groups.length === 1 &&
    groups[0].name === "Fountain choices" &&
    selected.length === 1;
  const baseChanged =
    unsupportedSize ||
    removedDefault ||
    selected.some(
      ({ group, option }) =>
        !option.default &&
        !addOnGroups.has(group) &&
        !/^add-on /i.test(option.label),
    );
  const includeBase = !builder && !replacesDrink && !baseChanged;
  const missingBase = !builder && !replacesDrink && baseChanged;
  const servings = selected
    .filter(
      ({ option }) =>
        (!includeBase || !option.default) &&
        option.key !== "component:trattoria:no-sauce",
    )
    .map(({ group, option }) => {
      const component = components.find((c) => c.id === option.component_id);
      if (!component) return null;
      const published = ingredientNutrition(component);
      const estimate = component.estimated_nutrition;
      return (
        published ??
        (group === "Fountain choices" && estimate?.serving === "16 fl oz"
          ? estimate.nutrients
          : null)
      );
    });
  const published: Food["published_nutrition"] = {};
  const incomplete: NutritionField[] = [];
  const totals: Partial<Food> = {};

  for (const [field, key, unit, label] of fields) {
    const values = servings.map((serving) =>
      publishedAmount(serving, key, unit),
    );
    if (includeBase) {
      const base = food[field];
      values.unshift(base == null ? null : base * (sizeFactor ?? 1));
    }
    const known = values.filter((value) => value != null);
    const total = known.length
      ? Number(known.reduce((sum, value) => sum + value, 0).toFixed(4))
      : null;
    totals[field] = total;
    if (missingBase || known.length < values.length) incomplete.push(field);
    if (total != null) published[key] = { value: String(total), unit, label };
  }
  return {
    ...food,
    ...totals,
    estimated_nutrition:
      includeBase && !addsOrChanges ? food.estimated_nutrition : null,
    serving_description:
      size ?? (includeBase || builder ? food.serving_description : null),
    published_nutrition: published,
    incomplete_nutrients: incomplete,
    nutrition_source: Object.keys(published).length
      ? "estimated"
      : "unavailable",
  };
}

function publishedAmount(
  facts: PublishedNutrition | null,
  key: string,
  unit: string,
) {
  const fact = facts?.[key];
  return fact && fact.unit === unit && /^[0-9]+(\.[0-9]+)?$/.test(fact.value)
    ? Number(fact.value)
    : null;
}

export function menuNutritionNote(food: Food) {
  if (food.nutrition_source === "unavailable")
    return "Nutrition facts are unavailable for this selection.";
}
