import { publishedDiet } from "./discovery";
import { kitchenKey } from "./theme";
import type { Catalog, Food, Offering } from "./types";

export const rotatingStations = [
  "Spice Market",
  "Global Grill",
  "Simply Oasis",
  "Chef’s Table",
];
const rotatingKeys = new Set(rotatingStations.map(kitchenKey));

// The publisher gives each protein its own recipe and food ID.
function dishNameWithoutProtein(name: string) {
  return name
    .toLowerCase()
    .replace(/[-–]/g, " ")
    .replace(
      /\b(?:plant based|pork belly|impossible nuggets?|fried chicken|chicken|beef|pork|turkey|fish|shrimp|salmon|vegetarian|vegan|veggie|impossible|beyond|tofu|tempeh|jackfruit|eggplant|cauliflower|celeriac|protein|meatless|meat|regular)\b/g,
      " ",
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

type Variant = {
  offering: Offering;
  food: Food;
  name: string;
  priority: number;
};

function alternatives(a: Variant, b: Variant, rotatingPair: boolean) {
  if (a.name && a.name === b.name) return true;
  if (!rotatingPair) return false;
  // Two rotating plates can have different main recipes and the same published sides.
  const sides = a.food.source_recipe_ids?.slice(1) ?? [];
  const sameSides =
    sides.length > 0 &&
    sides.join(",") === b.food.source_recipe_ids?.slice(1).join(",");
  if (sameSides && sides.length > 1) return true;
  // The same entrée can have a different garnish (e.g. chicken and seared eggplant piccata).
  const main = (name: string) =>
    name.split(/\s+with\s+/)[0].replace(/^(?:seared|roasted|grilled)\s+/, "");
  const first = main(a.name),
    second = main(b.name);
  if (first && first === second) return true;
  // One common side is weaker evidence. Also require the same dish, e.g. "bao buns".
  const shorter = first.length < second.length ? first : second;
  const longer = first.length < second.length ? second : first;
  return sameSides && shorter.includes(" ") && longer.endsWith(" " + shorter);
}

export function preferredOfferings(
  catalog: Catalog,
  offerings: Offering[],
  dietary: string[],
) {
  const foods = new Map(catalog.foods.map((food) => [food.id, food]));
  const rotatingIds = new Set(
    catalog.stations
      .filter((s) => rotatingKeys.has(kitchenKey(s.name)))
      .map((s) => s.id),
  );
  const preferences = dietary.map((label) => label.toLowerCase());
  const order = preferences.includes("vegetarian")
    ? ["vegetarian", "vegan", "regular"]
    : preferences.includes("vegan")
      ? ["vegan", "vegetarian", "regular"]
      : ["regular", "vegetarian", "vegan"];
  const groups = new Map<string, Variant[]>();
  for (const offering of offerings) {
    const food = foods.get(offering.food_version_id);
    if (!food || !offering.is_listed || !offering.station_id) continue;
    const key = JSON.stringify([
      offering.menu_service_id,
      offering.station_id,
      (offering.menu_section ?? "").trim().toLowerCase().replace(/s$/, ""),
    ]);
    const group = groups.get(key) ?? [];
    group.push({
      offering,
      food,
      name: dishNameWithoutProtein(food.name),
      priority: order.indexOf(publishedDiet(food)),
    });
    groups.set(key, group);
  }
  const hidden = new Set<string>();
  for (const group of groups.values()) {
    const rotatingPair =
      rotatingIds.has(group[0].offering.station_id!) &&
      new Set(group.map((v) => v.food.food_item_id)).size === 2;
    for (const option of group) {
      if (
        group.some(
          (other) =>
            other.priority < option.priority &&
            alternatives(option, other, rotatingPair),
        )
      )
        hidden.add(option.offering.id);
    }
  }
  return offerings.filter((offering) => !hidden.has(offering.id));
}
