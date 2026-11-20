import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import type { Session } from "@supabase/supabase-js";
import snapshot from "../data/catalog.json";
import { supabase } from "../lib/supabase";
import { accountSession } from "../lib/account-auth";
import { previewAccountEnabled } from "../lib/config";
import { avatarId, isAvatarId } from "../lib/avatars";
import { DEFAULT_STARRED_KITCHENS } from "../lib/menu";
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
const CATALOG_KEY = "buckys-bites:catalog:v2";
type Toast = {
  message: string;
  action?: string;
  onAction?: () => void | Promise<void>;
};
type ProfileStatus = "loading" | "saved" | "error";
type AppContext = {
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
  notify: (
    message: string,
    action?: string,
    onAction?: Toast["onAction"],
  ) => void;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  addFood: (
    food: Food,
    meal: string,
    eatenAt?: string,
    selection?: MenuSelection,
  ) => Promise<string>;
  updateLog: (id: string, servings: number, meal: string) => Promise<void>;
  deleteLog: (id: string, reviewId?: string, undo?: boolean) => Promise<void>;
  saveReview: (
    food: Food,
    stars: number,
    comment: string,
    id?: string,
  ) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  vote: (review: Review, direction: 1 | -1) => Promise<void>;
  saveMealPreferences: (dietary: string[]) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  report: (id: string, reason: string) => Promise<void>;
  requestAccountDeletion: () => Promise<void>;
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
  const [catalog, setCatalog] = useState<Catalog>(snapshot as Catalog);
  const [data, setData] = useState<AppData>(initial);
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
    (message: string, action?: string, onAction?: Toast["onAction"]) =>
      setToast({ message, action, onAction }),
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
        notify("Couldn’t load your preferences.", "Retry", load),
      );
    if (ready) void load();
    return () => {
      profileRequest.current++;
    };
  }, [ready, refreshProfile, notify]);

  const reviewRequest = useRef(0);
  const savedVotes = useRef<AppData["votes"]>({});
  const pendingVotes = useRef(new Map<string, { target: number }>());
  const refreshReviews = useCallback(async () => {
    // The last pending write will fetch a fresh pair of totals and selections.
    if (pendingVotes.current.size) return;
    const request = ++reviewRequest.current;
    const [reviews, selections] = await Promise.all([
      selectAll("bites_public_reviews").catch(() => null),
      userId && userId !== "local"
        ? selectAll("bites_votes", "review_id,vote", "review_id").catch(
            () => null,
          )
        : Promise.resolve({ data: [] }),
    ]);
    if (request !== reviewRequest.current || identity.current !== userId)
      return;
    setBackendAvailable(!!reviews);
    if (!reviews) return;
    if (!selections) {
      // Public reviews are still readable if the account's votes fail to load.
      setData((d) => (d.reviews.length ? d : { ...d, reviews: reviews.data }));
      throw new Error("Couldn’t refresh your review votes.");
    }
    const votes = Object.fromEntries(
      selections.data.map((x) => [x.review_id, x.vote]),
    );
    savedVotes.current = { ...votes };
    setData((d) => ({ ...d, reviews: reviews.data, votes }));
  }, [userId]);

  const refreshAccount = useCallback(async () => {
    await refreshReviews();
    const expected = session?.user.id;
    if (!expected || identity.current !== expected) return;
    const results = await Promise.all([
      selectAll("food_logs", "*,food:food_versions(*)"),
      selectAll("bites_eating_history"),
      supabase.from("favorites").select("food_item_id"),
      selectAll("bites_review_submissions"),
    ]);
    results.forEach(checked);
    if (identity.current !== expected) return;
    setData((d) => ({
      ...d,
      submissions: results[3].data ?? [],
      logs: results[0].data as FoodLog[],
      history: results[1].data ?? [],
      favorites: (results[2].data ?? []).map((x) => x.food_item_id),
    }));
  }, [session, refreshReviews]);

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
        const account = accountSession(next);
        setSession(account);
        if (event === "SIGNED_OUT") setToast(null);
        if (account || event === "SIGNED_OUT") setLocal(false);
        else if (event === "INITIAL_SESSION") setLocal(previewAccountEnabled);
        if (
          (account && identity.current !== account.user.id) ||
          (!account && identity.current && identity.current !== "local")
        ) {
          reviewRequest.current++;
          pendingVotes.current.clear();
          savedVotes.current = {};
          setLoadedProfile(null);
          setData(initial);
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
  }, [refresh]);
  useEffect(() => {
    if (ready) void refreshAccount().catch((e) => notify(e.message));
  }, [ready, refreshAccount, notify]);
  const feedback = () => {
    if (data.profile.haptics && Platform.OS !== "web")
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
  };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    // Local sign-out can clear the device session before server revocation fails.
    if (error && (await supabase.auth.getSession()).data.session) throw error;
  };
  const refreshAfterMutation = async () => {
    try {
      await refreshAccount();
    } catch {
      notify("Saved. Your account will refresh when you reconnect.");
    }
  };
  const addFood = async (
    food: Food,
    meal: string,
    eatenAt = new Date().toISOString(),
    selection?: MenuSelection,
  ) => {
    if (!session) throw new Error("Sign in to save your food online.");
    const time = new Date(eatenAt).getTime();
    if (
      !Number.isFinite(time) ||
      time > Date.now() ||
      time < Date.now() - 30 * 86400000
    )
      throw new Error("Choose an eating time in the past 30 days.");
    const details = { p_servings: 1, p_meal: meal, p_eaten_at: eatenAt };
    const result = checked(
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
    );
    await refreshAfterMutation();
    feedback();
    return result.data as string;
  };
  const updateLog = async (logId: string, servings: number, meal: string) => {
    if (!session) throw new Error("Sign in to update your food log.");
    if (!(servings > 0 && servings <= 100))
      throw new Error("Enter a valid portion.");
    checked(
      await supabase.rpc("bites_update_log", {
        p_log_id: logId,
        p_servings: servings,
        p_meal: meal,
      }),
    );
    await refreshAfterMutation();
  };
  const deleteLog = async (logId: string, reviewId?: string, undo = false) => {
    if (!session) throw new Error("Sign in to update your food log.");
    checked(
      await supabase.rpc("bites_delete_log", {
        p_log_id: logId,
        p_review_id: reviewId ?? null,
        p_undo: undo,
      }),
    );
    await refreshAfterMutation();
  };
  const saveReview = async (
    food: Food,
    stars: number,
    comment: string,
    reviewId?: string,
  ) => {
    if (!session) throw new Error("Sign in to publish a review.");
    if (!Number.isInteger(stars) || stars < 1 || stars > 5)
      throw new Error("Choose 1–5 Bucky stars.");
    if (comment.length > 2000)
      throw new Error("Keep your review under 2,000 characters.");
    const eligible = reviewEligibility(
      data.history,
      data.reviews,
      session.user.id,
      food.food_item_id,
      new Date(),
      reviewId,
      data.submissions,
    );
    if (!eligible.eligible) throw new Error(eligible.reason);
    checked(
      await supabase.rpc("bites_save_review", {
        p_food_item_id: food.food_item_id,
        p_stars: stars,
        p_comment: comment,
        p_review_id: reviewId ?? null,
      }),
    );
    await refreshAfterMutation();
    feedback();
  };
  const deleteReview = async (reviewId: string) => {
    if (!session) throw new Error("Sign in to delete your review.");
    checked(await supabase.from("bites_reviews").delete().eq("id", reviewId));
    await refreshAfterMutation();
  };
  const vote = async (review: Review, direction: 1 | -1) => {
    if (!session || identity.current !== session.user.id) return;
    const id = review.id;
    const pending = pendingVotes.current.get(id);
    const current = pending?.target ?? savedVotes.current[id] ?? 0;
    const next = current === direction ? 0 : direction;
    if (next) {
      const reason = voteEligibility(data.history, review, session.user.id);
      if (reason) throw new Error(reason);
    }
    reviewRequest.current++;
    setData((d) => applyReviewVote(d, review, next));
    if (pending) {
      pending.target = next;
      return;
    }

    // One writer per review. Taps during a save replace its next target.
    const write = { target: next };
    pendingVotes.current.set(id, write);
    const isCurrent = () => pendingVotes.current.get(id) === write;
    try {
      for (;;) {
        const target = write.target;
        try {
          checked(
            await supabase.rpc("bites_vote", {
              p_review_id: id,
              p_vote: target,
            }),
          );
        } catch (error) {
          if (!isCurrent()) return;
          if (write.target !== target) continue;
          const confirmed = savedVotes.current[id] ?? 0;
          setData((d) => applyReviewVote(d, review, confirmed));
          throw error;
        }
        if (!isCurrent()) return;
        savedVotes.current[id] = target;
        if (write.target === target) return;
      }
    } finally {
      if (isCurrent()) {
        pendingVotes.current.delete(id);
        void refreshReviews().catch((e) => notify(e.message));
      }
    }
  };
  const saveProfile = async (profile: Profile) => {
    if (!userId) throw new Error("Sign in to save preferences.");
    if (profileStatus !== "saved")
      throw new Error("Load your saved preferences before editing.");
    if (!profile.display_name.trim() || profile.display_name.length > 40)
      throw new Error("Use a display name of 1–40 characters.");
    if (!isAvatarId(profile.avatar_id))
      throw new Error("Choose one of the eight Bucky avatars.");
    profile = {
      ...profile,
      goals_initialized: true,
      display_name: profile.display_name.trim(),
      avatar_id: avatarId(profile.avatar_id),
    };
    if (!local) {
      checked(
        await supabase.from("bites_profiles").upsert({
          id: userId,
          display_name: profile.display_name,
          avatar_id: profile.avatar_id,
        }),
      );
      checked(
        await supabase
          .from("bites_preferences")
          .upsert({ user_id: userId, preferences: profile }),
      );
    } else {
      await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
    }
    if (identity.current !== userId) return;
    profileRequest.current++;
    setData((d) => ({
      ...d,
      profile,
      reviews: d.reviews.map((r) =>
        r.user_id === userId
          ? {
              ...r,
              display_name: profile.display_name,
              avatar_id: profile.avatar_id,
            }
          : r,
      ),
    }));
  };
  const saveMealPreferences = async (dietary: string[]) => {
    const selected = dietary.filter((x) => ["Vegetarian", "Vegan"].includes(x));
    if (userId) await saveProfile({ ...data.profile, dietary: selected });
    else {
      await AsyncStorage.setItem(DIETARY_KEY, JSON.stringify(selected));
      setData((d) => ({ ...d, profile: { ...d.profile, dietary: selected } }));
    }
  };
  const report = async (reviewId: string, reason: string) => {
    if (!session) throw new Error("Sign in to report a review.");
    checked(
      await supabase
        .from("bites_reports")
        .upsert(
          { user_id: userId, review_id: reviewId, reason },
          { onConflict: "user_id,review_id" },
        ),
    );
  };
  const requestAccountDeletion = async () => {
    if (!session) throw new Error("Sign in to request account deletion.");
    checked(await supabase.rpc("bites_request_account_deletion"));
  };
  return (
    <Context.Provider
      value={{
        catalog,
        data,
        session,
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
        introComplete,
        finishIntro,
        refreshProfile,
        profileStatus,
        saveMealPreferences,
        report,
        requestAccountDeletion,
        userId,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("AppProvider is missing");
  return context;
}
