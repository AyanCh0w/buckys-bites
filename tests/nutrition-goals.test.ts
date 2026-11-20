import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_STUDENT_GOALS,
  activityLevels,
  estimateFromMeasurements,
  estimateGoals,
  goalsForProfile,
} from "../src/lib/nutrition-goals";

test("the active student preset supplies its energy from protein, carbs, and fat", () => {
  const preset = goalsForProfile();
  assert.deepEqual(preset, {
    calories_kcal: 2600,
    protein_g: 105,
    carbohydrate_g: 365,
    total_fat_g: 80,
    fiber_g: 36,
    sodium_mg: 2300,
    saturated_fat_g: 25,
  });
  assert.equal(
    4 * preset.protein_g + 4 * preset.carbohydrate_g + 9 * preset.total_fat_g,
    preset.calories_kcal,
  );
});

test("new and legacy empty profiles receive independent defaults; personal and cleared goals survive", () => {
  const first = goalsForProfile();
  const second = goalsForProfile(null);
  first.calories_kcal = 2400;
  assert.deepEqual(second, ACTIVE_STUDENT_GOALS);
  assert.deepEqual(goalsForProfile({ goals: {} }), ACTIVE_STUDENT_GOALS);
  assert.deepEqual(goalsForProfile({ goals: { protein_g: 100 } }), {
    protein_g: 100,
  });
  assert.deepEqual(goalsForProfile({ goals: {}, goals_initialized: true }), {});
});

test("only the untouched FDA seed switches automatically to the active student preset", () => {
  const goals = {
    calories_kcal: 2000,
    protein_g: 50,
    carbohydrate_g: 275,
    total_fat_g: 78,
    fiber_g: 28,
    sodium_mg: 2300,
    saturated_fat_g: 20,
  };
  const seed = { goals, goals_initialized: true };
  assert.deepEqual(goalsForProfile(seed), ACTIVE_STUDENT_GOALS);
  assert.deepEqual(goalsForProfile({ ...seed, display_name: "Bronco" }), goals);
  for (const edited of [{ ...goals, protein_g: 75 }, { ...goals, sugar_g: 60 }])
    assert.deepEqual(goalsForProfile({ ...seed, goals: edited }), edited);
});

const measurements = {
  age: "20",
  feet: "5",
  inches: "7",
  pounds: "150.5",
  sex: "Female",
  activity: "Low active",
} as const;

test("measurement entry converts feet, inches, and fractional pounds into the equation", () => {
  assert.deepEqual(
    estimateFromMeasurements(measurements),
    estimateGoals({
      age: 20,
      heightCm: 67 * 2.54,
      weightKg: 150.5 * 0.45359237,
      sex: "Female",
      activity: "Low active",
    }),
  );
  assert.deepEqual(
    estimateFromMeasurements({ ...measurements, inches: "" }),
    estimateFromMeasurements({ ...measurements, inches: "0" }),
  );
});

test("empty, malformed, or out-of-range entries cannot save sample estimates", () => {
  for (const invalid of [
    { age: "" },
    { age: "20.5" },
    { age: "13" },
    { feet: "" },
    { feet: "0" },
    { feet: "5.5" },
    { inches: "12" },
    { inches: "-1" },
    { pounds: "" },
    { pounds: "1e2" },
    { pounds: "0" },
    { pounds: "Infinity" },
    { sex: null },
  ]) {
    assert.throws(() =>
      estimateFromMeasurements({ ...measurements, ...invalid }),
    );
  }
});

const inputs = {
  age: 19,
  heightCm: 170,
  weightKg: 65,
  sex: "Female",
  activity: "Low active",
} as const;

test("energy uses the age-specific DRI equation for the chosen sex and activity", () => {
  for (const [age, sex, calories] of [
    [18, "Female", [2200, 2500, 2600, 2900]],
    [19, "Female", [2200, 2400, 2500, 2700]],
    [18, "Male", [2700, 2900, 3200, 3500]],
    [19, "Male", [2600, 2800, 2900, 3200]],
  ] as const) {
    assert.deepEqual(
      activityLevels.map(
        (activity) =>
          estimateGoals({ ...inputs, age, sex, activity }).calories_kcal,
      ),
      calories,
    );
  }
});

test("starting goals use rounded calories, grams in fives, and separate limits", () => {
  assert.deepEqual(estimateGoals(inputs), {
    calories_kcal: 2400,
    protein_g: 120,
    carbohydrate_g: 300,
    total_fat_g: 80,
    fiber_g: 35,
    sodium_mg: 2300,
    saturated_fat_g: 25,
  });
  const maleGoals = estimateGoals({
    ...inputs,
    sex: "Male",
    age: 19,
    activity: "Inactive",
  });
  // Nearest-five rounding would allow 30 g, above 10% of 2,600 calories.
  assert.equal(maleGoals.saturated_fat_g, 25);
  assert.equal(maleGoals.sugar_g, undefined);
});

test("incomplete or unsupported measurements never produce goals", () => {
  for (const invalid of [
    { age: 13 },
    { age: NaN },
    { age: 20.5 },
    { sex: null },
    { activity: null },
    { heightCm: 0 },
    { weightKg: Infinity },
    { weightKg: -60 },
    {
      age: 120,
      heightCm: 75,
      weightKg: 20,
      sex: "Male",
      activity: "Very active",
    },
  ] as const)
    assert.throws(() => estimateGoals({ ...inputs, ...invalid }));
});
