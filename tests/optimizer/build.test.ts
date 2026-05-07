import { describe, expect, it } from 'vitest';
import type { WeeklyTargets } from '@/lib/nutrition/tdee';
import { buildShoppingList } from '@/lib/optimizer/build';
import { filterCandidates } from '@/lib/optimizer/filter';
import type { Candidate, OptimizerProfile } from '@/lib/optimizer/types';

// =============================================================================
// Fixture builders — the optimizer is a pure function, so we feed it
// hand-crafted Candidate[] rather than wiring up a real Supabase client.
// Numbers below are the same per-100g values used in the foods seed
// (db/migrations/004_foods.sql) so assertions read like real life.
// =============================================================================

function makeCandidate(overrides: Partial<Candidate> & { product_id: string }): Candidate {
  return {
    product_id: overrides.product_id,
    food_id: overrides.food_id ?? `food-${overrides.product_id}`,
    name: overrides.name ?? overrides.product_id,
    food_name: overrides.food_name ?? overrides.product_id,
    brand: overrides.brand ?? null,
    chain: overrides.chain ?? 'carrefour',
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
  category: 'protein_animal',
  price_ars: 5000,
  weight_g: 1000,
  kcal_per_100g: 165,
  protein_per_100g: 31,
  fats_per_100g: 3.6,
  is_vegan: false,
  is_vegetarian: false,
  is_gluten_free: true,
  is_lactose_free: true,
});

const ATUN = makeCandidate({
  product_id: 'p-atun',
  food_id: 'f-atun',
  food_name: 'Atún en lata',
  category: 'protein_animal',
  price_ars: 1200,
  weight_g: 170,
  kcal_per_100g: 116,
  protein_per_100g: 26,
  fats_per_100g: 1,
  is_vegan: false,
  is_vegetarian: false,
  is_gluten_free: true,
  is_lactose_free: true,
});

const HUEVO = makeCandidate({
  product_id: 'p-huevo',
  food_id: 'f-huevo',
  food_name: 'Huevo de gallina',
  category: 'protein_animal',
  price_ars: 4500,
  weight_g: 720, // 12 huevos × 60g
  kcal_per_100g: 155,
  protein_per_100g: 13,
  carbs_per_100g: 1.1,
  fats_per_100g: 11,
  is_vegan: false,
  is_vegetarian: true,
});

const LECHE = makeCandidate({
  product_id: 'p-leche',
  food_id: 'f-leche',
  food_name: 'Leche entera',
  category: 'dairy',
  price_ars: 1100,
  weight_g: 1000,
  kcal_per_100g: 60,
  protein_per_100g: 3.2,
  carbs_per_100g: 4.8,
  fats_per_100g: 3.3,
  is_vegan: false,
  is_vegetarian: true,
  is_gluten_free: true,
  is_lactose_free: false,
});

const QUESO = makeCandidate({
  product_id: 'p-queso',
  food_id: 'f-queso',
  food_name: 'Queso fresco',
  category: 'dairy',
  price_ars: 6500,
  weight_g: 500,
  kcal_per_100g: 250,
  protein_per_100g: 18,
  fats_per_100g: 19,
  is_vegan: false,
  is_vegetarian: true,
  is_gluten_free: true,
  is_lactose_free: false,
});

const LENTEJAS = makeCandidate({
  product_id: 'p-lentejas',
  food_id: 'f-lentejas',
  food_name: 'Lentejas',
  category: 'legume',
  price_ars: 800,
  weight_g: 500,
  kcal_per_100g: 116,
  protein_per_100g: 9,
  carbs_per_100g: 20,
  fiber_per_100g: 8,
  is_vegan: true,
  is_vegetarian: true,
  is_gluten_free: true,
  is_lactose_free: true,
});

const TOFU = makeCandidate({
  product_id: 'p-tofu',
  food_id: 'f-tofu',
  food_name: 'Tofu',
  category: 'protein_vegetal',
  price_ars: 2500,
  weight_g: 500,
  kcal_per_100g: 76,
  protein_per_100g: 8,
  fats_per_100g: 4.8,
  is_vegan: true,
  is_vegetarian: true,
  is_gluten_free: true,
  is_lactose_free: true,
});

const ARROZ = makeCandidate({
  product_id: 'p-arroz',
  food_id: 'f-arroz',
  food_name: 'Arroz blanco',
  category: 'carbs_grain',
  price_ars: 1500,
  weight_g: 1000,
  kcal_per_100g: 130,
  protein_per_100g: 2.7,
  carbs_per_100g: 28,
  is_vegan: true,
  is_vegetarian: true,
  is_gluten_free: true,
  is_lactose_free: true,
});

const PAN_BLANCO = makeCandidate({
  product_id: 'p-pan-blanco',
  food_id: 'f-pan-blanco',
  food_name: 'Pan blanco',
  category: 'carbs_grain',
  price_ars: 2000,
  weight_g: 500,
  kcal_per_100g: 265,
  protein_per_100g: 9,
  carbs_per_100g: 49,
  fats_per_100g: 3.2,
  is_vegan: true,
  is_vegetarian: true,
  is_gluten_free: false, // contains gluten
  is_lactose_free: true,
});

const ALMENDRAS = makeCandidate({
  product_id: 'p-almendras',
  food_id: 'f-almendras',
  food_name: 'Almendras',
  category: 'fats_nuts',
  price_ars: 4000,
  weight_g: 250,
  kcal_per_100g: 579,
  protein_per_100g: 21,
  fats_per_100g: 50,
  fiber_per_100g: 12,
  is_vegan: true,
  is_vegetarian: true,
  is_gluten_free: true,
  is_lactose_free: true,
});

const BANANA = makeCandidate({
  product_id: 'p-banana',
  food_id: 'f-banana',
  food_name: 'Banana',
  category: 'fruit',
  price_ars: 1500,
  weight_g: 1000,
  kcal_per_100g: 89,
  protein_per_100g: 1.1,
  carbs_per_100g: 23,
  fiber_per_100g: 2.6,
  is_vegan: true,
  is_vegetarian: true,
  is_gluten_free: true,
  is_lactose_free: true,
});

const FULL_CATALOG: Candidate[] = [
  POLLO,
  ATUN,
  HUEVO,
  LECHE,
  QUESO,
  LENTEJAS,
  TOFU,
  ARROZ,
  PAN_BLANCO,
  ALMENDRAS,
  BANANA,
];

function makeProfile(overrides: Partial<OptimizerProfile> = {}): OptimizerProfile {
  return {
    weekly_budget_ars: overrides.weekly_budget_ars ?? 80_000,
    allergies: overrides.allergies ?? null,
    dietary_restrictions: overrides.dietary_restrictions ?? null,
    preferred_foods: overrides.preferred_foods ?? null,
    disliked_foods: overrides.disliked_foods ?? null,
  };
}

function makeTargets(overrides: Partial<WeeklyTargets> = {}): WeeklyTargets {
  // Defaults loosely reflect a 75kg male, moderate activity, muscle_gain.
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
// filter.ts — hard constraints
// =============================================================================

describe('filterCandidates', () => {
  it('vegan profile keeps only is_vegan=true candidates', () => {
    const profile = makeProfile({ dietary_restrictions: ['Vegano'] });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.every((c) => c.is_vegan)).toBe(true);
    expect(filtered.map((c) => c.product_id)).not.toContain(POLLO.product_id);
    expect(filtered.map((c) => c.product_id)).toContain(LENTEJAS.product_id);
    expect(filtered.map((c) => c.product_id)).toContain(TOFU.product_id);
  });

  it('vegetarian profile keeps eggs/dairy but drops meat/fish', () => {
    const profile = makeProfile({ dietary_restrictions: ['Vegetariano'] });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.every((c) => c.is_vegetarian)).toBe(true);
    expect(filtered.map((c) => c.product_id)).toContain(LECHE.product_id);
    expect(filtered.map((c) => c.product_id)).toContain(HUEVO.product_id);
    expect(filtered.map((c) => c.product_id)).not.toContain(POLLO.product_id);
    expect(filtered.map((c) => c.product_id)).not.toContain(ATUN.product_id);
  });

  it('Sin TACC drops gluten-containing candidates', () => {
    const profile = makeProfile({ dietary_restrictions: ['Sin TACC'] });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.every((c) => c.is_gluten_free)).toBe(true);
    expect(filtered.map((c) => c.product_id)).not.toContain(PAN_BLANCO.product_id);
    expect(filtered.map((c) => c.product_id)).toContain(ARROZ.product_id);
  });

  it('Lactosa as allergy enforces lactose-free flag (cross-cut from allergies bucket)', () => {
    const profile = makeProfile({ allergies: ['Lactosa'] });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.every((c) => c.is_lactose_free)).toBe(true);
    expect(filtered.map((c) => c.product_id)).not.toContain(LECHE.product_id);
    expect(filtered.map((c) => c.product_id)).not.toContain(QUESO.product_id);
  });

  it('Gluten as allergy enforces gluten-free (same as Sin TACC)', () => {
    const profile = makeProfile({ allergies: ['Gluten'] });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.every((c) => c.is_gluten_free)).toBe(true);
    expect(filtered.map((c) => c.product_id)).not.toContain(PAN_BLANCO.product_id);
  });

  it('free-form allergy matches food_name as substring (diacritic-insensitive)', () => {
    const profile = makeProfile({ allergies: ['almendrás'] }); // typo + accent
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.map((c) => c.product_id)).not.toContain(ALMENDRAS.product_id);
  });

  it('disliked foods match food_name as substring', () => {
    const profile = makeProfile({ disliked_foods: ['atun'] });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.map((c) => c.product_id)).not.toContain(ATUN.product_id);
    expect(filtered.map((c) => c.product_id)).toContain(POLLO.product_id);
  });

  it('combines multiple constraints (vegan + Lactosa is redundant but should hold)', () => {
    const profile = makeProfile({
      dietary_restrictions: ['Vegano'],
      allergies: ['Lactosa'],
    });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    expect(filtered.every((c) => c.is_vegan)).toBe(true);
    expect(filtered.every((c) => c.is_lactose_free)).toBe(true);
  });
});

// =============================================================================
// build.ts — greedy core
// =============================================================================

describe('buildShoppingList', () => {
  it('produces a feasible plan with the full catalog and a comfortable budget', () => {
    const profile = makeProfile({ weekly_budget_ars: 80_000 });
    const targets = makeTargets();
    const result = buildShoppingList(profile, targets, FULL_CATALOG);

    expect(result.feasible).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.summary.total_cost).toBeLessThanOrEqual(profile.weekly_budget_ars);
    expect(result.summary.targets_match_pct.protein).toBeGreaterThanOrEqual(95);
  });

  it('respects vegan filtering downstream — no animal product in the items', () => {
    const profile = makeProfile({
      dietary_restrictions: ['Vegano'],
      weekly_budget_ars: 80_000,
    });
    const targets = makeTargets({ weekly_protein_g: 700 });
    const filtered = filterCandidates(FULL_CATALOG, profile);
    const result = buildShoppingList(profile, targets, filtered);

    const usedIds = new Set(result.items.map((i) => i.product_id));
    for (const c of FULL_CATALOG) {
      if (!c.is_vegan && usedIds.has(c.product_id)) {
        throw new Error(`vegan plan included non-vegan product: ${c.product_id}`);
      }
    }
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.feasible).toBe(true);
  });

  it('respects Sin TACC — no gluten product in the items', () => {
    const profile = makeProfile({
      dietary_restrictions: ['Sin TACC'],
      weekly_budget_ars: 80_000,
    });
    const targets = makeTargets();
    const filtered = filterCandidates(FULL_CATALOG, profile);
    const result = buildShoppingList(profile, targets, filtered);

    const usedIds = new Set(result.items.map((i) => i.product_id));
    expect(usedIds.has(PAN_BLANCO.product_id)).toBe(false);
  });

  it('flags infeasible when the budget cannot cover the protein target', () => {
    const profile = makeProfile({ weekly_budget_ars: 5_000 });
    const targets = makeTargets({ weekly_protein_g: 1050 });
    const result = buildShoppingList(profile, targets, FULL_CATALOG);

    expect(result.feasible).toBe(false);
    // Even infeasible runs return a partial list so the UI can show context.
    expect(result.summary.total_cost).toBeLessThanOrEqual(profile.weekly_budget_ars);
    // The actionable message lives on infeasible results only.
    expect(result.feasibility_message).not.toBeNull();
    expect(result.feasibility_message).toContain('presupuesto');
  });

  it('feasibility_message is null on feasible plans', () => {
    const profile = makeProfile({ weekly_budget_ars: 80_000 });
    const targets = makeTargets();
    const result = buildShoppingList(profile, targets, FULL_CATALOG);
    expect(result.feasible).toBe(true);
    expect(result.feasibility_message).toBeNull();
  });

  it('summary.micros_coverage_pct is present (empty in v1)', () => {
    const profile = makeProfile({ weekly_budget_ars: 80_000 });
    const targets = makeTargets();
    const result = buildShoppingList(profile, targets, FULL_CATALOG);
    expect(result.summary.micros_coverage_pct).toEqual({});
  });

  it('caps single-SKU quantity at MAX_GRAMS_PER_SKU (5kg/sku)', () => {
    // Only one viable candidate + a high protein target → we'd want to load up
    // on it, but the cap should hold. Setting a huge budget removes any
    // budget-driven cap so we're really stress-testing the SKU cap.
    const profile = makeProfile({ weekly_budget_ars: 1_000_000 });
    const targets = makeTargets({ weekly_protein_g: 5000 });
    const result = buildShoppingList(profile, targets, [POLLO]);

    expect(result.items.length).toBe(1);
    expect(result.items[0]!.qty_g).toBeLessThanOrEqual(5000);
  });

  it('completes in <2s for 1000 generated candidates', () => {
    const big: Candidate[] = [];
    for (let i = 0; i < 1000; i++) {
      big.push(
        makeCandidate({
          product_id: `synthetic-${i}`,
          food_id: `food-${i % 50}`, // 50 distinct foods to exercise variety
          food_name: `Food ${i % 50}`,
          price_ars: 500 + (i % 100) * 25,
          weight_g: 250 + (i % 5) * 250,
          protein_per_100g: 5 + (i % 30),
          carbs_per_100g: 5 + (i % 40),
          fats_per_100g: 1 + (i % 20),
          fiber_per_100g: i % 12,
          is_vegan: i % 3 === 0,
          is_vegetarian: i % 2 === 0,
          is_gluten_free: i % 4 !== 0,
          is_lactose_free: i % 5 !== 0,
        }),
      );
    }
    const profile = makeProfile({ weekly_budget_ars: 100_000 });
    const targets = makeTargets();

    const t0 = Date.now();
    const result = buildShoppingList(profile, targets, big);
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(2000);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('summary numbers match the items it built (no drift)', () => {
    const profile = makeProfile({ weekly_budget_ars: 80_000 });
    const targets = makeTargets();
    const result = buildShoppingList(profile, targets, FULL_CATALOG);

    // Re-derive expected totals from the items + the catalog and compare.
    const byId = new Map(FULL_CATALOG.map((c) => [c.product_id, c]));
    let expectedCost = 0;
    let expectedProtein = 0;
    for (const item of result.items) {
      const c = byId.get(item.product_id)!;
      expectedCost += item.cost;
      expectedProtein += (item.qty_g / 100) * c.protein_per_100g;
    }
    expect(result.summary.total_cost).toBeCloseTo(Math.round(expectedCost * 100) / 100, 1);
    expect(result.summary.total_protein_g).toBeCloseTo(
      Math.round(expectedProtein * 10) / 10,
      0,
    );
  });

  it('preferred foods nudge their SKUs into the list when otherwise tied', () => {
    // Two candidates with identical macros + price; preferred should win.
    const A = makeCandidate({
      product_id: 'p-a',
      food_id: 'f-a',
      food_name: 'Alfa',
      price_ars: 1000,
      weight_g: 1000,
      protein_per_100g: 20,
      is_vegan: true,
      is_vegetarian: true,
    });
    const B = makeCandidate({
      product_id: 'p-b',
      food_id: 'f-b',
      food_name: 'Beta',
      price_ars: 1000,
      weight_g: 1000,
      protein_per_100g: 20,
      is_vegan: true,
      is_vegetarian: true,
    });
    const profile = makeProfile({
      weekly_budget_ars: 50_000,
      preferred_foods: ['Beta'],
    });
    const targets = makeTargets({ weekly_protein_g: 200 });

    const result = buildShoppingList(profile, targets, [A, B]);
    const firstPick = result.items[0]?.product_id;
    expect(firstPick).toBe(B.product_id);
  });

  it('returns no items + feasible=false when the candidate list is empty', () => {
    const profile = makeProfile();
    const targets = makeTargets();
    const result = buildShoppingList(profile, targets, []);
    expect(result.items).toEqual([]);
    expect(result.feasible).toBe(false);
    expect(result.summary.total_cost).toBe(0);
  });
});
