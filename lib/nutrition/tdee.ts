/**
 * Deterministic baseline for the AI Nutrition Engine (Phase 4 / P4.A).
 *
 * Pure math — given a profile, returns the user's weekly calorie + macro
 * targets using Mifflin-St Jeor + standard activity factors + a goal-driven
 * deficit/surplus. The LLM layer (P4.B) sits ON TOP of these numbers, adds
 * micros, and exposes the "How we calculated this" copy.
 *
 * No side effects, no DB calls, no I/O — easy to unit-test and to reuse from
 * server actions, API routes, and the recalibration job in Phase 8.
 */

export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

export type FitnessGoal = 'muscle_gain' | 'fat_loss' | 'recomp' | 'strength' | 'maintenance';

// Standard sport-nutrition multipliers applied to BMR. `athlete` corresponds
// to "very active / 2x daily training" — already aggressive, do not push higher.
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

// Calorie deltas relative to maintenance TDEE. Conservative on purpose:
// aggressive cuts (>20%) and bulks (>15%) hurt adherence + body comp.
const GOAL_ADJUSTMENTS: Record<FitnessGoal, number> = {
  muscle_gain: 0.1,
  fat_loss: -0.2,
  recomp: 0,
  strength: 0.05,
  maintenance: 0,
};

// Protein floor in g/kg of bodyweight. fat_loss gets the highest floor to
// preserve lean mass during a deficit; maintenance gets the everyday RDA-ish
// number.
const PROTEIN_PER_KG: Record<FitnessGoal, number> = {
  muscle_gain: 2.0,
  fat_loss: 2.2,
  recomp: 2.0,
  strength: 2.0,
  maintenance: 1.6,
};

// Fat target as a share of daily calories. The 0.8g/kg floor below acts as a
// safety net for low-calorie female-leaning profiles where 30% of a small
// daily total dips below the hormonal-health threshold.
const FAT_PCT_OF_CALORIES = 0.3;
const FAT_FLOOR_G_PER_KG = 0.8;

// IOM dietary guideline: ~14g of fiber per 1000kcal consumed.
const FIBER_G_PER_1000_KCAL = 14;

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

const DAYS_PER_WEEK = 7;

export interface BiometricInputs {
  age: number;
  weight_kg: number;
  height_cm: number;
  gender: Gender;
}

export interface NutritionInputs extends BiometricInputs {
  activity_level: ActivityLevel;
  fitness_goal: FitnessGoal;
}

export interface MacroBreakdown {
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}

export interface WeeklyTargets {
  weekly_calories: number;
  weekly_protein_g: number;
  weekly_carbs_g: number;
  weekly_fats_g: number;
  weekly_fiber_g: number;
  daily_calories: number;
  method: 'mifflin_st_jeor' | 'llm_adjusted';
  calculated_at: string;
}

/** Mifflin-St Jeor BMR. Returns kcal/day. */
export function calculateBMR(profile: BiometricInputs): number {
  const { weight_kg, height_cm, age, gender } = profile;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  // For non-binary users we average the male (+5) and female (-161) constants
  // — there's no validated Mifflin variant for `other`, and averaging avoids
  // forcing a binary pick at the schema layer.
  if (gender === 'male') return base + 5;
  if (gender === 'female') return base - 161;
  return base + (5 + -161) / 2;
}

/** Apply the activity factor. Returns daily kcal at maintenance. */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activityLevel];
}

/** Apply the goal-driven deficit / surplus. */
export function applyGoalAdjustment(tdee: number, goal: FitnessGoal): number {
  return tdee * (1 + GOAL_ADJUSTMENTS[goal]);
}

/**
 * Resolve daily macro grams from a calorie target.
 *
 * Order of operations is intentional: protein first (anchored to bodyweight),
 * fat second (with the 0.8g/kg floor), carbs absorb the remainder. If protein
 * + fat already exceed `targetCalories` (only possible at extreme deficits)
 * carbs clamp to 0 instead of going negative.
 */
export function calculateMacros(
  targetCalories: number,
  profile: Pick<NutritionInputs, 'weight_kg' | 'fitness_goal'>,
): MacroBreakdown {
  const { weight_kg, fitness_goal } = profile;

  const proteinG = weight_kg * PROTEIN_PER_KG[fitness_goal];
  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;

  const fatKcalFromPct = targetCalories * FAT_PCT_OF_CALORIES;
  const fatKcalFromFloor = weight_kg * FAT_FLOOR_G_PER_KG * KCAL_PER_G_FAT;
  const fatKcal = Math.max(fatKcalFromPct, fatKcalFromFloor);
  const fatG = fatKcal / KCAL_PER_G_FAT;

  const carbsKcal = targetCalories - proteinKcal - fatKcal;
  const carbsG = Math.max(0, carbsKcal / KCAL_PER_G_CARBS);

  return {
    protein_g: round1(proteinG),
    carbs_g: round1(carbsG),
    fats_g: round1(fatG),
  };
}

/**
 * End-to-end: profile in, weekly targets out. This is what API routes and
 * server actions consume; intermediate steps (BMR, TDEE, macros) stay
 * exported for transparency / debugging / the "How we calculated this" UI.
 */
export function calculateWeeklyTargets(profile: NutritionInputs): WeeklyTargets {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activity_level);
  const dailyCalories = applyGoalAdjustment(tdee, profile.fitness_goal);
  const macros = calculateMacros(dailyCalories, profile);
  const dailyFiberG = (dailyCalories / 1000) * FIBER_G_PER_1000_KCAL;

  const dailyCaloriesRounded = Math.round(dailyCalories);

  return {
    weekly_calories: dailyCaloriesRounded * DAYS_PER_WEEK,
    weekly_protein_g: round1(macros.protein_g * DAYS_PER_WEEK),
    weekly_carbs_g: round1(macros.carbs_g * DAYS_PER_WEEK),
    weekly_fats_g: round1(macros.fats_g * DAYS_PER_WEEK),
    weekly_fiber_g: round1(dailyFiberG * DAYS_PER_WEEK),
    daily_calories: dailyCaloriesRounded,
    method: 'mifflin_st_jeor',
    calculated_at: new Date().toISOString(),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
