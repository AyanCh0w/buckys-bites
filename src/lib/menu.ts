import type { Catalog, Component, Food, Offering, Service } from "./types";
import { campusDate, displayName } from "./domain";
import { kitchenKey, kitchenName } from "./theme";
import { diningLocations } from "./dining-locations";
import { preferredOfferings } from "./menu-variants";

export { serviceIsOpen } from "./availability";
import { kitchenHours } from "./availability";
import { operatingServices } from "./kitchen-hours";
import {
  compareFoodPreference,
  matchesDietary,
  rankMenuFoods,
} from "./discovery";
import type { Review } from "./types";

// Each satellite café publishes one menu with its own dish sections.
const visibleKitchens = new Set([
  "global-grill",
  "la-parrilla",
  "mission-bakery",
  "acai",
  "slice",
  "spice-market",
  "fire",
  "sushi",
  "chef-s-table",
  "trattoria",
  "simply-oasis",
  "stacks-deli",
  "garden",
  ...diningLocations
    .filter((location) => location.key !== "benson")
    .map((location) => kitchenKey(location.name)),
]);

export const BAKERY_KEY = "mission-bakery";
export const DEFAULT_STARRED_KITCHENS: readonly string[] = [BAKERY_KEY];

/** Format source categories for display without changing catalog identifiers. */
export function menuSectionLabel(section?: string | null): string {
  const label = (section ?? "").trim().replace(/\s+/g, " ");
  // The publisher uses "static" for recurring items, not a dining category.
  if (/^static$/i.test(label)) return "";
  if (/^wraps?$/i.test(label)) return "Wraps";
  return label.replace(/[^\s-]+/g, (word, offset: number) =>
    offset > 0 && /^(a|an|the|and|or|of|for|in|on|to|with)$/i.test(word)
      ? word.toLowerCase()
      : displayName(word),
  );
}

// The Fire publishes its smash burger under "a la carte" and its combos separately.
// Match mains before their accompaniments (e.g. chicken tenders with fries).
const fireMenuOrder: [section: string, dish: RegExp][] = [
  ["Burgers", /^signature smash burger$/i],
  ["Burgers", /burgers?\b/i],
  ["Sandwiches & Tenders", /\b(sandwich(es)?|melts?)\b/i],
  ["Sandwiches & Tenders", /\btenders?\b/i],
  ["Bowls", /\bbowls?\b/i],
  ["From the Grill", /\bgrilled (chicken|salmon)\b/i],
  ["Fries & Sides", /\bfries\b/i],
  ["Fries & Sides", /\b(vegetable sticks|grilled vegetables|brown rice)\b/i],
  ["Drinks", /\bdrinks?\b/i],
];

export function kitchenDishSections(
  key: string,
  foods: Food[],
  placements?: ReadonlyMap<string, Offering>,
) {
  const rows = foods.map((food) => {
    const index =
      key === "fire"
        ? fireMenuOrder.findIndex(([, dish]) => dish.test(food.name))
        : -1;
    return {
      food,
      order: index < 0 ? fireMenuOrder.length : index,
      section:
        fireMenuOrder[index]?.[0] ??
        menuSectionLabel(placements?.get(food.id)?.menu_section),
    };
  });
  if (key === "fire") rows.sort((a, b) => a.order - b.order);
  const sections = new Map<string, Food[]>();
  for (const { section, food } of rows) {
    const entries = sections.get(section);
    if (entries) entries.push(food);
    else sections.set(section, [food]);
  }
  return sections;
}

export function browsingCatalog(
  catalog: Catalog,
  dietary: string[] = [],
): Catalog {
  const stations = catalog.stations.filter((station) =>
    visibleKitchens.has(kitchenKey(station.name)),
  );
  const stationIds = new Set(stations.map((station) => station.id));
  const offerings = catalog.offerings.filter((offering) =>
    stationIds.has(offering.station_id ?? ""),
  );
  const serviceIds = new Set(
    offerings.map((offering) => offering.menu_service_id),
  );
  const cafes = new Set(stations.map((station) => station.cafe_id));
  return {
    ...catalog,
    stations,
    offerings: preferredOfferings(catalog, offerings, dietary),
    services: catalog.services.filter(
      (service) =>
        serviceIds.has(service.id) ||
        (cafes.has(service.cafe_id) && service.status === "closed") ||
        Object.keys(service.station_extras ?? {}).some((id) =>
          stationIds.has(id),
        ),
    ),
  };
}

export function kitchenMenus(
  catalog: Catalog,
  now = new Date(),
  reviews: Review[] = [],
  userId?: string | null,
  dietary: string[] = [],
  starred: readonly string[] = DEFAULT_STARRED_KITCHENS,
) {
  const today = campusDate(now);
  const stars = new Set(starred);
  return [...new Set(catalog.stations.map((s) => kitchenKey(s.name)))]
    .map((key) => {
      const stations = catalog.stations.filter(
        (s) => kitchenKey(s.name) === key,
      );
      const ids = new Set(stations.map((s) => s.id));
      const offerings = catalog.offerings.filter(
        (o) => o.is_listed && ids.has(o.station_id ?? ""),
      );
      const services = stationServices(catalog, ids);
      const dated = services.filter((s) => s.service_date === today);
      const closure = catalog.services.find(
        (s) =>
          s.status === "closed" &&
          s.cafe_id === stations[0].cafe_id &&
          s.service_date === today,
      );
      const cafePublished = catalog.services.some(
        (s) =>
          s.status === "published" &&
          s.cafe_id === stations[0].cafe_id &&
          s.service_date === today,
      );
      const serviceIds = new Set(dated.map((s) => s.id));
      const versions = new Set(
        offerings
          .filter((o) => serviceIds.has(o.menu_service_id))
          .map((o) => o.food_version_id),
      );
      const dishes = rankMenuFoods(
        catalog.foods.filter(
          (f) => versions.has(f.id) && matchesDietary(f, dietary),
        ),
        catalog,
        reviews,
        userId,
        now,
        serviceIds,
      );
      const featured = dishes[0];
      const hours = closure
        ? { open: false, label: closure.closure_message ?? "Closed today" }
        : kitchenHours(
            operatingServices(catalog, stations, services, now),
            now,
          );
      if (!dated.length && !("next" in hours && hours.next) && !closure)
        hours.label = cafePublished
          ? "No service listed today"
          : "Hours unavailable";
      return {
        key,
        name: kitchenName(stations[0].name),
        cafe: stations[0].cafe_id,
        date: today,
        featured,
        open: hours.open,
        hours,
        services: dated,
      };
    })
    .filter((k) => !dietary.length || k.featured)
    .sort(
      (a, b) =>
        Number(stars.has(b.key)) - Number(stars.has(a.key)) ||
        Number(b.open) - Number(a.open) ||
        (a.featured && b.featured
          ? compareFoodPreference(a.featured, b.featured, reviews, userId)
          : Number(Boolean(b.featured)) - Number(Boolean(a.featured))) ||
        a.name.localeCompare(b.name),
    );
}
export function serviceMatchesMeal(service: Service, meal: string) {
  if (service.name === "Brunch")
    return meal === "Breakfast" || meal === "Lunch";
  return service.name === meal || service.name.startsWith("All Day");
}

export function stationServices(catalog: Catalog, stationIds: Set<string>) {
  const serviceIds = new Set(
    catalog.offerings
      .filter((o) => o.is_listed && stationIds.has(o.station_id ?? ""))
      .map((o) => o.menu_service_id),
  );
  return catalog.services.filter(
    (s) =>
      s.status === "published" &&
      (serviceIds.has(s.id) ||
        Object.keys(s.station_extras ?? {}).some((id) => stationIds.has(id))),
  );
}
type Published = Record<
  string,
  { value: string; unit: string; label?: string }
>;
/** Do not infer a dish's ingredient quantity from a separately published serving. */
export function ingredientNutrition(ingredient: Component) {
  const candidates = ingredient.published_serving_candidates as {
    kind?: string;
    nutrition?: Published;
  }[];
  const published = candidates
    .filter((c) => c.kind === "standalone" && c.nutrition?.servingSize?.value)
    .map((c) => c.nutrition!);
  if (!published.length) return null;
  const signature = (n: Published) =>
    JSON.stringify(
      Object.entries(n)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, v.value, v.unit]),
    );
  return published.every((n) => signature(n) === signature(published[0]))
    ? published[0]
    : null;
}
