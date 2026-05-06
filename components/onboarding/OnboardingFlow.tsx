'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getNextStep, getPrevStep, stepIndex } from '@/lib/onboarding/machine';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding/schema';
import { ReviewStep } from './ReviewStep';
import { ActivityStep } from './steps/ActivityStep';
import { BiometricsStep } from './steps/BiometricsStep';
import { BudgetStep } from './steps/BudgetStep';
import { GoalStep } from './steps/GoalStep';
import { LocationStep } from './steps/LocationStep';
import { PreferencesStep } from './steps/PreferencesStep';
import { RestrictionsStep } from './steps/RestrictionsStep';

export interface ProfileData {
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
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
  weekly_budget_ars: number | null;
}

interface OnboardingFlowProps {
  initialData: ProfileData;
  initialStep: OnboardingStep;
  editing: boolean;
}

export function OnboardingFlow({ initialData, initialStep, editing }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [data, setData] = useState<ProfileData>(initialData);

  const idx = stepIndex(step);
  const total = ONBOARDING_STEPS.length;
  const progressPct = ((idx + 1) / total) * 100;

  // Each step calls this with its own slice; we merge into the in-memory copy
  // so ReviewStep renders fresh values without an extra round-trip to Supabase.
  const advance = useCallback(<T extends Partial<ProfileData>>(slice: T) => {
    setData((prev) => ({ ...prev, ...slice }));
    setStep((current) => getNextStep(current) ?? current);
  }, []);

  const back = useCallback(() => {
    setStep((current) => getPrevStep(current) ?? current);
  }, []);

  const jumpTo = useCallback((target: OnboardingStep) => setStep(target), []);

  const showBack = idx > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-20 flex flex-col gap-3 px-6 pb-3 pt-20 sm:px-10 sm:pt-24">
        <div className="flex items-center justify-between gap-4">
          {showBack ? (
            <Button type="button" variant="ghost" size="sm" onClick={back}>
              ← Atrás
            </Button>
          ) : (
            <span aria-hidden className="h-9 w-9" />
          )}
          <span className="font-display text-xs uppercase tracking-widest text-white/45">
            Paso {idx + 1} <span className="text-white/25">de</span> {total}
            {editing && <span className="ml-3 text-accent-cyan">· Editando</span>}
          </span>
          <span aria-hidden className="h-9 w-9" />
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={idx + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-accent-gradient shadow-glow-cyan transition-[width] duration-500 ease-premium"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div key={step} className="animate-fade-up motion-reduce:animate-none">
          {step === 'biometrics' && (
            <BiometricsStep
              initial={data}
              onContinue={(slice) => advance(slice)}
              onBack={undefined}
            />
          )}
          {step === 'activity' && (
            <ActivityStep initial={data} onContinue={(slice) => advance(slice)} onBack={back} />
          )}
          {step === 'goal' && (
            <GoalStep initial={data} onContinue={(slice) => advance(slice)} onBack={back} />
          )}
          {step === 'preferences' && (
            <PreferencesStep initial={data} onContinue={(slice) => advance(slice)} onBack={back} />
          )}
          {step === 'restrictions' && (
            <RestrictionsStep initial={data} onContinue={(slice) => advance(slice)} onBack={back} />
          )}
          {step === 'location' && (
            <LocationStep initial={data} onContinue={(slice) => advance(slice)} onBack={back} />
          )}
          {step === 'budget' && (
            <BudgetStep initial={data} onContinue={(slice) => advance(slice)} onBack={back} />
          )}
          {step === 'review' && <ReviewStep data={data} onEdit={jumpTo} onBack={back} />}
        </div>
      </div>
    </div>
  );
}
