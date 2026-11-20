import campus from "../data/campus-catalog.json";
import base from "../data/catalog.json";
import type { Catalog } from "./types";

// Older offline caches and servers can contain just the two Benson cafés.
// Once a café is present in the server catalog, its publication is authoritative.
export function withCampusMenus(catalog: Catalog): Catalog {
  const present = new Set(catalog.cafes.map((cafe) => cafe.source_key));
  const missing = campus.cafes.filter((cafe) => !present.has(cafe.source_key));
  const illustrated = new Set(
    catalog.images.filter((image) => image.path).map((image) => image.foodId),
  );
  const extraImages = campus.images.filter(
    (image) => !illustrated.has(image.foodId),
  );
  const images = extraImages.length
    ? [...catalog.images, ...extraImages]
    : catalog.images;
  if (!missing.length)
    return images === catalog.images ? catalog : { ...catalog, images };
  const cafeIds = new Set(missing.map((cafe) => cafe.id));
  const offerings = campus.offerings.filter((offering) =>
    cafeIds.has(offering.cafe_id),
  );
  const versions = new Set(
    offerings.map((offering) => offering.food_version_id),
  );
  for (const food of catalog.foods) versions.delete(food.id);
  const bundledFoods = [...campus.foods, ...base.foods] as Catalog["foods"];
  return {
    ...catalog,
    images,
    cafes: [...catalog.cafes, ...missing],
    stations: [
      ...catalog.stations,
      ...campus.stations.filter((s) => cafeIds.has(s.cafe_id)),
    ],
    services: [
      ...catalog.services,
      ...campus.services.filter((s) => cafeIds.has(s.cafe_id)),
    ],
    offerings: [...catalog.offerings, ...offerings],
    foods: [
      ...catalog.foods,
      ...bundledFoods.filter((food) => versions.has(food.id)),
    ],
  };
}
