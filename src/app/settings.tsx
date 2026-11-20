import { useTheme } from "../state/ThemeProvider";
import { backOrReplace } from "../lib/navigation";
import React, { useEffect, useRef, useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  Share,
  Switch,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Art, BackHeader, Button, Icon, Input, T, Tap } from "../components/ui";
import { useApp } from "../state/AppProvider";

import { useGoalEstimateDraft } from "../state/GoalEstimateDraftProvider";
import {
  FDA_DAILY_VALUES,
  dailyValuesReference,
  isDailyLimit,
} from "../lib/nutrition-goals";
import { NUTRIENTS } from "../lib/domain";
import type { Goals } from "../lib/types";
import { AVATARS, avatarId } from "../lib/avatars";
import { Avatar } from "../components/Avatar";

const nutritionSections = {
  dietary: "Dietary Preferences",
  goals: "Nutritional Goals",
};

function SignOutButton({ disabled = false }: { disabled?: boolean }) {
  const { session, signOut, notify } = useApp();
  const [pending, setPending] = useState(false);
  if (!session) return null;
  return (
    <Button
      secondary
      title={pending ? "Signing out…" : "Sign out"}
      disabled={disabled || pending}
      onPress={async () => {
        setPending(true);
        try {
          await signOut();
          router.dismissTo("/");
        } catch {
          notify("Couldn’t sign out. Please try again.");
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

export default function Settings() {
  const { profileStatus, refreshProfile, notify, userId } = useApp();
  const { section = "profile" } = useLocalSearchParams<{ section: string }>();
  const { s } = useTheme();
  if (
    userId &&
    profileStatus === "error" &&
    ["goals", "profile", "general", "dietary"].includes(section)
  ) {
    return (
      <View>
        <BackHeader />
        <View style={[s.inset, { gap: 12 }]}>
          <T>Your preferences couldn’t load.</T>
          <Button
            title="Try again"
            onPress={() =>
              refreshProfile().catch(() =>
                notify("Couldn’t load your preferences."),
              )
            }
          />
          {section === "general" && <SignOutButton />}
        </View>
      </View>
    );
  }
  return <SettingsForm key={`${userId}:${section}`} section={section} />;
}
function SettingsForm({ section }: { section: string }) {
  const { colors, s } = useTheme();
  const { setDraft } = useGoalEstimateDraft();
  const {
    data,
    local,
    userId,
    saveProfile,
    saveMealPreferences,
    requestAccountDeletion,
    notify,
  } = useApp();
  const [name, setName] = useState(data.profile.display_name);
  const [avatar, setAvatar] = useState(avatarId(data.profile.avatar_id));
  const { width } = useWindowDimensions();
  const [goals, setGoals] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(data.profile.goals).map(([k, v]) => [k, String(v)]),
    ),
  );
  const savedGoals = useRef(data.profile.goals);
  useEffect(() => {
    // A successful estimate updates the page underneath it. Returning without
    // saving leaves every manual edit and the editor's scroll position intact.
    if (savedGoals.current === data.profile.goals) return;
    savedGoals.current = data.profile.goals;
    setGoals(
      Object.fromEntries(
        Object.entries(data.profile.goals).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
    );
  }, [data.profile.goals]);
  const [dietary, setDietary] = useState(data.profile.dietary);
  const [haptics, setHaptics] = useState(data.profile.haptics);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title =
    (
      {
        profile: "Your Profile",
        nutrition: "Nutrition Settings",
        ...nutritionSections,
        privacy: "Privacy & Your Data",
        about: "About Bucky’s Bites",
      } as Record<string, string>
    )[section] ?? "Settings";
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (section === "dietary") {
        await saveMealPreferences(dietary);
        notify("Dietary preferences saved");
        backOrReplace("/nutrition");
        return;
      }
      if (section === "goals") {
        const parsed: Goals = {};
        for (const n of NUTRIENTS) {
          const raw = goals[n.key]?.trim();
          if (!raw) continue;
          const value = Number(raw);
          if (!Number.isFinite(value) || value <= 0 || value > 100000)
            throw new Error("Goals must be positive numbers, or left blank.");
          parsed[n.key] = value;
        }
        await saveProfile({ ...data.profile, goals: parsed });
      } else if (section === "general") {
        await saveProfile({ ...data.profile, haptics });
      } else {
        await saveProfile({
          ...data.profile,
          display_name: name,
          avatar_id: avatar,
        });
      }
      notify("Preferences saved");
      backOrReplace(section === "goals" ? "/nutrition" : "/me");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportData = async () => {
    const text = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        mode: local ? "profile-preview" : "account",
        ...data,
        reviews: data.reviews.filter((r) => r.user_id === userId),
      },
      null,
      2,
    );
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "buckys-bites-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } else await Share.share({ title: "My Bucky’s Bites data", message: text });
  };
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: colors.paper }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{ paddingBottom: 50 }}
    >
      <BackHeader />
      <View style={[s.inset, { gap: 21, paddingTop: 14 }]}>
        <T style={s.title}>{title}</T>
        {section === "nutrition" && (
          <View>
            {Object.entries(nutritionSections).map(([key, label]) => (
              <Tap
                key={key}
                padding="row"
                accessibilityLabel={label}
                onPress={() =>
                  router.push({
                    pathname: "/settings",
                    params: { section: key },
                  })
                }
              >
                <View style={[s.row, s.between]}>
                  <T style={s.body}>{label}</T>
                  <Icon name="chevron-forward" size={17} color={colors.muted} />
                </View>
              </Tap>
            ))}
          </View>
        )}
        {section === "profile" && (
          <>
            <View style={{ alignItems: "center" }}>
              <Avatar value={avatar} size={92} />
            </View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Profile picture"
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                rowGap: 16,
              }}
            >
              {AVATARS.map((option) => (
                <Tap
                  key={option.id}
                  padding="card"
                  style={{ width: "23%" }}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label} Bucky`}
                  accessibilityState={{ checked: avatar === option.id }}
                  onPress={() => setAvatar(option.id)}
                >
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Avatar
                      value={option.id}
                      size={Math.min(
                        68,
                        (Math.min(width, 520) - 48) * 0.23 - 16,
                      )}
                    />
                    <View style={{ position: "absolute", right: 0, top: 46 }}>
                      {avatar === option.id && (
                        <Icon
                          name="checkmark-circle"
                          color={colors.accent}
                          size={19}
                        />
                      )}
                    </View>
                    <T
                      style={[
                        s.caption,
                        {
                          color:
                            avatar === option.id ? colors.accent : colors.muted,
                        },
                      ]}
                    >
                      {option.label}
                    </T>
                  </View>
                </Tap>
              ))}
            </View>
            <T style={s.caption}>
              Your name and picture appear with your reviews.
            </T>
            <Input
              value={name}
              onChangeText={setName}
              maxLength={40}
              accessibilityLabel="Public display name"
              placeholder="Display name"
            />
          </>
        )}
        {section === "general" && (
          <>
            <View style={[s.row, s.between]}>
              <View style={{ flex: 1 }}>
                <T>Gentle haptics</T>
                <T style={s.caption}>
                  A little feedback when your food is saved.
                </T>
              </View>
              <Switch
                value={haptics}
                onValueChange={setHaptics}
                trackColor={{ true: colors.accent }}
                accessibilityLabel="Gentle haptics"
              />
            </View>
            <Button
              secondary
              title="Replay onboarding"
              onPress={() =>
                router.push({
                  pathname: "/onboarding",
                  params: { replay: "1" },
                })
              }
            />
            <T style={s.caption}>
              The app follows your device’s appearance, text-size,
              reduced-motion, and reduced-transparency settings.
            </T>
          </>
        )}
        {section === "goals" && (
          <>
            <Tap
              padding="none"
              highlightRadius={18}
              onPress={() => {
                setDraft({ ...goals });
                router.push("/goal-estimate");
              }}
              accessibilityLabel="Estimate from my measurements"
              contentStyle={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                padding: 16,
                backgroundColor: colors.accentLight,
                borderRadius: 18,
                borderCurve: "continuous",
              }}
            >
              <Icon name="options-outline" size={23} color={colors.accent} />
              <View style={{ flex: 1, gap: 3 }}>
                <T style={{ fontWeight: "600" }}>Make It Personal</T>
                <T style={s.caption}>Estimate from your measurements</T>
              </View>
              <Icon name="chevron-forward" size={17} color={colors.accent} />
            </Tap>
            {NUTRIENTS.map((n) => (
              <View
                key={n.key}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Art name={`icons/${n.icon}`} size={32} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 15 }}>{n.label}</T>
                  <T style={s.caption}>
                    {isDailyLimit(n.key) ? "Daily limit" : "Daily goal"} ·{" "}
                    {n.unit}
                  </T>
                </View>
                <Input
                  value={goals[n.key] ?? ""}
                  onChangeText={(value) =>
                    setGoals((g) => ({ ...g, [n.key]: value }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  accessibilityLabel={`${n.label} daily ${isDailyLimit(n.key) ? "limit" : "goal"}`}
                  style={{ width: 125, textAlign: "right" }}
                />
              </View>
            ))}
            <T style={s.caption}>
              Leave a field blank to track it without a target. General values
              use a 2,000-calorie reference; your needs may differ.
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Tap
                disabled={busy}
                onPress={() => {
                  setGoals(
                    Object.fromEntries(
                      Object.entries(FDA_DAILY_VALUES).map(([key, value]) => [
                        key,
                        String(value),
                      ]),
                    ),
                  );
                  setError("");
                }}
              >
                <T style={s.link}>Use general daily goals</T>
              </Tap>
              <Tap
                accessibilityRole="link"
                onPress={() => Linking.openURL(dailyValuesReference)}
              >
                <T style={s.caption}>About Daily Values</T>
              </Tap>
            </View>
          </>
        )}
        {section === "dietary" && (
          <>
            <T style={s.body}>Show meals</T>
            {["All meals", "Vegetarian", "Vegan"].map((label) => {
              const selected =
                label === "All meals"
                  ? !dietary.length
                  : dietary.includes(label);
              return (
                <Tap
                  key={label}
                  padding="row"
                  style={{ marginHorizontal: -12 }}
                  onPress={() =>
                    setDietary(label === "All meals" ? [] : [label])
                  }
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={label}
                >
                  <View style={[s.row, s.inline, { gap: 18 }]}>
                    {label === "All meals" ? (
                      <Icon
                        name="restaurant-outline"
                        sf="fork.knife"
                        size={30}
                      />
                    ) : (
                      <Art name={"icons/" + label.toLowerCase()} size={44} />
                    )}
                    <T style={{ flex: 1, fontSize: 18 }}>{label}</T>
                    {selected && (
                      <Icon
                        name="checkmark"
                        sf="checkmark"
                        color={colors.accent}
                      />
                    )}
                  </View>
                </Tap>
              );
            })}
          </>
        )}
        {["profile", "general", "goals", "dietary"].includes(section) && (
          <>
            {Boolean(error) && (
              <T accessibilityRole="alert" style={{ color: colors.red }}>
                {error}
              </T>
            )}
            {userId || section === "dietary" ? (
              <Button
                title={busy ? "Saving…" : "Save preferences"}
                disabled={busy}
                onPress={save}
              />
            ) : (
              <Button
                title="Sign in"
                onPress={() => router.push("/auth")}
              />
            )}
          </>
        )}
        {section === "general" && <SignOutButton disabled={busy} />}
        {section === "privacy" && (
          <>
            <T style={s.sectionTitle}>How Your Data Is Stored</T>
            <T style={s.body}>
              Your meals are stored online in Supabase with your account, dish,
              portion, meal period, and eating time. Nutrition is calculated
              from the dish’s shared recipe information rather than stored as
              separate personal nutrient totals.
            </T>
            <T style={s.body}>
              Public reviews show your display name, karma, score, optional
              text, day eaten, and meal. Votes affect review helpfulness and
              author karma. Deleting a food log never deletes a review unless
              you choose that option.
            </T>
            <T style={s.body}>
              The app developer can access meal logs and ratings to operate the
              service and build a usage dashboard. Other students cannot see
              your food logs, portions, or goals. Account access is protected,
              and iOS sessions use Secure Store.
            </T>
            <T style={s.sectionTitle}>Eating History</T>
            <T style={s.body}>
              When you delete a log, a minimal record of the dish and eating
              time preserves review and voting eligibility. You can request
              removal of your account and its associated data below.
            </T>
            {userId && !local && (
              <>
                <Button
                  secondary
                  title="Export my data"
                  onPress={() => exportData().catch((e) => notify(e.message))}
                />
                <Button
                  secondary
                  title="Request account deletion"
                  onPress={() => setDeleting(true)}
                />
              </>
            )}
            {deleting && (
              <View style={[s.note, { gap: 12 }]}>
                <T style={{ fontWeight: "600" }}>
                  Request removal of your account and data.
                </T>
                <T style={s.caption}>
                  The developer will receive your request to remove your
                  account, meals, reviews, and preferences. Type DELETE to
                  submit the request.
                </T>
                <Input
                  value={confirm}
                  onChangeText={setConfirm}
                  accessibilityLabel="Type DELETE to confirm"
                  autoCapitalize="characters"
                />
                <Button
                  title={busy ? "Sending…" : "Submit deletion request"}
                  disabled={confirm !== "DELETE" || busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await requestAccountDeletion();
                      setDeleting(false);
                      notify("Your deletion request has been submitted");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                {Boolean(error) && <T style={{ color: colors.red }}>{error}</T>}
              </View>
            )}
          </>
        )}
        {section === "about" && (
          <>
            <T style={s.body}>
              Bucky’s Bites helps Santa Clara students find campus food,
              understand published nutrition, and share useful reviews. It is an
              independent student app. Bucky’s Bites is not affiliated with,
              endorsed by, or operated by Santa Clara University.
            </T>
            <T style={s.sectionTitle}>About the Menu</T>
            <T style={s.body}>
              Menus, serving sizes, labels, and ingredients come from SCU
              Dining. Food and Bucky images are generated illustrations. Menu
              listings do not guarantee stock, and images may differ from the
              food served.
            </T>
            <Button
              secondary
              title="Open SCU Dining"
              onPress={() =>
                Linking.openURL("https://scudining.cafebonappetit.com/")
              }
            />
            <T style={s.sectionTitle}>Community Terms</T>
            <T style={s.body}>
              Review only food you’ve eaten. Be useful, honest, and respectful.
              Don’t post harassment, spam, personal information, or claims of
              allergy safety. Use the review’s options to report content. Public
              reviews may be hidden by a moderator.
            </T>
            <T style={s.body}>
              One new review per dish every rolling seven days, with an eating
              record within 72 hours. Star edits also require a recent meal.
              Your latest remaining score contributes to the average. Helpful
              votes add karma; downvotes subtract it. Removed votes and deleted
              reviews no longer count.
            </T>
            <T style={s.caption}>Version 1.0 · Initial campus release</T>
          </>
        )}
      </View>
    </ScrollView>
  );
}
