-- =============================================================================
-- 002_user_profile_data.sql — Onboarding profile fields on users_profile
-- =============================================================================
--
-- Extends `users_profile` (created in 001) with every field captured in the
-- onboarding "Interview" flow. All columns are nullable on purpose: rows are
-- written incrementally as the user advances through the seven steps; the
-- `onboarding_step` cursor at the bottom lets the app resume from where the
-- user left off.
--
-- RLS is already enabled on this table (001) and the existing policies cover
-- the new columns by row, not by column, so no policy changes are needed.
-- =============================================================================

-- Biometrics (Step 1)
alter table users_profile
  add column if not exists age int,
  add column if not exists weight_kg numeric(5,2),
  add column if not exists height_cm numeric(5,2),
  add column if not exists gender text check (gender in ('male','female','other'));

-- Activity (Step 2)
alter table users_profile
  add column if not exists activity_level text check (activity_level in ('sedentary','light','moderate','active','athlete')),
  add column if not exists exercise_type text[];

-- Fitness goal (Step 3)
alter table users_profile
  add column if not exists fitness_goal text check (fitness_goal in ('muscle_gain','fat_loss','recomp','strength','maintenance'));

-- Preferences (Step 4)
alter table users_profile
  add column if not exists preferred_foods text[],
  add column if not exists disliked_foods text[];

-- Restrictions (Step 5)
alter table users_profile
  add column if not exists allergies text[],
  add column if not exists dietary_restrictions text[];

-- Location & budget (Steps 6 + 7)
alter table users_profile
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists weekly_budget_ars numeric(10,2);

-- Resume cursor: index into ONBOARDING_STEPS the user should land on next.
alter table users_profile
  add column if not exists onboarding_step int default 0;
