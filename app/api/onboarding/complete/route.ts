import { NextResponse } from 'next/server';
import { generateAndPersistTargets } from '@/lib/nutrition/generate';
import { ONBOARDING_STEPS, STEP_SCHEMAS, type OnboardingStep } from '@/lib/onboarding/schema';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Onboarding completion synchronously generates the first nutrition plan via
// the LLM (5-15s typical); raise the route timeout above the 10s Hobby cap.
export const maxDuration = 30;

// Steps whose schemas hold actual fields — `review` is a confirmation marker
// without inputs of its own, so we don't validate it here.
const VALIDATING_STEPS = ONBOARDING_STEPS.filter((s) => s !== 'review') as Exclude<
  OnboardingStep,
  'review'
>[];

const PROFILE_FIELDS = [
  'age',
  'weight_kg',
  'height_cm',
  'gender',
  'activity_level',
  'exercise_type',
  'fitness_goal',
  'preferred_foods',
  'disliked_foods',
  'allergies',
  'dietary_restrictions',
  'country',
  'region',
  'weekly_budget_ars',
] as const;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: fetchError } = await supabase
    .from('users_profile')
    .select(PROFILE_FIELDS.join(', '))
    .eq('id', user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Re-validate every required step's slice from the DB row. This protects
  // against a client that POSTs /complete without having actually filled in
  // each step (e.g. someone calling the API by hand).
  const missing: { step: OnboardingStep; issues: unknown }[] = [];
  for (const stepName of VALIDATING_STEPS) {
    const result = STEP_SCHEMAS[stepName].safeParse(profile);
    if (!result.success) {
      missing.push({ step: stepName, issues: result.error.flatten() });
    }
  }

  if (missing.length > 0) {
    return NextResponse.json({ error: 'Onboarding incomplete', missing }, { status: 400 });
  }

  const reviewIdx = ONBOARDING_STEPS.indexOf('review');
  const { error: updateError } = await supabase
    .from('users_profile')
    .update({
      onboarding_completed: true,
      onboarding_step: reviewIdx,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Phase 4 hook: generate the first weekly nutrition plan now that the
  // profile is complete. A hard failure here (DB / config) is reported so
  // the client can show a retry; LLM failures are absorbed inside
  // `generateAndPersistTargets` and surface as `method: 'mifflin_st_jeor'`
  // on the persisted row.
  const targets = await generateAndPersistTargets(supabase, user.id);
  if (!targets.ok) {
    return NextResponse.json(
      { ok: true, targets_error: targets.error },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, targets: targets.targets });
}
