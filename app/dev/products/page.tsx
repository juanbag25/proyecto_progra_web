import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { ReScrapeButton } from '@/components/dev/ReScrapeButton';
import { CHAINS, type ChainId } from '@/scrapers/chains';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const FOOD_CATEGORIES = [
  'protein_animal',
  'protein_vegetal',
  'carbs_grain',
  'carbs_tuber',
  'fats_oil',
  'fats_nuts',
  'dairy',
  'vegetable',
  'fruit',
  'legume',
  'condiment',
  'beverage',
] as const;
type FoodCategory = (typeof FOOD_CATEGORIES)[number];

const PAGE_SIZE = 50;
const MATCHED_VALUES = ['all', 'true', 'false'] as const;
type MatchedFilter = (typeof MATCHED_VALUES)[number];

interface SearchParams {
  chain?: string;
  category?: string;
  matched?: string;
  page?: string;
}

interface FoodRel {
  name_es: string;
  category: string;
  kcal_per_100g: number | string;
}

interface ProductRow {
  id: string;
  external_id: string;
  chain: ChainId;
  name: string;
  brand: string | null;
  price: number | string;
  list_price: number | string | null;
  image_url: string | null;
  source_url: string | null;
  food_id: string | null;
  food: FoodRel | null;
}

interface ChainStats {
  chain: ChainId;
  display_name: string;
  total: number;
  matched: number;
  matched_pct: number;
  last_log: ScrapeLogRow | null;
}

interface ScrapeLogRow {
  status: 'running' | 'success' | 'partial' | 'failed';
  started_at: string;
  finished_at: string | null;
  products_scraped: number;
  products_matched: number;
  errors_count: number;
  duration_ms: number | null;
}

export default async function DevProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = parseFilters(searchParams);
  const supabase = createAdminClient();

  const [stats, productsResult] = await Promise.all([
    loadChainStats(supabase),
    loadProducts(supabase, filters),
  ]);

  const { products, totalCount } = productsResult;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Productos scrapeados
          </h1>
          <p className="mt-1 font-sans text-sm text-white/55">
            Inspector dev de la tabla <code className="text-accent-cyan">products</code>{' '}
            (JOIN <code className="text-accent-cyan">foods</code>) — solo accesible en local.
          </p>
        </div>
        <ReScrapeButton />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <ChainStatsCard key={s.chain} stats={s} />
        ))}
      </section>

      <FilterBar filters={filters} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between font-sans text-xs text-white/45">
          <span>
            {totalCount} resultado{totalCount === 1 ? '' : 's'} · Página {filters.page} de{' '}
            {totalPages}
          </span>
          <Pagination filters={filters} totalPages={totalPages} />
        </div>

        {products.length === 0 ? (
          <GlassCard className="text-center text-sm text-white/55">
            No hay productos para estos filtros.
          </GlassCard>
        ) : (
          <ul className="flex flex-col gap-2">
            {products.map((p) => (
              <ProductRowCard key={p.id} product={p} />
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end pt-2">
          <Pagination filters={filters} totalPages={totalPages} />
        </div>
      </section>
    </div>
  );
}

function parseFilters(searchParams: SearchParams) {
  const chain = isChain(searchParams.chain) ? searchParams.chain : null;
  const category = isCategory(searchParams.category) ? searchParams.category : null;
  const matched: MatchedFilter = isMatched(searchParams.matched) ? searchParams.matched : 'all';
  const pageRaw = Number(searchParams.page ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  return { chain, category, matched, page };
}

type Filters = ReturnType<typeof parseFilters>;

function isChain(v: unknown): v is ChainId {
  return typeof v === 'string' && CHAINS.some((c) => c.id === v);
}
function isCategory(v: unknown): v is FoodCategory {
  return typeof v === 'string' && (FOOD_CATEGORIES as readonly string[]).includes(v);
}
function isMatched(v: unknown): v is MatchedFilter {
  return typeof v === 'string' && (MATCHED_VALUES as readonly string[]).includes(v);
}

async function loadChainStats(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<ChainStats[]> {
  // One query for ALL chains' latest log. We sort + group in JS afterward.
  // Why not per-chain `.eq(chain).order().limit(1)`? In supabase-js@2.105,
  // running that pattern from multiple parallel chain iterations against the
  // same admin client returns an empty array (the count/head queries on
  // `products` seem to interfere). The aggregate fetch sidesteps it and
  // also makes pages faster (1 round-trip instead of 3).
  const allLogsRes = await supabase
    .from('scrape_logs')
    .select(
      'chain, status, started_at, finished_at, products_scraped, products_matched, errors_count, duration_ms',
    )
    .order('started_at', { ascending: false });
  const logsByChain = bucketLatestPerChain(
    (allLogsRes.data as Array<ScrapeLogRow & { chain: ChainId }> | null) ?? [],
  );

  return Promise.all(
    CHAINS.map(async (chain) => {
      const [totalRes, matchedRes] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('chain', chain.id),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('chain', chain.id)
          .not('food_id', 'is', null),
      ]);

      const total = totalRes.count ?? 0;
      const matched = matchedRes.count ?? 0;
      return {
        chain: chain.id,
        display_name: chain.display_name,
        total,
        matched,
        matched_pct: total === 0 ? 0 : Math.round((matched / total) * 100),
        last_log: logsByChain.get(chain.id) ?? null,
      };
    }),
  );
}

function bucketLatestPerChain(
  rows: Array<ScrapeLogRow & { chain: ChainId }>,
): Map<ChainId, ScrapeLogRow> {
  // Rows arrive sorted by started_at desc, so the first hit per chain wins.
  const out = new Map<ChainId, ScrapeLogRow>();
  for (const row of rows) {
    if (!out.has(row.chain)) out.set(row.chain, row);
  }
  return out;
}

async function loadProducts(
  supabase: ReturnType<typeof createAdminClient>,
  filters: Filters,
): Promise<{ products: ProductRow[]; totalCount: number }> {
  let query = supabase
    .from('products')
    .select(
      'id, external_id, chain, name, brand, price, list_price, image_url, source_url, food_id, food:foods(name_es, category, kcal_per_100g)',
      { count: 'exact' },
    );

  if (filters.chain) query = query.eq('chain', filters.chain);
  if (filters.matched === 'true') query = query.not('food_id', 'is', null);
  if (filters.matched === 'false') query = query.is('food_id', null);

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.order('last_seen_at', { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) {
    return { products: [], totalCount: 0 };
  }

  // Filter by category client-side because we'd otherwise need a foreign-table
  // filter (.eq('foods.category', ...)) which Supabase resolves with an outer
  // join semantic. Doing it post-query keeps the row count honest and the
  // page-level pagination consistent. Downside: when category filter is on,
  // the page could under-fill — acceptable for an admin inspector.
  let products = (data ?? []) as unknown as ProductRow[];
  let totalCount = count ?? 0;
  if (filters.category) {
    products = products.filter((p) => p.food?.category === filters.category);
    totalCount = products.length;
  }

  return { products, totalCount };
}

function ChainStatsCard({ stats }: { stats: ChainStats }) {
  const log = stats.last_log;
  const statusColor = log
    ? log.status === 'success'
      ? 'text-accent-mint'
      : log.status === 'partial'
        ? 'text-warn-orange'
        : log.status === 'failed'
          ? 'text-warn-coral'
          : 'text-accent-cyan'
    : 'text-white/40';

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold tracking-tight">{stats.display_name}</h3>
        <span className={`tabular font-display text-xs ${statusColor}`}>
          {log ? log.status : 'sin runs'}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular font-display text-3xl font-bold text-white">{stats.total}</span>
        <span className="font-sans text-xs text-white/45">productos</span>
      </div>
      <div className="font-sans text-xs text-white/55">
        <span className="tabular text-accent-cyan">{stats.matched_pct}%</span> matcheados (
        <span className="tabular">{stats.matched}</span> con <code>food_id</code>)
      </div>
      {log && (
        <div className="border-t border-hairline pt-2 font-sans text-[11px] text-white/45">
          Último run:{' '}
          <span className="tabular text-white/70">
            {log.finished_at ? formatRelative(log.finished_at) : 'corriendo'}
          </span>
          {log.duration_ms != null && (
            <span className="tabular text-white/40">
              {' '}
              · {Math.round(log.duration_ms / 1000)}s
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function FilterBar({ filters }: { filters: Filters }) {
  return (
    <GlassCard className="flex flex-wrap items-center gap-2 text-sm">
      <FilterGroup label="Cadena">
        <FilterChip active={filters.chain === null} href={buildHref(filters, { chain: null, page: 1 })}>
          Todas
        </FilterChip>
        {CHAINS.map((c) => (
          <FilterChip
            key={c.id}
            active={filters.chain === c.id}
            href={buildHref(filters, { chain: c.id, page: 1 })}
          >
            {c.display_name}
          </FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup label="Match">
        <FilterChip
          active={filters.matched === 'all'}
          href={buildHref(filters, { matched: 'all', page: 1 })}
        >
          Todos
        </FilterChip>
        <FilterChip
          active={filters.matched === 'true'}
          href={buildHref(filters, { matched: 'true', page: 1 })}
        >
          Con match
        </FilterChip>
        <FilterChip
          active={filters.matched === 'false'}
          href={buildHref(filters, { matched: 'false', page: 1 })}
        >
          Sin match
        </FilterChip>
      </FilterGroup>
      <FilterGroup label="Categoría">
        <FilterChip
          active={filters.category === null}
          href={buildHref(filters, { category: null, page: 1 })}
        >
          Todas
        </FilterChip>
        {FOOD_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            active={filters.category === cat}
            href={buildHref(filters, { category: cat, page: 1 })}
          >
            {cat}
          </FilterChip>
        ))}
      </FilterGroup>
    </GlassCard>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-sans text-[11px] uppercase tracking-widest text-white/40">{label}:</span>
      {children}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const base = 'rounded-full px-3 py-1 font-sans text-xs transition-colors duration-300 ease-premium';
  const cls = active
    ? `${base} bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/40`
    : `${base} bg-white/[0.04] text-white/60 border border-hairline hover:border-white/20 hover:text-white`;
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

function ProductRowCard({ product }: { product: ProductRow }) {
  const matched = product.food_id !== null && product.food !== null;
  return (
    <li className="glass flex items-center gap-4 px-4 py-3">
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-canvas-elevated">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-sans text-[10px] text-white/30">
            no img
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-white">
            {product.name}
          </span>
          {product.brand && (
            <span className="font-sans text-xs text-white/45">· {product.brand}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-sans text-[11px]">
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/55">
            {product.chain}
          </span>
          {matched ? (
            <span className="text-accent-mint">
              ✓ {product.food!.name_es}{' '}
              <span className="text-white/40">
                · {Number(product.food!.kcal_per_100g).toFixed(0)} kcal/100g
              </span>
            </span>
          ) : (
            <span className="text-warn-coral">sin match</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end font-display">
        <span className="tabular text-base font-bold text-white">
          ${formatARS(product.price)}
        </span>
        {product.list_price != null && Number(product.list_price) > Number(product.price) && (
          <span className="tabular text-[11px] text-white/35 line-through">
            ${formatARS(product.list_price)}
          </span>
        )}
      </div>
    </li>
  );
}

function Pagination({ filters, totalPages }: { filters: Filters; totalPages: number }) {
  const prev = filters.page > 1 ? buildHref(filters, { page: filters.page - 1 }) : null;
  const next = filters.page < totalPages ? buildHref(filters, { page: filters.page + 1 }) : null;
  return (
    <div className="flex items-center gap-2 font-sans text-xs">
      {prev ? (
        <Link href={prev} className="text-accent-cyan hover:underline">
          ← anterior
        </Link>
      ) : (
        <span className="text-white/25">← anterior</span>
      )}
      {next ? (
        <Link href={next} className="text-accent-cyan hover:underline">
          siguiente →
        </Link>
      ) : (
        <span className="text-white/25">siguiente →</span>
      )}
    </div>
  );
}

function buildHref(
  filters: Filters,
  patch: Partial<{ chain: ChainId | null; category: FoodCategory | null; matched: MatchedFilter; page: number }>,
): string {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (merged.chain) params.set('chain', merged.chain);
  if (merged.category) params.set('category', merged.category);
  if (merged.matched && merged.matched !== 'all') params.set('matched', merged.matched);
  if (merged.page && merged.page > 1) params.set('page', String(merged.page));
  const qs = params.toString();
  return qs ? `/dev/products?${qs}` : '/dev/products';
}

function formatARS(value: number | string): string {
  const n = Number(value);
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const deltaSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (deltaSec < 60) return `${deltaSec}s atrás`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m atrás`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h atrás`;
  return `${Math.floor(deltaSec / 86400)}d atrás`;
}
