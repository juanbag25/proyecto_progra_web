import { describe, expect, it } from 'vitest';
import {
  applyGoalAdjustment,
  calculateBMR,
  calculateMacros,
  calculateTDEE,
  calculateWeeklyTargets,
} from '@/lib/nutrition/tdee';

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('male: 10w + 6.25h - 5a + 5', () => {
    // 10*75 + 6.25*180 - 5*25 + 5 = 1755
    expect(calculateBMR({ weight_kg: 75, height_cm: 180, age: 25, gender: 'male' })).toBe(1755);
  });

  it('female: 10w + 6.25h - 5a - 161', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
    expect(calculateBMR({ weight_kg: 60, height_cm: 165, age: 30, gender: 'female' })).toBe(
      1320.25,
    );
  });

  it('other: averages the male/female constants (-78 vs base)', () => {
    // 10*75 + 6.25*180 - 5*25 + (5 + -161)/2 = 1750 - 78 = 1672
    expect(calculateBMR({ weight_kg: 75, height_cm: 180, age: 25, gender: 'other' })).toBe(1672);
  });
});

describe('calculateTDEE', () => {
  it('multiplies BMR by the activity factor', () => {
    expect(calculateTDEE(1500, 'sedentary')).toBe(1800);
    expect(calculateTDEE(1500, 'light')).toBeCloseTo(2062.5);
    expect(calculateTDEE(1500, 'moderate')).toBeCloseTo(2325);
    expect(calculateTDEE(1500, 'active')).toBeCloseTo(2587.5);
    expect(calculateTDEE(1500, 'athlete')).toBe(2850);
  });
});

describe('applyGoalAdjustment', () => {
  it('+10% for muscle_gain', () => {
    expect(applyGoalAdjustment(2000, 'muscle_gain')).toBeCloseTo(2200);
  });
  it('-20% for fat_loss', () => {
    expect(applyGoalAdjustment(2000, 'fat_loss')).toBeCloseTo(1600);
  });
  it('0 for recomp', () => {
    expect(applyGoalAdjustment(2000, 'recomp')).toBe(2000);
  });
  it('+5% for strength', () => {
    expect(applyGoalAdjustment(2000, 'strength')).toBeCloseTo(2100);
  });
  it('0 for maintenance', () => {
    expect(applyGoalAdjustment(2000, 'maintenance')).toBe(2000);
  });
});

describe('calculateMacros', () => {
  it('hits the fat_loss protein floor (2.2 g/kg)', () => {
    const m = calculateMacros(2000, { weight_kg: 70, fitness_goal: 'fat_loss' });
    expect(m.protein_g).toBeCloseTo(154); // 70 * 2.2
  });

  it('hits the muscle_gain protein floor (2.0 g/kg)', () => {
    const m = calculateMacros(3000, { weight_kg: 80, fitness_goal: 'muscle_gain' });
    expect(m.protein_g).toBeCloseTo(160); // 80 * 2.0
  });

  it('hits the maintenance protein floor (1.6 g/kg)', () => {
    const m = calculateMacros(2400, { weight_kg: 70, fitness_goal: 'maintenance' });
    expect(m.protein_g).toBeCloseTo(112); // 70 * 1.6
  });

  it('keeps fat at 30% of calories when above the 0.8g/kg floor', () => {
    // 3000 kcal × 0.30 = 900 kcal of fat = 100g — well above 70 * 0.8 = 56g.
    const m = calculateMacros(3000, { weight_kg: 70, fitness_goal: 'muscle_gain' });
    expect(m.fats_g).toBeCloseTo(100);
  });

  it('respects the 0.8g/kg fat floor on aggressive deficits', () => {
    // 1200 kcal × 0.30 = 360 kcal = 40g of fat. Floor is 80 * 0.8 = 64g.
    const m = calculateMacros(1200, { weight_kg: 80, fitness_goal: 'fat_loss' });
    expect(m.fats_g).toBeGreaterThanOrEqual(64);
  });

  it('macros sum to (approximately) the calorie target', () => {
    const target = 2500;
    const m = calculateMacros(target, { weight_kg: 75, fitness_goal: 'recomp' });
    const totalKcal = m.protein_g * 4 + m.carbs_g * 4 + m.fats_g * 9;
    // Rounded grams introduce up to ~5 kcal of drift; allow that.
    expect(Math.abs(totalKcal - target)).toBeLessThan(10);
  });

  it('clamps carbs at 0 instead of going negative when protein+fat exceed the target', () => {
    // 50kg, fat_loss: protein floor = 50 * 2.2 * 4 = 440 kcal,
    // fat floor = 50 * 0.8 * 9 = 360 kcal → 800 kcal of P+F.
    // Push the target below that to force the negative-carbs branch.
    const m = calculateMacros(700, { weight_kg: 50, fitness_goal: 'fat_loss' });
    expect(m.carbs_g).toBe(0);
  });
});

describe('calculateWeeklyTargets — reference cases', () => {
  it('male / 25 / 75kg / 180cm / moderate / muscle_gain → ~2900 kcal/day', () => {
    // BMR = 1755 → TDEE = 2720.25 → +10% = 2992.275 ≈ 2992
    const result = calculateWeeklyTargets({
      age: 25,
      weight_kg: 75,
      height_cm: 180,
      gender: 'male',
      activity_level: 'moderate',
      fitness_goal: 'muscle_gain',
    });
    expect(result.daily_calories).toBeGreaterThan(2800);
    expect(result.daily_calories).toBeLessThan(3100);
    expect(result.weekly_calories).toBe(result.daily_calories * 7);
  });

  it('female / 30 / 60kg / 165cm / light / fat_loss → ~1500 kcal/day', () => {
    // BMR = 1320.25 → TDEE = 1815.34 → -20% = 1452.27 ≈ 1452
    const result = calculateWeeklyTargets({
      age: 30,
      weight_kg: 60,
      height_cm: 165,
      gender: 'female',
      activity_level: 'light',
      fitness_goal: 'fat_loss',
    });
    expect(result.daily_calories).toBeGreaterThan(1400);
    expect(result.daily_calories).toBeLessThan(1600);
  });
});

describe('calculateWeeklyTargets — invariants', () => {
  const sample = {
    age: 28,
    weight_kg: 72,
    height_cm: 175,
    gender: 'male' as const,
    activity_level: 'moderate' as const,
    fitness_goal: 'recomp' as const,
  };

  it('weekly_calories = daily_calories × 7', () => {
    const r = calculateWeeklyTargets(sample);
    expect(r.weekly_calories).toBe(r.daily_calories * 7);
  });

  it('marks method as mifflin_st_jeor', () => {
    expect(calculateWeeklyTargets(sample).method).toBe('mifflin_st_jeor');
  });

  it('emits an ISO timestamp for calculated_at', () => {
    const r = calculateWeeklyTargets(sample);
    expect(r.calculated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Number.isFinite(Date.parse(r.calculated_at))).toBe(true);
  });

  it('fiber tracks ~14 g per 1000 kcal', () => {
    const r = calculateWeeklyTargets(sample);
    const expectedDaily = (r.daily_calories / 1000) * 14;
    const actualDaily = r.weekly_fiber_g / 7;
    expect(actualDaily).toBeCloseTo(expectedDaily, 0);
  });
});

describe('calculateWeeklyTargets — edge cases', () => {
  it('low weight (40kg / age 18 / female / sedentary / maintenance)', () => {
    const r = calculateWeeklyTargets({
      age: 18,
      weight_kg: 40,
      height_cm: 150,
      gender: 'female',
      activity_level: 'sedentary',
      fitness_goal: 'maintenance',
    });
    // BMR = 1086.5 → TDEE = 1303.8 → maintenance = 1303.8 → ~1304
    expect(r.daily_calories).toBeGreaterThan(1100);
    expect(r.daily_calories).toBeLessThan(1500);
  });

  it('high weight (150kg / 40 / male / sedentary / fat_loss)', () => {
    const r = calculateWeeklyTargets({
      age: 40,
      weight_kg: 150,
      height_cm: 190,
      gender: 'male',
      activity_level: 'sedentary',
      fitness_goal: 'fat_loss',
    });
    // BMR = 1500 + 1187.5 - 200 + 5 = 2492.5 → TDEE = 2991 → -20% = 2392.8 ≈ 2393
    expect(r.daily_calories).toBeGreaterThan(2200);
    expect(r.daily_calories).toBeLessThan(2700);
  });

  it('lower age bound (14)', () => {
    const r = calculateWeeklyTargets({
      age: 14,
      weight_kg: 50,
      height_cm: 160,
      gender: 'male',
      activity_level: 'active',
      fitness_goal: 'muscle_gain',
    });
    // BMR = 500 + 1000 - 70 + 5 = 1435 → TDEE = 2475.4 → +10% = 2722.9
    expect(r.daily_calories).toBeGreaterThan(2400);
    expect(r.daily_calories).toBeLessThan(3000);
  });

  it('upper age bound (80)', () => {
    const r = calculateWeeklyTargets({
      age: 80,
      weight_kg: 70,
      height_cm: 170,
      gender: 'male',
      activity_level: 'sedentary',
      fitness_goal: 'maintenance',
    });
    // BMR = 700 + 1062.5 - 400 + 5 = 1367.5 → TDEE = 1641 → maintenance = 1641
    expect(r.daily_calories).toBeGreaterThan(1400);
    expect(r.daily_calories).toBeLessThan(1900);
  });

  it('athlete + muscle_gain produces the highest calorie target', () => {
    const baseProfile = {
      age: 25,
      weight_kg: 80,
      height_cm: 180,
      gender: 'male' as const,
    };
    const sedentary = calculateWeeklyTargets({
      ...baseProfile,
      activity_level: 'sedentary',
      fitness_goal: 'fat_loss',
    });
    const athlete = calculateWeeklyTargets({
      ...baseProfile,
      activity_level: 'athlete',
      fitness_goal: 'muscle_gain',
    });
    expect(athlete.daily_calories).toBeGreaterThan(sedentary.daily_calories);
  });
});
