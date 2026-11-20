import type { AppData, FoodLog, Profile, Review } from "../lib/types";

type Change = (data: AppData) => AppData;
export type AccountWrite = {
  apply: Change;
  persist: (confirmed: AppData) => Promise<string | void>;
  temporaryId?: string;
  voteKey?: string;
  failed: (error: unknown) => void;
};

// Replay outstanding changes over the last confirmed state. A failed write can
// then be removed without restoring a snapshot over newer taps.
export class AccountMutations {
  private writes: AccountWrite[] = [];
  private ids = new Map<string, string>();
  private confirmed: AppData;
  current: AppData;
  revision = 0;

  constructor(
    initial: AppData,
    private render: (data: AppData) => void,
  ) {
    this.current = this.confirmed = initial;
  }

  get pending() {
    return this.writes.length > 0;
  }

  resolveId = (id: string) => this.ids.get(id) ?? id;

  private publish() {
    this.current = this.writes.reduce(
      (data, write) => write.apply(data),
      this.confirmed,
    );
    this.render(this.current);
  }

  update = (change: Change) => {
    this.confirmed = change(this.confirmed);
    this.publish();
  };

  reset(data: AppData) {
    this.revision++;
    this.writes = [];
    this.ids.clear();
    this.update(() => data);
  }

  enqueue(write: AccountWrite, onIdle: () => void) {
    const running = this.pending;
    const last = this.writes.at(-1);
    if (
      write.voteKey &&
      this.writes.length > 1 &&
      last?.voteKey === write.voteKey
    )
      this.writes.pop();
    this.writes.push(write);
    this.revision++;
    this.publish();
    if (!running) void this.flush(onIdle);
  }

  private async flush(onIdle: () => void) {
    while (this.writes.length) {
      const write = this.writes[0];
      try {
        const id = await write.persist(this.confirmed);
        if (this.writes[0] !== write) return; // Account changed during the request.
        if (write.temporaryId && id) this.ids.set(write.temporaryId, id);
        this.confirmed = write.apply(this.confirmed);
      } catch (error) {
        if (this.writes[0] !== write) return;
        if (
          !write.voteKey ||
          !this.writes.slice(1).some((next) => next.voteKey === write.voteKey)
        )
          write.failed(error);
      }
      this.writes.shift();
      this.revision++;
      this.publish();
    }
    onIdle();
  }
}

export function insertLog(
  data: AppData,
  log: FoodLog,
  eatingId: string,
): AppData {
  return {
    ...data,
    logs: [log, ...data.logs],
    history: [
      {
        id: eatingId,
        user_id: log.user_id,
        food_item_id: log.food.food_item_id,
        log_id: log.id,
        eaten_at: log.eaten_at,
        meal_label: log.meal_label,
      },
      ...data.history,
    ],
  };
}

export function removeReview(data: AppData, id: string): AppData {
  const removed = data.reviews.find((r) => r.id === id);
  if (!removed) return data;
  const votes = { ...data.votes };
  delete votes[id];
  return {
    ...data,
    votes,
    reviews: data.reviews
      .filter((r) => r.id !== id)
      .map((r) =>
        r.user_id === removed.user_id
          ? { ...r, karma: r.karma - removed.score }
          : r,
      ),
    submissions: data.submissions.map((s) =>
      s.review_id === id ? { ...s, review_id: null } : s,
    ),
  };
}

export function removeLog(
  data: AppData,
  id: string,
  reviewId?: string,
  undo = false,
): AppData {
  if (reviewId) data = removeReview(data, reviewId);
  return {
    ...data,
    logs: data.logs.filter((l) => l.id !== id),
    history: undo
      ? data.history.filter((h) => h.log_id !== id)
      : data.history.map((h) => (h.log_id === id ? { ...h, log_id: null } : h)),
  };
}

export function putReview(data: AppData, review: Review): AppData {
  const prior = data.reviews.find((r) => r.id === review.id);
  if (!prior)
    return {
      ...data,
      reviews: [review, ...data.reviews],
      submissions: [
        {
          user_id: review.user_id,
          food_item_id: review.food_item_id,
          review_id: review.id,
          submitted_at: review.created_at,
        },
        ...data.submissions,
      ],
    };
  const lostScore = review.comment ? 0 : prior.score;
  return {
    ...data,
    reviews: data.reviews.map((r) => {
      if (r.id === review.id)
        return review.comment
          ? review
          : {
              ...review,
              karma: review.karma - lostScore,
              score: 0,
              upvotes: 0,
              downvotes: 0,
            };
      return lostScore && r.user_id === review.user_id
        ? { ...r, karma: r.karma - lostScore }
        : r;
    }),
  };
}

export function applyProfile(
  data: AppData,
  userId: string | null,
  changes: Partial<Profile>,
): AppData {
  const profile = { ...data.profile, ...changes };
  return {
    ...data,
    profile,
    reviews:
      changes.avatar_id || changes.display_name
        ? data.reviews.map((r) =>
            r.user_id === userId
              ? {
                  ...r,
                  display_name: profile.display_name,
                  avatar_id: profile.avatar_id,
                }
              : r,
          )
        : data.reviews,
  };
}
