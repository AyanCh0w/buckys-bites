import test from "node:test";
import assert from "node:assert/strict";
import snapshot from "../src/data/catalog.json";
import { foodIsOpen } from "../src/lib/availability";
import { currentMealPicks } from "../src/lib/home";
import { browsingCatalog, kitchenMenus } from "../src/lib/menu";
import type { Catalog } from "../src/lib/types";

const catalog = snapshot as Catalog;
const at = (clock: string, date = "2026-11-19", offset = "-08:00") =>
  new Date(`${date}T${clock}:00${offset}`);
const kitchens = (now: Date, model = catalog) =>
  new Map(kitchenMenus(browsingCatalog(model), now).map((k) => [k.key, k]));

test("weekday kitchen status matches the 2:40 PM Transact screenshot", () => {
  const rows = kitchens(at("14:40"));
  for (const key of [
    "spice-market",
    "global-grill",
    "trattoria",
    "simply-oasis",
  ]) {
    assert.equal(rows.get(key)?.open, false, key);
    assert.equal(rows.get(key)?.hours.label, "Opens 5 PM", key);
  }
  for (const [key, label] of [
    ["la-parrilla", "Closes 9 PM"],
    ["mission-bakery", "Closes 8 PM"],
    ["fire", "Closes 11:58 PM"],
  ]) {
    assert.equal(rows.get(key)?.open, true, key);
    assert.equal(rows.get(key)?.hours.label, label, key);
  }
  assert.equal(rows.get("slice")?.open, false);
  assert.equal(rows.get("slice")?.hours.label, "Opens 5:30 PM");
  assert.equal(rows.get("acai")?.open, false);
});

test("weekday breaks, dinner openings and closing boundaries use each kitchen's hours", () => {
  assert.equal(
    kitchens(at("10:30")).get("global-grill")?.hours.label,
    "Opens 11 AM",
  );
  assert.equal(kitchens(at("14:30")).get("spice-market")?.open, false);
  assert.equal(kitchens(at("14:30")).get("la-parrilla")?.open, true);
  assert.equal(kitchens(at("17:29")).get("slice")?.open, false);
  assert.equal(kitchens(at("17:30")).get("slice")?.open, true);
  const dinner = kitchens(at("20:29"));
  const closed = kitchens(at("20:30"));
  for (const key of ["spice-market", "global-grill", "simply-oasis"]) {
    assert.equal(dinner.get(key)?.hours.label, "Closes 8:30 PM");
    assert.equal(closed.get(key)?.open, false);
  }
  assert.equal(closed.get("trattoria")?.open, true);
  assert.equal(closed.get("fire")?.hours.label, "Closes 11:58 PM");
  assert.equal(kitchens(at("23:57")).get("fire")?.open, true);
  assert.equal(
    kitchens(at("23:58")).get("fire")?.hours.label,
    "Opens tomorrow 11 AM",
  );
});

test("holiday and cafe closures take precedence over regular weekday hours", () => {
  const restricted = kitchens(at("16:30", "2026-11-23"));
  assert.deepEqual(
    [...restricted.values()]
      .filter((k) => k.open)
      .map((k) => k.key)
      .sort(),
    ["fire", "mission-bakery"],
  );
  assert.equal(restricted.get("fire")?.hours.label, "Closes 7 PM");
  assert.equal(restricted.get("mission-bakery")?.hours.label, "Closes 6 PM");
  assert.ok(
    [...kitchens(at("12:00", "2026-11-26")).values()].every((k) => !k.open),
  );
  const cafe = catalog.cafes.find((c) => c.source_key === "marketplace-2")!;
  const model: Catalog = {
    ...catalog,
    services: [
      ...catalog.services,
      {
        ...catalog.services[0],
        id: "unexpected-closure",
        cafe_id: cafe.id,
        service_date: "2026-11-19",
        status: "closed",
        closure_message: "Closed for maintenance",
      },
    ],
  };
  assert.equal(
    kitchens(at("12:00"), model).get("fire")?.hours.label,
    "Closed for maintenance",
  );
  assert.ok(
    currentMealPicks(model, [], null, [], at("12:00")).dishes.every(
      (food) =>
        !catalog.offerings.some(
          (o) => o.food_version_id === food.id && o.cafe_id === cafe.id,
        ),
    ),
  );
});

test("weekday hours respect campus DST without fabricating weekend hours or menus", () => {
  assert.equal(
    kitchens(at("06:59", "2027-06-10", "-07:00")).get("global-grill")?.open,
    false,
  );
  const summer = kitchens(at("07:00", "2027-06-10", "-07:00"));
  assert.equal(summer.get("global-grill")?.hours.label, "Closes 10:30 AM");
  assert.equal(summer.get("global-grill")?.featured, undefined);
  assert.equal(
    kitchens(at("12:00", "2027-06-12", "-07:00")).get("fire")?.open,
    false,
  );
  assert.equal(
    foodIsOpen(catalog, catalog.foods[0], at("12:00", "2027-06-10", "-07:00")),
    false,
  );
});

test("closed kitchens do not supply currently available dishes or meal highlights", () => {
  const spice = catalog.stations.find((s) => s.source_key === "24742")!;
  const dinner = catalog.services.find(
    (s) =>
      s.service_date === "2026-11-19" &&
      s.name === "Dinner" &&
      catalog.offerings.some(
        (o) => o.station_id === spice.id && o.menu_service_id === s.id,
      ),
  )!;
  const offering = catalog.offerings.find(
    (o) =>
      o.station_id === spice.id &&
      o.menu_service_id === dinner.id &&
      o.is_listed,
  )!;
  const food = catalog.foods.find((f) => f.id === offering.food_version_id)!;
  const model = { ...catalog, offerings: [offering] };
  assert.equal(foodIsOpen(model, food, at("20:29")), true);
  assert.equal(foodIsOpen(model, food, at("20:30")), false);
  assert.equal(
    currentMealPicks(model, [], null, [], at("20:30")).dishes.length,
    0,
  );
  const slice = catalog.stations.find((s) => s.source_key === "18722")!;
  const pizzaOfferings = catalog.offerings.filter(
    (o) => o.station_id === slice.id,
  );
  const pizza = { ...catalog, offerings: pizzaOfferings };
  assert.ok(
    pizzaOfferings.some((o) =>
      foodIsOpen(
        pizza,
        catalog.foods.find((f) => f.id === o.food_version_id)!,
        at("17:30"),
      ),
    ),
  );
  assert.ok(
    pizzaOfferings.every(
      (o) =>
        !foodIsOpen(
          pizza,
          catalog.foods.find((f) => f.id === o.food_version_id)!,
          at("14:40"),
        ),
    ),
  );
});
