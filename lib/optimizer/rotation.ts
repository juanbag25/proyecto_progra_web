import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cross-week variety helper for the optimizer (P8 follow-up).
 *
 * The greedy in build.ts is fully deterministic: same profile + targets +
 * candidates → same list. Without help it picks the same SKUs week after
 * week, which feels like the app gave up on you. This module loads the
 * food_ids that appeared on the user's recent shopping_lists (excluding
 * the one we're about to write) and turns them into a per-food
 * "freshness" multiplier that build.ts applies inside `pickBest`.
 *
 * The penalty curve is intentionally soft:
 *   - Most recent past week: 0.50× — we *halve* the score so a
 *     previously-picked food only wins if its base score is roughly
 *     double the alternative. Preferred-food users still get pollo;
 *     ties get broken in favor of variety.
 *   - Two weeks ago: 0.75× — the food is still discouraged but less so.
 *   - Three weeks back or older: 1.00× (no penalty) — we forget.
 *
 * When a food appears in MULTIPLE recent lists, we use the strongest
 * (lowest) penalty so "ate pollo every week for a month" doesn't average
 * out to a soft penalty.
 *
 * RLS: the underlying queries run with the user's session client, so
 * cross-user reads are impossible by construction.
 */

const PENALTY_BY_RECENCY = [0.5, 0.75] as const;
const RECENT_LISTS_TO_LOAD = PENALTY_BY_RECENCY.length;

/** Map from `food_id` to a multiplier in (0, 1]. Lower = stronger penalty.
 *  Foods absent from the map get the implicit default of 1.0 (no penalty). */
export type RotationPenalty = Map<string, number>;

interface ProductNode {
  food_id: string | null;
}
interface ItemRow {
  product: ProductNode | ProductNode[] | null;
}
interface ListRow {
  week_start: string;
  items: ItemRow[];
}

export async function loadRotationPenalty(
  supabase: SupabaseClient,
  userId: string,
  /** The week we're about to write — exclude it so a regen of the SAME
   *  week doesn't penalize itself. */
  excludeWeekStart: string,
): Promise<RotationPenalty> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(
      `week_start,
       items:shopping_list_items(
         product:products(food_id)
       )`,
    )
    .eq('user_id', userId)
    .neq('week_start', excludeWeekStart)
    .order('week_start', { ascending: false })
    .limit(RECENT_LISTS_TO_LOAD);

  if (error) {
    // Don't fail the whole optimizer over a variety query — a missing
    // rotation map just degrades to "no variety bonus", same as v1.
    console.error('[optimizer/rotation] failed to load past lists:', error);
    return new Map();
  }
  if (!data) return new Map();

  const penalty: RotationPenalty = new Map();
  const rows = data as ListRow[];

  rows.forEach((row, idx) => {
    const recencyPenalty = PENALTY_BY_RECENCY[idx] ?? 1.0;
    for (const item of row.items ?? []) {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      if (!product?.food_id) continue;
      const existing = penalty.get(product.food_id);
      // Strongest (lowest) penalty wins when a food shows up in multiple
      // recent weeks — see file header for rationale.
      if (existing == null || recencyPenalty < existing) {
        penalty.set(product.food_id, recencyPenalty);
      }
    }
  });

  return penalty;
}

/**
 * Stable jitter in [-0.05, +0.05] for a given (productId, seed) pair.
 *
 * Used by the optimizer to break ties between candidates of similar
 * score: the seed comes from the route at generation time (built from
 * `week_start + Date.now()`) so two regens of the same week still
 * produce different orderings.
 *
 * Fnv1a-style 32-bit hash. Cryptographically worthless but deterministic
 * and fast — exactly what we need for tiebreaking. The output range is
 * normalized to `±JITTER_MAGNITUDE` so the multiplier `(1 + jitter)`
 * always stays in `[0.95, 1.05]`.
 */
export const JITTER_MAGNITUDE = 0.05;

export function jitterFor(productId: string, seed: string): number {
  const input = `${productId}|${seed}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Normalize the lower 24 bits to [0, 1), then map to [-1, +1).
  const unit = ((hash >>> 0) & 0xffffff) / 0x1000000;
  return (unit - 0.5) * 2 * JITTER_MAGNITUDE;
}
