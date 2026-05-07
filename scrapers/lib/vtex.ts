import 'server-only';

import { POLICY } from './policy';
import { vtexResponseSchema, type NormalizedProduct, type VtexProduct } from './types';

/**
 * VTEX catalog client. Carrefour, Dia, and Jumbo all run on VTEX, so this
 * single module handles the search + paginate + normalize loop for the 3
 * chains. Per-chain quirks (different domain, anti-bot edge cases) are the
 * caller's responsibility — see `scrapers/chains.ts`.
 *
 * The public catalog endpoint (`/api/catalog_system/pub/products/search/`)
 * is unauthenticated and meant for third-party use. We still throttle to
 * `POLICY.rateLimitMs` between requests to the SAME chain.
 */

const SUPABASE_PRICE_LIMIT = 99_999_999.99; // 10 digits, 2 decimals — products.price column

export async function searchVtex(
  domain: string,
  query: string,
): Promise<NormalizedProduct[]> {
  const collected: NormalizedProduct[] = [];

  for (let page = 0; page < POLICY.maxPagesPerQuery; page++) {
    const from = page * 50;
    const to = from + 49;
    const url = `https://${domain}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}?_from=${from}&_to=${to}`;

    const raw = await fetchVtexPage(url);
    if (raw.length === 0) break;

    for (const product of raw) {
      const normalized = normalizeVtexProduct(product, domain);
      if (normalized) collected.push(normalized);
    }

    if (raw.length < 50) break; // partial last page

    // Throttle between pages of the same query
    if (page < POLICY.maxPagesPerQuery - 1) {
      await sleep(POLICY.rateLimitMs);
    }
  }

  return collected;
}

async function fetchVtexPage(url: string): Promise<VtexProduct[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= POLICY.retryBackoffsMs.length; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': POLICY.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(POLICY.timeoutMs),
      });

      // 200 = full page, 206 = partial page (last batch). Both return JSON arrays.
      if (response.status === 200 || response.status === 206) {
        const json = (await response.json()) as unknown;
        const parsed = vtexResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error(`Unexpected VTEX shape: ${parsed.error.message}`);
        }
        return parsed.data;
      }

      // 404 or empty array equivalents → no results for this query/page
      if (response.status === 404) return [];

      // Retry on rate limiting and server errors
      if (response.status === 429 || response.status >= 500) {
        throw new RetryableError(`HTTP ${response.status} on ${url}`);
      }

      // Anything else (401, 403, 400) is non-retryable for the public API
      throw new Error(`HTTP ${response.status} on ${url}`);
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof RetryableError ||
        (err instanceof Error && err.name === 'TimeoutError') ||
        (err instanceof Error && err.name === 'AbortError') ||
        (err instanceof TypeError && /fetch failed|network|socket/i.test(err.message));

      if (!isRetryable || attempt === POLICY.retryBackoffsMs.length) {
        throw err;
      }

      await sleep(POLICY.retryBackoffsMs[attempt]!);
    }
  }

  throw lastError ?? new Error('VTEX fetch exhausted retries');
}

function normalizeVtexProduct(p: VtexProduct, domain: string): NormalizedProduct | null {
  const item = p.items?.[0];
  if (!item) return null;

  const seller = item.sellers?.[0];
  const offer = seller?.commertialOffer;
  if (!offer || typeof offer.Price !== 'number' || offer.Price <= 0) return null;

  // VTEX occasionally returns Price > 9 digits for industrial bulk SKUs;
  // the products column is numeric(10,2), so reject those.
  if (offer.Price > SUPABASE_PRICE_LIMIT) return null;

  const ean = (item.ean ?? '').trim();

  return {
    external_id: p.productId,
    ean: ean.length >= 8 ? ean : null,
    name: p.productName,
    brand: p.brand?.trim() || null,
    category: lastCategory(p.categories),
    price: roundTo2(offer.Price),
    list_price:
      typeof offer.ListPrice === 'number' && offer.ListPrice > 0
        ? roundTo2(offer.ListPrice)
        : null,
    unit: item.measurementUnit?.trim() || null,
    unit_multiplier: item.unitMultiplier ?? null,
    weight_g: parseWeightGrams(p.productName, item.measurementUnit, item.unitMultiplier),
    image_url: item.images?.[0]?.imageUrl ?? null,
    source_url: absolutize(p.link, domain),
  };
}

function lastCategory(categories: string[] | undefined): string | null {
  if (!categories || categories.length === 0) return null;
  // VTEX returns paths like "/Frescos/Lácteos/Leche/" — last segment is most specific.
  const last = categories[categories.length - 1]!;
  const segments = last.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1]! : null;
}

function absolutize(link: string | undefined, domain: string): string {
  if (!link) return `https://${domain}`;
  if (link.startsWith('http')) return link;
  return `https://${domain}${link.startsWith('/') ? '' : '/'}${link}`;
}

/**
 * Best-effort weight extraction. Tries (in order):
 *   1. VTEX's structured `unitMultiplier` × `measurementUnit` (the cleanest source).
 *   2. Regex over the product name for "500 g", "1.5 kg", "750 ml", "1lt".
 *
 * For liquids we treat 1ml ≈ 1g — close enough for nutrition math on
 * dairy/oil where most relevant.
 */
function parseWeightGrams(
  name: string,
  unit: string | undefined,
  multiplier: number | undefined,
): number | null {
  if (typeof multiplier === 'number' && multiplier > 0) {
    const u = (unit ?? '').toLowerCase();
    if (u === 'kg') return roundTo2(multiplier * 1000);
    if (u === 'g' || u === 'gr' || u === 'grs') return roundTo2(multiplier);
    if (u === 'l' || u === 'lt' || u === 'lts') return roundTo2(multiplier * 1000);
    if (u === 'ml') return roundTo2(multiplier);
  }

  const lower = name.toLowerCase();

  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kgMatch) return roundTo2(parseFloat(kgMatch[1]!.replace(',', '.')) * 1000);

  const gMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*g(?:rs?)?\b/);
  if (gMatch) return roundTo2(parseFloat(gMatch[1]!.replace(',', '.')));

  const lMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:lts?|litros?)\b/);
  if (lMatch) return roundTo2(parseFloat(lMatch[1]!.replace(',', '.')) * 1000);

  const mlMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) return roundTo2(parseFloat(mlMatch[1]!.replace(',', '.')));

  return null;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}
