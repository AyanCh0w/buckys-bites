import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/data/catalog.json";
import { dailyKitchenHours, foodIsOpen } from "../src/lib/availability";
import {
  foodNutritionFacts,
  nutrientValue,
  roundedNutritionFacts,
  totalIncludesEstimate,
} from "../src/lib/nutrition-display";
import { formatAmount, nutritionTotals } from "../src/lib/domain";
import { menuNutritionNote } from "../src/lib/menu-nutrition";
import type { Catalog, Food, FoodLog, Service } from "../src/lib/types";

const breakfast = {
  id: "breakfast",
  name: "Breakfast",
  service_date: "2026-11-18",
  status: "published",
  starts_at: "2026-11-18T15:00:00Z",
  ends_at: "2026-11-18T18:30:00Z",
} as Service;
const lunch = {
  ...breakfast,
  id: "lunch",
  name: "Lunch",
  starts_at: "2026-11-18T19:00:00Z",
  ends_at: "2026-11-19T01:00:00Z",
};
const dinner = {
  ...breakfast,
  id: "dinner",
  name: "Dinner",
  starts_at: "2026-11-19T01:00:00Z",
  ends_at: "2026-11-19T05:00:00Z",
};

test("standard kitchen hours repeat daily, preserve breaks and merge lunch into dinner", () => {
  const services = [breakfast, lunch, dinner];
  assert.equal(
    dailyKitchenHours(services, new Date("2026-11-20T16:00:00Z")).label,
    "Closes 10:30 AM",
  );
  assert.equal(
    dailyKitchenHours(services, new Date("2026-11-20T18:30:00Z")).label,
    "Opens 11 AM",
  );
  assert.equal(
    dailyKitchenHours(services, new Date("2026-11-20T20:00:00Z")).label,
    "Closes 9 PM",
  );
  assert.equal(
    dailyKitchenHours(services, new Date("2026-11-21T05:00:00Z")).label,
    "Opens tomorrow 7 AM",
  );
  assert.equal(
    dailyKitchenHours(services, new Date("2026-11-21T08:00:00Z")).label,
    "Opens 7 AM",
  );
  // In summer, 7 AM campus time is 14:00 UTC, not the winter template's 15:00.
  assert.equal(
    dailyKitchenHours(services, new Date("2027-06-10T14:00:00Z")).open,
    true,
  );
  assert.equal(
    dailyKitchenHours(services, new Date("2027-06-10T13:59:00Z")).open,
    false,
  );
  assert.equal(dailyKitchenHours([], new Date()).label, "Hours unavailable");
});

test("repeating hours do not repeat a dish's menu availability", () => {
  const food = { id: "dish", food_item_id: "item" };
  const catalog = {
    services: [lunch],
    offerings: [
      { food_version_id: "dish", is_listed: true, menu_service_id: "lunch" },
    ],
  } as Catalog;
  assert.equal(
    dailyKitchenHours([lunch], new Date("2026-11-20T20:00:00Z")).open,
    true,
  );
  assert.equal(
    foodIsOpen(catalog, food as any, new Date("2026-11-20T20:00:00Z")),
    false,
  );
});

test("nutrition units are shown once beside the value and unknown stays unknown", () => {
  assert.equal(nutrientValue("2g"), "2");
  assert.equal(nutrientValue("350 mg"), "350");
  assert.equal(nutrientValue("260 kcal"), "260");
  assert.equal(nutrientValue(0), "0");
  assert.equal(nutrientValue(""), null);
  assert.equal(nutrientValue(undefined), null);
});

test("estimates round for display after serving calculations and preserve published labels", () => {
  const protein = { value: "2.45", unit: "g", label: "Protein" };
  const nutrients = { proteinContent: protein };
  const food: Food = {
    ...(catalog as Catalog).foods[0],
    nutrition_source: "estimated",
    protein_g: 2.45,
    estimated_nutrition: { nutrients, note: "Reference serving", sources: [] },
    published_nutrition: {
      fatContent: { ...protein, label: "Fat", value: "1.5" },
    },
  };
  assert.equal(foodNutritionFacts(food).proteinContent.value, "2");
  assert.equal(foodNutritionFacts(food).fatContent.value, "1.5");
  assert.equal(roundedNutritionFacts(nutrients).proteinContent.value, "2");
  assert.equal(nutrients.proteinContent.value, "2.45");
  const logs = [{ food, servings: 2 }] as FoodLog[];
  const estimated = totalIncludesEstimate(logs, {
    key: "protein_g",
    factKey: "proteinContent",
  });
  assert.equal(
    formatAmount(nutritionTotals(logs).protein_g.value, 1, estimated),
    "5",
  );
  assert.equal(formatAmount(food.protein_g, 2, estimated), "5");
  assert.equal(menuNutritionNote(food), undefined);
  assert.equal(
    foodNutritionFacts({
      ...food,
      published_nutrition: { proteinContent: { ...protein, value: "< 5" } },
    }).proteinContent.value,
    "< 5",
  );
  const customized = {
    ...food,
    estimated_nutrition: null,
    published_nutrition: nutrients,
  };
  assert.equal(foodNutritionFacts(customized).proteinContent.value, "2");
  assert.equal(menuNutritionNote(customized), undefined);
});
