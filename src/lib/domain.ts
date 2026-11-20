import type {
  AppData,
  Catalog,
  Eating,
  Food,
  FoodLog,
  Nutrient,
  Review,
  ReviewSubmission,
  Service,
} from "./types";

export const CAMPUS_TZ = "America/Los_Angeles";
export const NUTRIENTS: {
  key: Nutrient;
  factKey: string;
  label: string;
  unit: string;
  color: string;
  icon: string;
}[] = [
  {
    key: "calories_kcal",
    factKey: "calories",
    label: "Calories",
    unit: "cal",
    color: "#A32035",
    icon: "calories",
  },
  {
    key: "protein_g",
    factKey: "proteinContent",
    label: "Protein",
    unit: "g",
    color: "#55712E",
    icon: "protein",
  },
  {
    key: "carbohydrate_g",
    factKey: "carbohydrateContent",
    label: "Carbs",
    unit: "g",
    color: "#C97900",
    icon: "carbohydrates",
  },
  {
    key: "total_fat_g",
    factKey: "fatContent",
    label: "Fat",
    unit: "g",
    color: "#7F5E9C",
    icon: "fat",
  },
  {
    key: "fiber_g",
    factKey: "fiberContent",
    label: "Fiber",
    unit: "g",
    color: "#55712E",
    icon: "fiber",
  },
  {
    key: "sugar_g",
    factKey: "sugarContent",
    label: "Sugar",
    unit: "g",
    color: "#C97900",
    icon: "sugar",
  },
  {
    key: "sodium_mg",
    factKey: "sodiumContent",
    label: "Sodium",
    unit: "mg",
    color: "#4D8798",
    icon: "sodium",
  },
  {
    key: "saturated_fat_g",
    factKey: "saturatedFatContent",
    label: "Saturated fat",
    unit: "g",
    color: "#7F5E9C",
    icon: "saturated-fat",
  },
];
export function campusDate(date: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  return ["year", "month", "day"]
    .map((p) => parts.find((x) => x.type === p)!.value)
    .join("-");
}
export function shiftDate(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    timeZone: CAMPUS_TZ,
    ...options,
  });
}
export function timeLabel(date: string | null) {
  return date
    ? new Date(date)
        .toLocaleTimeString("en-US", {
          timeZone: CAMPUS_TZ,
          hour: "numeric",
          minute: "2-digit",
        })
        .replace(":00", "")
    : "Hours unavailable";
}
export function currentMeal(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: CAMPUS_TZ,
    }).format(now),
  );
  return hour < 11 ? "Breakfast" : hour < 17 ? "Lunch" : "Dinner";
}
export function serviceStatus(
  s: Service,
  now = new Date(),
): "Serving now" | "Later today" | "Service ended" | "On the menu" {
  if (!s.starts_at || !s.ends_at || s.service_date !== campusDate(now))
    return "On the menu";
  return now < new Date(s.starts_at)
    ? "Later today"
    : now < new Date(s.ends_at)
      ? "Serving now"
      : "Service ended";
}
export function displayName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
export function dishContext(
  catalog: Catalog,
  food: Food,
  date?: string,
  meal?: string,
  offeringId?: string,
) {
  const offerings = catalog.offerings.filter(
    (o) => o.food_version_id === food.id && o.is_listed,
  );
  const dated = offerings.filter((o) => {
    const service = catalog.services.find((s) => s.id === o.menu_service_id);
    return (
      service?.status === "published" &&
      (!date || service.service_date === date)
    );
  });
  const offering =
    offerings.find((o) => o.id === offeringId) ??
    dated.find((o) => {
      const s = catalog.services.find(
        (service) => service.id === o.menu_service_id,
      );
      return !meal || s?.name === meal;
    }) ??
    dated[0] ??
    (date ? undefined : offerings[0]);
  return {
    offering,
    station: catalog.stations.find((s) => s.id === offering?.station_id),
    service: catalog.services.find((s) => s.id === offering?.menu_service_id),
  };
}
export function menuFoods(
  catalog: Catalog,
  date: string,
  meal?: string,
  cafeId?: string,
) {
  const serviceIds = new Set(
    catalog.services
      .filter(
        (s) =>
          s.service_date === date &&
          s.status === "published" &&
          (!cafeId || s.cafe_id === cafeId) &&
          (!meal || s.name === meal || s.name.startsWith("All Day")),
      )
      .map((s) => s.id),
  );
  const ids = new Set(
    catalog.offerings
      .filter((o) => o.is_listed && serviceIds.has(o.menu_service_id))
      .map((o) => o.food_version_id),
  );
  const foods = catalog.foods.filter((f) => ids.has(f.id));
  return [...new Map(foods.map((f) => [f.food_item_id, f])).values()];
}
export function nutritionTotals(logs: FoodLog[]) {
  return Object.fromEntries(
    NUTRIENTS.map((n) => [
      n.key,
      {
        value: logs.reduce((s, l) => s + (l.food[n.key] ?? 0) * l.servings, 0),
        missing: logs.filter(
          (l) =>
            l.food[n.key] == null ||
            l.food.incomplete_nutrients?.includes(n.key),
        ).length,
      },
    ]),
  ) as Record<Nutrient, { value: number; missing: number }>;
}
export function ratingFor(reviews: Review[], foodId: string) {
  const latest = new Map<string, Review>();
  for (const review of reviews.filter((r) => r.food_item_id === foodId)) {
    const prior = latest.get(review.user_id);
    if (
      !prior ||
      review.created_at > prior.created_at ||
      (review.created_at === prior.created_at && review.id > prior.id)
    )
      latest.set(review.user_id, review);
  }
  const all = [...latest.values()];
  return {
    average: all.length
      ? all.reduce((sum, r) => sum + r.stars, 0) / all.length
      : 0,
    count: all.length,
  };
}
export function nextReviewTime(submittedAt: string) {
  return Date.parse(submittedAt) + 7 * 86400000;
}

export function recentDishReview(
  reviews: Review[],
  userId: string | null,
  foodId: string,
  now = new Date(),
) {
  return reviews
    .filter(
      (r) =>
        r.user_id === userId &&
        r.food_item_id === foodId &&
        nextReviewTime(r.created_at) > now.getTime(),
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
}

export function reviewEligibility(
  history: Eating[],
  reviews: Review[],
  userId: string,
  foodId: string,
  now = new Date(),
  editingId?: string,
  submissions: ReviewSubmission[] = [],
) {
  const eaten = history
    .filter(
      (h) =>
        h.user_id === userId &&
        h.food_item_id === foodId &&
        new Date(h.eaten_at) <= now &&
        now.getTime() - new Date(h.eaten_at).getTime() <= 72 * 3600000,
    )
    .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))[0];
  if (!eaten)
    return {
      eligible: false,
      reason: editingId
        ? "To save changes, you need a meal with this dish logged in the past 72 hours."
        : "Add this dish to your food after eating it. You can review it for the next 72 hours.",
      eating: undefined,
    };
  if (
    !editingId &&
    (recentDishReview(reviews, userId, foodId, now) ||
      submissions.some(
        (r) =>
          r.user_id === userId &&
          r.food_item_id === foodId &&
          nextReviewTime(r.submitted_at) > now.getTime(),
      ))
  )
    return {
      eligible: false,
      reason:
        "You can publish another review seven days after your last one, with a recent meal.",
      eating: eaten,
    };
  return {
    eligible: true,
    reason: "You ate this dish within the last 72 hours.",
    eating: eaten,
  };
}
export function voteEligibility(
  history: Eating[],
  review: Review,
  userId: string,
) {
  if (!review.comment?.trim()) return "Votes are for written reviews.";
  if (review.user_id === userId) return "You can’t vote on your own review.";
  if (
    !history.some(
      (h) => h.user_id === userId && h.food_item_id === review.food_item_id,
    )
  )
    return "You can vote on reviews of dishes you’ve eaten. Add this dish to your food after eating it.";
  return null;
}
export function applyReviewVote(
  data: AppData,
  review: Review,
  next: number,
): AppData {
  const previous = data.votes[review.id] ?? 0;
  if (previous === next) return data;
  const votes = { ...data.votes };
  if (next === 0) delete votes[review.id];
  else votes[review.id] = next;
  const delta = next - previous;
  const reviews = data.reviews.map((r) => {
    if (r.user_id !== review.user_id) return r;
    const karma = r.karma + delta;
    if (r.id !== review.id) return { ...r, karma };
    return {
      ...r,
      karma,
      score: r.score + delta,
      upvotes: r.upvotes + Number(next === 1) - Number(previous === 1),
      downvotes: r.downvotes + Number(next === -1) - Number(previous === -1),
    };
  });
  return { ...data, votes, reviews };
}
export function formatAmount(
  value: number | null | undefined,
  multiplier = 1,
  estimated = false,
) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: estimated ? 0 : 1,
      }).format(value * multiplier);
}
