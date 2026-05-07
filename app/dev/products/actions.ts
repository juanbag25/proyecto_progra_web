'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';
import { CHAINS, findChain, type ChainId } from '@/scrapers/chains';
import { runScraper } from '@/scrapers/lib/run';
import type { ScrapeSummary } from '@/scrapers/lib/types';

/**
 * Server action invoked from the /dev/products "Re-scrape ahora" button.
 *
 * Calls runScraper() directly instead of self-fetching /api/scrape — same
 * code path, no URL gymnastics, no SCRAPE_SECRET handling on the client.
 * The /api/scrape route remains the canonical entry point for the cron
 * + manual curl flows; this is just the dev convenience trigger.
 *
 * Defense in depth: NODE_ENV check so even if this file is ever imported
 * from outside /dev/*, prod calls fail fast.
 */
export async function triggerScrapeAction(
  chains?: ChainId[],
): Promise<{ ok: true; results: ScrapeSummary[] } | { ok: false; error: string }> {
  if (process.env.NODE_ENV !== 'development') {
    return { ok: false, error: 'Re-scrape only available in dev mode' };
  }

  const targets =
    chains && chains.length > 0
      ? chains.map(findChain).filter((c): c is NonNullable<typeof c> => c !== null)
      : [...CHAINS];

  const results: ScrapeSummary[] = [];
  for (const config of targets) {
    try {
      results.push(await runScraper(config));
    } catch (err) {
      results.push({
        chain: config.id,
        queries_run: 0,
        products_scraped: 0,
        products_matched: 0,
        upserted: 0,
        errors: [
          {
            query: '__bootstrap__',
            message: err instanceof Error ? err.message : String(err),
          },
        ],
        duration_ms: 0,
      });
    }
  }

  revalidatePath('/dev/products');
  return { ok: true, results };
}
