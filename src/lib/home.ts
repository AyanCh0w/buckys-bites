import type { AppData, Catalog, Food, Review } from "./types";
import { campusDate } from "./domain";
import { foodIsOpen, serviceIsOpen } from "./availability";
import { serviceMatchesMeal } from "./menu";
import { kitchenKey } from "./theme";
import { preferredOfferings, rotatingStations } from "./menu-variants";
import {
  hasReviewText,
  matchesDietary,
  rankMenuFoods,
  relevantReviewScore,
} from "./discovery";

export type SpecialMeal = "Lunch" | "Dinner";

export function dailyStationMenus(
  catalog: Catalog,
  date: string,
  meal: SpecialMeal,
  dietary: string[],
) {
  const services = catalog.services.filter((s) => s.service_date === date);
  const serviceIds = new Set(
    services
      .filter((s) => s.status === "published" && serviceMatchesMeal(s, meal))
      .map((s) => s.id),
  );
  const offerings = preferredOfferings(
    catalog,
    catalog.offerings.filter(
      (o) => o.is_listed && serviceIds.has(o.menu_service_id),
    ),
    dietary,
  ).sort((a, b) => a.sort_order - b.sort_order);
  const byVersion = new Map(catalog.foods.map((food) => [food.id, food]));

  return rotatingStations.map((name) => {
    const key = kitchenKey(name);
    const stations = catalog.stations.filter((s) => kitchenKey(s.name) === key);
    const stationIds = new Set(stations.map((s) => s.id));
    const cafe = stations[0]?.cafe_id;
    const closure = services.find(
      (s) => s.cafe_id === cafe && s.status === "closed",
    );
    const options = new Map<string, { food: Food; offeringId: string }>();
    let hasListedDish = false;
    if (!closure) {
      for (const offering of offerings) {
        if (!offering.station_id || !stationIds.has(offering.station_id))
          continue;
        const food = byVersion.get(offering.food_version_id);
        if (!food) continue;
        hasListedDish = true;
        if (!options.has(food.food_item_id) && matchesDietary(food, dietary))
          options.set(food.food_item_id, { food, offeringId: offering.id });
      }
    }
    const message = closure
      ? closure.closure_message || "Closed today"
      : hasListedDish && !options.size
        ? "No dishes match your meal preferences."
        : !options.size
          ? "No menu listed."
          : null;
    return { key, name, cafe, meal, options: [...options.values()], message };
  });
}

export function stationSpecials(
  catalog: Catalog,
  date: string,
  dietary: string[],
  preferredMeal: SpecialMeal,
) {
  const lunches = dailyStationMenus(catalog, date, "Lunch", dietary);
  const dinners = dailyStationMenus(catalog, date, "Dinner", dietary);
  return lunches.map((lunch, index) => {
    const dinner = dinners[index];
    const lunchFoods = new Set(lunch.options.map(({ food }) => food.id));
    const sameMenu =
      lunch.message === dinner.message &&
      lunchFoods.size === dinner.options.length &&
      dinner.options.every(({ food }) => lunchFoods.has(food.id));
    const periods = sameMenu
      ? [
          {
            ...(preferredMeal === "Dinner" ? dinner : lunch),
            label: "Lunch & dinner",
          },
        ]
      : [lunch, dinner].map((period) => ({ ...period, label: period.meal }));
    return { key: lunch.key, name: lunch.name, cafe: lunch.cafe, periods };
  });
}

export function latestPersonalReviews(
  reviews: Review[],
  userId?: string | null,
) {
  if (!userId) return [];
  const sorted = reviews
    .filter((r) => r.user_id === userId)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  return sorted.filter(
    (r, i) => sorted.findIndex((x) => x.food_item_id === r.food_item_id) === i,
  );
}

export function reviewedDishes(
  foods: Food[],
  reviews: Review[],
  userId?: string | null,
) {
  const newestVersions = [...foods].sort((a, b) =>
    (b.captured_at ?? "").localeCompare(a.captured_at ?? ""),
  );
  return latestPersonalReviews(reviews, userId).flatMap((review) => {
    const food = newestVersions.find(
      (f) => f.food_item_id === review.food_item_id,
    );
    return food ? [{ food, review }] : [];
  });
}

/** Written reviews only. Controversy requires meaningful votes on both sides. */
export function featuredReview(
  catalog: Catalog,
  data: AppData,
  userId: string | null,
  now: Date,
): { food: Food; review: Review } | undefined {
  const foods = new Map<string, Food>();
  for (const food of catalog.foods) {
    const previous = foods.get(food.food_item_id);
    if (!previous || previous.captured_at < food.captured_at)
      foods.set(food.food_item_id, food);
  }
  const eligible = data.reviews.flatMap((review) => {
    const food = foods.get(review.food_item_id);
    return food &&
      matchesDietary(food, data.profile.dietary) &&
      hasReviewText(review) &&
      Date.parse(review.created_at) <= +now
      ? [{ food, review }]
      : [];
  });
  const weekAgo = +now - 7 * 86400000;
  const recent = eligible.filter(
    ({ review }) => Date.parse(review.created_at) >= weekAgo,
  );
  if (!recent.length)
    return eligible.sort((a, b) =>
      b.review.created_at.localeCompare(a.review.created_at),
    )[0];
  return recent
    .map(({ food, review }) => {
      const total = review.upvotes + review.downvotes;
      const controversial = review.upvotes >= 2 && review.downvotes >= 2;
      const disagreement = controversial
        ? Math.log1p(total) *
          ((2 * Math.min(review.upvotes, review.downvotes)) / total)
        : 0;
      const ageDays = Math.max(
        0,
        (+now - Date.parse(review.created_at)) / 86400000,
      );
      const helpfulness =
        Math.log1p(Math.max(0, review.score)) +
        0.35 * Math.log1p(review.upvotes);
      const score =
        Math.max(helpfulness, disagreement) / Math.pow(1 + ageDays / 7, 0.5) +
        relevantReviewScore(review, catalog, data, userId, data.reviews, now);
      return { food, review, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.review.created_at.localeCompare(a.review.created_at),
    )[0];
}

function rankedServiceDishes(
  catalog: Catalog,
  services: Set<string>,
  reviews: Review[],
  userId: string | null | undefined,
  dietary: string[],
  now: Date,
) {
  const ids = new Set(
    catalog.offerings
      .filter((o) => o.is_listed && services.has(o.menu_service_id))
      .map((o) => o.food_version_id),
  );
  return rankMenuFoods(
    catalog.foods.filter((f) => ids.has(f.id) && matchesDietary(f, dietary)),
    catalog,
    reviews,
    userId,
    now,
    services,
  ).filter(
    (f, i, a) => a.findIndex((x) => x.food_item_id === f.food_item_id) === i,
  );
}

export function homeSelection(
  catalog: Catalog,
  data: AppData,
  userId: string | null,
  now = new Date(),
) {
  const today = campusDate(now);
  const services = catalog.services.filter((s) => s.service_date === today);
  const closedCafes = new Set(
    services.filter((s) => s.status === "closed").map((s) => s.cafe_id),
  );
  const published = new Set(
    services
      .filter((s) => s.status === "published" && !closedCafes.has(s.cafe_id))
      .map((s) => s.id),
  );
  const dishes = rankedServiceDishes(
    catalog,
    published,
    data.reviews,
    userId,
    data.profile.dietary,
    now,
  );
  const personalStars = new Map(
    latestPersonalReviews(data.reviews, userId).map((r) => [
      r.food_item_id,
      r.stars,
    ]),
  );
  let pick: { food: Food; stars: number } | undefined;
  for (const food of dishes) {
    const stars = personalStars.get(food.food_item_id);
    if (stars !== undefined && (!pick || stars > pick.stars))
      pick = { food, stars };
  }
  const unrated = dishes
    .filter((food) => !personalStars.has(food.food_item_id))
    .slice(0, 3);
  return {
    date: published.size ? today : undefined,
    pick,
    featured: featuredReview(catalog, data, userId, now),
    unrated,
  };
}

/** No clock-based guesses in service breaks; highlight only the published active meal. */
export function currentMealPicks(
  catalog: Catalog,
  reviews: Review[],
  userId?: string | null,
  dietary: string[] = [],
  now = new Date(),
) {
  const active = catalog.services
    .filter(
      (s) => /^(Breakfast|Lunch|Dinner)$/.test(s.name) && serviceIsOpen(s, now),
    )
    .sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
  const meal = active[0]?.name;
  const services = new Set(
    active.filter((s) => s.name === meal).map((s) => s.id),
  );
  const dishes = rankedServiceDishes(
    catalog,
    services,
    reviews,
    userId,
    dietary,
    now,
  )
    .filter((food) => foodIsOpen(catalog, food, now, services))
    .slice(0, 2);
  return { meal, dishes };
}
