'use client';

import { useState } from 'react';
import { goalSchema } from '@/lib/onboarding/schema';
import { useStepSubmit } from '@/lib/onboarding/useStepSubmit';
import { StepCard } from '../StepCard';

type Goal = 'muscle_gain' | 'fat_loss' | 'recomp' | 'strength' | 'maintenance';

const GOALS: { value: Goal; emoji: string; label: string; description: string }[] = [
  {
    value: 'muscle_gain',
    emoji: '💪',
    label: 'Hipertrofia',
    description: 'Más músculo, calorías por arriba del mantenimiento.',
  },
  {
    value: 'fat_loss',
    emoji: '🔥',
    label: 'Pérdida de grasa',
    description: 'Bajar % de grasa cuidando la masa magra.',
  },
  {
    value: 'recomp',
    emoji: '⚡',
    label: 'Recomposición',
    description: 'Bajar grasa y subir músculo en simultáneo.',
  },
  {
    value: 'strength',
    emoji: '🏋️',
    label: 'Fuerza',
    description: 'Levantar más peso, foco en performance.',
  },
  {
    value: 'maintenance',
    emoji: '🧘',
    label: 'Mantenimiento',
    description: 'Sostener tu composición actual con buena nutrición.',
  },
];

interface Props {
  initial: { fitness_goal?: string | null };
  onContinue: (data: { fitness_goal: Goal }) => void;
  onBack?: () => void;
}

export function GoalStep({ initial, onContinue, onBack }: Props) {
  const [goal, setGoal] = useState<Goal | null>((initial.fitness_goal as Goal) ?? null);

  const valid = goal !== null && goalSchema.safeParse({ fitness_goal: goal }).success;
  const { submit, submitting } = useStepSubmit('goal', onContinue);

  return (
    <StepCard
      title="¿Qué buscás conseguir?"
      subtitle="Esto define el déficit / superávit calórico y el split de macros."
      canContinue={valid}
      submitting={submitting}
      onContinue={() => goal && submit({ fitness_goal: goal })}
      onBack={onBack}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GOALS.map((g) => {
          const isSelected = goal === g.value;
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoal(g.value)}
              aria-pressed={isSelected}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-5 text-left transition-all duration-300 ease-premium ${
                isSelected
                  ? 'border-accent-cyan/60 bg-accent-cyan/10 shadow-glow-cyan'
                  : 'border-hairline bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]'
              }`}
            >
              <span className="text-3xl" aria-hidden>
                {g.emoji}
              </span>
              <span
                className={`font-display text-lg font-bold tracking-tight ${
                  isSelected ? 'text-accent-cyan' : 'text-white'
                }`}
              >
                {g.label}
              </span>
              <span className="font-sans text-xs leading-relaxed text-white/60">
                {g.description}
              </span>
            </button>
          );
        })}
      </div>
    </StepCard>
  );
}
