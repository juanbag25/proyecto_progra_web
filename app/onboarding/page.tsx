import { redirect } from 'next/navigation';
import { OnboardingFlow, type ProfileData } from '@/components/onboarding/OnboardingFlow';
import { requireUser } from '@/lib/auth';
import { stepFromCursor } from '@/lib/onboarding/machine';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding/schema';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { edit?: string };
}

const PROFILE_COLUMNS = [
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
  'onboarding_step',
  'onboarding_completed',
].join(', ');

export default async function OnboardingPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('users_profile')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  const editing = searchParams?.edit === '1';

  // Already finished + not in edit mode → app shell takes over.
  if (profile?.onboarding_completed && !editing) {
    redirect('/app');
  }

  // Editing forces the user back to step 0 (per UX spec). Otherwise resume
  // wherever they were before — clamping the cursor through `stepFromCursor`
  // protects against a corrupted DB value.
  const initialStep: OnboardingStep = editing
    ? ONBOARDING_STEPS[0]
    : stepFromCursor(profile?.onboarding_step ?? 0);

  const initialData: ProfileData = {
    age: profile?.age ?? null,
    weight_kg: profile?.weight_kg != null ? Number(profile.weight_kg) : null,
    height_cm: profile?.height_cm != null ? Number(profile.height_cm) : null,
    gender: profile?.gender ?? null,
    activity_level: profile?.activity_level ?? null,
    exercise_type: profile?.exercise_type ?? null,
    fitness_goal: profile?.fitness_goal ?? null,
    preferred_foods: profile?.preferred_foods ?? null,
    disliked_foods: profile?.disliked_foods ?? null,
    allergies: profile?.allergies ?? null,
    dietary_restrictions: profile?.dietary_restrictions ?? null,
    country: profile?.country ?? null,
    region: profile?.region ?? null,
    weekly_budget_ars:
      profile?.weekly_budget_ars != null ? Number(profile.weekly_budget_ars) : null,
  };

  return <OnboardingFlow initialData={initialData} initialStep={initialStep} editing={editing} />;
}

interface ProfileRow {
  age: number | null;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  gender: string | null;
  activity_level: string | null;
  exercise_type: string[] | null;
  fitness_goal: string | null;
  preferred_foods: string[] | null;
  disliked_foods: string[] | null;
  allergies: string[] | null;
  dietary_restrictions: string[] | null;
  country: string | null;
  region: string | null;
  weekly_budget_ars: number | string | null;
  onboarding_step: number | null;
  onboarding_completed: boolean | null;
}
