import React, { useRef, useState } from "react";
import { Keyboard, Linking, View } from "react-native";
import { useTheme } from "../state/ThemeProvider";
import {
  activityLevels,
  energyReference,
  estimateFromMeasurements,
  type GoalMeasurements,
} from "../lib/nutrition-goals";
import type { Goals } from "../lib/types";
import { Art, Button, Icon, Input, Segments, T, Tap } from "./ui";
import { NutrientAmount } from "./nutrient-display";
import { useHaptic } from "../lib/haptics";

const activityDetails = [
  "Mostly sitting, with everyday movement.",
  "Some walking and light activity each day.",
  "Lots of walking, plus exercise or sports.",
  "A physical day with frequent, intense activity.",
];

function MeasurementInput({
  label,
  unit,
  placeholder,
  onChange,
  disabled,
  decimal = false,
}: {
  label: string;
  unit: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled: boolean;
  decimal?: boolean;
}) {
  const { colors, s } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
      <T style={s.caption}>{label}</T>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: focused ? colors.accent : colors.rule,
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderCurve: "continuous",
          paddingRight: 14,
          minHeight: 56,
        }}
      >
        <Input
          defaultValue=""
          onChangeText={onChange}
          placeholder={placeholder}
          accessibilityLabel={`${label} in ${unit}`}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          autoCorrect={false}
          editable={!disabled}
          maxLength={decimal ? 6 : 3}
          selectTextOnFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            height: 54,
            minHeight: 54,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 0,
            borderRadius: 14,
            backgroundColor: colors.surface,
            fontSize: 28,
            color: colors.ink,
          }}
        />
        <T style={s.caption}>{unit}</T>
      </View>
    </View>
  );
}

export function GoalEstimator({
  onApply,
  onCancel,
}: {
  onApply: (goals: Goals) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { colors, s } = useTheme();
  const [measurements, setMeasurements] = useState<GoalMeasurements>({
    age: "",
    feet: "",
    inches: "",
    pounds: "",
    sex: null,
    activity: "Low active",
  });
  const [details, setDetails] = useState(false);
  const playHaptic = useHaptic();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const update = (patch: Partial<GoalMeasurements>) => {
    setMeasurements((current) => ({ ...current, ...patch }));
    setError("");
  };
  let estimated: Goals | null = null;
  try {
    estimated = estimateFromMeasurements(measurements);
  } catch {
    // Keep the preview empty until the person supplies valid measurements.
  }

  const submit = async () => {
    if (pending.current) return;
    pending.current = true;
    setError("");
    Keyboard.dismiss();
    try {
      const goals = estimateFromMeasurements(measurements);
      setBusy(true);
      await onApply(goals);
      playHaptic("success");
    } catch (e) {
      playHaptic("error");
      setError(
        e instanceof Error ? e.message : "Couldn’t save your goals. Try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <T style={s.body}>
        Make your daily goals a little more personal. Add your measurements to
        see an estimate before you save.
      </T>
      <View style={{ gap: 14 }}>
        <View style={[s.between, { flexWrap: "wrap", gap: 8 }]}>
          <T style={{ fontWeight: "600" }}>Your Measurements</T>
          <T style={s.caption}>US units</T>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <MeasurementInput
            label="Age"
            unit="years"
            placeholder="20"
            onChange={(age) => update({ age })}
            disabled={busy}
          />
          <MeasurementInput
            label="Weight"
            unit="lb"
            placeholder="150"
            onChange={(pounds) => update({ pounds })}
            disabled={busy}
            decimal
          />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <MeasurementInput
            label="Height · feet"
            unit="ft"
            placeholder="5"
            onChange={(feet) => update({ feet })}
            disabled={busy}
          />
          <MeasurementInput
            label="Height · inches"
            unit="in"
            placeholder="0"
            onChange={(inches) => update({ inches })}
            disabled={busy}
          />
        </View>
        <View style={{ gap: 8, paddingTop: 4 }}>
          <T style={s.caption}>Sex used for the estimate</T>
          <Segments
            values={["Female", "Male"]}
            value={measurements.sex ?? ""}
            disabledValues={busy ? ["Female", "Male"] : []}
            onChange={(sex) => update({ sex: sex as "Female" | "Male" })}
          />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <T style={{ fontWeight: "600" }}>Your Usual Activity</T>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Usual activity level"
          style={{
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: 18,
            borderCurve: "continuous",
            overflow: "hidden",
          }}
        >
          {activityLevels.map((level, index) => {
            const selected = measurements.activity === level;
            return (
              <Tap
                key={level}
                padding="none"
                highlightRadius={0}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: busy }}
                haptic={selected ? false : "select"}
                accessibilityLabel={`${level}. ${activityDetails[index]}`}
                onPress={() => update({ activity: level })}
                contentStyle={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: selected
                    ? colors.accentLight
                    : colors.surface,
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: colors.rule,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontWeight: selected ? "600" : "400" }}>
                    {level}
                  </T>
                  <T style={s.caption}>{activityDetails[index]}</T>
                </View>
                <Icon
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  sf={selected ? "checkmark.circle.fill" : "circle"}
                  size={22}
                  color={selected ? colors.accent : colors.faint}
                />
              </Tap>
            );
          })}
        </View>
      </View>
      <View
        style={{
          padding: 20,
          borderRadius: 20,
          borderCurve: "continuous",
          backgroundColor: colors.accentLight,
          gap: 16,
        }}
      >
        <View style={[s.inline, { gap: 12 }]}>
          <Art name="icons/calories" size={42} />
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontWeight: "600" }}>Your Daily Estimate</T>
            {estimated ? (
              <NutrientAmount
                value={estimated.calories_kcal!.toLocaleString()}
                unit="cal / day"
                size="title"
              />
            ) : (
              <T style={s.caption}>Add your measurements and select a sex.</T>
            )}
          </View>
        </View>
        {estimated && (
          <>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 16,
                paddingTop: 14,
                borderTopWidth: 1,
                borderColor: colors.rule,
              }}
            >
              {[
                { label: "Protein", value: estimated.protein_g },
                { label: "Carbs", value: estimated.carbohydrate_g },
                { label: "Fat", value: estimated.total_fat_g },
              ].map((macro) => (
                <View
                  key={macro.label}
                  style={{ flex: 1, minWidth: 65, gap: 3 }}
                >
                  <NutrientAmount value={macro.value!} unit="g" size="title" />
                  <T style={s.caption}>{macro.label}</T>
                </View>
              ))}
            </View>
            <T style={s.caption}>
              Fiber {estimated.fiber_g} g · Sodium limit 2,300 mg{"\n"}
              Saturated fat limit {estimated.saturated_fat_g} g
            </T>
          </>
        )}
      </View>
      {Boolean(error) && (
        <T selectable accessibilityRole="alert" style={{ color: colors.red }}>
          {error}
        </T>
      )}
      <View style={{ gap: 12 }}>
        <Button
          title={busy ? "Saving…" : "Use these goals"}
          disabled={busy}
          onPress={submit}
          haptic={false}
        />
        <Tap
          padding="row"
          disabled={busy}
          onPress={onCancel}
          haptic="release"
          accessibilityLabel="Cancel goal estimate"
        >
          <T style={[s.caption, { textAlign: "center" }]}>
            Keep my current goals
          </T>
        </Tap>
      </View>
      <View style={[s.inline, { alignItems: "flex-start", gap: 8 }]}>
        <Icon
          name="lock-closed-outline"
          sf="lock"
          size={15}
          color={colors.muted}
        />
        <T style={[s.caption, { flex: 1 }]}>
          Only your goals are saved. Your measurements stay in this form.
        </T>
      </View>
      <View
        style={{ borderTopWidth: 1, borderColor: colors.rule, paddingTop: 8 }}
      >
        <Tap
          padding="row"
          style={{ marginHorizontal: -12 }}
          onPress={() => setDetails(!details)}
          accessibilityState={{ expanded: details }}
          haptic={details ? "release" : "tap"}
        >
          <View style={s.between}>
            <T style={s.caption}>How this estimate works</T>
            <Icon
              name={details ? "chevron-up" : "chevron-down"}
              sf={details ? "chevron.up" : "chevron.down"}
              size={14}
              color={colors.muted}
            />
          </View>
        </Tap>
        {details && (
          <View style={{ gap: 10, paddingTop: 8 }}>
            <T style={s.caption}>
              A starting point based on Dietary Reference Intakes for ages 14
              and up, with 50% carbs, 20% protein, and 30% fat. You can edit any
              goal later. For pregnancy or breastfeeding, use personal goals.
            </T>
            <Tap
              accessibilityRole="link"
              onPress={() => Linking.openURL(energyReference)}
            >
              <T style={s.link}>View the reference equations</T>
            </Tap>
          </View>
        )}
      </View>
    </View>
  );
}
