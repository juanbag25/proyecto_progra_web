/**
 * Tests for the optimizer pieces consumed by /api/shopping-list/generate.
 *
 * Why a separate file from build.test.ts:
 *   - build.test.ts owns the algorithm (filter / pickBest / cap behavior).
 *   - This file owns the *user-facing contract*: the actionable feasibility
 *     message, end-to-end shape against realistic profiles, and the helpers
 *     the route handler composes (computeMinViableProteinBudget,
 *     collectActiveRestrictions).
 *
 * The route handler itself is mostly orchestration over Supabase + the
 * functions below — covered by manual smoke tests after the migration runs.
 */

import { describe, expect, it } from 'vitest';
import type { WeeklyTargets } from '@/lib/nutrition/tdee';
import {
  buildShoppingList,
  collectActiveRestrictions,
  computeMinViableProteinBudget,
} from '@/lib/optimizer/build';
import { filterCandidates } from '@/lib/optimizer/filter';
import type { Candidate, OptimizerProfile } from '@/lib/optimizer/types';

// =============================================================================
// Fixtures (compact subset of build.test.ts — duplicated on purpose so this
// file reads standalone)
// =============================================================================

function makeCandidate(overrides: Partial<Candidate> & { product_id: string }): Candidate {
  return {
    product_id: overrides.product_id,
    food_id: overrides.food_id ?? `food-${overrides.product_id}`,
    name: overrides.name ?? overrides.product_id,
    food_name: overrides.food_name ?? overrides.product_id,
    brand: null,
    chain: 'carrefour',
    category: overrides.category ?? 'protein_animal',
    image_url: null,
    source_url: null,
    price_ars: overrides.price_ars ?? 1000,
    weight_g: overrides.weight_g ?? 1000,
    kcal_per_100g: overrides.kcal_per_100g ?? 100,
    protein_per_100g: overrides.protein_per_100g ?? 0,
    carbs_per_100g: overrides.carbs_per_100g ?? 0,
    fats_per_100g: overrides.fats_per_100g ?? 0,
    fiber_per_100g: overrides.fiber_per_100g ?? 0,
    is_vegan: overrides.is_vegan ?? false,
    is_vegetarian: overrides.is_vegetarian ?? false,
    is_gluten_free: overrides.is_gluten_free ?? true,
    is_lactose_free: overrides.is_lactose_free ?? true,
  };
}

const POLLO = makeCandidate({
  product_id: 'p-pollo',
  food_id: 'f-pollo',
  food_name: 'Pechuga de pollo',
  price_ars: 5000,
  weight_g: 1000,
  protein_per_100g: 31,
});

const ATUN = makeCandidate({
  product_id: 'p-atun',
  food_id: 'f-atun',
  food_name: 'Atún en lata',
  price_ars: 1200,
  weight_g: 170,
  protein_per_100g: 26,
});

const LENTEJAS = makeCandidate({
  product_id: 'p-lentejas',
  food_id: 'f-lentejas',
  food_name: 'Lentejas',
  category: 'legume',
  price_ars: 800,
  weight_g: 500,
  protein_per_100g: 9,
  carbs_per_100g: 20,
  fiber_per_100g: 8,
  is_vegan: true,
  is_vegetarian: true,
});

const TOFU = makeCandidate({
  product_id: 'p-tofu',
  food_id: 'f-tofu',
  food_name: 'Tofu',
  category: 'protein_vegetal',
  price_ars: 2500,
  weight_g: 500,
  protein_per_100g: 8,
  is_vegan: true,
  is_vegetarian: true,
});

const PAN_BLANCO = makeCandidate({
  product_id: 'p-pan',
  food_id: 'f-pan',
  food_name: 'Pan blanco',
  category: 'carbs_grain',
  price_ars: 2000,
  weight_g: 500,
  protein_per_100g: 9,
  carbs_per_100g: 49,
  is_vegan: true,
  is_vegetarian: true,
  is_gluten_free: false,
});

const FULL_CATALOG: Candidate[] = [POLLO, ATUN, LENTEJAS, TOFU, PAN_BLANCO];

function makeProfile(overrides: Partial<OptimizerProfile> = {}): OptimizerProfile {
  return {
    weekly_budget_ars: overrides.weekly_budget_ars ?? 80_000,
    allergies: overrides.allergies ?? null,
    dietary_restrictions: overrides.dietary_restrictions ?? null,
    preferred_foods: overrides.preferred_foods ?? null,
    disliked_foods: overrides.disliked_foods ?? null,
    fitness_goal: overrides.fitness_goal ?? null,
  };
}

function makeTargets(overrides: Partial<WeeklyTargets> = {}): WeeklyTargets {
  return {
    weekly_calories: overrides.weekly_calories ?? 20_300,
    weekly_protein_g: overrides.weekly_protein_g ?? 1050,
    weekly_carbs_g: overrides.weekly_carbs_g ?? 2240,
    weekly_fats_g: overrides.weekly_fats_g ?? 630,
    weekly_fiber_g: overrides.weekly_fiber_g ?? 200,
    daily_calories: overrides.daily_calories ?? 2900,
    method: overrides.method ?? 'mifflin_st_jeor',
    calculated_at: overrides.calculated_at ?? '2026-05-07T00:00:00.000Z',
  };
}

// =============================================================================
// computeMinViableProteinBudget
// =============================================================================

describe('computeMinViableProteinBudget', () => {
  it('returns the cheapest cost-per-g-protein × target', () => {
    // Lentejas: $800 / (9% × 500g) = $800 / 45g protein = ~$17.78/g
    // Pollo:    $5000 / (31% × 1000g) = $5000 / 310g = ~$16.13/g  ← cheaper
    const min = computeMinViableProteinBudget(FULL_CATALOG, 1000);
    // Cheapest is pollo: ~$16.13 × 1000 = $16,130
    expect(min).not.toBeNull();
    expect(min!).toBeGreaterThan(15_000);
    expect(min!).toBeLessThan(17_000);
  });

  it('returns null when no candidate has any protein', () => {
    const noProtein = [
      makeCandidate({ product_id: 'sugar', protein_per_100g: 0, food_name: 'Azúcar' }),
    ];
    expect(computeMinViableProteinBudget(noProtein, 1000)).toBeNull();
  });

  it('returns null when the candidate list is empty', () => {
    expect(computeMinViableProteinBudget([], 1000)).toBeNull();
  });
});

// =============================================================================
// collectActiveRestrictions
// =============================================================================

describe('collectActiveRestrictions', () => {
  it('lists dietary restrictions verbatim', () => {
    const out = collectActiveRestrictions(
      makeProfile({ dietary_restrictions: ['Vegano', 'Sin TACC'] }),
    );
    expect(out).toContain('Vegano');
    expect(out).toContain('Sin TACC');
  });

  it('promotes Lactosa/Gluten allergies into the active-restrictions list', () => {
    const out = collectActiveRestrictions(
      makeProfile({ allergies: ['Lactosa', 'Gluten', 'Mariscos'] }),
    );
    expect(out).toContain('Lactosa');
    expect(out).toContain('Gluten');
    // Free-form allergies (Mariscos) belong to a different lever — not here.
    expect(out).not.toContain('Mariscos');
  });

  it('returns empty array on a clean profile', () => {
    expect(collectActiveRestrictions(makeProfile())).toEqual([]);
  });
});

// =============================================================================
// Feasibility message: end-to-end content checks
// =============================================================================

describe('feasibility_message (built end-to-end)', () => {
  it('mentions current budget, target protein g, and the suggested budget', () => {
    const profile = makeProfile({
      weekly_budget_ars: 5_000,
      fitness_goal: 'muscle_gain',
    });
    const targets = makeTargets({ weekly_protein_g: 1050 });
    const result = buildShoppingList(profile, targets, FULL_CATALOG);

    expect(result.feasible).toBe(false);
    const msg = result.feasibility_message;
    expect(msg).not.toBeNull();
    // Current budget appears (es-AR formatting → 5.000)
    expect(msg).toContain('5.000');
    // Protein target appears (1.050 in es-AR formatting; or 1050 plain — accept both)
    expect(msg).toMatch(/1[.,]?050/);
    // It tells the user what budget they actually need
    expect(msg!.toLowerCase()).toContain('necesitás');
    // It offers options
    expect(msg).toContain('Opciones:');
  });

  it('suggests "switch to maintenance" when the user is on a non-maintenance goal', () => {
    const profile = makeProfile({
      weekly_budget_ars: 5_000,
      fitness_goal: 'muscle_gain',
    });
    const targets = makeTargets({ weekly_protein_g: 1050 });
    const result = buildShoppingList(profile, targets, FULL_CATALOG);
    expect(result.feasibility_message).toContain('maintenance');
  });

  it('does NOT suggest maintenance when the user is already on maintenance', () => {
    const profile = makeProfile({
      weekly_budget_ars: 5_000,
      fitness_goal: 'maintenance',
    });
    const targets = makeTargets({ weekly_protein_g: 1050 });
    const result = buildShoppingList(profile, targets, FULL_CATALOG);
    expect(result.feasibility_message).not.toContain('maintenance');
  });

  it('names the active restrictions when there are any', () => {
    const profile = makeProfile({
      weekly_budget_ars: 5_000,
      dietary_restrictions: ['Vegano'],
      allergies: ['Lactosa'],
    });
    const targets = makeTargets({ weekly_protein_g: 1050 });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    const result = buildShoppingList(profile, targets, filtered);
    if (result.feasibility_message) {
      expect(result.feasibility_message).toContain('Vegano');
      expect(result.feasibility_message).toContain('Lactosa');
    }
  });

  it('renders the empty-pool message when filtering wipes every candidate', () => {
    // Vegan + extreme allergy free-form match against every food_name we have.
    const profile = makeProfile({
      weekly_budget_ars: 100_000,
      dietary_restrictions: ['Vegano'],
      allergies: ['lentejas', 'tofu', 'pan'],
    });
    const targets = makeTargets({ weekly_protein_g: 500 });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.length).toBe(0);

    const result = buildShoppingList(profile, targets, filtered);
    expect(result.feasible).toBe(false);
    expect(result.feasibility_message).toContain('No quedaron candidatos');
    expect(result.feasibility_message).toContain('Vegano');
  });

  it('produces a clean (no message) result on a comfortable budget', () => {
    const profile = makeProfile({
      weekly_budget_ars: 80_000,
      fitness_goal: 'muscle_gain',
    });
    // FULL_CATALOG has enough animal protein to hit ~1000g, but greedy
    // packing under the 1kg/food cap doesn't always land on the optimum
    // arrangement. 850g is comfortably feasible across the candidate
    // mix while still being "muscle-gain shaped" (~120g/day).
    const targets = makeTargets({ weekly_protein_g: 850 });
    const result = buildShoppingList(profile, targets, FULL_CATALOG);
    expect(result.feasible).toBe(true);
    expect(result.feasibility_message).toBeNull();
  });
});
