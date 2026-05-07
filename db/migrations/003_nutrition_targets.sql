-- =============================================================================
-- 003_nutrition_targets.sql — Weekly nutrition targets (macros + micros)
-- =============================================================================
--
-- One row per (user, week_start). Persists the LLM-enriched output of
-- `/api/nutrition/targets`. Macros live in their own columns so the optimizer
-- (Phase 6) can index/filter on them; the 9 micros + any future expansion
-- live in `micros_json` as a free-form jsonb.
--
-- `method` records how the row was produced:
--   'mifflin_st_jeor'  → fallback when the LLM call failed twice
--   'llm_adjusted'     → LLM enriched + returned a valid response
--
-- RLS: a user can only ever read their own targets. Inserts go through API
-- routes that hold the user's session cookie, so `auth.uid() = user_id`
-- holds; cron / admin work would use the service role key (bypasses RLS).
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  weekly_calories numeric(10, 2) not null,
  weekly_protein_g numeric(10, 2) not null,
  weekly_carbs_g numeric(10, 2) not null,
  weekly_fats_g numeric(10, 2) not null,
  weekly_fiber_g numeric(10, 2),
  micros_json jsonb,
  method text not null check (method in ('mifflin_st_jeor', 'llm_adjusted')),
  llm_explanation text,
  created_at timestamptz default now(),
  unique (user_id, week_start)
);

create index if not exists nutrition_targets_user_week_idx
  on nutrition_targets (user_id, week_start desc);

alter table nutrition_targets enable row level security;

drop policy if exists "users read own targets" on nutrition_targets;
create policy "users read own targets" on nutrition_targets
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own targets" on nutrition_targets;
create policy "users insert own targets" on nutrition_targets
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own targets" on nutrition_targets;
create policy "users update own targets" on nutrition_targets
  for update using (auth.uid() = user_id);
