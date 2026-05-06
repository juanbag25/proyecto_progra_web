import { ONBOARDING_STEPS, STEP_SCHEMAS, type OnboardingStep, type StepDataMap } from './schema';

export function getNextStep(current: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx === -1 || idx === ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1]!;
}

export function getPrevStep(current: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx <= 0) return null;
  return ONBOARDING_STEPS[idx - 1]!;
}

/**
 * Index of a step in ONBOARDING_STEPS — used to compare cursor positions
 * (e.g. when resuming, or to decide which back-edits skip the cursor bump).
 */
export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

/**
 * Resolve `users_profile.onboarding_step` (a number) back into the step name
 * the UI should mount. Out-of-range cursors clamp to the first step so a
 * corrupted DB value can't crash the flow.
 */
export function stepFromCursor(cursor: number | null | undefined): OnboardingStep {
  if (cursor == null || cursor < 0 || cursor >= ONBOARDING_STEPS.length) {
    return ONBOARDING_STEPS[0];
  }
  return ONBOARDING_STEPS[cursor]!;
}

export function validateStep<S extends OnboardingStep>(step: S, data: unknown) {
  return STEP_SCHEMAS[step].safeParse(data);
}

export type PersistResult =
  | { ok: true; next: OnboardingStep | null }
  | { ok: false; error: string };

/**
 * Send a step's draft data to the API for validation + persistence. Lives in
 * machine.ts (not the page component) so the same call site is used by the
 * onboarding flow itself and any "edit-after-the-fact" surface in /app.
 */
export async function persistDraft<S extends OnboardingStep>(
  step: S,
  data: StepDataMap[S],
): Promise<PersistResult> {
  const res = await fetch('/api/onboarding/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, data }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error ?? `Request failed: ${res.status}` };
  }

  const body = (await res.json()) as { ok: true; next_step: OnboardingStep | null };
  return { ok: true, next: body.next_step };
}
