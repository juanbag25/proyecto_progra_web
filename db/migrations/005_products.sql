-- =============================================================================
-- 005_products.sql — Scraped supermarket products
-- =============================================================================
--
-- One row per (chain, external_id, region) — the same SKU at the same chain
-- in the same region. The scraper upserts on every run, refreshing `price`,
-- `last_seen_at`, and any drifted fields.
--
-- Nutrition lives on `foods` (004), not here. Products link to their canonical
-- food via `food_id` after a fuzzy name match (see scrapers/lib/match.ts).
-- Unmatched products keep `food_id = null` until a future LLM enrichment pass.
--
-- Coto is intentionally NOT in the chain check — it was descoped in P5.A.
-- Adding it later only requires changing the constraint.
--
-- RLS: any authenticated user can read; only service role writes (the
-- scraper authenticates with SUPABASE_SERVICE_ROLE_KEY which bypasses RLS).
-- =============================================================================

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  chain text not null check (chain in ('carrefour', 'jumbo', 'dia')),
  region text not null default 'AR',
  ean text,
  food_id uuid references foods(id) on delete set null,
  -- Confidence of the food_id match: 1.0 = exact substring hit, null = no match.
  match_confidence numeric,
  category text,
  name text not null,
  brand text,
  price numeric(10, 2) not null,
  list_price numeric(10, 2),
  currency text not null default 'ARS',
  unit text,
  unit_multiplier numeric,
  weight_g numeric,
  image_url text,
  source_url text,
  last_seen_at timestamptz not null default now(),
  unique (chain, external_id, region)
);

create index if not exists products_chain_region_idx on products (chain, region);
create index if not exists products_food_id_idx on products (food_id);
create index if not exists products_ean_idx on products (ean);

alter table products enable row level security;

drop policy if exists "authenticated read products" on products;
create policy "authenticated read products" on products
  for select using (auth.role() = 'authenticated');
