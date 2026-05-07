import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FoodLite, ProductRow } from './types';

/**
 * DB I/O for the scraper. Uses the admin (service role) client which
 * bypasses RLS — required because the scraper has no user session.
 */

export async function loadFoodsCache(supabase: SupabaseClient): Promise<FoodLite[]> {
  const { data, error } = await supabase
    .from('foods')
    .select('id, slug, name_es, category, search_terms');
  if (error) throw new Error(`loadFoodsCache: ${error.message}`);
  return (data ?? []) as FoodLite[];
}

export interface UpsertResult {
  attempted: number;
  upserted: number;
}

/**
 * Refreshes `last_seen_at` on every call so the column doubles as
 * "freshness" — products not seen for a few days can be cleaned up later.
 *
 * Conflict resolution is on `(chain, external_id, region)` — the unique
 * constraint declared in `005_products.sql`.
 */
export async function upsertProducts(
  supabase: SupabaseClient,
  products: ProductRow[],
): Promise<UpsertResult> {
  if (products.length === 0) return { attempted: 0, upserted: 0 };

  const now = new Date().toISOString();
  const rows = products.map((p) => ({ ...p, last_seen_at: now }));

  const { data, error } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'chain,external_id,region' })
    .select('id');

  if (error) throw new Error(`upsertProducts: ${error.message}`);

  return { attempted: rows.length, upserted: data?.length ?? 0 };
}
