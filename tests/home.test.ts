import test from "node:test";
import assert from "node:assert/strict";
import {
  currentMealPicks,
  dailyStationMenus,
  featuredReview,
  homeSelection,
  reviewedDishes,
  stationSpecials,
} from "../src/lib/home";
import { kitchenHours } from "../src/lib/availability";
import type { AppData, Catalog, Food, Review, Service } from "../src/lib/types";

const now = new Date("2026-11-18T20:00:00Z");
const food = (id: string, protein = 10): Food =>
  ({
    id,
    food_item_id: id,
    name: id,
    protein_g: protein,
    calories_kcal: 400,
    carbohydrate_g: null,
    total_fat_g: null,
    fiber_g: null,
    sugar_g: null,
    sodium_mg: null,
    saturated_fat_g: null,
    description: null,
    ingredients_text: null,
    serving_description: null,
    allergen_tags: [],
    allergen_information_available: false,
    nutrition_source: "test",
    source_url: "",
    published_nutrition: {},
    dietary_tags: [],
    captured_at: now.toISOString(),
  }) as Food;
const foods = [
  food("featured"),
  food("protein", 45),
  food("new"),
  food("favorite", 50),
  food("low"),
];
const lunch = {
  id: "lunch",
  name: "Lunch",
  service_date: "2026-11-18",
  status: "published",
  starts_at: "2026-11-18T19:00:00Z",
  ends_at: "2026-11-18T22:30:00Z",
} as Service;
const dinner = {
  ...lunch,
  id: "dinner",
  name: "Dinner",
  starts_at: "2026-11-19T01:00:00Z",
  ends_at: "2026-11-19T05:00:00Z",
};
const catalog = {
  foods,
  services: [lunch, dinner],
  offerings: foods.map((f, i) => ({
    id: f.id,
    food_version_id: f.id,
    menu_service_id: "lunch",
    is_listed: true,
    sort_order: i,
  })),
  stations: [],
  cafes: [],
  links: [],
  components: [],
  images: [],
} as unknown as Catalog;
const review = (
  id: string,
  item: string,
  user = "me",
  stars = 5,
  comment: string | null = null,
  upvotes = 0,
  downvotes = 0,
): Review =>
  ({
    id,
    food_item_id: item,
    user_id: user,
    stars,
    comment,
    created_at: "2026-11-18T19:00:00Z",
    upvotes,
    downvotes,
    score: upvotes - downvotes,
  }) as Review;
const data = {
  reviews: [
    review("hero", "featured", "other", 4, "A useful review", 10),
    review("mine", "favorite"),
    review("disliked", "low", "me", 1),
  ],
  profile: { dietary: [] },
  history: [],
  favorites: ["new"],
} as unknown as AppData;

test("daily specials keep each listed dish with its station, date, and meal", () => {
  const stationNames = [
    "The Global Grill Lunch",
    "The Global Grill Dinner",
    "The Spice Market",
    "The Fire",
    "The Chef's Table",
  ];
  const placement = (
    version: number,
    station: number,
    service: string,
    order: number,
  ) => ({
    ...catalog.offerings[version],
    food_version_id: foods[version].id,
    station_id: String(station),
    menu_service_id: service,
    sort_order: order,
  });
  const menus: Catalog = {
    ...catalog,
    foods: foods.map((f, i) => ({
      ...f,
      dietary_tags: i === 1 ? ["Vegan"] : [],
    })),
    stations: stationNames.map((name, i) => ({
      id: String(i),
      name,
      cafe_id: "benson",
      source_key: name,
    })),
    services: [
      lunch,
      dinner,
      { ...lunch, id: "past", service_date: "2026-11-17" },
      { ...lunch, id: "draft", status: "unpublished" },
      { ...lunch, id: "breakfast", name: "Breakfast" },
    ],
    offerings: [
      placement(0, 0, "lunch", 2),
      placement(1, 0, "lunch", 1),
      placement(0, 0, "lunch", 3),
      placement(2, 1, "dinner", 1),
      placement(0, 2, "lunch", 1),
      placement(4, 2, "draft", 1),
      { ...placement(4, 2, "lunch", 1), is_listed: false },
      placement(4, 3, "lunch", 1),
      placement(4, 4, "past", 1),
      placement(4, 0, "breakfast", 1),
    ],
  };
  const summaries = dailyStationMenus(menus, lunch.service_date, "Lunch", []);
  assert.deepEqual(
    summaries.map((s) => s.key),
    ["spice-market", "global-grill", "simply-oasis", "chef-s-table"],
  );
  assert.deepEqual(
    summaries.map((s) => s.options.map(({ food }) => food.id)),
    [["featured"], ["protein", "featured"], [], []],
  );
  assert.equal(summaries[3].message, "No menu listed.");
  const dashboard = stationSpecials(menus, lunch.service_date, [], "Dinner");
  assert.deepEqual(
    dashboard[1].periods.map((p) => p.label),
    ["Lunch", "Dinner"],
  );
  assert.deepEqual(
    dashboard[2].periods.map((p) => p.label),
    ["Lunch & dinner"],
  );
  const shared = {
    ...menus,
    offerings: [
      ...menus.offerings,
      { ...placement(0, 2, "dinner", 1), id: "shared-dinner" },
    ],
  };
  const spice = stationSpecials(shared, lunch.service_date, [], "Dinner")[0];
  assert.deepEqual(
    spice.periods.map((p) => p.label),
    ["Lunch & dinner"],
  );
  assert.equal(spice.periods[0].options[0].offeringId, "shared-dinner");
  const vegan = dailyStationMenus(menus, lunch.service_date, "Lunch", [
    "Vegan",
  ]);
  assert.equal(vegan[0].message, "No dishes match your meal preferences.");
  assert.deepEqual(
    vegan[1].options.map(({ food }) => food.id),
    ["protein"],
  );
  const evening = dailyStationMenus(menus, lunch.service_date, "Dinner", []);
  assert.deepEqual(
    evening[1].options.map(({ food }) => food.id),
    ["new"],
  );
  assert.equal(evening[0].options.length, 0);
  assert.equal(
    dailyStationMenus(menus, "2026-11-17", "Lunch", [])[3].options[0].food.id,
    "low",
  );
  const closed = {
    ...menus,
    services: [
      ...menus.services,
      {
        ...lunch,
        cafe_id: "benson",
        status: "closed",
        closure_message: "Holiday closure",
      },
    ],
  };
  assert.equal(
    dailyStationMenus(closed, lunch.service_date, "Lunch", [])[0].message,
    "Holiday closure",
  );
});

test("Today’s pick uses the user’s latest score and the footer lists up to three personally unrated dishes", () => {
  const result = homeSelection(catalog, data, "me", now);
  assert.deepEqual(result.pick, { food: foods[3], stars: 5 });
  assert.equal(result.featured?.review.id, "hero");
  // Someone else's written review does not count as my rating.
  assert.deepEqual(
    result.unrated.map((f) => f.id),
    ["featured", "protein", "new"],
  );

  const revised = {
    ...data,
    reviews: [
      ...data.reviews,
      {
        ...review("newer", "favorite", "me", 1),
        created_at: "2026-11-18T19:30:00Z",
      },
      review("just-stars", "new", "me", 2),
      review("off-menu", "yesterday-only", "me", 5),
    ],
  };
  assert.deepEqual(homeSelection(catalog, revised, "me", now).pick, {
    food: foods[2],
    stars: 2,
  });
  const noRatings = homeSelection(catalog, data, "someone-new", now);
  assert.equal(noRatings.pick, undefined);
  assert.equal(noRatings.unrated.length, 3);
  assert.equal(homeSelection(catalog, data, null, now).pick, undefined);
  const allRated = {
    ...data,
    reviews: foods.map((f) => review(f.id, f.food_item_id)),
  };
  assert.deepEqual(homeSelection(catalog, allRated, "me", now).unrated, []);

  const unpublishedDay = homeSelection(
    catalog,
    data,
    "me",
    new Date("2026-11-20T20:00:00Z"),
  );
  assert.equal(unpublishedDay.date, undefined);
  assert.equal(unpublishedDay.pick, undefined);
  assert.deepEqual(unpublishedDay.unrated, []);
});

test("a higher-rated dinner on today's menu wins over an open lunch; all suggestions follow the menu and diet", () => {
  const anotherVersion = { ...foods[2], id: "new-version" };
  const menus = {
    ...catalog,
    foods: [...foods, anotherVersion].map((f) => ({
      ...f,
      dietary_tags: f.id === "protein" ? [] : ["Vegan"],
    })),
    services: [
      { ...lunch, cafe_id: "main" },
      { ...dinner, cafe_id: "main" },
      { ...lunch, cafe_id: "closed-cafe", id: "closed-cafe-lunch" },
      { ...lunch, cafe_id: "closed-cafe", id: "closure", status: "closed" },
    ],
    offerings: [
      { ...catalog.offerings[0], menu_service_id: "closed-cafe-lunch" },
      catalog.offerings[1],
      catalog.offerings[2],
      { ...catalog.offerings[3], menu_service_id: "dinner" },
      { ...catalog.offerings[4], is_listed: false },
      {
        ...catalog.offerings[2],
        id: "second",
        food_version_id: anotherVersion.id,
      },
    ],
  };
  const personal = {
    ...data,
    profile: { ...data.profile, dietary: ["Vegan"] },
    reviews: [
      review("lunch", "new", "me", 3),
      review("dinner", "favorite", "me", 4),
      ...["featured", "protein", "low"].map((id) => review(id, id, "me", 5)),
    ],
  };
  assert.equal(
    homeSelection(menus, personal, "me", now).pick?.food.food_item_id,
    "favorite",
  );
  assert.deepEqual(homeSelection(menus, personal, "me", now).unrated, []);
  const fresh = homeSelection(menus, personal, "new-user", now);
  assert.deepEqual(fresh.unrated.map((f) => f.food_item_id).sort(), [
    "favorite",
    "new",
  ]);
});

test("featured reviews exclude numeric-only, blank and future entries; controversy requires both sides", () => {
  const reviews = [
    review("number", "featured", "a", 5, null, 100),
    review("blank", "featured", "b", 5, "  ", 100),
    review("helpful", "featured", "c", 4, "Helpful", 8),
    review("unpopular", "featured", "d", 1, "Unpopular", 0, 50),
    {
      ...review("future", "featured", "e", 5, "Future", 500),
      created_at: "2026-12-01T00:00:00Z",
    },
  ];
  assert.equal(
    featuredReview(catalog, { ...data, reviews }, "me", now)?.review.id,
    "helpful",
  );
  const divided = review(
    "divided",
    "featured",
    "f",
    3,
    "A divided opinion",
    40,
    40,
  );
  const result = featuredReview(
    catalog,
    {
      ...data,
      reviews: [divided, review("quiet", "featured", "g", 4, "Quiet", 1)],
    },
    "me",
    now,
  );
  assert.equal(result?.review.id, "divided");
  assert.equal(
    featuredReview(catalog, { ...data, reviews: [] }, "me", now),
    undefined,
  );
});

test("Home features recent reviews across dishes, including meals outside today’s menu", () => {
  const offMenu = food("off-menu");
  const allFoods = { ...catalog, foods: [...catalog.foods, offMenu] };
  const fresh = review("fresh", offMenu.id, "student", 4, "Worth trying");
  const older = {
    ...review("older", "new", "a", 3, "Mixed", 300, 300),
    created_at: "2026-10-01T12:00:00Z",
  };
  const result = homeSelection(
    allFoods,
    { ...data, reviews: [fresh, older] },
    "me",
    now,
  );
  assert.equal(result.featured?.review.id, "fresh");
  assert.equal(result.featured?.food.id, offMenu.id);
  const lastWeek = { ...fresh, created_at: "2026-11-07T12:00:00Z" };
  assert.equal(
    featuredReview(allFoods, { ...data, reviews: [older, lastWeek] }, "me", now)
      ?.review.id,
    "fresh",
  );
});

test("profile dishes come from all own reviews, dedupe recipe versions, and fall back after review deletion", () => {
  const newer = {
    ...foods[3],
    id: "new-recipe",
    captured_at: "2026-11-19T00:00:00Z",
  };
  const myDishes = reviewedDishes([...foods, newer], data.reviews, "me");
  assert.equal(myDishes.length, 2);
  assert.equal(
    myDishes.find((x) => x.food.food_item_id === "favorite")?.food.id,
    "new-recipe",
  );
  assert.equal(
    myDishes.find((x) => x.food.food_item_id === "low")?.review.stars,
    1,
  );
  assert.equal(reviewedDishes(foods, [], "me").length, 0);
  assert.equal(reviewedDishes(foods, data.reviews, null).length, 0);
});

test("current meal shows only two ranked dishes and nothing during service breaks or after closing", () => {
  const result = currentMealPicks(catalog, data.reviews, "me", [], now);
  assert.equal(result.meal, "Lunch");
  assert.deepEqual(
    result.dishes.map((f) => f.id),
    ["favorite", "low"],
  );
  assert.equal(
    currentMealPicks(catalog, [], null, [], new Date("2026-11-18T23:00:00Z"))
      .dishes.length,
    0,
  );
  assert.equal(
    currentMealPicks(catalog, [], null, [], new Date("2026-11-19T05:00:00Z"))
      .dishes.length,
    0,
  );
  assert.equal(
    currentMealPicks(catalog, [], null, ["Vegan"], now).dishes.length,
    0,
  );
  const breakfast = {
    ...lunch,
    id: "breakfast",
    name: "Breakfast",
    starts_at: "2026-11-18T15:00:00Z",
    ends_at: "2026-11-18T18:30:00Z",
  };
  const breakfastCatalog = {
    ...catalog,
    services: [breakfast],
    offerings: catalog.offerings.map((o) => ({
      ...o,
      menu_service_id: breakfast.id,
    })),
  };
  assert.equal(
    currentMealPicks(
      breakfastCatalog,
      [],
      null,
      [],
      new Date("2026-11-18T16:00:00Z"),
    ).meal,
    "Breakfast",
  );
});

test("kitchen status uses actual next openings, merges contiguous hours, and never invents tomorrow", () => {
  assert.equal(kitchenHours([lunch, dinner], now).label, "Closes 2:30 PM");
  assert.equal(
    kitchenHours([lunch, dinner], new Date("2026-11-18T22:30:00Z")).label,
    "Opens 5 PM",
  );
  assert.equal(
    kitchenHours([lunch, dinner], new Date("2026-11-19T05:00:00Z")).next,
    null,
  );
  assert.equal(
    kitchenHours([{ ...lunch, ends_at: dinner.starts_at }, dinner], now).label,
    "Closes 9 PM",
  );
  const tomorrow = {
    ...lunch,
    service_date: "2026-11-19",
    starts_at: "2026-11-19T19:00:00Z",
    ends_at: "2026-11-19T22:30:00Z",
  };
  assert.equal(
    kitchenHours([lunch, tomorrow], new Date("2026-11-19T05:00:00Z")).label,
    "Opens tomorrow 11 AM",
  );
  assert.equal(
    kitchenHours([{ ...tomorrow, status: "draft" }], now).next,
    null,
  );
});
