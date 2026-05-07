/**
 * Weekly recalibration logic — Phase 8.
 *
 * Pure function: given the user's goal, last weight, current weight, and the
 * elapsed days between readings, decide:
 *
 *   - whether the user is on track for their goal
 *   - what calorie adjustment (as a percentage) we'd recommend going forward
 *   - a human-readable, motivating message in the FitList voice
 *
 * The function is advisory — it does NOT mutate the profile. The caller (the
 * /api/feedback/submit route) writes the new weight to `users_profile.weight_kg`
 * separately, which naturally re-derives TDEE on the next nutrition target
 * generation. The `calorie_adjustment_pct` returned here is exposed in the
 * response so the UI can show "we're nudging your calories +5% next week"
 * even though we don't yet have a column to persist that nudge across
 * regenerations (that would require a schema change — deferred).
 *
 * Reasoning behind the nudges (sport-nutrition consensus):
 *
 *   fat_loss
 *     - Expected: −0.5 to −1.0 kg/week (≈0.5–1% bodyweight).
 *     - Stalled (delta ≥ 0): deepen the deficit by 5%.
 *     - Crashing (delta ≤ −1.0/week): pull back by 5% — losing too fast
 *       eats lean mass and tanks adherence.
 *
 *   muscle_gain
 *     - Expected: +0.2 to +0.5 kg/week.
 *     - Stalled (delta ≤ 0): bump the surplus by 5%.
 *     - Overshooting (delta ≥ +0.6/week): we're past muscle and into fat —
 *       suggest pivoting to recomp instead of hard-cutting calories.
 *
 *   recomp / strength / maintenance
 *     - No structural calorie change. Big unexpected swings get flagged but
 *       the math stays unchanged — these goals tolerate more weight noise.
 */

import type { FitnessGoal } from './tdee';

export interface RecalibrationInput {
  goal: FitnessGoal;
  /** Most recent prior weight reading (kg). Null when this is the user's
   *  first feedback ever — recalibration short-circuits to "no signal yet". */
  previous_weight_kg: number | null;
  /** Weight the user just submitted (kg). */
  current_weight_kg: number;
  /** Days between the two readings. Used to normalize the delta to a
   *  per-week rate so we don't over-react to a bi-weekly check-in. Must be
   *  positive; callers default to 7 when the previous reading is null. */
  days_elapsed: number;
}

export type RecalibrationSuggestion =
  /** Goal arc looks healthy — no copy change implied. */
  | 'on_track'
  /** Goal needs a calorie-side nudge in the same direction. */
  | 'increase_intensity'
  /** Goal is overshooting — pull back a bit to protect lean mass. */
  | 'pull_back'
  /** Muscle_gain user gaining too fast — recomp is the better arc. */
  | 'pivot_to_recomp'
  /** Not enough signal yet (first reading, or null inputs). */
  | 'no_signal';

export interface RecalibrationResult {
  /** Raw kg delta (current − previous). Positive = gained, negative = lost. */
  weight_delta_kg: number;
  /** Delta normalized to kg/week, for messaging purposes. */
  weight_delta_per_week_kg: number;
  /** True if the user's trajectory matches their goal's expected direction
   *  within a reasonable band. */
  on_track: boolean;
  /** Recommended calorie change relative to current TDEE-derived target.
   *  +5 means "consume 5% more next week", −5 means "consume 5% less". 0
   *  means stay the course. */
  calorie_adjustment_pct: number;
  /** What the UI should communicate. */
  suggestion: RecalibrationSuggestion;
  /** Single-paragraph copy in the FitList voice — direct, motivating, no
   *  preachy "talk to your doctor" disclaimers (those live in static UI). */
  message: string;
}

const STALL_TOLERANCE_KG = 0.05; // weights wobble; treat ±50g as "no change"
const FAT_LOSS_FAST_KG_PER_WEEK = 1.0;
const MUSCLE_GAIN_FAST_KG_PER_WEEK = 0.6;
const NUDGE_PCT = 5;

export function recalibrateProfile(input: RecalibrationInput): RecalibrationResult {
  const { goal, previous_weight_kg, current_weight_kg, days_elapsed } = input;

  if (previous_weight_kg == null || days_elapsed <= 0) {
    return {
      weight_delta_kg: 0,
      weight_delta_per_week_kg: 0,
      on_track: true,
      calorie_adjustment_pct: 0,
      suggestion: 'no_signal',
      message:
        'Primera medición registrada. La próxima semana ya vamos a poder ajustar el plan según tu progreso real.',
    };
  }

  const delta = round1(current_weight_kg - previous_weight_kg);
  const ratePerWeek = round1((delta / days_elapsed) * 7);

  switch (goal) {
    case 'fat_loss':
      return forFatLoss(delta, ratePerWeek);
    case 'muscle_gain':
      return forMuscleGain(delta, ratePerWeek);
    case 'recomp':
      return forRecomp(delta, ratePerWeek);
    case 'strength':
      return forStrength(delta, ratePerWeek);
    case 'maintenance':
      return forMaintenance(delta, ratePerWeek);
  }
}

function forFatLoss(delta: number, ratePerWeek: number): RecalibrationResult {
  // Crashing — losing more than 1kg/week. Defend lean mass.
  if (ratePerWeek <= -FAT_LOSS_FAST_KG_PER_WEEK) {
    return {
      weight_delta_kg: delta,
      weight_delta_per_week_kg: ratePerWeek,
      on_track: false,
      calorie_adjustment_pct: +NUDGE_PCT,
      suggestion: 'pull_back',
      message: `Bajaste ${formatDelta(delta)} kg — está bajando muy rápido. Te subo las calorías un 5% para proteger músculo. La idea es bajar grasa, no quemarte.`,
    };
  }

  // On track — losing within healthy band (between −0.05 and −1.0 kg/week,
  // i.e. anywhere from gentle progress to the crash threshold).
  if (ratePerWeek <= -STALL_TOLERANCE_KG) {
    return {
      weight_delta_kg: delta,
      weight_delta_per_week_kg: ratePerWeek,
      on_track: true,
      calorie_adjustment_pct: 0,
      suggestion: 'on_track',
      message: `Bajaste ${formatDelta(Math.abs(delta))} kg. Vas perfecto — mismo plan otra semana más.`,
    };
  }

  // Stalled — delta too small or going the wrong way.
  return {
    weight_delta_kg: delta,
    weight_delta_per_week_kg: ratePerWeek,
    on_track: false,
    calorie_adjustment_pct: -NUDGE_PCT,
    suggestion: 'increase_intensity',
    message:
      delta >= 0
        ? `El peso no se movió esta semana. Te bajo las calorías un 5% — sin drama, así rompemos el plateau.`
        : `Bajaste poquito esta semana. Apretamos el déficit un 5% para que la próxima se note.`,
  };
}

function forMuscleGain(delta: number, ratePerWeek: number): RecalibrationResult {
  // Overshooting — gaining more than 0.6kg/week is mostly fat at this point.
  if (ratePerWeek >= MUSCLE_GAIN_FAST_KG_PER_WEEK) {
    return {
      weight_delta_kg: delta,
      weight_delta_per_week_kg: ratePerWeek,
      on_track: false,
      calorie_adjustment_pct: -NUDGE_PCT,
      suggestion: 'pivot_to_recomp',
      message: `Subiste ${formatDelta(delta)} kg — mucho ya. Si seguís a este ritmo es grasa, no músculo. Considerá pasar a recomp en tu perfil; mientras tanto te bajo las calorías un 5%.`,
    };
  }

  // On track — gaining within healthy band.
  if (ratePerWeek >= STALL_TOLERANCE_KG) {
    return {
      weight_delta_kg: delta,
      weight_delta_per_week_kg: ratePerWeek,
      on_track: true,
      calorie_adjustment_pct: 0,
      suggestion: 'on_track',
      message: `Subiste ${formatDelta(delta)} kg. Vas perfecto para hipertrofia — seguimos.`,
    };
  }

  // Stalled — not gaining, possibly losing.
  return {
    weight_delta_kg: delta,
    weight_delta_per_week_kg: ratePerWeek,
    on_track: false,
    calorie_adjustment_pct: +NUDGE_PCT,
    suggestion: 'increase_intensity',
    message:
      delta <= 0
        ? `El peso no se movió (o bajó algo). Te subo las calorías un 5% — necesitás más combustible para construir.`
        : `Subiste poquito esta semana. Subimos el superávit un 5% para que la próxima se note.`,
  };
}

function forRecomp(delta: number, ratePerWeek: number): RecalibrationResult {
  // Recomp expects the scale ~flat. Big swings either way deserve a flag,
  // but we don't change calories — adherence + training quality matter
  // more than calorie tweaking at maintenance.
  const big = Math.abs(ratePerWeek) >= 0.4;
  return {
    weight_delta_kg: delta,
    weight_delta_per_week_kg: ratePerWeek,
    on_track: !big,
    calorie_adjustment_pct: 0,
    suggestion: big ? 'pull_back' : 'on_track',
    message: big
      ? `El peso se movió ${formatDelta(delta)} kg — bastante para recomp. Revisá si la balanza siempre fue a la misma hora; si seguís así la próxima, ajustamos.`
      : `Peso estable, justo lo que recomp pide. Confiá en el espejo y en cómo levantás, no en la balanza.`,
  };
}

function forStrength(delta: number, ratePerWeek: number): RecalibrationResult {
  // Strength tolerates a slight surplus (0.05–0.2 kg/week). Big losses are
  // a problem (you can't add weight to the bar in a deficit).
  if (ratePerWeek <= -0.3) {
    return {
      weight_delta_kg: delta,
      weight_delta_per_week_kg: ratePerWeek,
      on_track: false,
      calorie_adjustment_pct: +NUDGE_PCT,
      suggestion: 'increase_intensity',
      message: `Bajaste ${formatDelta(Math.abs(delta))} kg — mucho para fuerza. Te subo las calorías un 5%; necesitás el combustible para que la barra siga subiendo.`,
    };
  }
  return {
    weight_delta_kg: delta,
    weight_delta_per_week_kg: ratePerWeek,
    on_track: true,
    calorie_adjustment_pct: 0,
    suggestion: 'on_track',
    message: `Peso ${delta === 0 ? 'estable' : `${formatDelta(delta)} kg`}. Para fuerza, lo importante son los kilos en la barra — el cuerpo se acomoda solo.`,
  };
}

function forMaintenance(delta: number, ratePerWeek: number): RecalibrationResult {
  const big = Math.abs(ratePerWeek) >= 0.5;
  return {
    weight_delta_kg: delta,
    weight_delta_per_week_kg: ratePerWeek,
    on_track: !big,
    calorie_adjustment_pct: 0,
    suggestion: big ? 'pull_back' : 'on_track',
    message: big
      ? `Te moviste ${formatDelta(delta)} kg — bastante para mantenimiento. Si la próxima semana repite, te recalibro las calorías.`
      : `Peso bajo control. Mantenimiento es el goal más fácil de sostener — seguís bien.`,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Always include the sign for non-zero deltas so "+0.4" reads as a gain
 *  and "−0.4" as a loss without needing a separate label. */
function formatDelta(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}
