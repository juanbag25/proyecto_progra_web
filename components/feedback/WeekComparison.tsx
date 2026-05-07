import { GlassCard } from '@/components/ui/GlassCard';
import { formatARS, formatDate } from '@/lib/format';

/**
 * Side-by-side comparison of two weeks: macros target, total cost, weight,
 * and self-reported adherence.
 *
 * Pure presentational component — the parent supplies normalized snapshots
 * for the previous week and the current week. We render arrows colored by
 * whether each delta moves *toward* the user's expectation (e.g. for
 * fat_loss, a weight drop is good and renders cyan; for muscle_gain, a
 * weight bump is good).
 *
 * `goal` is optional — when omitted, deltas are shown as neutral.
 */

import type { FitnessGoal } from '@/lib/nutrition/tdee';

export interface WeekSnapshot {
  week_start: string;
  weekly_protein_g: number;
  weekly_carbs_g: number;
  weekly_fats_g: number;
  /** Total ARS cost of the list (planned, not actual). */
  total_cost: number;
  /** Self-reported, 0–100. Null if no feedback was filed for this week. */
  adherence_pct: number | null;
  /** Mean weight reading captured during this week. Null when no log. */
  weight_kg: number | null;
}

interface WeekComparisonProps {
  previous: WeekSnapshot;
  current: WeekSnapshot;
  goal?: FitnessGoal | null;
}

type Direction = 'up' | 'down' | 'flat';
type Tone = 'good' | 'bad' | 'neutral';

export function WeekComparison({ previous, current, goal }: WeekComparisonProps) {
  return (
    <GlassCard variant="strong" className="flex flex-col gap-6 p-7">
      <header className="flex flex-col gap-1">
        <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-accent-cyan">
          Comparativa semanal
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight text-white">
          Semana pasada vs ésta
        </h2>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-4 sm:gap-x-6">
        {/* Header row — week labels above each column. */}
        <ColumnHead label="Semana del" date={previous.week_start} />
        <span aria-hidden />
        <ColumnHead label="Esta semana" date={current.week_start} />

        <Row
          label="Proteína"
          previous={`${formatN(previous.weekly_protein_g)} g`}
          current={`${formatN(current.weekly_protein_g)} g`}
          delta={current.weekly_protein_g - previous.weekly_protein_g}
          unit="g"
          // Higher protein is generally a positive signal across goals.
          tone={toneForDelta(current.weekly_protein_g - previous.weekly_protein_g, 'higher_is_better')}
        />
        <Row
          label="Carbos"
          previous={`${formatN(previous.weekly_carbs_g)} g`}
          current={`${formatN(current.weekly_carbs_g)} g`}
          delta={current.weekly_carbs_g - previous.weekly_carbs_g}
          unit="g"
          tone="neutral"
        />
        <Row
          label="Grasas"
          previous={`${formatN(previous.weekly_fats_g)} g`}
          current={`${formatN(current.weekly_fats_g)} g`}
          delta={current.weekly_fats_g - previous.weekly_fats_g}
          unit="g"
          tone="neutral"
        />
        <Row
          label="Costo lista"
          previous={formatARS(previous.total_cost)}
          current={formatARS(current.total_cost)}
          delta={current.total_cost - previous.total_cost}
          unit="ARS"
          // Lower is better for budget — a higher cost is worse.
          tone={toneForDelta(current.total_cost - previous.total_cost, 'lower_is_better')}
        />
        <Row
          label="Peso"
          previous={previous.weight_kg != null ? `${previous.weight_kg} kg` : '—'}
          current={current.weight_kg != null ? `${current.weight_kg} kg` : '—'}
          delta={
            previous.weight_kg != null && current.weight_kg != null
              ? current.weight_kg - previous.weight_kg
              : null
          }
          unit="kg"
          tone={
            previous.weight_kg == null || current.weight_kg == null
              ? 'neutral'
              : toneForWeight(current.weight_kg - previous.weight_kg, goal)
          }
          decimals={1}
        />
        <Row
          label="Adherencia"
          previous={previous.adherence_pct != null ? `${previous.adherence_pct}%` : '—'}
          current={current.adherence_pct != null ? `${current.adherence_pct}%` : '—'}
          delta={
            previous.adherence_pct != null && current.adherence_pct != null
              ? current.adherence_pct - previous.adherence_pct
              : null
          }
          unit="%"
          tone={toneForDelta(
            (current.adherence_pct ?? 0) - (previous.adherence_pct ?? 0),
            'higher_is_better',
          )}
        />
      </div>
    </GlassCard>
  );
}

function ColumnHead({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className="font-display text-sm font-semibold tracking-tight text-white/85">
        {formatDate(date)}
      </span>
    </div>
  );
}

interface RowProps {
  label: string;
  previous: string;
  current: string;
  /** Numeric delta; null when one side is missing. */
  delta: number | null;
  unit: string;
  tone: Tone;
  decimals?: number;
}

function Row({ label, previous, current, delta, unit, tone, decimals = 0 }: RowProps) {
  const direction = directionOf(delta);

  return (
    <>
      <div className="col-span-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-6">
        <Cell value={previous} align="left" />
        <Arrow
          direction={direction}
          tone={tone}
          delta={delta}
          unit={unit}
          decimals={decimals}
          srLabel={label}
        />
        <Cell value={current} align="right" emphasize />
      </div>
      <div className="col-span-3 -mt-3 flex items-center justify-center">
        <span className="font-display text-[10px] uppercase tracking-widest text-white/40">
          {label}
        </span>
      </div>
    </>
  );
}

function Cell({
  value,
  align,
  emphasize = false,
}: {
  value: string;
  align: 'left' | 'right';
  emphasize?: boolean;
}) {
  return (
    <span
      className={`tabular font-display ${
        emphasize ? 'text-base font-semibold text-white' : 'text-sm font-medium text-white/55'
      } ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {value}
    </span>
  );
}

function Arrow({
  direction,
  tone,
  delta,
  unit,
  decimals,
  srLabel,
}: {
  direction: Direction;
  tone: Tone;
  delta: number | null;
  unit: string;
  decimals: number;
  srLabel: string;
}) {
  const toneClass = TONE_CLASSES[tone];

  let glyph = '→';
  let descriptor = 'sin cambios';
  if (direction === 'up') {
    glyph = '↑';
    descriptor = 'subió';
  } else if (direction === 'down') {
    glyph = '↓';
    descriptor = 'bajó';
  }

  const deltaText =
    delta == null
      ? null
      : `${delta > 0 ? '+' : ''}${delta.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span aria-hidden className={`font-display text-lg font-bold ${toneClass}`}>
        {glyph}
      </span>
      {deltaText && (
        <span className={`tabular font-display text-[10px] ${toneClass} opacity-80`}>
          {deltaText}
        </span>
      )}
      <span className="sr-only">
        {srLabel} {descriptor} {deltaText ?? ''}
      </span>
    </div>
  );
}

const TONE_CLASSES: Record<Tone, string> = {
  good: 'text-accent-mint',
  bad: 'text-warn-coral',
  neutral: 'text-white/45',
};

function directionOf(delta: number | null): Direction {
  if (delta == null) return 'flat';
  if (delta > 0.05) return 'up';
  if (delta < -0.05) return 'down';
  return 'flat';
}

function toneForDelta(delta: number, mode: 'higher_is_better' | 'lower_is_better'): Tone {
  if (Math.abs(delta) < 0.05) return 'neutral';
  if (mode === 'higher_is_better') return delta > 0 ? 'good' : 'bad';
  return delta < 0 ? 'good' : 'bad';
}

/** Weight is goal-aware: gaining is good for muscle_gain, losing is good
 *  for fat_loss, anything else is neutral. */
function toneForWeight(delta: number, goal?: FitnessGoal | null): Tone {
  if (Math.abs(delta) < 0.05) return 'neutral';
  if (goal === 'fat_loss') return delta < 0 ? 'good' : 'bad';
  if (goal === 'muscle_gain' || goal === 'strength') return delta > 0 ? 'good' : 'bad';
  return 'neutral';
}

const formatN = (n: number) => Math.round(n).toLocaleString('es-AR');
