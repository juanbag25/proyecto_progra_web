-- =============================================================================
-- 007_shopping_lists.sql — Generated weekly grocery lists
-- =============================================================================
--
-- Two tables: a header (`shopping_lists`) keyed on (user_id, week_start) so
-- regenerating within the same week upserts rather than duplicates, and a
-- per-item child table (`shopping_list_items`) the optimizer fills with
-- one row per SKU it picked.
--
-- summary_json holds the full ShoppingListSummary returned by buildShoppingList
-- (totals, target match %, budget usage %, micros_coverage_pct stub).
-- Persisting it as JSON keeps the DB shape stable when P5.D enriches micros
-- without forcing a new column per metric.
--
-- `feasible` is denormalized onto the header so list-page queries can filter
-- without parsing JSON.
--
-- `position` on items preserves the optimizer's output order — useful for
-- the UI to render "first picked = most important" semantics.
--
-- RLS: every row is private to its owner. Items inherit ownership through
-- the parent list row (an EXISTS subquery on shopping_lists.user_id).
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  summary_json jsonb not null,
  feasible boolean not null,
  feasibility_message text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists shopping_lists_user_week_idx
  on shopping_lists (user_id, week_start desc);

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_g numeric(10, 2) not null,
  cost numeric(10, 2) not null,
  checked boolean not null default false,
  position int,
  created_at timestamptz not null default now()
);

create index if not exists shopping_list_items_list_idx
  on shopping_list_items (list_id);
create index if not exists shopping_list_items_product_idx
  on shopping_list_items (product_id);

alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;

drop policy if exists "users read own lists" on shopping_lists;
create policy "users read own lists" on shopping_lists
  for select using (auth.uid() = user_id);

drop policy if exists "users manage own lists" on shopping_lists;
create policy "users manage own lists" on shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own list items" on shopping_list_items;
create policy "users read own list items" on shopping_list_items
  for select using (
    exists (
      select 1 from shopping_lists
      where shopping_lists.id = shopping_list_items.list_id
        and shopping_lists.user_id = auth.uid()
    )
  );

drop policy if exists "users manage own list items" on shopping_list_items;
create policy "users manage own list items" on shopping_list_items
  for all using (
    exists (
      select 1 from shopping_lists
      where shopping_lists.id = shopping_list_items.list_id
        and shopping_lists.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from shopping_lists
      where shopping_lists.id = shopping_list_items.list_id
        and shopping_lists.user_id = auth.uid()
    )
  );
