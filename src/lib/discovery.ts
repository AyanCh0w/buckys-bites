import type { AppData, Catalog, Food, Review } from "./types";
import { ratingFor } from "./domain";
import { foodIsOpen } from "./availability";

export function publishedDiet(food: Food) {
  const tags = food.dietary_tags.map((t) => t.toLowerCase());
  if (tags.includes("vegan")) return "vegan";
  if (tags.includes("vegetarian")) return "vegetarian";
  // Some named options, such as the Express Vegetarian Breakfast Burrito Bowl,
  // have an explicit entrée label but no separate dietary tag.
  const label = food.name.match(
    /^(?:express\s+)?(vegan|vegetarian)\b|\(\s*(vegan|vegetarian)\s*\)$/i,
  );
  const namedDiet = (label?.[1] ?? label?.[2])?.toLowerCase();
  if (namedDiet === "vegan" || namedDiet === "vegetarian") return namedDiet;
  return "regular";
}

export function matchesDietary(food: Food, selected: string[] = []) {
  if (!selected.length) return true;
  const diet = publishedDiet(food);
  return selected.some((label) => {
    const preference = label.toLowerCase();
    if (preference === "vegan") return diet === "vegan";
    if (preference === "vegetarian") return diet !== "regular";
    return food.dietary_tags.some((tag) => tag.toLowerCase() === preference);
  });
}
export function latestOwnRating(
  reviews: Review[],
  foodId: string,
  userId?: string | null,
) {
  if (!userId) return 0;
  return (
    reviews
      .filter((r) => r.food_item_id === foodId && r.user_id === userId)
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      )[0]?.stars ?? 0
  );
}
/** Numeric preferences only; callers choose a stable fallback for equal scores. */
export function compareFoodPreference(
  a: Food,
  b: Food,
  reviews: Review[],
  userId?: string | null,
) {
  const personal =
    latestOwnRating(reviews, b.food_item_id, userId) -
    latestOwnRating(reviews, a.food_item_id, userId);
  const ar = ratingFor(reviews, a.food_item_id),
    br = ratingFor(reviews, b.food_item_id);
  return personal || br.average - ar.average || br.count - ar.count;
}
export function rankMenuFoods(
  foods: Food[],
  catalog: Catalog,
  reviews: Review[],
  userId?: string | null,
  now = new Date(),
  serviceIds?: Set<string>,
) {
  const firstPlacement = new Map<string, number>();
  for (const offering of catalog.offerings) {
    if (
      !offering.is_listed ||
      (serviceIds && !serviceIds.has(offering.menu_service_id))
    )
      continue;
    const previous = firstPlacement.get(offering.food_version_id) ?? 100000;
    firstPlacement.set(
      offering.food_version_id,
      Math.min(previous, offering.sort_order),
    );
  }
  const ranked = foods.map((food) => ({
    food,
    open: foodIsOpen(catalog, food, now, serviceIds),
    order: firstPlacement.get(food.id) ?? 100000,
  }));
  return ranked
    .sort(
      (a, b) =>
        Number(b.open) - Number(a.open) ||
        compareFoodPreference(a.food, b.food, reviews, userId) ||
        a.order - b.order ||
        a.food.name.localeCompare(b.food.name),
    )
    .map((entry) => entry.food);
}
export const hasReviewText = (review: Review) =>
  Boolean(review.comment?.trim());
export function netVoteLabel(score: number) {
  return `${score > 0 ? "+" : ""}${score} net ${Math.abs(score) === 1 ? "vote" : "votes"}`;
}
export type FeedMode = "Top" | "For You" | "New";
export type TopPeriod = "Day" | "Week" | "All time";
type Interests = Pick<AppData, "history" | "profile">;
export function relevantReviewScore(
  review: Review,
  catalog: Catalog,
  interests: Interests,
  userId: string | null,
  reviews: Review[],
  now: Date,
  ownScore = latestOwnRating(reviews, review.food_item_id, userId),
) {
  const ageHours = Math.max(
    0,
    (now.getTime() - new Date(review.created_at).getTime()) / 3600000,
  );
  const food = catalog.foods.find(
    (f) => f.food_item_id === review.food_item_id,
  );
  const own = ownScore;
  // Bounded affinity boosts plus net helpfulness, decayed with age. No engagement tracking.
  let relevance = 1;
  if (interests.history.some((h) => h.food_item_id === review.food_item_id))
    relevance += 0.5;
  if (own >= 4) relevance += 3;
  if (own > 0 && own <= 2) relevance -= 0.5;
  if (food && foodIsOpen(catalog, food, now)) relevance += 1;
  if (
    food &&
    interests.profile.dietary.length &&
    matchesDietary(food, interests.profile.dietary)
  )
    relevance += 0.5;
  const popularity =
    Math.log1p(Math.max(0, review.score)) + 0.35 * Math.log1p(review.upvotes);
  return (
    (relevance + popularity) / Math.pow(ageHours + 2, 0.65) -
    (review.score < 0 ? Math.log1p(-review.score) : 0)
  );
}
export function reviewFeed({
  reviews,
  mode,
  period = "Day",
  now = new Date(),
  catalog,
  interests,
  userId = null,
}: {
  reviews: Review[];
  mode: FeedMode;
  period?: TopPeriod;
  now?: Date;
  catalog: Catalog;
  interests: Interests;
  userId?: string | null;
}) {
  const duration =
    period === "Day" ? 86400000 : period === "Week" ? 7 * 86400000 : Infinity;
  const personal = new Map<string, Review>();
  for (const r of reviews)
    if (r.user_id === userId) {
      const old = personal.get(r.food_item_id);
      if (
        !old ||
        r.created_at > old.created_at ||
        (r.created_at === old.created_at && r.id > old.id)
      )
        personal.set(r.food_item_id, r);
    }
  const relevant =
    mode === "For You"
      ? new Map(
          reviews.map((r) => [
            r.id,
            relevantReviewScore(
              r,
              catalog,
              interests,
              userId,
              reviews,
              now,
              personal.get(r.food_item_id)?.stars ?? 0,
            ),
          ]),
        )
      : new Map<string, number>();
  return reviews
    .filter(
      (r) =>
        hasReviewText(r) &&
        new Date(r.created_at) <= now &&
        (mode !== "Top" ||
          now.getTime() - new Date(r.created_at).getTime() <= duration),
    )
    .sort(
      (a, b) =>
        (mode === "Top"
          ? b.score - a.score || b.upvotes - a.upvotes
          : mode === "For You"
            ? relevant.get(b.id)! - relevant.get(a.id)!
            : 0) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
}
