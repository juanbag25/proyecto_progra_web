import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChainId } from '@/scrapers/chains';
import type { Candidate } from './types';

/**
 * Fetches every product viable for optimization in a region.
 *
 * "Viable" means INNER JOIN with `foods` (so food_id is non-null and the
 * canonical row exists) AND a non-null weight_g (we need it to derive
 * price-per-gram). Anything missing those is dead weight for the optimizer
 * and is silently dropped here, not deeper in the pipeline.
 *
 * Uses the supabase-js relational select shorthand:
 *   `food:foods!inner(...)` — `!inner` forces an INNER JOIN (default would
 *   be a LEFT JOIN that includes products with no matching food).
 *
 * Caller responsibility: pass an admin client (or any client whose RLS lets
 * it read both tables). Both tables already allow SELECT to authenticated
 * users; the admin client bypasses RLS for cron / server-action contexts.
 */

// Real AR food prices in 2026 are at least ~$500/kg for staples (rice,
// flour, pasta). Anything cheaper-per-gram is feed noise — observed during
// P6.B smoke testing: Jumbo SKUs come back with prices that imply
// $300/kg pan or $107 for 350g of lentejas, which the greedy then happily
// picks because they're "almost free per gram of protein". An absolute
// price floor doesn't help — a 100g spice can legitimately cost $300, but
// 1kg of pan at $300 is wrong. Filter on price-per-gram instead.
//
// MIN_PRICE_PER_GRAM_ARS = 0.5 → $500/kg floor. Excludes the bad data
// without rejecting any reasonably-cheap real food. Tested against the
// existing catalog: the candidates that survive this filter all have
// prices a real shopper would recognize.
const MIN_PRICE_PER_GRAM_ARS = 0.5;

// Supabase REST defaults to 1000 rows per response. The catalog is ~1900
// products; without an explicit `range()` we'd silently drop ~half the
// inventory. 10k is a comfortable ceiling that scales with future scrapes.
const MAX_CANDIDATES = 10_000;

export async function loadCandidates(
  supabase: SupabaseClient,
  region: string,
): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      [
        'id',
        'name',
        'brand',
        'chain',
        'price',
        'weight_g',
        'image_url',
        'source_url',
        'food_id',
        'food:foods!inner(id, name_es, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, is_vegan, is_vegetarian, is_gluten_free, is_lactose_free)',
      ].join(', '),
    )
    .eq('region', region)
    .not('weight_g', 'is', null)
    .gt('price', 0)
    .range(0, MAX_CANDIDATES - 1);

  if (error) throw new Error(`loadCandidates: ${error.message}`);
  if (!data) return [];

  // Per-gram price filter happens client-side (Postgres can't compare
  // computed expressions through the supabase-js builder without RPC).
  // The cost is tiny — at most a few ms over MAX_CANDIDATES rows.
  return (data as unknown as RawJoinRow[])
    .map(toCandidate)
    .filter((c): c is Candidate => c !== null && c.price_ars / c.weight_g >= MIN_PRICE_PER_GRAM_ARS);
}

interface RawJoinRow {
  id: string;
  name: string;
  brand: string | null;
  chain: ChainId;
  price: number | string;
  weight_g: number | string | null;
  image_url: string | null;
  source_url: string | null;
  food_id: string | null;
  // supabase-js may return the related row as object OR array (depending on
  // the FK cardinality it inferred). We accept both and pick the first.
  food:
    | RawFood
    | RawFood[]
    | null;
}

interface RawFood {
  id: string;
  name_es: string;
  category: string;
  kcal_per_100g: number | string;
  protein_per_100g: number | string;
  carbs_per_100g: number | string;
  fats_per_100g: number | string;
  fiber_per_100g: number | string;
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
}

function toCandidate(row: RawJoinRow): Candidate | null {
  const food = Array.isArray(row.food) ? row.food[0] : row.food;
  if (!food || !row.food_id) return null;

  const weight = toNumber(row.weight_g);
  const price = toNumber(row.price);
  if (weight == null || weight <= 0 || price == null || price <= 0) return null;

  return {
    product_id: row.id,
    food_id: row.food_id,
    name: row.name,
    food_name: food.name_es,
    brand: row.brand,
    chain: row.chain,
    category: food.category,
    image_url: row.image_url,
    source_url: row.source_url,
    price_ars: price,
    weight_g: weight,
    kcal_per_100g: toNumber(food.kcal_per_100g) ?? 0,
    protein_per_100g: toNumber(food.protein_per_100g) ?? 0,
    carbs_per_100g: toNumber(food.carbs_per_100g) ?? 0,
    fats_per_100g: toNumber(food.fats_per_100g) ?? 0,
    fiber_per_100g: toNumber(food.fiber_per_100g) ?? 0,
    is_vegan: food.is_vegan,
    is_vegetarian: food.is_vegetarian,
    is_gluten_free: food.is_gluten_free,
    is_lactose_free: food.is_lactose_free,
  };
}

// Postgres `numeric` columns come back as strings via supabase-js, while
// `int` columns come back as numbers. Normalize both paths.
function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
