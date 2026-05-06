'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { persistDraft } from './machine';
import type { OnboardingStep, StepDataMap } from './schema';

/**
 * Wraps the per-step submit pattern: `submitting` flag, `persistDraft` call,
 * toast on failure, and `onSuccess(data)` to advance the flow. Pulls the
 * boilerplate out of every step component so each one only has to define its
 * inputs + validity check.
 */
export function useStepSubmit<S extends OnboardingStep>(
  step: S,
  onSuccess: (data: StepDataMap[S]) => void,
) {
  const { show } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function submit(data: StepDataMap[S]) {
    setSubmitting(true);
    const result = await persistDraft(step, data);
    setSubmitting(false);
    if (!result.ok) {
      show({ message: result.error, variant: 'error' });
      return;
    }
    onSuccess(data);
  }

  return { submit, submitting };
}
