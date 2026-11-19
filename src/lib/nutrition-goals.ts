import type { Goals, Nutrient } from "./types";

export const dailyValuesReference =
  "https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels";

// FDA label reference values, not a personalized energy prescription. Only
// include nutrients the app tracks as goals. Total sugar has no FDA Daily Value;
// the 50 g added-sugars value must not be applied to the menu's total sugars.
export const FDA_DAILY_VALUES: Readonly<Goals> = Object.freeze({
  calories_kcal: 2000,
  protein_g: 50,
  carbohydrate_g: 275,
  total_fat_g: 78,
  fiber_g: 28,
  sodium_mg: 2300,
  saturated_fat_g: 20,
});

// Older profiles started with no targets. Seed those once, while preserving
// personal targets and an explicit choice to clear goals after initialization.
export function goalsForProfile(
  saved?: Goals | null,
  initialized = false,
): Goals {
  return {
    ...(saved && (initialized || Object.keys(saved).length > 0)
      ? saved
      : FDA_DAILY_VALUES),
  };
}

export const activityLevels = [
  "Inactive",
  "Low active",
  "Active",
  "Very active",
] as const;
export type ActivityLevel = (typeof activityLevels)[number];
export type EquationSex = "Female" | "Male";

export type GoalMeasurements = {
  age: string;
  feet: string;
  inches: string;
  pounds: string;
  sex: EquationSex | null;
  activity: ActivityLevel;
};

export function estimateFromMeasurements(input: GoalMeasurements): Goals {
  const whole = (value: string) => /^\d+$/.test(value.trim());
  if (!whole(input.age)) throw new Error("Enter your age in whole years.");
  if (!whole(input.feet))
    throw new Error("Enter your height in feet and inches.");
  const inches = input.inches.trim() || "0";
  if (!whole(inches) || Number(inches) > 11)
    throw new Error(
      "Use 0–11 for inches, with the rest of your height in feet.",
    );
  if (!/^\d+(\.\d+)?$/.test(input.pounds.trim()))
    throw new Error("Enter your weight in pounds.");
  return estimateGoals({
    age: Number(input.age),
    heightCm: (Number(input.feet) * 12 + Number(inches)) * 2.54,
    weightKg: Number(input.pounds) * 0.45359237,
    sex: input.sex,
    activity: input.activity,
  });
}
export const energyReference =
  "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html";

// 2023 Dietary Reference Intakes for Energy. Each row is [intercept, age,
// height in cm, weight in kg], in the order shown in activityLevels.
const energyEquations = {
  adult: {
    Female: [
      [584.9, -7.01, 5.72, 11.71],
      [575.77, -7.01, 6.6, 12.14],
      [710.25, -7.01, 6.54, 12.34],
      [511.83, -7.01, 9.07, 12.56],
    ],
    Male: [
      [753.07, -10.83, 6.5, 14.1],
      [581.47, -10.83, 8.3, 14.94],
      [1004.82, -10.83, 6.52, 15.91],
      [-517.88, -10.83, 15.61, 19.11],
    ],
  },
  adolescent: {
    Female: [
      [55.59, -22.25, 8.43, 17.07],
      [-297.54, -22.25, 12.77, 14.73],
      [-189.55, -22.25, 11.74, 18.34],
      [-709.59, -22.25, 18.22, 14.25],
    ],
    Male: [
      [-447.51, 3.68, 13.01, 13.15],
      [19.12, 3.68, 8.62, 20.28],
      [-388.19, 3.68, 12.66, 20.46],
      [-671.75, 3.68, 15.38, 23.25],
    ],
  },
} as const;

export function estimateGoals({
  age,
  heightCm,
  weightKg,
  sex,
  activity,
}: {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: EquationSex | null;
  activity: ActivityLevel | null;
}): Goals {
  if (!Number.isInteger(age) || age < 14 || age > 120)
    throw new Error("Enter an age from 14 to 120 in whole years.");
  if (!(heightCm >= 75 && heightCm <= 275))
    throw new Error("Check your height and the selected units.");
  if (!(weightKg >= 20 && weightKg <= 500))
    throw new Error("Check your weight and the selected units.");
  if (!sex) throw new Error("Choose the sex to use for the equation.");
  if (!activity) throw new Error("Choose your usual activity level.");

  const teen = age < 19;
  const [base, years, cm, kg] =
    energyEquations[teen ? "adolescent" : "adult"][sex][
      activityLevels.indexOf(activity)
    ];
  const energy =
    base + years * age + cm * heightCm + kg * weightKg + (teen ? 20 : 0);
  const calories = Math.round(energy / 100) * 100;
  const saturatedFatLimit = Math.floor((calories * 0.1) / 9 / 5) * 5;
  if (saturatedFatLimit <= 0)
    throw new Error(
      "These measurements fall outside the estimator’s range. Check the units or set your goals manually.",
    );
  const nearestFive = (value: number) => Math.round(value / 5) * 5;

  // Our starting split (50/20/30) is within the DRI macronutrient ranges
  // for both age groups. Fiber uses the DRI density of 14 g per 1,000 kcal.
  // US Dietary Guidelines: sodium 2,300 mg from age 14, saturated fat at
  // most 10% of energy. Round the latter down to keep the limit within 10%.
  // The menu reports total sugar, for which there is no reference target.
  return {
    calories_kcal: calories,
    carbohydrate_g: nearestFive((calories * 0.5) / 4),
    protein_g: nearestFive((calories * 0.2) / 4),
    total_fat_g: nearestFive((calories * 0.3) / 9),
    fiber_g: nearestFive((calories * 14) / 1000),
    sodium_mg: 2300,
    saturated_fat_g: saturatedFatLimit,
  };
}

export function isDailyLimit(key: Nutrient) {
  return key === "sodium_mg" || key === "saturated_fat_g";
}
