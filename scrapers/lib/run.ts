import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
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
 *   1. Open a `scrape_logs` row with status='running'.
 *   2. Load + sort the foods cache (once per run).
 *   3. Iterate QUERIES, throttle between queries.
 *   4. For each product, fuzzy-match to a food (or null) and stage for upsert.
 *   5. Flush in batches to keep memory bounded + visible progress in DB.
 *   6. Close the log row with status='success' | 'partial' | 'failed' even if
 *      we throw — finally{} guarantees the audit trail isn't lost.
 *
 * Returns a summary that the API route forwards to the caller.
 */

const FLUSH_BATCH_SIZE = 100;

type LogStatus = 'running' | 'success' | 'partial' | 'failed';

export async function runScraper(chain: ChainConfig): Promise<ScrapeSummary> {
  const start = Date.now();
  const supabase = createAdminClient();

  const logId = await openLog(supabase, chain.id);

  let scraped = 0;
  let matched = 0;
  let upserted = 0;
  const errors: ScrapeError[] = [];
  let buffer: ProductRow[] = [];
  let consecutiveFailures = 0;
  let bootstrapError: unknown = null;

  try {
    const foods = sortFoodsBySpecificity(await loadFoodsCache(supabase));

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
  } catch (err) {
    bootstrapError = err;
    errors.push({
      query: '__bootstrap__',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const duration_ms = Date.now() - start;
  const status: LogStatus = pickStatus({
    bootstrap: bootstrapError != null,
    scraped,
    errorCount: errors.length,
  });

  const summary: ScrapeSummary = {
    chain: chain.id,
    queries_run: QUERIES.length,
    products_scraped: scraped,
    products_matched: matched,
    upserted,
    errors,
    duration_ms,
  };

  await closeLog(supabase, logId, status, summary);
  emitStdoutLog(status, summary);

  // Don't re-throw bootstrap failures — the summary already encodes them via
  // errors[] + status='failed', and the caller (api/scrape/route.ts) renders
  // the same shape on every chain. Re-throwing would just duplicate the
  // bootstrap error in the response.
  return summary;
}

function pickStatus(args: {
  bootstrap: boolean;
  scraped: number;
  errorCount: number;
}): LogStatus {
  if (args.bootstrap) return 'failed';
  if (args.scraped === 0) return 'failed';
  if (args.errorCount > 0) return 'partial';
  return 'success';
}

async function openLog(supabase: SupabaseClient, chain: ChainConfig['id']): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_logs')
    .insert({ chain, status: 'running' })
    .select('id')
    .single();
  if (error) {
    // The log table is best-effort observability; if it's missing or RLS
    // misconfigured, don't fail the whole scrape. Stdout still has the run.
    console.error(JSON.stringify({ event: 'scrape_logs_open_failed', chain, error: error.message }));
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

async function closeLog(
  supabase: SupabaseClient,
  logId: string | null,
  status: LogStatus,
  summary: ScrapeSummary,
): Promise<void> {
  if (!logId) return;
  const errorSummary =
    summary.errors.length > 0
      ? summary.errors
          .slice(0, 5)
          .map((e) => `${e.query}: ${e.message}`)
          .join(' | ')
      : null;

  const { error } = await supabase
    .from('scrape_logs')
    .update({
      finished_at: new Date().toISOString(),
      queries_run: summary.queries_run,
      products_scraped: summary.products_scraped,
      products_matched: summary.products_matched,
      upserted: summary.upserted,
      errors_count: summary.errors.length,
      duration_ms: summary.duration_ms,
      status,
      error_summary: errorSummary,
    })
    .eq('id', logId);

  if (error) {
    console.error(
      JSON.stringify({ event: 'scrape_logs_close_failed', logId, error: error.message }),
    );
  }
}

function emitStdoutLog(status: LogStatus, summary: ScrapeSummary): void {
  // Single-line JSON keeps Vercel's log viewer happy and is grep-friendly.
  console.log(
    JSON.stringify({
      event: 'scrape_run',
      chain: summary.chain,
      status,
      queries_run: summary.queries_run,
      products_scraped: summary.products_scraped,
      products_matched: summary.products_matched,
      upserted: summary.upserted,
      errors_count: summary.errors.length,
      duration_ms: summary.duration_ms,
    }),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
