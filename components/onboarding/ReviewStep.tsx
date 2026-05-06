'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/components/ui/Toast';
import type { OnboardingStep } from '@/lib/onboarding/schema';

interface ReviewProps {
  data: {
    age?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
    gender?: string | null;
    activity_level?: string | null;
    exercise_type?: string[] | null;
    fitness_goal?: string | null;
    preferred_foods?: string[] | null;
    disliked_foods?: string[] | null;
    allergies?: string[] | null;
    dietary_restrictions?: string[] | null;
    country?: string | null;
    region?: string | null;
    weekly_budget_ars?: number | null;
  };
  onEdit: (step: OnboardingStep) => void;
  onBack?: () => void;
}

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: 'Hipertrofia',
  fat_loss: 'Pérdida de grasa',
  recomp: 'Recomposición',
  strength: 'Fuerza',
  maintenance: 'Mantenimiento',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentario',
  light: 'Liviano',
  moderate: 'Moderado',
  active: 'Activo',
  athlete: 'Atleta',
};

function Section({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: OnboardingStep;
  onEdit: (s: OnboardingStep) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xs font-medium uppercase tracking-widest text-white/55">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="font-sans text-xs text-accent-cyan transition-colors duration-300 ease-premium hover:text-white"
        >
          Editar →
        </button>
      </div>
      <div className="flex flex-col gap-1.5 font-sans text-sm text-white/85">{children}</div>
    </div>
  );
}

const formatARS = (n: number) => `$${n.toLocaleString('es-AR')}`;
const join = (arr: string[] | null | undefined) => (arr && arr.length > 0 ? arr.join(' · ') : '—');

export function ReviewStep({ data, onEdit, onBack }: ReviewProps) {
  const router = useRouter();
  const { show } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    const res = await fetch('/api/onboarding/complete', { method: 'POST' });
    setSubmitting(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      show({
        message: body?.error ?? 'No pudimos cerrar el onboarding. Probá de nuevo.',
        variant: 'error',
      });
      return;
    }
    show({ message: 'Generando tu plan…', variant: 'success' });
    router.replace('/app');
    router.refresh();
  }

  return (
    <GlassCard variant="strong" className="flex w-[min(92vw,40rem)] flex-col gap-5 p-8 sm:p-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Revisá y confirmá.
        </h1>
        <p className="font-sans text-sm text-white/65">
          Si algo no cuadra, tocá <span className="text-accent-cyan">Editar</span>. Cuando estés
          listo, generamos tu primer plan.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Section title="Biometría" step="biometrics" onEdit={onEdit}>
          <span>
            <span className="text-white/55">Edad:</span> {data.age ?? '—'} años
          </span>
          <span>
            <span className="text-white/55">Peso:</span> {data.weight_kg ?? '—'} kg ·{' '}
            <span className="text-white/55">Altura:</span> {data.height_cm ?? '—'} cm
          </span>
          <span>
            <span className="text-white/55">Género:</span> {data.gender ?? '—'}
          </span>
        </Section>

        <Section title="Actividad" step="activity" onEdit={onEdit}>
          <span>
            <span className="text-white/55">Nivel:</span>{' '}
            {data.activity_level ? ACTIVITY_LABELS[data.activity_level] : '—'}
          </span>
          <span>
            <span className="text-white/55">Ejercicios:</span> {join(data.exercise_type)}
          </span>
        </Section>

        <Section title="Objetivo" step="goal" onEdit={onEdit}>
          <span className="font-display text-base font-semibold tracking-tight text-accent-cyan">
            {data.fitness_goal ? GOAL_LABELS[data.fitness_goal] : '—'}
          </span>
        </Section>

        <Section title="Preferencias" step="preferences" onEdit={onEdit}>
          <span>
            <span className="text-white/55">Te gusta:</span> {join(data.preferred_foods)}
          </span>
          <span>
            <span className="text-white/55">No te gusta:</span> {join(data.disliked_foods)}
          </span>
        </Section>

        <Section title="Restricciones" step="restrictions" onEdit={onEdit}>
          <span>
            <span className="text-white/55">Alergias:</span> {join(data.allergies)}
          </span>
          <span>
            <span className="text-white/55">Dietas:</span> {join(data.dietary_restrictions)}
          </span>
        </Section>

        <Section title="Ubicación" step="location" onEdit={onEdit}>
          <span>
            {data.region ?? '—'}, {data.country ?? '—'}
          </span>
        </Section>

        <Section title="Presupuesto" step="budget" onEdit={onEdit}>
          <span className="tabular font-display text-2xl font-bold text-accent-mint">
            {data.weekly_budget_ars ? formatARS(Number(data.weekly_budget_ars)) : '—'}
          </span>
          <span className="text-xs text-white/55">por semana</span>
        </Section>
      </div>

      <div className="flex items-center gap-3 pt-2">
        {onBack && (
          <Button type="button" variant="ghost" size="md" onClick={onBack}>
            ← Atrás
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={submitting}
          onClick={handleConfirm}
          className="ml-auto shadow-glow-cyan"
        >
          {submitting ? 'Cerrando…' : 'Confirmar y generar mi plan →'}
        </Button>
      </div>
    </GlassCard>
  );
}
