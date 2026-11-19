import React from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoalEstimator } from "../components/goal-estimator";
import { BackHeader, Button, T } from "../components/ui";
import { NUTRIENTS } from "../lib/domain";
import { backOrReplace } from "../lib/navigation";
import { useApp } from "../state/AppProvider";
import { useGoalEstimateDraft } from "../state/GoalEstimateDraftProvider";
import { useTheme } from "../state/ThemeProvider";

export default function GoalEstimate() {
  const { colors, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, saveProfile, notify, profileStatus, refreshProfile } = useApp();
  const { draft, setDraft } = useGoalEstimateDraft();
  const close = () => {
    setDraft(null);
    backOrReplace({ pathname: "/settings", params: { section: "goals" } });
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 24) + 24,
      }}
    >
      <BackHeader
        title={Platform.OS === "ios" ? "Estimate Your Goals" : undefined}
      />
      <View style={[s.inset, { gap: 21, paddingTop: 14 }]}>
        {Platform.OS !== "ios" && <T style={s.title}>Estimate Your Goals</T>}
        {profileStatus === "error" ? (
          <>
            <T>Your preferences couldn’t load.</T>
            <Button
              title="Try again"
              onPress={() =>
                refreshProfile().catch(() =>
                  notify("Couldn’t load your preferences."),
                )
              }
            />
          </>
        ) : (
          <GoalEstimator
            onCancel={close}
            onApply={async (estimated) => {
              const saved = { ...estimated };
              for (const nutrient of NUTRIENTS) {
                if (nutrient.key in estimated) continue;
                const raw = draft
                  ? draft[nutrient.key]?.trim()
                  : data.profile.goals[nutrient.key];
                if (raw == null || raw === "") continue;
                const value = Number(raw);
                if (!Number.isFinite(value) || value <= 0 || value > 100000)
                  throw new Error(
                    `Go back and check your ${nutrient.label.toLowerCase()} goal. Use a positive number or leave it blank.`,
                  );
                saved[nutrient.key] = value;
              }
              await saveProfile({ ...data.profile, goals: saved });
              close();
              notify("Your estimated goals are saved");
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}
