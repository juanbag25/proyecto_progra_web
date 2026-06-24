-- =============================================================================
-- 009_subscriptions.sql — Mercado Pago subscriptions + payment log (P10.A)
-- =============================================================================
--
-- `subscriptions`: one row per user subscription. `mp_preapproval_id` is the
-- natural key against Mercado Pago; the rest mirrors the MP `preapproval`
-- state, kept up to date by the webhook (P10.C).
--
-- `subscription_payments`: a log of each recurring charge (authorized_payment),
-- used to render billing history and extend `current_period_end`.
--
-- RLS: every row is private to its owner — users may only READ their own. ALL
-- writes go through the service-role key (webhook P10.C + the create route
-- P10.B), which bypasses RLS, so there are deliberately no insert/update/delete
-- policies for end users. Mirrors the read-own shape used across the schema.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mp_preapproval_id text unique,
  tier text not null check (tier in ('monthly', 'annual')),
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'paused', 'cancelled')),
  amount numeric(10, 2) not null,
  currency text not null default 'ARS',
  frequency int not null,
  frequency_type text not null check (frequency_type in ('days', 'months')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on subscriptions (user_id);

create table if not exists subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mp_payment_id text unique,
  amount numeric(10, 2),
  status text,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_user_id_idx
  on subscription_payments (user_id);

alter table subscriptions enable row level security;
alter table subscription_payments enable row level security;

drop policy if exists "users read own subscription" on subscriptions;
create policy "users read own subscription" on subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "users read own payments" on subscription_payments;
create policy "users read own payments" on subscription_payments
  for select using (auth.uid() = user_id);
