import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountMutations,
  applyProfile,
  insertLog,
  putReview,
  removeLog,
} from "../src/state/account-mutations";
import { applyReviewVote, nutritionTotals } from "../src/lib/domain";
import type { AppData, FoodLog, Review } from "../src/lib/types";

const initial: AppData = {
  logs: [],
  history: [],
  reviews: [],
  submissions: [],
  favorites: [],
  votes: {},
  profile: {
    display_name: "Bronco",
    avatar_id: "classic",
    haptics: false,
    goals: {},
    dietary: [],
  },
};
const meal = {
  id: "pending-meal",
  user_id: "a",
  food_version_id: "version",
  food: { food_item_id: "dish", calories_kcal: 240 },
  eaten_at: "2026-11-19T20:00:00Z",
  meal_label: "Lunch",
  local_date: "2026-11-19",
  servings: 1,
} as FoodLog;
const review: Review = {
  id: "review",
  user_id: "a",
  eating_id: "eaten",
  food_item_id: "dish",
  stars: 4,
  comment: "Good lunch",
  eaten_at: meal.eaten_at,
  meal_label: "Lunch",
  created_at: meal.eaten_at,
  updated_at: meal.eaten_at,
  display_name: "Bronco",
  upvotes: 3,
  downvotes: 1,
  score: 2,
  karma: 2,
};

test("Undo removes nutrition and history while add is in flight and uses the returned ID", async () => {
  const account = new AccountMutations(initial, () => {});
  const add = Promise.withResolvers<string>();
  const undo = Promise.withResolvers<void>();
  const idle = Promise.withResolvers<void>();
  const deleted: string[] = [];
  account.enqueue(
    {
      temporaryId: meal.id,
      apply: (d) =>
        insertLog(d, { ...meal, id: account.resolveId(meal.id) }, "eaten"),
      persist: () => add.promise,
      failed: (error) => assert.fail(String(error)),
    },
    idle.resolve,
  );
  assert.equal(nutritionTotals(account.current.logs).calories_kcal.value, 240);
  assert.equal(account.current.history[0].log_id, meal.id);
  account.enqueue(
    {
      apply: (d) => removeLog(d, account.resolveId(meal.id), undefined, true),
      persist: () => {
        deleted.push(account.resolveId(meal.id));
        return undo.promise;
      },
      failed: () => {},
    },
    idle.resolve,
  );
  assert.equal(account.current.logs.length, 0);
  assert.equal(account.current.history.length, 0);
  assert.deepEqual(deleted, []);
  add.resolve("saved-meal");
  await add.promise;
  assert.deepEqual(deleted, ["saved-meal"]);
  assert.equal(account.current.logs.length, 0);
  undo.reject(new Error("Undo expired"));
  await idle.promise;
  assert.equal(account.current.logs[0].id, "saved-meal");
  assert.equal(account.current.history[0].log_id, "saved-meal");
});

test("a failed profile save rolls back its public reviews while preserving a later preference", async () => {
  const account = new AccountMutations(
    { ...initial, reviews: [review] },
    () => {},
  );
  const name = Promise.withResolvers<void>();
  const idle = Promise.withResolvers<void>();
  const persistedNames: string[] = [];
  account.enqueue(
    {
      apply: (d) => applyProfile(d, "a", { display_name: "Bucky" }),
      persist: () => name.promise,
      failed: () => {},
    },
    idle.resolve,
  );
  account.enqueue(
    {
      apply: (d) => applyProfile(d, "a", { dietary: ["Vegan"] }),
      persist: async (d) => {
        persistedNames.push(d.profile.display_name);
      },
      failed: (error) => assert.fail(String(error)),
    },
    idle.resolve,
  );
  assert.equal(account.current.reviews[0].display_name, "Bucky");
  assert.deepEqual(account.current.profile.dietary, ["Vegan"]);
  name.reject(new Error("Unavailable"));
  await idle.promise;
  assert.deepEqual(persistedNames, ["Bronco"]);
  assert.equal(account.current.reviews[0].display_name, "Bronco");
  assert.deepEqual(account.current.profile.dietary, ["Vegan"]);
});

test("removing a review or its text adjusts karma and preserves the submission cooldown", () => {
  const data = putReview(insertLog(initial, meal, "eaten"), review);
  const withSibling = {
    ...data,
    reviews: [...data.reviews, { ...review, id: "other", score: 0 }],
  };
  const ratingOnly = putReview(withSibling, { ...review, comment: null });
  assert.deepEqual(
    ratingOnly.reviews.map((r) => r.karma),
    [0, 0],
  );
  assert.equal(ratingOnly.reviews[0].upvotes, 0);
  assert.equal(ratingOnly.reviews[0].downvotes, 0);
  const kept = removeLog(withSibling, meal.id);
  assert.equal(kept.history[0].log_id, null);
  assert.equal(kept.reviews.length, 2);
  const removed = removeLog(withSibling, meal.id, review.id);
  assert.deepEqual(
    removed.reviews.map((r) => [r.id, r.karma]),
    [["other", 0]],
  );
  assert.equal(removed.submissions[0].review_id, null);
  assert.equal(removed.submissions[0].submitted_at, review.created_at);
});

test("rapid votes coalesce while the latest selection and totals stay visible", async () => {
  const account = new AccountMutations(
    { ...initial, reviews: [review] },
    () => {},
  );
  const first = Promise.withResolvers<void>();
  const idle = Promise.withResolvers<void>();
  const requests: number[] = [];
  for (const next of [1, 0, -1]) {
    account.enqueue(
      {
        voteKey: review.id,
        apply: (d) => applyReviewVote(d, review, next),
        persist: async () => {
          requests.push(next);
          if (next === 1) await first.promise;
        },
        failed: (error) => assert.fail(String(error)),
      },
      idle.resolve,
    );
  }
  assert.equal(account.current.votes[review.id], -1);
  assert.equal(account.current.reviews[0].score, 1);
  assert.deepEqual(requests, [1]);
  first.reject(new Error("First vote rejected"));
  await idle.promise;
  assert.deepEqual(requests, [1, -1]);
  assert.equal(account.current.reviews[0].score, 1);
});

test("switching accounts cancels queued work and ignores a late create response", async () => {
  const account = new AccountMutations(initial, () => {});
  const create = Promise.withResolvers<string>();
  account.enqueue(
    {
      temporaryId: meal.id,
      apply: (d) => insertLog(d, meal, "eaten"),
      persist: () => create.promise,
      failed: (error) => assert.fail(String(error)),
    },
    assert.fail,
  );
  account.enqueue(
    {
      apply: (d) => d,
      persist: async () => {
        assert.fail("Old account write ran");
      },
      failed: (error) => assert.fail(String(error)),
    },
    assert.fail,
  );
  account.reset(initial);
  create.resolve("old-account-log");
  await create.promise;
  assert.equal(account.resolveId(meal.id), meal.id);
  assert.equal(account.current, initial);
});
