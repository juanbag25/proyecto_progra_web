import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { matchToFood, sortFoodsBySpecificity } from './match';
import { loadFoodsCache, upsertProducts } from './persist';
import { POLICY } from './policy';
import { QUERIES } from './queries';
import type { ChainConfig } from '@/scrapers/chains';
import type { ProductRow, ScrapeError, ScrapeSummary } from './types';
import { searchVtex } from './vtex';

/**
 * One full scrape pass for a single chain:
 *   1. Load + sort the foods cache (once per run).
 *   2. Iterate QUERIES, throttle between queries.
 *   3. For each product, fuzzy-match to a food (or null) and stage for upsert.
 *   4. Flush in batches to keep memory bounded + visible progress in DB.
 *
 * Returns a summary that the API route forwards to the caller.
 */

const FLUSH_BATCH_SIZE = 100;

export async function runScraper(chain: ChainConfig): Promise<ScrapeSummary> {
  const start = Date.now();
  const supabase = createAdminClient();

  const foods = sortFoodsBySpecificity(await loadFoodsCache(supabase));

  let scraped = 0;
  let matched = 0;
  let upserted = 0;
  const errors: ScrapeError[] = [];
  let buffer: ProductRow[] = [];
  let consecutiveFailures = 0;

  const flush = async () => {
    if (buffer.length === 0) return;
    const result = await upsertProducts(supabase, buffer);
    upserted += result.upserted;
    buffer = [];
  };

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i]!;

    if (consecutiveFailures >= POLICY.abortAfterConsecutiveFailures) {
      errors.push({
        query,
        message: `Aborted: ${consecutiveFailures} consecutive failures`,
      });
      break;
    }

    try {
      const products = await searchVtex(chain.domain, query);
      consecutiveFailures = 0;
      scraped += products.length;

      for (const p of products) {
        const match = matchToFood(p.name, foods);
        if (match) matched++;
        buffer.push({
          ...p,
          chain: chain.id,
          region: 'AR',
          food_id: match?.food_id ?? null,
          match_confidence: match?.confidence ?? null,
        });
        if (buffer.length >= FLUSH_BATCH_SIZE) {
          await flush();
        }
      }
    } catch (err) {
      consecutiveFailures += 1;
      errors.push({
        query,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // Throttle between queries to the same chain (in addition to vtex.ts's
    // intra-pagination throttle).
    if (i < QUERIES.length - 1) {
      await sleep(POLICY.rateLimitMs);
    }
  }

  // Final flush of the remaining buffer.
  try {
    await flush();
  } catch (err) {
    errors.push({
      query: '__final_flush__',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    chain: chain.id,
    queries_run: QUERIES.length,
    products_scraped: scraped,
    products_matched: matched,
    upserted,
    errors,
    duration_ms: Date.now() - start,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
