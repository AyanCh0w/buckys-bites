import test from "node:test";
import assert from "node:assert/strict";
import base from "../src/data/catalog.json";
import { withCampusMenus } from "../src/lib/campus-catalog";
import {
  campusMenuEntries,
  cafeMenuCategory,
  diningLocations,
  locationCatalog,
} from "../src/lib/dining-locations";
import { browsingCatalog } from "../src/lib/menu";
import { campusPicks, homeSelection } from "../src/lib/home";
import { dishContext } from "../src/lib/domain";
import type { AppData, Catalog } from "../src/lib/types";

const catalog = withCampusMenus(base as Catalog);
const day = "2026-11-19";
const now = new Date(day + "T20:00:00Z");
test("location tabs isolate each dated menu and preserve both Benson cafés", () => {
  assert.deepEqual(
    diningLocations.map((l) => l.key),
    [
      "benson",
      "the-sunstream-cafe",
      "fresh-bytes",
      "cadence-cyber-cafe",
      "side-bar-cafe",
    ],
  );
  assert.deepEqual(
    locationCatalog(catalog, "benson")
      .cafes.map((c) => c.source_key)
      .sort(),
    ["marketplace-2", "mission-bakery"],
  );
  for (const location of diningLocations.slice(1)) {
    const model = locationCatalog(catalog, location.key);
    const cafe = model.cafes[0];
    const entries = campusMenuEntries(
      browsingCatalog(model),
      location.key,
      day,
      [],
    );
    assert.ok(entries.length > 0, location.name);
    assert.ok(
      entries.every(
        (e) => e.offering.cafe_id === cafe.id && e.service.service_date === day,
      ),
    );
    assert.deepEqual(
      campusMenuEntries(model, location.key, "2027-02-01", []),
      [],
    );
  }
  const desserts = campusMenuEntries(catalog, "fresh-bytes", day, []);
  assert.equal(desserts.length, 2);
  assert.ok(desserts.every((e) => e.offering.menu_section === "Desserts"));
  assert.equal(
    campusMenuEntries(catalog, "fresh-bytes", day, ["Vegan"]).length,
    0,
  );
  const tapas = campusMenuEntries(catalog, "fresh-bytes", "2026-11-23", []);
  assert.ok(
    tapas.some(
      (e) => e.offering.menu_section === "Tapas" && e.service.name === "Lunch",
    ),
  );
});

test("home picks use campus offerings and share food identities across café menus", () => {
  const model = browsingCatalog(catalog);
  const picks = campusPicks(model, day, [], [], null, now);
  assert.equal(new Set(picks.map((p) => p.offering.cafe_id)).size, 4);
  for (const { food, offering } of picks) {
    assert.equal(
      dishContext(catalog, food, day, undefined, offering.id).station?.cafe_id,
      offering.cafe_id,
    );
  }
  const latte = (key: string) =>
    campusMenuEntries(catalog, key, day, []).find(
      (e) => e.food.name === "Holiday Spice Latte",
    )!;
  const a = latte("the-sunstream-cafe"),
    b = latte("side-bar-cafe");
  assert.equal(a.food.food_item_id, b.food.food_item_id);
  assert.notEqual(a.offering.id, b.offering.id);
  const dessert = picks.find(
    (e) => e.offering.menu_section === "Desserts",
  )!.food;
  const data = {
    profile: { dietary: [] },
    reviews: [
      {
        food_item_id: dessert.food_item_id,
        user_id: "me",
        stars: 5,
        created_at: now.toISOString(),
      },
    ],
  } as unknown as AppData;
  assert.equal(homeSelection(model, data, "me", now).pick?.food.id, dessert.id);
});

test("café fallback enriches an older cache while retaining refreshed and withdrawn menus", () => {
  assert.equal(withCampusMenus(catalog), catalog);
  const sunstream = locationCatalog(catalog, "the-sunstream-cafe");
  const withdrawn = withCampusMenus({
    ...sunstream,
    offerings: [],
    services: [],
  });
  assert.deepEqual(
    campusMenuEntries(withdrawn, "the-sunstream-cafe", day, []),
    [],
  );
  assert.equal(campusMenuEntries(withdrawn, "fresh-bytes", day, []).length, 2);
});

test("café categories use the dated offering and have artwork for every seeded dish", () => {
  const counts = (key: string, date = day) => {
    const result: Record<string, number> = {};
    for (const { food, offering } of campusMenuEntries(
      catalog,
      key,
      date,
      [],
    )) {
      const section = cafeMenuCategory(food, offering);
      result[section] = (result[section] ?? 0) + 1;
    }
    return result;
  };
  assert.deepEqual(counts("side-bar-cafe"), {
    Pastries: 15,
    "Hot Drinks": 14,
    "Cold Drinks": 14,
    "Specialty Drinks": 8,
  });
  assert.deepEqual(counts("fresh-bytes"), { Desserts: 2 });
  assert.deepEqual(counts("fresh-bytes", "2026-11-23"), { Tapas: 8 });
  const illustrated = new Set(
    catalog.images.filter((i) => i.path).map((i) => i.foodId),
  );
  const foods = new Map(catalog.foods.map((f) => [f.id, f]));
  for (const location of diningLocations.slice(1))
    for (const offering of locationCatalog(catalog, location.key).offerings)
      assert.ok(
        illustrated.has(foods.get(offering.food_version_id)!.food_item_id),
      );
});
