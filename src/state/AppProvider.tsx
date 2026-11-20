import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { HapticContext, useHapticPlayer, type HapticCue } from "../lib/haptics";
import type { Session } from "@supabase/supabase-js";
import {
  AccountMutations,
  applyProfile,
  insertLog,
  putReview,
  removeLog,
  removeReview,
  type AccountWrite,
} from "./account-mutations";
import { menuNutrition } from "../lib/menu-nutrition";
import snapshot from "../data/catalog.json";
import { supabase } from "../lib/supabase";
import { accountSession } from "../lib/account-auth";
import { previewAccountEnabled } from "../lib/config";
import { avatarId, isAvatarId } from "../lib/avatars";
import { DEFAULT_STARRED_KITCHENS } from "../lib/menu";
import { withBurgerBreadOptions } from "../lib/menu-options";
import { goalsForProfile } from "../lib/nutrition-goals";
import {
  applyReviewVote,
  campusDate,
  reviewEligibility,
  voteEligibility,
} from "../lib/domain";
import type {
  AppData,
  Catalog,
  Food,
  FoodLog,
  MenuSelection,
  Profile,
  Review,
} from "../lib/types";

let nextTemporaryId = 0;
const temporaryId = () => `pending-${Date.now()}-${++nextTemporaryId}`;

const initial: AppData = {
  submissions: [],
  logs: [],
  history: [],
  favorites: [],
  reviews: [],
  votes: {},
  profile: {
    display_name: "Bronco",
    avatar_id: "classic",
    goals: goalsForProfile(),
    goals_initialized: true,
    dietary: [],
    haptics: true,
  },
};
const LOCAL_KEY = "buckys-bites:profile-preview:v1";
const INTRO_KEY = "buckys-bites:intro:v1";
const DIETARY_KEY = "buckys-bites:dietary:v1";
const LEGACY_STARS_KEY = "buckys-bites:starred-kitchens:v1";
const CATALOG_KEY = "buckys-bites:catalog:v3";
type Toast = {
  message: string;
  action?: string;
  actionHaptic?: HapticCue;
  onAction?: () => void | Promise<void>;
  nutrientRain?: { logId: string; icons: string[] };
};
type ProfileStatus = "loading" | "saved" | "error";
type PublicProfile = Pick<Profile, "display_name" | "avatar_id">;
type Preferences = Omit<Partial<Profile>, keyof PublicProfile> & {
  display_name?: never;
  avatar_id?: never;
};
type ReviewDraft = {
  foodItemId: string;
  edit?: string;
  stars: number;
  comment: string;
};
type AppContext = {
  reviewDraft: ReviewDraft | null;
  signingOut: boolean;
  introComplete: boolean | null;
  finishIntro: () => Promise<void>;
  profileStatus: ProfileStatus;
  refreshProfile: () => Promise<void>;
  catalog: Catalog;
  data: AppData;
  session: Session | null;
  local: boolean;
  ready: boolean;
  backendAvailable: boolean | null;
  refreshing: boolean;
  syncError: string | null;
  toast: Toast | null;
  notify: (message: string, options?: Omit<Toast, "message">) => void;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  signOut: () => void;
  resolveId: (id: string) => string;
  addFood: (
    food: Food,
    meal: string,
    eatenAt?: string,
    selection?: MenuSelection,
  ) => string;
  updateLog: (id: string, servings: number, meal: string) => void;
  deleteLog: (id: string, reviewId?: string, undo?: boolean) => void;
  saveReview: (
    food: Food,
    stars: number,
    comment: string,
    id?: string,
    recoverDraft?: (edit?: string) => void,
  ) => void;
  deleteReview: (id: string) => void;
  vote: (review: Review, direction: 1 | -1) => void;
  saveMealPreferences: (dietary: string[]) => void;
  saveProfile: (changes: PublicProfile | Preferences) => void;
  toggleKitchenStar: (key: string) => void;
  report: (id: string, reason: string) => void;
  requestAccountDeletion: () => void;
  userId: string | null;
};
const Context = createContext<AppContext | null>(null);
function checked<T extends { error: { message: string } | null }>(r: T): T {
  if (r.error) throw new Error(r.error.message);
  return r;
}

async function selectAll(table: string, columns = "*", orderBy = "id") {
  const data: any[] = [];
  for (let from = 0; ; from += 1000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let result;
    try {
      result = checked(
        await supabase
          .from(table)
          .select(columns)
          .order(orderBy)
          .range(from, from + 999)
          .abortSignal(controller.signal),
      );
    } finally {
      clearTimeout(timer);
    }
    data.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) return { data, error: null };
  }
}

export function AppProvider({ children }: React.PropsWithChildren) {
  const [sourceCatalog, setCatalog] = useState<Catalog>(snapshot as Catalog);
  const catalog = useMemo(
    () => withBurgerBreadOptions(sourceCatalog),
    [sourceCatalog],
  );
  const [data, renderData] = useState<AppData>(initial);
  const [account] = useState(() => new AccountMutations(initial, renderData));
  const setData = account.update;
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [local, setLocal] = useState(false);
  const [ready, setReady] = useState(false);
  const [introComplete, setIntroComplete] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(INTRO_KEY)
      .then((value) => {
        if (alive) setIntroComplete(value === "complete");
      })
      .catch(() => {
        if (alive) setIntroComplete(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const finishIntro = async () => {
    await AsyncStorage.setItem(INTRO_KEY, "complete");
    setIntroComplete(true);
  };
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const userId = session?.user.id ?? (local ? "local" : null);
  const identity = useRef(userId);
  identity.current = userId;
  const notify = useCallback(
    (message: string, options?: Omit<Toast, "message">) =>
      setToast({ message, ...options }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.action ? 10000 : 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  const [loadedProfile, setLoadedProfile] = useState<{
    id: string;
    status: ProfileStatus;
  } | null>(null);
  const profileStatus =
    loadedProfile && loadedProfile.id === userId
      ? loadedProfile.status
      : "loading";
  const playHaptic = useHapticPlayer(
    data.profile.haptics && (!userId || profileStatus === "saved"),
  );
  const profileRequest = useRef(0);
  const defaultName = session?.user.user_metadata?.display_name ?? "Bronco";
  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const request = ++profileRequest.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      let preferences: Partial<Profile> | null;
      let publicProfile: Pick<Profile, "display_name" | "avatar_id"> | null =
        null;
      if (userId === "local") {
        const saved = await AsyncStorage.getItem(LOCAL_KEY);
        preferences = saved ? JSON.parse(saved) : null;
        if (preferences && !Array.isArray(preferences.starred_kitchens)) {
          const legacy = await AsyncStorage.getItem(LEGACY_STARS_KEY).catch(
            () => null,
          );
          if (legacy) {
            try {
              const keys: unknown = JSON.parse(legacy);
              if (Array.isArray(keys)) {
                preferences.starred_kitchens = [
                  ...new Set([
                    ...DEFAULT_STARRED_KITCHENS,
                    ...keys.filter(
                      (key): key is string => typeof key === "string",
                    ),
                  ]),
                ];
              }
            } catch {}
          }
        }
      } else {
        const [prefs, profile] = await Promise.all([
          supabase
            .from("bites_preferences")
            .select("preferences")
            .eq("user_id", userId)
            .abortSignal(controller.signal)
            .maybeSingle(),
          supabase
            .from("bites_profiles")
            .select("display_name,avatar_id")
            .eq("id", userId)
            .abortSignal(controller.signal)
            .maybeSingle(),
        ]);
        preferences = checked(prefs).data?.preferences ?? null;
        publicProfile = checked(profile).data;
      }
      if (request !== profileRequest.current || identity.current !== userId)
        return;
      if (preferences === null) {
        // Insert once, without replacing preferences saved on another device.
        const defaults = { goals: goalsForProfile(), goals_initialized: true };
        if (userId === "local") {
          preferences = defaults;
          await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(defaults));
        } else {
          checked(
            await supabase
              .from("bites_preferences")
              .upsert(
                { user_id: userId, preferences: defaults },
                { ignoreDuplicates: true },
              )
              .abortSignal(controller.signal),
          );
          // Read the winner when two devices initialize at the same time.
          const saved = checked(
            await supabase
              .from("bites_preferences")
              .select("preferences")
              .eq("user_id", userId)
              .abortSignal(controller.signal)
              .single(),
          ).data;
          if (!saved) throw new Error("Couldn’t create your daily goals.");
          preferences = saved.preferences;
        }
      }
      if (request !== profileRequest.current || identity.current !== userId)
        return;
      setData((d) => ({
        ...d,
        profile: {
          ...initial.profile,
          ...(userId === "local" ? { dietary: d.profile.dietary } : {}),
          ...preferences,
          goals: goalsForProfile(preferences),
          goals_initialized: true,
          display_name:
            publicProfile?.display_name ??
            preferences?.display_name ??
            defaultName,
          avatar_id: avatarId(
            publicProfile?.avatar_id ?? preferences?.avatar_id,
          ),
        },
      }));
      setLoadedProfile({
        id: userId,
        status: "saved",
      });
    } catch (error) {
      if (request !== profileRequest.current || identity.current !== userId)
        return;
      setLoadedProfile({ id: userId, status: "error" });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }, [userId, defaultName]);

  useEffect(() => {
    const load = () =>
      refreshProfile().catch(() =>
        notify("Couldn’t load your preferences.", {
          action: "Retry",
          onAction: load,
        }),
      );
    if (ready) void load();
    return () => {
      profileRequest.current++;
    };
  }, [ready, refreshProfile, notify]);

  const accountRequest = useRef(0);
  const refreshAccount = useCallback(async () => {
    if (account.pending) return;
    const revision = account.revision;
    const request = ++accountRequest.current;
    const signedIn = Boolean(userId && userId !== "local");
    const [reviews, selections, privateRows] = await Promise.all([
      selectAll("bites_public_reviews").catch(() => null),
      signedIn
        ? selectAll("bites_votes", "review_id,vote", "review_id").catch(
            () => null,
          )
        : Promise.resolve({ data: [] }),
      signedIn
        ? Promise.all([
            selectAll("food_logs", "*,food:food_versions(*)"),
            selectAll("bites_eating_history"),
            supabase.from("favorites").select("food_item_id").then(checked),
            selectAll("bites_review_submissions"),
          ]).catch(() => null)
        : null,
    ]);
    // A response from before a tap (even one already confirmed) is stale.
    if (
      revision !== account.revision ||
      request !== accountRequest.current ||
      identity.current !== userId
    )
      return;
    setBackendAvailable(!!reviews);
    setData((d) => ({
      ...d,
      ...(reviews &&
        (selections || !d.reviews.length) && { reviews: reviews.data }),
      ...(reviews &&
        selections && {
          votes: Object.fromEntries(
            selections.data.map((v) => [v.review_id, v.vote]),
          ),
        }),
      ...(privateRows && {
        logs: privateRows[0].data as FoodLog[],
        history: privateRows[1].data,
        favorites: (privateRows[2].data ?? []).map((x) => x.food_item_id),
        submissions: privateRows[3].data,
      }),
    }));
    if (!selections) throw new Error("Couldn’t refresh your review votes.");
    if (signedIn && !privateRows)
      throw new Error("Couldn’t refresh your account.");
  }, [account, setData, userId]);

  const catalogRefreshRunning = useRef(false);
  const refresh = useCallback(async () => {
    if (catalogRefreshRunning.current) return;
    catalogRefreshRunning.current = true;
    setRefreshing(true);
    try {
      const names = [
        "cafes",
        "stations",
        "menu_services",
        "menu_offerings",
        "food_versions",
        "menu_components",
        "bites_catalog_component_links",
      ] as const;
      const responses = await Promise.all(names.map((name) => selectAll(name)));
      responses.forEach(checked);
      const next = {
        ...snapshot,
        cafes: responses[0].data!,
        stations: responses[1].data!,
        services: responses[2].data!,
        offerings: responses[3].data!,
        foods: responses[4].data!,
        components: responses[5].data!,
        links: responses[6].data!,
      } as Catalog;
      setCatalog(next);
      setSyncError(null);
      await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(next)).catch(
        () => {},
      );
    } catch {
      setSyncError("Couldn’t refresh. Showing the last saved menu.");
    } finally {
      catalogRefreshRunning.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let receivedAuthEvent = false;
    Promise.all([
      supabase.auth.getSession(),
      AsyncStorage.getItem(CATALOG_KEY),
      AsyncStorage.getItem(DIETARY_KEY),
    ])
      .then(([auth, cache, dietary]) => {
        if (!alive) return;
        if (cache) {
          try {
            const parsed = JSON.parse(cache);
            if (Array.isArray(parsed.foods) && Array.isArray(parsed.services))
              setCatalog((current) =>
                current === snapshot
                  ? { ...parsed, images: snapshot.images }
                  : current,
              );
          } catch {}
        }
        if (dietary) {
          try {
            const selected = JSON.parse(dietary);
            if (Array.isArray(selected))
              setData((d) => ({
                ...d,
                profile: {
                  ...d.profile,
                  dietary: selected.filter((x) =>
                    ["Vegetarian", "Vegan"].includes(x),
                  ),
                },
              }));
          } catch {}
        }
        if (!receivedAuthEvent) {
          const restored = accountSession(auth.data.session);
          setSession(restored);
          setLocal(!restored && previewAccountEnabled);
        }
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          if (!receivedAuthEvent && previewAccountEnabled) setLocal(true);
          setReady(true);
        }
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, next) => {
        if (!alive) return;
        receivedAuthEvent = true;
        const nextSession = accountSession(next);
        setSession(nextSession);
        if (event === "SIGNED_OUT") setToast(null);
        if (nextSession || event === "SIGNED_OUT") setLocal(false);
        else if (event === "INITIAL_SESSION") setLocal(previewAccountEnabled);
        if (
          (nextSession && identity.current !== nextSession.user.id) ||
          (!nextSession && identity.current && identity.current !== "local")
        ) {
          setToast(null);
          profileRequest.current++;
          setSigningOut(false);
          identity.current = nextSession?.user.id ?? null;
          setLoadedProfile(null);
          setReviewDraft(null);
          account.reset(initial);
        }
      },
    );
    let menuDay = campusDate();
    const refreshOnNewDay = () => {
      const today = campusDate();
      if (today === menuDay) return;
      menuDay = today;
      void refresh();
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
        refreshOnNewDay();
      } else supabase.auth.stopAutoRefresh();
    });
    const checkDay = setInterval(refreshOnNewDay, 60_000);
    void refresh();
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      sub.remove();
      clearInterval(checkDay);
    };
  }, [refresh, account]);
  useEffect(() => {
    if (ready) void refreshAccount().catch((e) => notify(e.message));
  }, [ready, refreshAccount, notify]);
  const enqueue = (
    write: Omit<AccountWrite, "failed">,
    failure: string,
    recoverDraft?: () => void,
  ) => {
    if (identity.current !== userId || signingOut)
      throw new Error(
        "Your account is changing. Please try again in a moment.",
      );
    account.enqueue(
      {
        ...write,
        failed: (error) => {
          playHaptic("error");
          const detail = error instanceof Error ? error.message : "";
          notify(
            detail ? `${failure} ${detail}` : failure,
            recoverDraft
              ? { action: "Edit", onAction: recoverDraft }
              : undefined,
          );
        },
      },
      () => {
        if (identity.current === userId) void refreshAccount().catch(() => {});
      },
    );
  };
  const resolveId = account.resolveId;
  const serverId = (id: string) => {
    const resolved = resolveId(id);
    if (resolved.startsWith("pending-"))
      throw new Error("The original item couldn’t be saved.");
    return resolved;
  };
  const signOut = () => {
    if (!session || signingOut || identity.current !== session.user.id) return;
    setSigningOut(true);
    setToast(null);
    // Finish already accepted writes using their original session.
    enqueue(
      {
        apply: (d) => d,
        persist: async () => {
          try {
            const { error } = await supabase.auth.signOut({ scope: "local" });
            if (error && (await supabase.auth.getSession()).data.session)
              throw error;
          } finally {
            if (identity.current === userId) setSigningOut(false);
          }
        },
      },
      "Couldn’t sign out.",
    );
  };
  const addFood: AppContext["addFood"] = (
    food,
    meal,
    eatenAt = new Date().toISOString(),
    selection,
  ) => {
    if (!session) throw new Error("Sign in to save your food online.");
    const time = Date.parse(eatenAt);
    if (
      !Number.isFinite(time) ||
      time > Date.now() ||
      time < Date.now() - 30 * 86400000
    )
      throw new Error("Choose an eating time in the past 30 days.");
    const id = temporaryId();
    const offering =
      selection &&
      catalog.offerings.find(
        (o) => o.id === selection.offering_id && o.food_version_id === food.id,
      );
    if (selection && !offering)
      throw new Error("This dish option is unavailable.");
    const log: FoodLog = {
      id,
      user_id: session.user.id,
      food_version_id: food.id,
      eaten_at: eatenAt,
      local_date: campusDate(eatenAt),
      meal_label: meal,
      servings: 1,
      food: selection
        ? menuNutrition(
            food,
            offering,
            catalog.components,
            selection.size,
            selection.choices,
          )
        : food,
      menu_selection: selection && {
        offering_id: selection.offering_id,
        size: selection.size,
        choices: (offering?.modifier_groups ?? []).flatMap((group) =>
          group.options
            .filter((option) => selection.choices.includes(option.key))
            .map((option) => ({ group: group.name, label: option.label })),
        ),
      },
    };
    const details = { p_servings: 1, p_meal: meal, p_eaten_at: eatenAt };
    enqueue(
      {
        temporaryId: id,
        apply: (d) =>
          insertLog(d, { ...log, id: resolveId(id) }, id + "-eating"),
        persist: async () =>
          checked(
            selection
              ? await supabase.rpc("bites_log_configured_food", {
                  ...details,
                  p_offering_id: selection.offering_id,
                  p_size: selection.size ?? null,
                  p_choices: selection.choices,
                })
              : await supabase.rpc("bites_log_food", {
                  ...details,
                  p_food_version_id: food.id,
                }),
          ).data as string,
      },
      "Couldn’t add your food.",
    );
    return id;
  };
  const updateLog: AppContext["updateLog"] = (id, servings, meal) => {
    if (!session) throw new Error("Sign in to update your food log.");
    if (!(servings > 0 && servings <= 100))
      throw new Error("Enter a valid portion.");
    enqueue(
      {
        apply: (d) => ({
          ...d,
          logs: d.logs.map((l) =>
            l.id === resolveId(id) ? { ...l, servings, meal_label: meal } : l,
          ),
          history: d.history.map((h) =>
            h.log_id === resolveId(id) ? { ...h, meal_label: meal } : h,
          ),
        }),
        persist: async () => {
          checked(
            await supabase.rpc("bites_update_log", {
              p_log_id: serverId(id),
              p_servings: servings,
              p_meal: meal,
            }),
          );
        },
      },
      "Couldn’t update your food log.",
    );
  };
  const deleteLog: AppContext["deleteLog"] = (id, reviewId, undo = false) => {
    if (!session) throw new Error("Sign in to update your food log.");
    enqueue(
      {
        apply: (d) =>
          removeLog(d, resolveId(id), reviewId && resolveId(reviewId), undo),
        persist: async () => {
          // Undoing a failed add has already achieved the requested state.
          if (undo && resolveId(id).startsWith("pending-")) return;
          checked(
            await supabase.rpc("bites_delete_log", {
              p_log_id: serverId(id),
              p_review_id: reviewId ? serverId(reviewId) : null,
              p_undo: undo,
            }),
          );
        },
      },
      undo
        ? "Couldn’t undo adding your food."
        : "Couldn’t delete your food log.",
    );
  };
  const saveReview: AppContext["saveReview"] = (
    food,
    stars,
    comment,
    reviewId,
    recoverDraft,
  ) => {
    if (!session) throw new Error("Sign in to publish a review.");
    if (!Number.isInteger(stars) || stars < 1 || stars > 5)
      throw new Error("Choose 1–5 Bucky stars.");
    if (comment.length > 2000)
      throw new Error("Keep your review under 2,000 characters.");
    const owner = session.user.id;
    const now = new Date();
    const eligibility = (d: AppData) =>
      reviewEligibility(
        d.history,
        d.reviews,
        owner,
        food.food_item_id,
        now,
        reviewId,
        d.submissions,
      );
    const eligible = eligibility(account.current);
    if (!eligible.eligible) throw new Error(eligible.reason);
    if (
      reviewId &&
      !account.current.reviews.some(
        (review) =>
          review.id === resolveId(reviewId) &&
          review.user_id === owner &&
          review.food_item_id === food.food_item_id,
      )
    )
      throw new Error("This review is unavailable.");
    const id = reviewId ?? temporaryId();
    setReviewDraft(null);
    enqueue(
      {
        temporaryId: reviewId ? undefined : id,
        apply: (d) => {
          const eating = eligibility(d).eating;
          const prior = d.reviews.find((r) => r.id === resolveId(id));
          if (!eating || (reviewId && !prior)) return d;
          return putReview(d, {
            id: resolveId(id),
            user_id: owner,
            food_item_id: food.food_item_id,
            created_at: now.toISOString(),
            upvotes: 0,
            downvotes: 0,
            score: 0,
            karma: d.reviews.find((r) => r.user_id === owner)?.karma ?? 0,
            ...prior,
            updated_at: now.toISOString(),
            eating_id: eating.id,
            eaten_at: eating.eaten_at,
            meal_label: eating.meal_label,
            display_name: d.profile.display_name,
            avatar_id: d.profile.avatar_id,
            stars,
            comment: comment.trim() || null,
          });
        },
        persist: async () =>
          checked(
            await supabase.rpc("bites_save_review", {
              p_food_item_id: food.food_item_id,
              p_stars: stars,
              p_comment: comment,
              p_review_id: reviewId ? serverId(reviewId) : null,
            }),
          ).data as string,
      },
      "Couldn’t save your review.",
      recoverDraft &&
        (() => {
          const edit =
            reviewId &&
            account.current.reviews.find((r) => r.id === resolveId(reviewId))
              ?.id;
          setReviewDraft({
            foodItemId: food.food_item_id,
            edit,
            stars,
            comment,
          });
          recoverDraft(edit);
        }),
    );
  };
  const deleteReview = (id: string) => {
    if (!session) throw new Error("Sign in to delete your review.");
    enqueue(
      {
        apply: (d) => removeReview(d, resolveId(id)),
        persist: async () => {
          checked(
            await supabase
              .from("bites_reviews")
              .delete()
              .eq("id", serverId(id)),
          );
        },
      },
      "Couldn’t delete your review.",
    );
  };
  const vote: AppContext["vote"] = (review, direction) => {
    if (!session || identity.current !== session.user.id) return;
    const next = account.current.votes[review.id] === direction ? 0 : direction;
    if (next) {
      const reason = voteEligibility(
        account.current.history,
        review,
        session.user.id,
      );
      if (reason) {
        playHaptic("error");
        throw new Error(reason);
      }
    }
    enqueue(
      {
        apply: (d) => applyReviewVote(d, review, next),
        voteKey: review.id,
        persist: async () => {
          checked(
            await supabase.rpc("bites_vote", {
              p_review_id: serverId(review.id),
              p_vote: next,
            }),
          );
        },
      },
      "Couldn’t save your vote.",
    );
    playHaptic(next ? "attach" : "release");
  };
  const changeProfile = (
    patch: (profile: Profile) => PublicProfile | Preferences,
  ) => {
    if (!userId) throw new Error("Sign in to save preferences.");
    if (profileStatus !== "saved")
      throw new Error("Load your saved preferences before editing.");
    const apply = (d: AppData) => applyProfile(d, userId, patch(d.profile));
    profileRequest.current++;
    enqueue(
      {
        apply,
        persist: async (confirmed) => {
          const changes = patch(confirmed.profile);
          const profile = { ...confirmed.profile, ...changes };
          if (local) {
            await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
          } else if (changes.display_name !== undefined) {
            checked(
              await supabase.from("bites_profiles").upsert({
                id: userId,
                display_name: profile.display_name,
                avatar_id: profile.avatar_id,
              }),
            );
          } else {
            checked(
              await supabase.from("bites_preferences").upsert({
                user_id: userId,
                preferences: profile,
              }),
            );
          }
          if (identity.current === userId) profileRequest.current++;
        },
      },
      "Couldn’t save your preferences.",
    );
  };
  const saveProfile: AppContext["saveProfile"] = (changes) => {
    if (changes.display_name !== undefined) {
      if (!changes.display_name.trim() || changes.display_name.length > 40)
        throw new Error("Use a display name of 1–40 characters.");
      if (!isAvatarId(changes.avatar_id))
        throw new Error("Choose one of the eight Bucky avatars.");
      changes = { ...changes, display_name: changes.display_name.trim() };
    }
    changeProfile(() => changes);
  };
  const toggleKitchenStar = (key: string) => {
    if (profileStatus !== "saved") return;
    const selected = !(
      account.current.profile.starred_kitchens ?? DEFAULT_STARRED_KITCHENS
    ).includes(key);
    changeProfile((profile) => {
      const keys = profile.starred_kitchens ?? DEFAULT_STARRED_KITCHENS;
      return {
        starred_kitchens: selected
          ? [...new Set([...keys, key])]
          : keys.filter((other) => other !== key),
      };
    });
    playHaptic(selected ? "attach" : "release");
  };
  const saveMealPreferences = (dietary: string[]) => {
    const selected = dietary.filter((x) => ["Vegetarian", "Vegan"].includes(x));
    if (userId) return saveProfile({ dietary: selected });
    enqueue(
      {
        apply: (d) => applyProfile(d, null, { dietary: selected }),
        persist: () =>
          AsyncStorage.setItem(DIETARY_KEY, JSON.stringify(selected)),
      },
      "Couldn’t save your dietary preferences.",
    );
  };
  const report = (id: string, reason: string) => {
    if (!session) throw new Error("Sign in to report a review.");
    enqueue(
      {
        apply: (d) => d,
        persist: async () => {
          checked(
            await supabase
              .from("bites_reports")
              .upsert(
                { user_id: userId, review_id: serverId(id), reason },
                { onConflict: "user_id,review_id" },
              ),
          );
        },
      },
      "Couldn’t submit your report.",
    );
  };
  const requestAccountDeletion = () => {
    if (!session) throw new Error("Sign in to request account deletion.");
    enqueue(
      {
        apply: (d) => d,
        persist: async () => {
          checked(await supabase.rpc("bites_request_account_deletion"));
          if (identity.current === userId)
            notify("Your deletion request has been submitted");
        },
      },
      "Couldn’t submit your deletion request.",
    );
  };
  return (
    <Context.Provider
      value={{
        catalog,
        data: signingOut ? initial : data,
        signingOut,
        reviewDraft: signingOut ? null : reviewDraft,
        session: signingOut ? null : session,
        resolveId,
        local,
        ready,
        backendAvailable,
        refreshing,
        syncError,
        toast,
        notify,
        dismissToast: () => setToast(null),
        refresh,
        refreshAccount,
        signOut,
        addFood,
        updateLog,
        deleteLog,
        saveReview,
        deleteReview,
        vote,
        saveProfile,
        toggleKitchenStar,
        introComplete,
        finishIntro,
        refreshProfile,
        profileStatus: signingOut ? "loading" : profileStatus,
        saveMealPreferences,
        report,
        requestAccountDeletion,
        userId: signingOut ? null : userId,
      }}
    >
      <HapticContext.Provider value={playHaptic}>
        {children}
      </HapticContext.Provider>
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("AppProvider is missing");
  return context;
}
