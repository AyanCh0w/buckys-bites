import test from "node:test";
import assert from "node:assert/strict";
import {
  applyReviewVote,
  campusDate,
  nutritionTotals,
  ratingFor,
  recentDishReview,
  reviewEligibility,
  voteEligibility,
} from "../src/lib/domain";
import type { AppData, Eating, Food, FoodLog, Review } from "../src/lib/types";
const now = new Date("2026-11-19T06:00:00Z");
const eating = (date: string): Eating => ({
  id: "e",
  user_id: "a",
  food_item_id: "dish-a",
  log_id: null,
  eaten_at: date,
  meal_label: "Dinner",
});
const review = (
  user_id: string,
  stars: number,
  created_at: string,
  id = created_at,
): Review => ({
  id,
  user_id,
  food_item_id: "dish-a",
  stars,
  created_at,
  eating_id: "e",
  comment: "Useful written review",
  eaten_at: created_at,
  meal_label: "Dinner",
  updated_at: created_at,
  display_name: "Bronco",
  karma: 0,
  upvotes: 0,
  downvotes: 0,
  score: 0,
});
test("campus days do not follow UTC midnight and respect DST", () => {
  assert.equal(campusDate("2026-11-19T06:00:00Z"), "2026-11-18");
  assert.equal(campusDate("2026-07-19T07:30:00Z"), "2026-07-19");
});
test("nutrition scales snapshots and distinguishes zero from unknown", () => {
  const food = {
    calories_kcal: 100,
    protein_g: 0,
    carbohydrate_g: null,
    total_fat_g: 5,
    fiber_g: 2,
    sugar_g: null,
    sodium_mg: 150,
    saturated_fat_g: 1,
  } as Food;
  const totals = nutritionTotals([{ food, servings: 0.25 } as FoodLog]);
  assert.equal(totals.calories_kcal.value, 25);
  assert.deepEqual(totals.protein_g, { value: 0, missing: 0 });
  assert.deepEqual(totals.carbohydrate_g, { value: 0, missing: 1 });
  assert.equal(totals.sodium_mg.value, 37.5);
});
test("only each user’s latest remaining review contributes", () => {
  const old = review("a", 1, "2026-11-01");
  const latest = review("a", 5, "2026-11-10");
  const other = review("b", 3, "2026-11-02");
  assert.deepEqual(ratingFor([old, latest, other], "dish-a"), {
    average: 4,
    count: 2,
  });
  assert.deepEqual(ratingFor([old, other], "dish-a"), { average: 2, count: 2 });
  assert.deepEqual(ratingFor([], "dish-a"), { average: 0, count: 0 });
});
test("72-hour window includes its boundary but rejects future and other variants", () => {
  assert.equal(
    reviewEligibility([eating("2026-11-16T06:00:00Z")], [], "a", "dish-a", now)
      .eligible,
    true,
  );
  assert.equal(
    reviewEligibility([eating("2026-11-16T05:59:59Z")], [], "a", "dish-a", now)
      .eligible,
    false,
  );
  assert.equal(
    reviewEligibility([eating("2026-11-20T06:00:00Z")], [], "a", "dish-a", now)
      .eligible,
    false,
  );
  assert.equal(
    reviewEligibility([eating(now.toISOString())], [], "a", "dish-b", now)
      .eligible,
    false,
  );
});
test("seven-day window and edits require recent consumption", () => {
  const r = review("a", 4, "2026-11-12T06:00:01Z");
  assert.equal(
    reviewEligibility([eating(now.toISOString())], [r], "a", "dish-a", now)
      .eligible,
    false,
  );
  r.created_at = "2026-11-12T06:00:00Z";
  assert.equal(
    reviewEligibility([eating(now.toISOString())], [r], "a", "dish-a", now)
      .eligible,
    true,
  );
  assert.equal(
    reviewEligibility([], [r], "a", "dish-a", now, r.id).eligible,
    false,
  );
});
test("the dish edit action targets my latest review until seven days after publication", () => {
  const older = review("a", 3, "2026-11-01T06:00:00Z");
  older.updated_at = now.toISOString();
  const current = review("a", 5, "2026-11-12T06:00:01Z");
  current.comment = null;
  const otherUser = review("b", 1, now.toISOString());
  const otherDish = { ...current, food_item_id: "dish-b" };
  const reviews = [otherUser, older, otherDish, current];
  assert.equal(recentDishReview(reviews, "a", "dish-a", now)?.id, current.id);
  assert.equal(recentDishReview(reviews, null, "dish-a", now), undefined);
  assert.equal(
    recentDishReview(reviews, "a", "dish-a", new Date(+now + 1000)),
    undefined,
  );
  assert.equal(
    reviewEligibility(
      [eating(now.toISOString())],
      reviews,
      "a",
      "dish-a",
      now,
      older.id,
    ).eligible,
    true,
  );
});
test("retained history grants lifetime voting, self-votes do not", () => {
  const r = review("b", 4, "2026-11-18");
  assert.equal(voteEligibility([eating("2020-01-01")], r, "a"), null);
  assert.match(voteEligibility([], r, "a")!, /eaten/);
  assert.match(voteEligibility([eating("2020-01-01")], r, "b")!, /own/);
});
test("switching and undoing a vote keeps review counts and author karma in sync", () => {
  const target = {
    ...review("b", 4, "2026-11-19", "r1"),
    upvotes: 4,
    downvotes: 1,
    score: 3,
    karma: 3,
  };
  const sameAuthor = { ...review("b", 3, "2026-11-18", "r2"), karma: 3 };
  const otherAuthor = review("c", 5, "2026-11-18", "r3");
  const initial: AppData = {
    reviews: [target, sameAuthor, otherAuthor],
    votes: {},
    history: [],
    logs: [],
    favorites: [],
    submissions: [],
    profile: {
      display_name: "Voter",
      avatar_id: "classic",
      goals: {},
      dietary: [],
      haptics: false,
    },
  };
  const up = applyReviewVote(initial, target, 1);
  const down = applyReviewVote(up, target, -1);
  assert.deepEqual(up.votes, { r1: 1 });
  assert.deepEqual(down.votes, { r1: -1 });
  assert.deepEqual(down.reviews, [
    { ...target, downvotes: 2, score: 2, karma: 2 },
    { ...sameAuthor, karma: 2 },
    otherAuthor,
  ]);
  assert.equal(down.reviews[2], otherAuthor);
  assert.deepEqual(applyReviewVote(down, target, 1), up);
  assert.deepEqual(applyReviewVote(down, target, 0), initial);
});

test("deleted reviews do not erase the submission cooldown", () => {
  const receipt = {
    user_id: "a",
    food_item_id: "dish-a",
    review_id: null,
    submitted_at: "2026-11-18T06:00:00Z",
  };
  assert.equal(
    reviewEligibility(
      [eating(now.toISOString())],
      [],
      "a",
      "dish-a",
      now,
      undefined,
      [receipt],
    ).eligible,
    false,
  );
});
