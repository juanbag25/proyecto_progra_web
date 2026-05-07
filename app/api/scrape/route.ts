import { NextResponse } from 'next/server';
import { CHAINS, findChain, type ChainId } from '@/scrapers/chains';
import { runScraper } from '@/scrapers/lib/run';
import type { ScrapeSummary } from '@/scrapers/lib/types';

export const dynamic = 'force-dynamic';
// 3 chains × 15 queries × 2s rate limit ≈ 90s. Plus retries / first-page
// fetch latency, budget for ~4 minutes. Vercel Hobby caps at 60s — for
// production this needs Pro or to be split into per-chain calls.
export const maxDuration = 300;

interface RequestBody {
  chains?: string[];
}

export async function POST(request: Request) {
  // Two valid bearer tokens:
  //   SCRAPE_SECRET — manual / local runs (P5.B).
  //   CRON_SECRET   — auto-injected by Vercel Cron when scheduled.
  // At least one must be configured; whichever the caller presents must match.
  const scrapeSecret = process.env.SCRAPE_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  if (!scrapeSecret && !cronSecret) {
    return NextResponse.json(
      { error: 'Neither SCRAPE_SECRET nor CRON_SECRET is configured on the server' },
      { status: 500 },
    );
  }

  const auth = request.headers.get('authorization');
  if (!auth || !isAuthorized(auth, scrapeSecret, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requested = await parseRequestedChains(request);
  const targets = requested.length > 0 ? requested : CHAINS.map((c) => c.id);

  const results: ScrapeSummary[] = [];
  for (const chainId of targets) {
    const config = findChain(chainId);
    if (!config) continue;
    try {
      const summary = await runScraper(config);
      results.push(summary);
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

  return NextResponse.json({ ok: true, results });
}

function isAuthorized(
  authHeader: string,
  scrapeSecret: string | undefined,
  cronSecret: string | undefined,
): boolean {
  return (
    (!!scrapeSecret && authHeader === `Bearer ${scrapeSecret}`) ||
    (!!cronSecret && authHeader === `Bearer ${cronSecret}`)
  );
}

async function parseRequestedChains(request: Request): Promise<ChainId[]> {
  // Body is optional — empty body = scrape all chains. Bad JSON = same.
  try {
    const text = await request.text();
    if (!text.trim()) return [];
    const body = JSON.parse(text) as RequestBody;
    if (!Array.isArray(body.chains)) return [];
    return body.chains
      .filter((c): c is ChainId => typeof c === 'string' && CHAINS.some((cc) => cc.id === c));
  } catch {
    return [];
  }
}
