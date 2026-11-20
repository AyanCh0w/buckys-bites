import { NUTRIENTS } from "./domain";
import type { Food, NutritionField } from "./types";

export const NUTRIENT_RAIN_DURATION_MS = 2500;

// Visual scale tuned to the spread of single servings on the menu.
const amountPerIcon: Record<NutritionField, number> = {
  calories_kcal: 180,
  protein_g: 8,
  carbohydrate_g: 18,
  total_fat_g: 9,
  fiber_g: 2,
  sugar_g: 10,
  sodium_mg: 300,
  saturated_fat_g: 3,
  trans_fat_g: 0.75,
  cholesterol_mg: 50,
};

const rainNutrients = [
  ...NUTRIENTS,
  { key: "trans_fat_g", icon: "trans-fat" },
  { key: "cholesterol_mg", icon: "cholesterol" },
] as const;

export function nutrientRainIcons(food: Pick<Food, NutritionField>): string[] {
  const known = rainNutrients.flatMap(({ key, icon }) => {
    const amount = food[key];
    if (amount == null || !Number.isFinite(amount) || amount <= 0) return [];
    return [{ key, icon, weight: amount / amountPerIcon[key] }];
  });
  const calories = known.filter(({ key }) => key === "calories_kcal");
  const ranked = known
    .filter(({ key }) => key !== "calories_kcal")
    .sort((a, b) => b.weight - a.weight);
  const highlights = ranked.filter(({ weight }) => weight >= 0.5).slice(0, 3);
  const mix = [...calories, ...highlights];
  if (!mix.length && ranked.length) mix.push(ranked[0]);

  return mix.flatMap(({ icon, weight }) =>
    Array<string>(Math.min(4, Math.max(1, Math.round(weight)))).fill(icon),
  );
}

export function createNutrientDrops(
  icons: readonly string[],
  random = Math.random,
) {
  const between = (min: number, max: number) => min + random() * (max - min);
  const takeRandom = <T>(pool: T[]) =>
    pool.splice(Math.floor(random() * pool.length), 1)[0];
  const remainingIcons = [...icons];
  const laneCenters = [16, 39, 61, 84];
  let lanes: number[] = [];
  const twirlIndex = Math.floor(random() * icons.length);
  const breeze = between(-10, 10);
  const waveGap = between(115, 135);

  const drops = icons.map((_, i) => {
    // Draw each lane once per wave so the random paths start apart.
    if (!lanes.length) lanes = [...laneCenters];
    const wave = Math.floor(i / laneCenters.length);
    const twirl = icons.length >= 3 && i === twirlIndex;
    const direction = random() < 0.5 ? -1 : 1;
    return {
      icon: takeRandom(remainingIcons),
      left: takeRandom(lanes) + between(-3, 3),
      size: between(29, 38),
      delay: wave * waveGap + (i === 0 ? 0 : between(0, 65)),
      duration: twirl ? between(875, 935) : between(775, 900),
      depth: between(0.86, 1),
      drift: breeze + between(-10, 10),
      sway: between(9, 19) * (random() < 0.5 ? -1 : 1),
      angle: between(-32, 32),
      spin: direction * (twirl ? between(355, 385) : between(45, 145)),
    };
  });

  // Stretch the stagger and each fall together so the final icon fades at 2.5s.
  const lastFinish = Math.max(
    1,
    ...drops.map((drop) => drop.delay + drop.duration),
  );
  const burstTime = (time: number) =>
    Math.round((time / lastFinish) * NUTRIENT_RAIN_DURATION_MS);
  return drops.map((drop) => {
    const delay = burstTime(drop.delay);
    return {
      ...drop,
      delay,
      duration: burstTime(drop.delay + drop.duration) - delay,
    };
  });
}
