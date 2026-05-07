-- =============================================================================
-- 006_scrape_logs.sql — Per-run audit trail for the scraper
-- =============================================================================
--
-- One row per (chain, run). Inserted with status='running' at the start of a
-- runScraper() invocation and updated to 'success' / 'partial' / 'failed' when
-- the run finishes (even if it throws). The /dev/products admin page reads
-- the latest row per chain to surface freshness.
--
--   running  → row inserted, finished_at IS NULL
--   success  → finished cleanly, errors_count = 0
--   partial  → finished but some queries failed (errors_count > 0, scraped > 0)
--   failed   → bootstrap or persistence threw, scraped == 0
--
-- Writes go through the service role (scraper has no user session). Reads are
-- open to any authenticated user — the /dev/* pages are dev-only via NODE_ENV
-- gating, not RLS, so we don't need to over-restrict here.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists scrape_logs (
  id uuid primary key default gen_random_uuid(),
  chain text not null check (chain in ('carrefour', 'jumbo', 'dia')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  queries_run int not null default 0,
  products_scraped int not null default 0,
  products_matched int not null default 0,
  upserted int not null default 0,
  errors_count int not null default 0,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  error_summary text,
  duration_ms int
);

create index if not exists scrape_logs_chain_started_idx
  on scrape_logs (chain, started_at desc);

alter table scrape_logs enable row level security;

drop policy if exists "authenticated read scrape_logs" on scrape_logs;
create policy "authenticated read scrape_logs" on scrape_logs
  for select using (auth.role() = 'authenticated');
