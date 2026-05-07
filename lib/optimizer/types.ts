/**
 * Optimizer types — the canonical "candidate" passed through the pipeline
 * (load → filter → score → build).
 *
 * One Candidate = one row of `products` already JOINed with its canonical
 * `foods` row. We pre-flatten everything the optimizer needs so the inner
 * loop in build.ts can stay tight (no nested object access, no null checks
 * on per-100g values, no follow-up DB calls).
 *
 * Invariants enforced upstream by `loadCandidates`:
 *   - food_id !== null   (INNER JOIN excludes scraped products without a
 *                         canonical match — without nutrition we can't optimize)
 *   - weight_g !== null  (we need a weight to convert price-per-package
 *                         to price-per-gram)
 *   - price_ars > 0
 *
 * If you ever extend the type, keep it loadCandidates-shaped (flat, all
 * primitives, ready for hot loops) — don't push DB-side nesting in here.
 */

import type { ChainId } from '@/scrapers/chains';

export interface Candidate {
  // Identity
  product_id: string; // products.id (UUID)
  food_id: string; // foods.id (UUID) — canonical food this SKU maps to
  // Display
  name: string; // products.name (the messy supermarket SKU name)
  food_name: string; // foods.name_es (the canonical, normalized name)
  brand: string | null;
  chain: ChainId;
  category: string; // foods.category enum
  image_url: string | null;
  source_url: string | null;
  // Pricing
  price_ars: number;
  weight_g: number; // grams in one package — invariant: > 0
  // Nutrition per 100g (from foods)
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  fiber_per_100g: number;
  // Dietary flags (from foods)
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
}

/** Subset of `users_profile` the optimizer reads. Pulled into its own type
 *  so test fixtures don't need to fabricate the full DB row. */
export interface OptimizerProfile {
  weekly_budget_ars: number;
  // Either nullable arrays from DB or [] from a fresh row — we treat null
  // as "user didn't pick anything for this category".
  allergies: string[] | null;
  dietary_restrictions: string[] | null;
  preferred_foods: string[] | null;
  disliked_foods: string[] | null;
  // Optional — used by the feasibility-message generator to suggest
  // "switch to maintenance" when the protein target is unreachable.
  // The optimizer math itself never reads it.
  fitness_goal?:
    | 'muscle_gain'
    | 'fat_loss'
    | 'recomp'
    | 'strength'
    | 'maintenance'
    | null;
}

/** One row of the generated shopping list. Cost is derived (qty_g / weight_g
 *  × price_ars) but persisted alongside qty so the UI can display it without
 *  re-deriving in N places. */
export interface ShoppingListItem {
  product_id: string;
  qty_g: number;
  cost: number;
}

export interface ShoppingListSummary {
  total_cost: number;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fats_g: number;
  total_fiber_g: number;
  /** Reserved for the LLM-enriched micros pass (P5.D backlog). Empty in v1
   *  because `foods.micros_json` is not yet populated at scale. The shape is
   *  here so the persisted JSON column is forward-compatible. */
  micros_coverage_pct: Record<string, number>;
  budget_usage_pct: number;
  targets_match_pct: {
    protein: number;
    carbs: number;
    fats: number;
  };
}

export interface ShoppingListResult {
  items: ShoppingListItem[];
  summary: ShoppingListSummary;
  /** false ⇒ the budget couldn't cover the protein target after filtering. */
  feasible: boolean;
  /** Human-readable, multi-line, actionable suggestion when `feasible=false`.
   *  null when feasible=true. Plain text — the UI is free to format. */
  feasibility_message: string | null;
}
