import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/data/catalog.json";
import {
  serviceIsOpen,
  browsingCatalog,
  kitchenDishSections,
  kitchenMenus,
  ingredientNutrition,
} from "../src/lib/menu";
import { dishContext, nutritionTotals } from "../src/lib/domain";
import { dailyStationMenus } from "../src/lib/home";
import { menuNutrition } from "../src/lib/menu-nutrition";
import {
  initialChoices,
  initialSize,
  savedChoiceKeys,
  toggleChoice,
  validChoices,
  withBurgerBreadOptions,
} from "../src/lib/menu-options";
import type { Catalog, Component, FoodLog, Service } from "../src/lib/types";
const service = {
  status: "published",
  service_date: "2026-11-18",
  starts_at: "2026-11-18T19:00:00Z",
  ends_at: "2026-11-18T22:30:00Z",
} as Service;

test("The Fire leads with its smash burger and groups combos, mains and sides", () => {
  const model = catalog as Catalog;
  const fire = model.stations.find((station) => station.name === "The Fire")!;
  const placements = new Map(
    model.offerings
      .filter(
        (offering) => offering.is_listed && offering.station_id === fire.id,
      )
      .map((offering) => [offering.food_version_id, offering]),
  );
  const foods = model.foods.filter((food) => placements.has(food.id));
  const sections = kitchenDishSections("fire", foods, placements);
  assert.deepEqual(
    [...sections.keys()],
    [
      "Burgers",
      "Sandwiches & Tenders",
      "Bowls",
      "From the Grill",
      "Fries & Sides",
      "Drinks",
    ],
  );
  const burgers = sections.get("Burgers")!;
  assert.equal(burgers[0].name, "Signature Smash Burger");
  assert.deepEqual(
    new Set(burgers.map((food) => food.name)),
    new Set([
      "Signature Smash Burger",
      "Cheese Burger Combo",
      "Bacon Cheese Burger Combo",
    ]),
  );
  assert.ok(
    sections
      .get("Sandwiches & Tenders")!
      .some((food) => food.name.includes("Tenders w/ Fries")),
  );
  assert.deepEqual(
    [...sections.values()]
      .flat()
      .map((food) => food.id)
      .sort(),
    foods.map((food) => food.id).sort(),
  );
});

test("published station pairs follow the saved meal preference", () => {
  const lunch = (dietary: string[], date = "2026-11-19") =>
    dailyStationMenus(catalog as Catalog, date, "Lunch", dietary).map(
      (station) => station.options.map(({ food }) => food.name),
    );
  assert.deepEqual(lunch([]), [
    ["Korean Style Chicken Noodle Stir Fry"],
    ["Beef Ropa Vieja"],
    ["Aji Roasted Chicken"],
    [],
  ]);
  assert.deepEqual(lunch(["Vegetarian"]), [
    ["Korean Style Impossible Noodle Stir Fry"],
    ["Jackfruit Ropa Vieja"],
    ["Grilled Spiced Portobello"],
    [],
  ]);
  assert.deepEqual(lunch(["Vegan"]), [
    [],
    ["Jackfruit Ropa Vieja"],
    ["Grilled Spiced Portobello"],
    [],
  ]);
  // Two different entrées, each with its own accompaniments.
  assert.deepEqual(lunch([], "2026-11-20")[2], [
    "Grilled Vegetable Involtini",
    "Herb Roasted Turkey Breast",
  ]);
});

test("only a listed counterpart in the same service, station and section can replace an offering", () => {
  const base = catalog as Catalog;
  const station = base.stations.find((s) => s.name === "The Spice Market")!;
  const dinner = base.services.find(
    (s) =>
      s.cafe_id === station.cafe_id &&
      s.name === "Dinner" &&
      s.service_date === service.service_date,
  )!;
  const food = (name: string, dietary_tags: string[]) => ({
    ...base.foods[0],
    name,
    id: name,
    food_item_id: name,
    dietary_tags,
    source_recipe_ids: [],
  });
  const foods = [
    food("Beef Chili", []),
    food("Vegetarian Chili", ["Vegetarian"]),
    food("Vegan Chili", ["Vegan"]),
    food("Lentil Soup", ["Vegan"]),
  ];
  const offerings = foods.map((f) => ({
    ...base.offerings[0],
    id: f.id,
    food_version_id: f.id,
    station_id: station.id,
    menu_service_id: dinner.id,
    menu_section: "Specials",
    is_listed: true,
  }));
  const model = { ...base, foods, offerings };
  const displayed = (dietary: string[]) =>
    dailyStationMenus(
      browsingCatalog(model, dietary),
      dinner.service_date,
      "Dinner",
      dietary,
    )[0]
      .options.map((o) => o.food.name)
      .sort();
  assert.deepEqual(displayed([]), ["Beef Chili", "Lentil Soup"]);
  assert.deepEqual(displayed(["Vegetarian"]), [
    "Lentil Soup",
    "Vegetarian Chili",
  ]);
  assert.deepEqual(displayed(["Vegan"]), ["Lentil Soup", "Vegan Chili"]);
  const soupAndChili = {
    ...model,
    foods: [foods[0], foods[3]].map((f) => ({
      ...f,
      source_recipe_ids: [f.id, "rice"],
    })),
    offerings: [offerings[0], offerings[3]],
  };
  assert.equal(browsingCatalog(soupAndChili).offerings.length, 2);
  for (const change of [
    { menu_service_id: "another-service" },
    { station_id: base.stations.find((s) => s.name === "Simply Oasis")!.id },
    { menu_section: "Elsewhere" },
    { is_listed: false },
  ]) {
    const separate = {
      ...model,
      offerings: [{ ...offerings[0], ...change }, offerings[1]],
    };
    assert.ok(
      browsingCatalog(separate).offerings.some(
        (o) => o.id === "Vegetarian Chili",
      ),
    );
  }
});
test("availability uses published campus hours and an exclusive closing boundary", () => {
  assert.equal(serviceIsOpen(service, new Date("2026-11-18T18:59:59Z")), false);
  assert.equal(serviceIsOpen(service, new Date("2026-11-18T19:00:00Z")), true);
  assert.equal(serviceIsOpen(service, new Date("2026-11-18T22:30:00Z")), false);
  assert.equal(
    serviceIsOpen(
      { ...service, starts_at: null },
      new Date("2026-11-18T20:00:00Z"),
    ),
    false,
  );
  const afternoon = kitchenMenus(
    catalog as Catalog,
    new Date("2026-11-18T20:00:00Z"),
  );
  const closed = kitchenMenus(
    catalog as Catalog,
    new Date("2026-11-19T07:58:00Z"),
  );
  assert.ok(afternoon.some((k) => k.open));
  assert.ok(closed.every((k) => !k.open));
  assert.deepEqual(
    afternoon.map((k) => k.key).sort(),
    closed.map((k) => k.key).sort(),
  );
  assert.equal(
    kitchenMenus(catalog as Catalog, new Date("2026-11-20T20:00:00Z")).some(
      (k) => k.open,
    ),
    true,
  );
});
test("ingredient nutrition requires one unambiguous independent serving", () => {
  const tortilla = (catalog as Catalog).components.find(
    (c) => c.name === "flour tortilla",
  )!;
  assert.equal(ingredientNutrition(tortilla)?.calories.value, "260");
  assert.equal(
    ingredientNutrition({ ...tortilla, published_serving_candidates: [] }),
    null,
  );
  const a = {
    kind: "standalone",
    nutrition: {
      servingSize: { value: "1", unit: "oz" },
      calories: { value: "30", unit: "" },
    },
  };
  const b = {
    ...a,
    nutrition: { ...a.nutrition, calories: { value: "50", unit: "" } },
  };
  assert.equal(
    ingredientNutrition({
      ...tortilla,
      published_serving_candidates: [a, b],
    } as Component),
    null,
  );
});

test("Benson browses the dedicated bakery and respects known campus closures", () => {
  const browsable = browsingCatalog(catalog as Catalog);
  const weekday = kitchenMenus(browsable, new Date("2026-11-19T20:00:00Z"));
  assert.equal(weekday[0].key, "mission-bakery");
  assert.equal(weekday[0].open, true);
  assert.ok(weekday.every(({ key }) => key !== "toast-bar" && key !== "soup"));
  assert.equal(
    weekday.filter((kitchen) => kitchen.key === "mission-bakery").length,
    1,
  );
  assert.ok(weekday.some((kitchen) => kitchen.key === "sushi" && kitchen.open));
  const holiday = kitchenMenus(browsable, new Date("2026-11-25T19:00:00Z"));
  assert.deepEqual(
    holiday.filter((kitchen) => kitchen.open).map((kitchen) => kitchen.key),
    ["mission-bakery"],
  );
  assert.equal(
    holiday.find((kitchen) => kitchen.key === "simply-oasis")?.featured,
    undefined,
  );
  const coastClosed = kitchenMenus(browsable, new Date("2026-11-26T20:00:00Z"));
  assert.ok(coastClosed.every((kitchen) => !kitchen.open && !kitchen.featured));
});

test("Mission Bakery is prioritized by its default star and follows regular sorting when unstarred", () => {
  const browsable = browsingCatalog(catalog as Catalog);
  const open = new Date("2026-11-19T20:00:00Z");
  const closed = new Date("2026-11-26T20:00:00Z");
  assert.equal(kitchenMenus(browsable, open)[0].key, "mission-bakery");
  assert.equal(kitchenMenus(browsable, closed)[0].key, "mission-bakery");
  assert.equal(
    kitchenMenus(browsable, open, [], null, [], ["trattoria"])[0].key,
    "trattoria",
  );
  assert.notEqual(
    kitchenMenus(browsable, open, [], null, [], [])[0].key,
    "mission-bakery",
  );
});

test("dated dish options reach the log with defaults and the observed group limit", () => {
  const model = catalog as Catalog;
  const pasta = model.foods.find(
    (food) => food.name === "BYO Pasta - Full Portion",
  )!;
  const { offering: lunch } = dishContext(model, pasta, "2026-11-19", "Lunch");
  const { offering: dinner } = dishContext(
    model,
    pasta,
    "2026-11-19",
    "Dinner",
  );
  assert.ok(lunch && dinner && lunch.id !== dinner.id);
  assert.equal(
    dishContext(model, pasta, "2026-11-26", "Lunch").offering,
    undefined,
  );
  const vegetables = lunch.modifier_groups!.find(
    (group) => group.name === "Vegetables",
  )!;
  const defaults = initialChoices(lunch);
  assert.equal(defaults.length, 2);
  assert.equal(validChoices(lunch, []), false);
  assert.equal(validChoices(lunch, defaults), true);
  const selected = vegetables.options
    .slice(0, 4)
    .reduce(
      (choices, option) => toggleChoice(choices, vegetables, option),
      defaults,
    );
  assert.equal(selected.length, 5);
  assert.ok(!selected.includes(vegetables.options[3].key));
  const pastaGroup = lunch.modifier_groups!.find(
    (group) => group.name === "Pasta",
  )!;
  const alternate = pastaGroup.options.find(
    (option) => !defaults.includes(option.key),
  )!;
  const customized = toggleChoice(selected, pastaGroup, alternate);
  assert.equal(
    pastaGroup.options.filter((option) => customized.includes(option.key))
      .length,
    1,
  );
  assert.deepEqual(
    initialChoices(lunch, JSON.stringify(customized)),
    customized,
  );
  assert.deepEqual(
    initialChoices(lunch, JSON.stringify([...customized, "unknown"])),
    defaults,
  );
  assert.deepEqual(initialChoices(lunch, JSON.stringify([])), defaults);

  const sizes = {
    ...lunch,
    serving_options: [
      { label: "Small", published_serving: true },
      { label: "Large" },
    ],
  };
  assert.equal(initialSize(sizes, "Large"), "Large");
  assert.equal(initialSize(sizes, "Unknown"), "Small");
});

test("a burger has one bread choice and keeps its toppings through logging", () => {
  const model = withBurgerBreadOptions(catalog as Catalog);
  const burgers = model.foods.filter((food) => /burger/i.test(food.name));
  assert.ok(burgers.some((food) => food.name === "Signature Smash Burger"));
  for (const food of burgers) {
    const { offering } = dishContext(model, food, "2026-11-19");
    assert.ok(offering);
    const groups = offering.modifier_groups!;
    const bread = groups.find((group) => group.name === "Bread and wraps")!;
    const toppings = groups.find((group) => group.name === "Toppings")!;
    const wrap = bread.options.find(
      (option) => option.label === "Lettuce wrap",
    )!;
    const defaults = initialChoices(offering);
    const standardBun = bread.options.find(
      (option) => option.label === "Hamburger bun",
    )!;
    assert.ok(defaults.includes(standardBun.key));
    assert.equal(
      menuNutrition(food, offering, model.components, undefined, defaults),
      food,
    );
    const switched = toggleChoice(defaults, bread, wrap);
    assert.ok(!switched.includes(standardBun.key));
    assert.equal(switched.length, defaults.length);
    assert.deepEqual(
      initialChoices(offering, JSON.stringify(switched)),
      switched,
    );
    const historical = { offering_id: offering.id, choices: [] };
    assert.deepEqual(savedChoiceKeys(offering, historical, true), defaults);
    assert.deepEqual(savedChoiceKeys(offering, historical, false), []);
    assert.equal(bread.max, 1);
    assert.ok(validChoices(offering, []));
    const first = toggleChoice(
      [toppings.options[0].key],
      bread,
      bread.options[0],
    );
    const changed = toggleChoice(first, bread, wrap);
    assert.deepEqual(changed, [toppings.options[0].key, wrap.key]);
    assert.deepEqual(toggleChoice(changed, bread, wrap), changed);
    assert.deepEqual(
      initialChoices(offering, JSON.stringify(changed)),
      changed,
    );
    assert.equal(
      validChoices(offering, [...changed, bread.options[0].key]),
      false,
    );
    assert.deepEqual(
      new Set(
        savedChoiceKeys(offering, {
          offering_id: offering.id,
          choices: [
            { group: "Vegetables", label: wrap.label },
            { group: toppings.name, label: toppings.options[0].label },
          ],
        }),
      ),
      new Set(changed),
    );
  }
  const sandwich = model.foods.find(
    (food) => food.name === "Build Your Own Deli Sandwich",
  )!;
  const { offering } = dishContext(model, sandwich, "2026-11-19");
  assert.ok(offering);
  assert.equal(
    offering,
    (catalog as Catalog).offerings.find((entry) => entry.id === offering.id),
  );
});

test("menu selections preview published ingredients, add-ons and partial meals", () => {
  const snapshot = catalog as Catalog;
  const select = (name: string, labels: string[], size?: string) => {
    const offering = snapshot.offerings.find(
      (o) =>
        o.is_listed &&
        (o.modifier_groups?.length || o.serving_options?.length) &&
        snapshot.foods.some(
          (f) => f.id === o.food_version_id && f.name === name,
        ),
    )!;
    const food = snapshot.foods.find((f) => f.id === offering.food_version_id)!;
    const choices =
      offering.modifier_groups
        ?.flatMap((group) => group.options)
        .filter((option) => labels.includes(option.label))
        .map((option) => option.key) ?? [];
    assert.equal(choices.length, labels.length);
    return menuNutrition(food, offering, snapshot.components, size, choices);
  };
  const bowl = select("Poke Bowl", [
    "Forsman Ranch Brown Rice",
    "tuna",
    "half avocado",
  ]);
  assert.equal(bowl.calories_kcal, 390);
  assert.equal(bowl.protein_g, 37);
  assert.equal(bowl.published_nutrition.calories.value, "390");
  assert.equal(
    select("Poke Bowl", ["Forsman Ranch Brown Rice", "tuna"]).calories_kcal,
    280,
  );
  assert.equal(select("Pancake (2)", ["Pancake Syrup"]).calories_kcal, 390);
  assert.equal(select("Fountain Drink 16oz", ["Coke"]).calories_kcal, 200);
  const dietCoke = select("Fountain Drink 16oz", ["Diet Coke"]);
  assert.equal(dietCoke.calories_kcal, 0);
  assert.equal(dietCoke.sodium_mg, 60);
  const icedTea = select("Iced Tea", [], "20 fl oz");
  assert.equal(icedTea.calories_kcal, 6.6667);
  assert.equal(icedTea.serving_description, "20 fl oz");
  assert.equal(
    select("BYO Pasta - Full Portion", [
      "Regular Penne",
      "Marinara Sauce",
      "Broccoli",
    ]).calories_kcal,
    310,
  );
  assert.equal(
    select("BYO Pasta - Full Portion", ["Regular Penne", "No Sauce"])
      .calories_kcal,
    240,
  );

  const latte = select("Iced Latte", ["Add Vanilla Cold Foam"], "16 fl oz");
  assert.equal(latte.calories_kcal, 130);
  assert.ok(latte.incomplete_nutrients?.includes("calories_kcal"));
  assert.deepEqual(
    nutritionTotals([{ food: latte, servings: 2 } as FoodLog]).calories_kcal,
    { value: 260, missing: 1 },
  );
});
