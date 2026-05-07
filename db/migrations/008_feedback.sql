-- =============================================================================
-- 008_feedback.sql — Weekly feedback loop (P8.A)
-- =============================================================================
--
-- Two tables that close the product loop:
--
--   `weight_logs`     — every weight reading the user enters. Append-only;
--                       one row per (user, day) so accidental double-submits
--                       upsert into the same row instead of polluting the
--                       progress chart with duplicates.
--
--   `weekly_feedback` — one row per (user, week_start) capturing the user's
--                       qualitative + quantitative feedback for the week
--                       just closed. `week_start` aligns with
--                       `shopping_lists.week_start` so we can join the two
--                       1:1 to render the WeekComparison view.
--
-- Adherence rationale: stored as int 0–100 instead of a derived check-off
-- ratio because the user self-reports "how it went" — what they actually
-- ate may diverge from what they checked in the UI (people forget to
-- tick boxes). The check-off ratio is computed live from
-- `shopping_list_items.checked` for the dashboard rings; this column is
-- the user's own honest take.
--
-- RLS: every row is private to its owner. Mirrors the policy shape used
-- across the rest of the schema (users_profile, nutrition_targets, etc.).
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5, 2) not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, logged_at)
);

create index if not exists weight_logs_user_date_idx
  on weight_logs (user_id, logged_at desc);

create table if not exists weekly_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  finished_food boolean,
  adherence_pct int check (adherence_pct between 0 and 100),
  budget_actual numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_feedback_user_week_idx
  on weekly_feedback (user_id, week_start desc);

alter table weight_logs enable row level security;
alter table weekly_feedback enable row level security;

drop policy if exists "users read own weight logs" on weight_logs;
create policy "users read own weight logs" on weight_logs
  for select using (auth.uid() = user_id);

drop policy if exists "users manage own weight logs" on weight_logs;
create policy "users manage own weight logs" on weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own feedback" on weekly_feedback;
create policy "users read own feedback" on weekly_feedback
  for select using (auth.uid() = user_id);

drop policy if exists "users manage own feedback" on weekly_feedback;
create policy "users manage own feedback" on weekly_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
