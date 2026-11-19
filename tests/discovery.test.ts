import test from "node:test";
import assert from "node:assert/strict";
import {
  compareFoodPreference,
  latestOwnRating,
  matchesDietary,
  rankMenuFoods,
  reviewFeed,
} from "../src/lib/discovery";
import { voteEligibility } from "../src/lib/domain";
import { kitchenMenus } from "../src/lib/menu";
import type { AppData, Catalog, Food, Review } from "../src/lib/types";
const now = new Date("2026-11-18T20:00:00Z");
const food = (id: string, dietary_tags: string[] = []) =>
  ({ id, food_item_id: id, name: id, dietary_tags }) as Food;
const a = food("a", ["Vegan"]),
  b = food("b", ["Vegetarian"]),
  c = food("c");
const review = (
  id: string,
  item: string,
  user: string,
  stars: number,
  hoursAgo = 1,
  score = 0,
  comment: string | null = "Useful comment",
): Review => ({
  id,
  food_item_id: item,
  user_id: user,
  stars,
  comment,
  created_at: new Date(+now - hoursAgo * 3600000).toISOString(),
  updated_at: now.toISOString(),
  eaten_at: now.toISOString(),
  meal_label: "Lunch",
  eating_id: null,
  display_name: user,
  karma: 0,
  score,
  upvotes: Math.max(0, score),
  downvotes: Math.max(0, -score),
});
const catalog = {
  cafes: [],
  foods: [a, b, c],
  components: [],
  links: [],
  images: [],
  stations: [
    { id: "sa", name: "A kitchen", cafe_id: "cafe", source_key: "a" },
    { id: "sb", name: "B kitchen", cafe_id: "cafe", source_key: "b" },
  ],
  services: [
    {
      id: "open",
      cafe_id: "cafe",
      name: "Lunch",
      service_date: "2026-11-18",
      starts_at: "2026-11-18T19:00:00Z",
      ends_at: "2026-11-18T22:00:00Z",
      status: "published",
      last_successful_sync_at: null,
    },
    {
      id: "later",
      cafe_id: "cafe",
      name: "Dinner",
      service_date: "2026-11-18",
      starts_at: "2026-11-19T01:00:00Z",
      ends_at: "2026-11-19T05:00:00Z",
      status: "published",
      last_successful_sync_at: null,
    },
  ],
  offerings: [
    {
      id: "oa",
      cafe_id: "cafe",
      station_id: "sa",
      menu_service_id: "later",
      food_version_id: "a",
      is_listed: true,
      sort_order: 1,
      price: null,
    },
    {
      id: "ob",
      cafe_id: "cafe",
      station_id: "sb",
      menu_service_id: "open",
      food_version_id: "b",
      is_listed: true,
      sort_order: 2,
      price: null,
    },
    {
      id: "oc",
      cafe_id: "cafe",
      station_id: "sb",
      menu_service_id: "open",
      food_version_id: "c",
      is_listed: true,
      sort_order: 3,
      price: null,
    },
  ],
} as Catalog;
const interests = {
  favorites: [],
  history: [],
  profile: {
    dietary: [],
    goals: {},
    haptics: false,
    display_name: "Test",
    avatar_id: "classic",
  },
} as Pick<AppData, "favorites" | "history" | "profile">;
test("menus keep open dishes and kitchens ahead of personally higher-rated closed ones", () => {
  const ratings = [
    review("ra", "a", "me", 5),
    review("rb", "b", "me", 3),
    review("rc", "c", "other", 5),
  ];
  assert.deepEqual(
    rankMenuFoods([a, b, c], catalog, ratings, "me", now).map((f) => f.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    kitchenMenus(catalog, now, ratings, "me").map((k) => k.name),
    ["B kitchen", "A kitchen"],
  );
});
test("personal sorting uses the latest score, then community scores, with no invented score for unrated dishes", () => {
  const ratings = [
    review("old", "a", "me", 5, 200),
    review("new", "a", "me", 2),
    review("rb", "b", "me", 4),
  ];
  assert.equal(latestOwnRating(ratings, "a", "me"), 2);
  assert.ok(compareFoodPreference(a, b, ratings, "me") > 0);
  assert.ok(
    compareFoodPreference(
      a,
      b,
      [review("a", "a", "other", 3), review("b", "b", "other", 5)],
      null,
    ) > 0,
  );
  assert.equal(latestOwnRating([], "a", "me"), 0);
});
test("dietary visibility follows published labels and includes vegan meals under vegetarian", () => {
  assert.equal(matchesDietary(a, ["Vegetarian"]), true);
  assert.equal(matchesDietary(b, ["Vegan"]), false);
  assert.equal(matchesDietary(c, []), true);
  assert.deepEqual(
    kitchenMenus(catalog, now, [], null, ["Vegan"]).map((k) => k.name),
    ["A kitchen"],
  );
  // Filtering food must not turn an open kitchen into a falsely closed one.
  const veganLater = { ...c, dietary_tags: ["Vegan"] };
  const filteredCatalog = {
    ...catalog,
    foods: [a, b, veganLater],
    offerings: catalog.offerings.map((o) =>
      o.food_version_id === "c" ? { ...o, menu_service_id: "later" } : o,
    ),
  };
  const kitchen = kitchenMenus(filteredCatalog, now, [], null, ["Vegan"]).find(
    (k) => k.name === "B kitchen",
  )!;
  assert.equal(kitchen.open, true);
  assert.equal(kitchen.hours.label, "Closes 2 PM");
});
test("all forum feeds exclude rating-only and whitespace-only reviews", () => {
  const reviews = [
    review("text", "a", "x", 4),
    review("number", "b", "x", 5, 0, 100, null),
    review("blank", "b", "x", 4, 0, 100, " \n\t "),
  ];
  for (const mode of ["Top", "For You", "New"] as const)
    assert.deepEqual(
      reviewFeed({ reviews, mode, catalog, interests, now }).map((r) => r.id),
      ["text"],
    );
  assert.match(voteEligibility([], reviews[1], "me")!, /written/);
});
test("Top day/week/all-time respect rolling boundaries; New ignores popularity", () => {
  const reviews = [
    review("recent", "a", "x", 4, 1, 2),
    review("week", "b", "y", 4, 48, 10),
    review("old", "c", "z", 5, 240, 100),
  ];
  const top = (period: "Day" | "Week" | "All time") =>
    reviewFeed({ reviews, mode: "Top", period, catalog, interests, now }).map(
      (r) => r.id,
    );
  assert.deepEqual(top("Day"), ["recent"]);
  assert.deepEqual(top("Week"), ["week", "recent"]);
  assert.deepEqual(top("All time"), ["old", "week", "recent"]);
  assert.deepEqual(
    reviewFeed({ reviews, mode: "New", catalog, interests, now }).map(
      (r) => r.id,
    ),
    ["recent", "week", "old"],
  );
});
test("For You mixes relevance, popularity and freshness instead of copying Top or New", () => {
  const reviews = [
    review("saved", "a", "x", 4, 2, 2),
    review("fresh", "c", "y", 4, 1, 0),
    review("old", "c", "z", 4, 240, 100),
    review("my-rating", "a", "me", 5, 2, 0, null),
  ];
  assert.equal(
    reviewFeed({
      reviews,
      mode: "For You",
      catalog,
      interests,
      userId: "me",
      now,
    }).at(0)?.id,
    "saved",
  );
});
