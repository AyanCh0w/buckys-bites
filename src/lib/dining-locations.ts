import { kitchenHours } from "./availability";
import { campusDate } from "./domain";
import { matchesDietary } from "./discovery";
import type { Catalog } from "./types";

// Mission Bakery and Marketplace are both in Benson Memorial Center.
export const diningLocations = [
  {
    key: "benson",
    label: "Benson",
    name: "Benson",
    art: "marketplace-2",
    building: "Benson Memorial Center",
  },
  {
    key: "the-sunstream-cafe",
    label: "Sunstream",
    name: "Sunstream Café",
    art: "the-sunstream-cafe",
    building: "Learning Commons & Library",
  },
  {
    key: "fresh-bytes",
    label: "Fresh Bytes",
    name: "Fresh Bytes",
    art: "fresh-bytes",
    building: "Sobrato Campus for Discovery and Innovation",
  },
  {
    key: "cadence-cyber-cafe",
    label: "Cadence",
    name: "Cadence Cyber Café",
    art: "cadence-cyber-cafe",
    building: "Lucas Hall",
  },
  {
    key: "side-bar-cafe",
    label: "Side Bar",
    name: "Side Bar Café",
    art: "side-bar-cafe",
    building: "Charney Hall",
  },
] as const;

export type DiningLocation = (typeof diningLocations)[number];

export function locationCatalog(
  catalog: Catalog,
  key: DiningLocation["key"],
): Catalog {
  const cafes = catalog.cafes.filter((cafe) =>
    key === "benson"
      ? cafe.source_key === "marketplace-2" ||
        cafe.source_key === "mission-bakery"
      : cafe.source_key === key,
  );
  const ids = new Set(cafes.map((cafe) => cafe.id));
  return {
    ...catalog,
    cafes,
    stations: catalog.stations.filter((station) => ids.has(station.cafe_id)),
    services: catalog.services.filter((service) => ids.has(service.cafe_id)),
    offerings: catalog.offerings.filter((offering) =>
      ids.has(offering.cafe_id),
    ),
  };
}

export function campusCafeStatus(catalog: Catalog, key: string, now: Date) {
  const cafe = catalog.cafes.find((entry) => entry.source_key === key);
  const services = catalog.services.filter(
    (service) => service.cafe_id === cafe?.id,
  );
  const date = campusDate(now);
  const today = services.filter((service) => service.service_date === date);
  const closure = today.find((service) => service.status === "closed");
  const hasMenu = today.some((service) => service.status === "published");
  const hours = closure
    ? { open: false, label: closure.closure_message ?? "Closed today" }
    : hasMenu
      ? kitchenHours(services, now)
      : undefined;
  return { closure, hasMenu, hours };
}

export function campusMenuEntries(
  catalog: Catalog,
  cafeKey: string,
  date: string,
  dietary: string[],
) {
  const cafe = catalog.cafes.find((entry) => entry.source_key === cafeKey);
  if (!cafe) return [];
  const dated = catalog.services.filter(
    (s) => s.cafe_id === cafe.id && s.service_date === date,
  );
  if (dated.some((service) => service.status === "closed")) return [];
  const services = new Map(
    dated.filter((s) => s.status === "published").map((s) => [s.id, s]),
  );
  const foods = new Map(catalog.foods.map((food) => [food.id, food]));
  return catalog.offerings
    .flatMap((offering) => {
      if (!offering.is_listed || offering.cafe_id !== cafe.id) return [];
      const service = services.get(offering.menu_service_id);
      const food = foods.get(offering.food_version_id);
      return service && food && matchesDietary(food, dietary)
        ? [{ offering, food, service }]
        : [];
    })
    .sort((a, b) => a.offering.sort_order - b.offering.sort_order);
}

// Some campus feeds put both hot and iced drinks under "Coffee". Keep an
// unfamiliar item in its published section until its category is known.
export function cafeMenuCategory(
  food: Catalog["foods"][number],
  offering?: Catalog["offerings"][number],
) {
  const section = offering?.menu_section?.trim() || "Other items";
  if (section === "Specialty") return "Specialty Drinks";
  if (section.toLowerCase() === "all day" && offering?.is_special) {
    return /latte|mocha|coffee|tea\b/i.test(food.name)
      ? "Specialty Drinks"
      : "Specials";
  }
  if (section !== "Coffee") return section;
  if (offering?.is_special) return "Specialty Drinks";
  if (
    /^(iced\b|cold brew\b|italian soda\b|lemonade\b|shaken lemonade\b)/i.test(
      food.name,
    )
  )
    return "Cold Drinks";
  if (
    /^(hot\b|espresso$|mocha$|steamer$|traditional cappuccino$)/i.test(
      food.name,
    )
  )
    return "Hot Drinks";
  return section;
}
