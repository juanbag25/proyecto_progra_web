import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ONBOARDING_STEPS, STEP_SCHEMAS, type OnboardingStep } from '@/lib/onboarding/schema';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Outer envelope; the per-step shape is checked separately so the 400 body
// can carry both the step + the field-level issues for the form to render.
const requestSchema = z.object({
  step: z.enum([...ONBOARDING_STEPS] as [OnboardingStep, ...OnboardingStep[]]),
  data: z.unknown(),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const envelope = requestSchema.safeParse(json);
  if (!envelope.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { step, data } = envelope.data;
  const stepResult = STEP_SCHEMAS[step].safeParse(data);
  if (!stepResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: stepResult.error.flatten() },
      { status: 400 },
    );
  }

  const stepIdx = ONBOARDING_STEPS.indexOf(step);
  // Cursor points at the NEXT step the user should land on; clamp at the
  // last index so saving on `review` is a no-op for the cursor. Flipping
  // `onboarding_completed` is owned by /api/onboarding/complete, not here.
  const nextCursor = Math.min(stepIdx + 1, ONBOARDING_STEPS.length - 1);

  const update: Record<string, unknown> = {
    ...stepResult.data,
    onboarding_step: nextCursor,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('users_profile')
    .update(update)
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const isLastStep = stepIdx === ONBOARDING_STEPS.length - 1;
  const nextStep: OnboardingStep | null = isLastStep ? null : ONBOARDING_STEPS[nextCursor]!;

  return NextResponse.json({ ok: true, next_step: nextStep });
}
