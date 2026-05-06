'use client';

import { useMemo, useState } from 'react';
import { Select } from '@/components/ui/Select';
import { activitySchema } from '@/lib/onboarding/schema';
import { useStepSubmit } from '@/lib/onboarding/useStepSubmit';
import { Chip } from '../Chip';
import { StepCard } from '../StepCard';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

const LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentario', description: 'Trabajo de oficina, poco movimiento.' },
  { value: 'light', label: 'Liviano', description: '1–3 sesiones por semana o caminás bastante.' },
  {
    value: 'moderate',
    label: 'Moderado',
    description: '3–5 sesiones por semana, intensidad media.',
  },
  { value: 'active', label: 'Activo', description: '6–7 sesiones por semana o trabajo físico.' },
  { value: 'athlete', label: 'Atleta', description: 'Entrenás 2× por día o competís.' },
];

const EXERCISE_OPTIONS = [
  'Pesas',
  'Running',
  'Ciclismo',
  'Natación',
  'Crossfit',
  'Yoga',
  'Pilates',
  'Fútbol',
  'Tenis',
  'HIIT',
  'Boxeo',
  'Senderismo',
];

interface Props {
  initial: { activity_level?: string | null; exercise_type?: string[] | null };
  onContinue: (data: { activity_level: ActivityLevel; exercise_type: string[] }) => void;
  onBack?: () => void;
}

export function ActivityStep({ initial, onContinue, onBack }: Props) {
  const [level, setLevel] = useState<ActivityLevel>(
    (initial.activity_level as ActivityLevel) ?? 'moderate',
  );
  const [exercises, setExercises] = useState<string[]>(initial.exercise_type ?? []);

  const data = useMemo(
    () => ({ activity_level: level, exercise_type: exercises }),
    [level, exercises],
  );
  const valid = activitySchema.safeParse(data).success;
  const levelMeta = LEVELS.find((l) => l.value === level)!;
  const { submit, submitting } = useStepSubmit('activity', onContinue);

  function toggleExercise(name: string) {
    setExercises((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  }

  return (
    <StepCard
      title="Movete por la vida ¿cómo?"
      subtitle="Tu nivel de actividad nos dice cuántas calorías quemás más allá del metabolismo."
      canContinue={valid}
      submitting={submitting}
      onContinue={() => submit(data)}
      onBack={onBack}
    >
      <Select
        label="Nivel de actividad"
        value={level}
        onChange={(e) => setLevel(e.target.value as ActivityLevel)}
        options={LEVELS.map((l) => ({ value: l.value, label: l.label }))}
        helperText={levelMeta.description}
      />

      <div className="flex flex-col gap-3">
        <span className="font-display text-xs font-medium uppercase tracking-widest text-white/60">
          Tipo de ejercicio (opcional)
        </span>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_OPTIONS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={exercises.includes(opt)}
              onClick={() => toggleExercise(opt)}
            />
          ))}
        </div>
      </div>
    </StepCard>
  );
}
