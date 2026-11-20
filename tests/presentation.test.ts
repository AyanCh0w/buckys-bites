import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/data/catalog.json";
import { dailyKitchenHours, foodIsOpen } from "../src/lib/availability";
import {
  calorieStack,
  foodNutritionFacts,
  nutrientValue,
  roundedNutritionFacts,
  totalIncludesEstimate,
} from "../src/lib/nutrition-display";
import { formatAmount, nutritionTotals } from "../src/lib/domain";
import { menuNutritionNote } from "../src/lib/menu-nutrition";
import {
  createNutrientDrops,
  nutrientRainIcons,
} from "../src/lib/nutrient-rain";
import type { Catalog, Food, FoodLog, Service } from "../src/lib/types";

function chartLog(food: Partial<Food>, servings = 1) {
  return { food, servings } as FoodLog;
}

test("calorie stacks use energy per gram and the logged serving size", () => {
  const food = {
    calories_kcal: 170,
    protein_g: 10,
    carbohydrate_g: 10,
    total_fat_g: 10,
  };
  assert.deepEqual(calorieStack([chartLog(food, 1.5)]), {
    protein: 60,
    carbs: 60,
    fat: 135,
    unassigned: 0,
  });
});

test("calorie stacks keep each dish within its energy total and preserve unattributed calories", () => {
  const logs = [
    chartLog({ calories_kcal: 40, protein_g: 10, carbohydrate_g: 10 }),
    chartLog({ calories_kcal: 100, protein_g: 5 }, 0.5),
    chartLog({ calories_kcal: 20 }, 2),
    chartLog({ calories_kcal: null, total_fat_g: 10 }),
    chartLog({ calories_kcal: 0, total_fat_g: 1 }),
  ];
  assert.deepEqual(calorieStack(logs), {
    protein: 30,
    carbs: 20,
    fat: 0,
    unassigned: 80,
  });
});

test("nutrition rain scales each icon in its own units and stays bounded", () => {
  const food = {
    calories_kcal: 120,
    protein_g: 8,
    sodium_mg: 300,
    sugar_g: 10,
    fiber_g: null,
    total_fat_g: 0,
    carbohydrate_g: null,
    saturated_fat_g: null,
  };
  assert.deepEqual(nutrientRainIcons(food).sort(), [
    "calories",
    "protein",
    "sodium",
    "sugar",
  ]);
  const richer = nutrientRainIcons({
    ...food,
    calories_kcal: 720,
    protein_g: 32,
    fiber_g: 6,
  });
  assert.equal(richer.filter((icon) => icon === "calories").length, 4);
  assert.equal(richer.filter((icon) => icon === "protein").length, 4);
  assert.equal(richer.filter((icon) => icon === "fiber").length, 3);
  const large = Object.fromEntries(
    Object.keys(food).map((key) => [key, 10000]),
  );
  assert.equal(nutrientRainIcons({ ...food, ...large }).length, 16);
});

test("nutrition rain only uses available positive amounts", () => {
  const food = {
    calories_kcal: null,
    protein_g: null,
    carbohydrate_g: 0,
    total_fat_g: 0,
    fiber_g: null,
    sugar_g: null,
    sodium_mg: NaN,
    saturated_fat_g: -1,
  };
  assert.deepEqual(nutrientRainIcons(food), []);
  assert.deepEqual(nutrientRainIcons({ ...food, fiber_g: 0.5 }), ["fiber"]);
});

test("randomized tumbles preserve the mix and space each wave", () => {
  const icons = Array.from({ length: 16 }, (_, i) =>
    i % 3 ? "calories" : "sodium",
  );
  const clockwise = createNutrientDrops(icons, () => 0.9);
  const counterclockwise = createNutrientDrops(icons, () => 0.1);
  assert.ok(clockwise.every((drop) => drop.spin > 0));
  assert.ok(counterclockwise.every((drop) => drop.spin < 0));
  assert.notEqual(clockwise[0].left, counterclockwise[0].left);
  for (const burst of [clockwise, counterclockwise]) {
    assert.deepEqual(burst.map((drop) => drop.icon).sort(), [...icons].sort());
    assert.equal(burst.filter((drop) => Math.abs(drop.spin) >= 355).length, 1);
    for (let i = 0; i < burst.length; i += 4) {
      const lanes = burst
        .slice(i, i + 4)
        .map((drop) => drop.left)
        .sort((a, b) => a - b);
      assert.ok(lanes.slice(1).every((left, j) => left - lanes[j] >= 16));
    }
  }
});

test("every shower runs for 2.5 seconds and reaches the lower screen", () => {
  for (let count = 1; count <= 16; count++) {
    const drops = createNutrientDrops(Array<string>(count).fill("calories"));
    assert.equal(Math.min(...drops.map((drop) => drop.delay)), 0);
    assert.equal(
      Math.max(...drops.map((drop) => drop.delay + drop.duration)),
      2500,
    );
    assert.ok(
      drops.every(
        (drop) => drop.duration > 0 && drop.depth >= 0.86 && drop.depth <= 1,
      ),
    );
  }
});

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
