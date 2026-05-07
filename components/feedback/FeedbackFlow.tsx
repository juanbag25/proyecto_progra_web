'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { NumberInput } from '@/components/ui/NumberInput';
import { Slider } from '@/components/ui/Slider';
import { useToast } from '@/components/ui/Toast';
import { formatARS } from '@/lib/format';
import type { RecalibrationResult } from '@/lib/nutrition/recalibration';
import type { FitnessGoal } from '@/lib/nutrition/tdee';
import { ProgressChart, type WeightPoint } from './ProgressChart';

/**
 * Three-step weekly check-in.
 *
 *   1. Adherence — qualitative "how did it go?" (3 buttons + optional notes
 *      on the lower two), feeds the `adherence_pct` int.
 *   2. Weight    — number input prefilled with the user's current profile
 *      weight, with an inline diff vs the prior log so the change feels
 *      tangible while typing.
 *   3. Budget    — slider for "what % of the budget did you actually spend?"
 *      plus an optional adjustment to next week's budget cap.
 *
 * Submission posts to /api/feedback/submit. The response carries everything
 * the success screen needs (recalibration message + fresh chart points + the
 * new list's id) so we don't re-query — single network round trip from
 * "submit" to "done".
 */

interface FeedbackFlowProps {
  weekStart: string;
  // For prefill + the success-screen comparison.
  currentWeightKg: number;
  weeklyBudgetArs: number;
  fitnessGoal: FitnessGoal | null;
  /** Most recent prior weight reading (kg). Drives the live diff under
   *  the weight input. Null when this is the user's first feedback. */
  previousWeightKg: number | null;
  /** Existing weight logs (oldest-first). Used to seed the success-screen
   *  chart even when the submit fails late so the user gets some signal. */
  initialWeightLogs: WeightPoint[];
}

type Step = 'adherence' | 'weight' | 'budget';

const ADHERENCE_OPTIONS: Array<{
  id: 'great' | 'meh' | 'rough';
  label: string;
  pct: number;
  finishedFood: boolean;
  hint: string;
}> = [
  { id: 'great', label: 'Bien', pct: 95, finishedFood: true, hint: 'Comí lo que tocaba.' },
  {
    id: 'meh',
    label: 'Más o menos',
    pct: 65,
    finishedFood: false,
    hint: 'Algunos días sí, otros no tanto.',
  },
  { id: 'rough', label: 'Mal', pct: 30, finishedFood: false, hint: 'No fue mi semana.' },
];

interface SubmitResponse {
  ok: true;
  next_list_id: string;
  next_week_start: string;
  feasible: boolean;
  recalibration: RecalibrationResult;
  targets: {
    weekly_calories: number;
    weekly_protein_g: number;
    weekly_carbs_g: number;
    weekly_fats_g: number;
    method: 'mifflin_st_jeor' | 'llm_adjusted';
  };
  recent_weight_logs: WeightPoint[];
  fitness_goal: FitnessGoal | null;
}

export function FeedbackFlow({
  weekStart,
  currentWeightKg,
  weeklyBudgetArs,
  fitnessGoal,
  previousWeightKg,
  initialWeightLogs,
}: FeedbackFlowProps) {
  const router = useRouter();
  const { show } = useToast();

  const [step, setStep] = useState<Step>('adherence');
  const [adherence, setAdherence] = useState<(typeof ADHERENCE_OPTIONS)[number] | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [weightKg, setWeightKg] = useState<number>(currentWeightKg);
  const [spentPct, setSpentPct] = useState<number>(100);
  const [adjustBudget, setAdjustBudget] = useState<boolean>(false);
  const [newBudget, setNewBudget] = useState<number>(weeklyBudgetArs);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SubmitResponse | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;

  function next() {
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx]);
  }

  function back() {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) setStep(STEPS[prevIdx]);
  }

  async function submit() {
    if (!adherence) return;
    setSubmitting(true);

    const payload = {
      week_start: weekStart,
      finished_food: adherence.finishedFood,
      adherence_pct: adherence.pct,
      weight_kg: weightKg,
      budget_actual: Math.round((spentPct / 100) * weeklyBudgetArs),
      new_weekly_budget_ars: adjustBudget && newBudget !== weeklyBudgetArs ? newBudget : null,
      notes: notes.trim() || null,
    };

    let response: Response;
    try {
      response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      setSubmitting(false);
      show({
        message:
          err instanceof Error
            ? `No pudimos enviar el feedback: ${err.message}`
            : 'No pudimos enviar el feedback. Probá de nuevo.',
        variant: 'error',
      });
      return;
    }

    setSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      show({
        message: body?.error ?? 'No pudimos cerrar la semana. Probá de nuevo.',
        variant: 'error',
      });
      return;
    }

    const data = (await response.json()) as SubmitResponse;
    setSuccess(data);
    show({ message: 'Semana cerrada. Tu nueva lista está lista.', variant: 'success' });
    // Refresh server data so the dashboard banner / list state updates
    // when the user navigates away from the success screen.
    router.refresh();
  }

  if (success) {
    return (
      <SuccessScreen
        result={success}
        previousWeightKg={previousWeightKg}
        fallbackChartPoints={initialWeightLogs}
        onGoToList={() => router.push(`/app/list`)}
        onGoToProfile={() => router.push('/app/profile')}
      />
    );
  }

  const weightDelta = previousWeightKg != null ? round1(weightKg - previousWeightKg) : null;
  const canAdvance = canAdvanceFromStep(step, { adherence, weightKg, weeklyBudgetArs, newBudget });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <ProgressBar current={stepIndex + 1} total={totalSteps} />

      {step === 'adherence' && (
        <CardShell
          title="¿Cómo te fue?"
          subtitle="Sin filtro — esto es para vos. Cuanto más honesto, mejor calibramos la próxima."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {ADHERENCE_OPTIONS.map((opt) => {
              const active = adherence?.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAdherence(opt)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center transition-all duration-300 ease-premium ${
                    active
                      ? 'border-accent-cyan/60 bg-accent-cyan/[0.10] shadow-glow-cyan'
                      : 'border-hairline bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]'
                  }`}
                  aria-pressed={active}
                >
                  <span className="font-display text-lg font-bold tracking-tight text-white">
                    {opt.label}
                  </span>
                  <span className="font-sans text-xs text-white/60">{opt.hint}</span>
                </button>
              );
            })}
          </div>

          {adherence && adherence.id !== 'great' && (
            <label className="mt-2 flex flex-col gap-2">
              <span className="font-display text-xs font-medium uppercase tracking-widest text-white/60">
                ¿Qué pasó? (opcional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Estuve de viaje, no me cuadraron las comidas, lo que sea."
                className="rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 font-sans text-sm text-white placeholder:text-white/35 shadow-inset-hairline backdrop-blur-glass transition-all duration-300 ease-premium focus:border-accent-cyan/70 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-accent-cyan/25"
              />
            </label>
          )}

          <Footer
            canAdvance={canAdvance}
            primaryLabel="Continuar →"
            onPrimary={next}
          />
        </CardShell>
      )}

      {step === 'weight' && (
        <CardShell
          title="¿Cuánto pesás hoy?"
          subtitle="La balanza miente día a día — semana a semana, no tanto."
        >
          <NumberInput
            label="Tu peso ahora"
            value={weightKg}
            onChange={setWeightKg}
            min={20}
            max={300}
            step={0.1}
            unit="kg"
          />

          {weightDelta != null && (
            <div className="rounded-xl border border-hairline bg-white/[0.03] px-4 py-3">
              <span className="font-sans text-sm text-white/75">
                {weightDelta === 0 ? (
                  'Igual que la semana pasada — peso estable.'
                ) : (
                  <>
                    <span
                      className={`tabular font-display text-lg font-bold ${
                        weightDelta > 0 ? 'text-warn-orange' : 'text-accent-mint'
                      }`}
                    >
                      {weightDelta > 0 ? '+' : ''}
                      {weightDelta} kg
                    </span>{' '}
                    <span className="text-white/55">vs hace una semana</span>
                  </>
                )}
              </span>
            </div>
          )}

          {weightDelta == null && (
            <div className="rounded-xl border border-hairline bg-white/[0.02] px-4 py-3">
              <span className="font-sans text-sm text-white/55">
                Primer registro — la próxima semana ya vamos a poder comparar.
              </span>
            </div>
          )}

          <Footer
            canAdvance={canAdvance}
            primaryLabel="Continuar →"
            onPrimary={next}
            onBack={back}
          />
        </CardShell>
      )}

      {step === 'budget' && (
        <CardShell
          title="¿Cuánto gastaste?"
          subtitle={`Tu presupuesto era ${formatARS(weeklyBudgetArs)}. Movelo si la realidad fue otra.`}
        >
          <Slider
            label="¿Qué % del presupuesto gastaste?"
            min={0}
            max={150}
            step={5}
            value={spentPct}
            onChange={setSpentPct}
            formatValue={(n) => `${n}%`}
          />
          <div className="rounded-xl border border-hairline bg-white/[0.03] px-4 py-3">
            <span className="tabular font-display text-base text-white/85">
              ≈{' '}
              <span className="font-semibold text-accent-mint">
                {formatARS(Math.round((spentPct / 100) * weeklyBudgetArs))}
              </span>
              <span className="ml-2 text-xs text-white/45">esta semana</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAdjustBudget((v) => !v)}
            className="self-start font-sans text-xs text-accent-cyan transition-opacity duration-300 ease-premium hover:opacity-80"
          >
            {adjustBudget
              ? '— Quiero dejar el presupuesto como estaba'
              : '+ Quiero cambiar el presupuesto para la próxima'}
          </button>

          {adjustBudget && (
            <div className="flex flex-col gap-2">
              <NumberInput
                label="Nuevo presupuesto semanal"
                value={newBudget}
                onChange={setNewBudget}
                min={1000}
                max={5_000_000}
                step={1000}
                unit="ARS"
              />
              <span className="font-sans text-xs text-white/45">
                Esto se usa desde la semana próxima en adelante.
              </span>
            </div>
          )}

          <Footer
            canAdvance={canAdvance}
            primaryLabel={submitting ? 'Cerrando semana…' : 'Cerrar semana'}
            onPrimary={() => void submit()}
            onBack={back}
            submitting={submitting}
          />
        </CardShell>
      )}
    </div>
  );
}

const STEPS: Step[] = ['adherence', 'weight', 'budget'];

interface CanAdvanceCtx {
  adherence: (typeof ADHERENCE_OPTIONS)[number] | null;
  weightKg: number;
  weeklyBudgetArs: number;
  newBudget: number;
}

function canAdvanceFromStep(step: Step, ctx: CanAdvanceCtx): boolean {
  switch (step) {
    case 'adherence':
      return ctx.adherence != null;
    case 'weight':
      return ctx.weightKg > 20 && ctx.weightKg < 300;
    case 'budget':
      return ctx.newBudget > 0;
  }
}

function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard
      variant="strong"
      className="flex flex-col gap-5 p-7 sm:p-8 animate-fade-up motion-reduce:animate-none"
    >
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="font-sans text-sm text-white/65">{subtitle}</p>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </GlassCard>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-[10px] uppercase tracking-widest text-white/45">
        Paso {current}{' '}
        <span className="text-white/25">de</span>
        {' '}
        {total}
      </span>
      <div
        className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-accent-gradient shadow-glow-cyan transition-[width] duration-500 ease-premium"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Footer({
  canAdvance,
  primaryLabel,
  onPrimary,
  onBack,
  submitting = false,
}: {
  canAdvance: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  onBack?: () => void;
  submitting?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <Button type="button" variant="ghost" size="md" onClick={onBack} disabled={submitting}>
          ← Atrás
        </Button>
      )}
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={!canAdvance || submitting}
        onClick={onPrimary}
        className="ml-auto"
      >
        {primaryLabel}
      </Button>
    </div>
  );
}

interface SuccessScreenProps {
  result: SubmitResponse;
  previousWeightKg: number | null;
  fallbackChartPoints: WeightPoint[];
  onGoToList: () => void;
  onGoToProfile: () => void;
}

function SuccessScreen({
  result,
  previousWeightKg,
  fallbackChartPoints,
  onGoToList,
  onGoToProfile,
}: SuccessScreenProps) {
  const points = result.recent_weight_logs.length > 0 ? result.recent_weight_logs : fallbackChartPoints;
  const { recalibration } = result;

  // The recalibration suggestion drives the headline copy + the accent
  // color on the message card.
  const headline = headlineForSuggestion(recalibration.suggestion, previousWeightKg != null);
  const accent = accentForSuggestion(recalibration.suggestion);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 animate-fade-up motion-reduce:animate-none">
      <GlassCard variant="strong" className="flex flex-col gap-4 p-8 sm:p-10">
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-display text-[10px] uppercase tracking-widest ${accent.badge}`}
        >
          Semana cerrada
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {headline}
        </h1>
        <p className="font-sans text-sm leading-relaxed text-white/85">{recalibration.message}</p>

        <div className="grid gap-3 rounded-2xl border border-hairline bg-white/[0.03] p-5 sm:grid-cols-3">
          <Stat
            label="Cambio de peso"
            value={`${recalibration.weight_delta_kg > 0 ? '+' : ''}${recalibration.weight_delta_kg} kg`}
            tone={
              recalibration.weight_delta_kg === 0
                ? 'neutral'
                : recalibration.on_track
                  ? 'good'
                  : 'warn'
            }
          />
          <Stat
            label="Nuevas calorías / sem"
            value={`${result.targets.weekly_calories.toLocaleString('es-AR')}`}
            tone="neutral"
          />
          <Stat
            label="Ajuste sugerido"
            value={
              recalibration.calorie_adjustment_pct === 0
                ? 'Mantener'
                : `${recalibration.calorie_adjustment_pct > 0 ? '+' : ''}${recalibration.calorie_adjustment_pct}%`
            }
            tone={recalibration.calorie_adjustment_pct === 0 ? 'good' : 'neutral'}
          />
        </div>
      </GlassCard>

      <ProgressChart points={points} goal={result.fitness_goal} title="Tu evolución" />

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" size="md" onClick={onGoToProfile}>
          Ver mi perfil
        </Button>
        <Button type="button" variant="primary" size="lg" onClick={onGoToList}>
          Ver mi nueva lista →
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'neutral';
}) {
  const text =
    tone === 'good' ? 'text-accent-mint' : tone === 'warn' ? 'text-warn-orange' : 'text-accent-cyan';
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </span>
      <span className={`tabular font-display text-2xl font-extrabold tracking-tightest ${text}`}>
        {value}
      </span>
    </div>
  );
}

function headlineForSuggestion(
  suggestion: RecalibrationResult['suggestion'],
  hadPriorWeight: boolean,
): string {
  if (!hadPriorWeight) return '¡Bienvenido al ciclo semanal!';
  switch (suggestion) {
    case 'on_track':
      return 'Vas perfecto. Seguimos.';
    case 'increase_intensity':
      return 'Apretamos el plan un toque.';
    case 'pull_back':
      return 'Aflojamos un poco — el cuerpo te lo agradece.';
    case 'pivot_to_recomp':
      return 'Estás creciendo rápido. Considerá pivotear.';
    case 'no_signal':
      return 'Listo, primer registro guardado.';
  }
}

function accentForSuggestion(suggestion: RecalibrationResult['suggestion']): {
  badge: string;
} {
  if (suggestion === 'on_track') {
    return { badge: 'border-accent-mint/40 bg-accent-mint/[0.06] text-accent-mint' };
  }
  if (suggestion === 'pull_back' || suggestion === 'pivot_to_recomp') {
    return { badge: 'border-warn-orange/40 bg-warn-orange/[0.06] text-warn-orange' };
  }
  return { badge: 'border-hairline bg-glass text-accent-cyan' };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
