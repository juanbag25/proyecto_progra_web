import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { callLLMJson } from '@/lib/llm/client';
import {
  buildNutritionUserPrompt,
  NUTRITIONIST_SYSTEM_PROMPT,
  nutritionLLMResponseSchema,
  nutritionResponseSchema,
  type Micros,
} from './llm-prompt';
import {
  calculateWeeklyTargets,
  type ActivityLevel,
  type FitnessGoal,
  type Gender,
} from './tdee';

/**
 * Single source of truth for generating + persisting weekly nutrition
 * targets. Called by both `/api/nutrition/targets` (explicit POST) and
 * `/api/onboarding/complete` (auto-trigger after the interview).
 *
 * Behavior:
 *   1. Read profile, validate required fields are present.
 *   2. Compute deterministic baseline via Mifflin-St Jeor.
 *   3. Try to enrich with the LLM (3 retries with backoff inside callLLMJson).
 *   4. On any LLM failure, fall back to baseline numbers + null micros.
 *   5. Upsert into `nutrition_targets` keyed on (user_id, week_start).
 */

const REQUIRED_FIELDS = [
  'age',
  'weight_kg',
  'height_cm',
  'gender',
  'activity_level',
  'fitness_goal',
] as const;

interface ProfileRow {
  age: number | null;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  gender: Gender | null;
  activity_level: ActivityLevel | null;
  fitness_goal: FitnessGoal | null;
  allergies: string[] | null;
  dietary_restrictions: string[] | null;
  preferred_foods: string[] | null;
  disliked_foods: string[] | null;
}

export interface GeneratedTargets {
  week_start: string;
  weekly_calories: number;
  weekly_protein_g: number;
  weekly_carbs_g: number;
  weekly_fats_g: number;
  weekly_fiber_g: number;
  micros: Micros | null;
  method: 'mifflin_st_jeor' | 'llm_adjusted';
  explanation: string | null;
  baseline: {
    daily_calories: number;
    method: 'mifflin_st_jeor' | 'llm_adjusted';
  };
}

export type GenerateResult =
  | { ok: true; targets: GeneratedTargets }
  | { ok: false; status: number; error: string; missing?: readonly string[] };

export async function generateAndPersistTargets(
  supabase: SupabaseClient,
  userId: string,
  /** Optional override for the week the targets row should anchor to. Used
   *  by the feedback flow to write next-week's targets without overwriting
   *  the row for the week that just closed. Defaults to the current ISO
   *  week (Monday) when omitted. */
  weekStart?: string,
): Promise<GenerateResult> {
  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select(
      'age, weight_kg, height_cm, gender, activity_level, fitness_goal, allergies, dietary_restrictions, preferred_foods, disliked_foods',
    )
    .eq('id', userId)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return { ok: false, status: 500, error: profileError.message };
  }
  if (!profile) {
    return { ok: false, status: 404, error: 'Profile not found' };
  }

  const missing = REQUIRED_FIELDS.filter((f) => profile[f] == null);
  if (missing.length > 0) {
    return { ok: false, status: 400, error: 'Profile incomplete', missing };
  }

  // Numeric columns come back as `string` from PostgREST when they exceed
  // 32-bit safe integers, so coerce explicitly.
  const inputs = {
    age: profile.age!,
    weight_kg: Number(profile.weight_kg),
    height_cm: Number(profile.height_cm),
    gender: profile.gender!,
    activity_level: profile.activity_level!,
    fitness_goal: profile.fitness_goal!,
  };

  const baseline = calculateWeeklyTargets(inputs);

  let method: 'mifflin_st_jeor' | 'llm_adjusted' = 'mifflin_st_jeor';
  let explanation: string | null = null;
  let micros: Micros | null = null;
  let weekly_calories = baseline.weekly_calories;
  let weekly_protein_g = baseline.weekly_protein_g;
  let weekly_carbs_g = baseline.weekly_carbs_g;
  let weekly_fats_g = baseline.weekly_fats_g;
  let weekly_fiber_g = baseline.weekly_fiber_g;

  try {
    const llm = await callLLMJson({
      systemPrompt: NUTRITIONIST_SYSTEM_PROMPT,
      userPrompt: buildNutritionUserPrompt(
        {
          ...inputs,
          allergies: profile.allergies,
          dietary_restrictions: profile.dietary_restrictions,
          preferred_foods: profile.preferred_foods,
          disliked_foods: profile.disliked_foods,
        },
        baseline,
      ),
      zodSchema: nutritionLLMResponseSchema,
      responseSchema: nutritionResponseSchema,
    });
    method = 'llm_adjusted';
    explanation = llm.explanation;
    micros = llm.micros;
    weekly_calories = llm.weekly_calories;
    weekly_protein_g = llm.weekly_protein_g;
    weekly_carbs_g = llm.weekly_carbs_g;
    weekly_fats_g = llm.weekly_fats_g;
    weekly_fiber_g = llm.weekly_fiber_g;
  } catch (err) {
    // Don't fail the request — Mifflin-St Jeor numbers are still valid.
    // The `method` column makes this state queryable for ops/debugging.
    console.error('[nutrition/generate] LLM enrichment failed, using baseline:', err);
  }

  const week_start = weekStart ?? startOfIsoWeek();

  const { error: upsertError } = await supabase.from('nutrition_targets').upsert(
    {
      user_id: userId,
      week_start,
      weekly_calories,
      weekly_protein_g,
      weekly_carbs_g,
      weekly_fats_g,
      weekly_fiber_g,
      micros_json: micros,
      method,
      llm_explanation: explanation,
    },
    { onConflict: 'user_id,week_start' },
  );

  if (upsertError) {
    return { ok: false, status: 500, error: upsertError.message };
  }

  return {
    ok: true,
    targets: {
      week_start,
      weekly_calories,
      weekly_protein_g,
      weekly_carbs_g,
      weekly_fats_g,
      weekly_fiber_g,
      micros,
      method,
      explanation,
      baseline: {
        daily_calories: baseline.daily_calories,
        method: baseline.method,
      },
    },
  };
}

/**
 * ISO week start (Monday) in UTC, formatted YYYY-MM-DD. Stable within a
 * calendar week so re-calls upsert into the same row.
 */
export function startOfIsoWeek(now: Date = new Date()): string {
  const day = now.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset),
  );
  return monday.toISOString().slice(0, 10);
}
