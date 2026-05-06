-- =============================================================================
-- 001_users_profile.sql — User profile table + RLS + auth-trigger
-- =============================================================================
--
-- Creates a 1:1 mirror of `auth.users` we can attach app fields to (starting
-- with `onboarding_completed` so the post-login redirect knows where to land).
--
-- RLS: every row is owned by exactly one user; reads/writes are allowed only
-- when `auth.uid() = id`. Admin/maintenance work goes through the service-role
-- key, which bypasses RLS.
--
-- Trigger `on_auth_user_created` fires on every `auth.users` insert and seeds
-- the matching `users_profile` row, so the app never has to handle a missing
-- profile race after signup.
-- =============================================================================

create table if not exists users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table users_profile enable row level security;

drop policy if exists "users can read own profile" on users_profile;
create policy "users can read own profile" on users_profile
  for select using (auth.uid() = id);

drop policy if exists "users can update own profile" on users_profile;
create policy "users can update own profile" on users_profile
  for update using (auth.uid() = id);

drop policy if exists "users can insert own profile" on users_profile;
create policy "users can insert own profile" on users_profile
  for insert with check (auth.uid() = id);

-- Auto-seed users_profile on signup. SECURITY DEFINER runs as the function
-- owner so the insert isn't blocked by RLS (the new auth.uid() is not yet
-- established at trigger time).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
