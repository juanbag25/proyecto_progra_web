import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfIsoWeek } from '@/lib/nutrition/generate';
import type {
  ActivityLevel,
  FitnessGoal,
  Gender,
  WeeklyTargets,
} from '@/lib/nutrition/tdee';
import { buildShoppingList } from '@/lib/optimizer/build';
import { filterCandidates } from '@/lib/optimizer/filter';
import { loadCandidates } from '@/lib/optimizer/loadCandidates';
import { loadRotationPenalty } from '@/lib/optimizer/rotation';
import type { OptimizerProfile, ShoppingListSummary } from '@/lib/optimizer/types';

/**
 * Single source of truth for "given this user's profile + targets, build and
 * persist a weekly shopping list". Used by:
 *
 *   - POST /api/shopping-list/generate (explicit trigger from the UI)
 *   - POST /api/feedback/submit        (auto-trigger after weekly feedback)
 *
 * Pulling this out of the route handler avoids the alternative — the feedback
 * endpoint fetching back into its own server with the user's cookie — which
 * is brittle and adds a network hop for no benefit.
 *
 * Behavior mirrors the original route exactly:
 *   1. Read profile + latest nutrition_targets row in parallel.
 *   2. Validate onboarding + budget + targets are present.
 *   3. Run the optimizer (load → filter → build).
 *   4. Upsert the shopping_lists header keyed on (user_id, week_start).
 *   5. Replace items wholesale (delete + insert) — checked state lives on
 *      the items so a regen genuinely resets the week.
 *
 * Returns a discriminated union: callers branch on `ok` and surface
 * `status` + `error` to the user.
 */

interface ProfileRow {
  age: number | null;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  gender: Gender | null;
  activity_level: ActivityLevel | null;
  fitness_goal: FitnessGoal | null;
  country: string | null;
  region: string | null;
  weekly_budget_ars: number | string | null;
  allergies: string[] | null;
  dietary_restrictions: string[] | null;
  preferred_foods: string[] | null;
  disliked_foods: string[] | null;
  onboarding_completed: boolean | null;
}

interface TargetsRow {
  week_start: string;
  weekly_calories: number | string;
  weekly_protein_g: number | string;
  weekly_carbs_g: number | string;
  weekly_fats_g: number | string;
  weekly_fiber_g: number | string | null;
  method: 'mifflin_st_jeor' | 'llm_adjusted';
}

interface ShoppingListHeader {
  id: string;
}

interface ExistingItemRow {
  product_id: string;
  checked: boolean;
}

const PRODUCT_REGION_BY_COUNTRY: Record<string, string> = {
  Argentina: 'AR',
  argentina: 'AR',
};
const DEFAULT_PRODUCT_REGION = 'AR';

export interface GeneratedShoppingList {
  list_id: string;
  week_start: string;
  feasible: boolean;
  feasibility_message: string | null;
  summary: ShoppingListSummary;
  items_count: number;
  counts: {
    candidates_loaded: number;
    candidates_after_filter: number;
  };
}

export type GenerateShoppingListResult =
  | { ok: true; list: GeneratedShoppingList }
  | { ok: false; status: number; error: string };

export async function generateAndPersistShoppingList(
  supabase: SupabaseClient,
  userId: string,
): Promise<GenerateShoppingListResult> {
  const [{ data: profileRow, error: profileErr }, { data: targetsArr, error: targetsErr }] =
    await Promise.all([
      supabase
        .from('users_profile')
        .select(
          'age, weight_kg, height_cm, gender, activity_level, fitness_goal, country, region, weekly_budget_ars, allergies, dietary_restrictions, preferred_foods, disliked_foods, onboarding_completed',
        )
        .eq('id', userId)
        .limit(1),
      // Avoiding `.maybeSingle()` chained after `.order().limit(1)` — known
      // bug in supabase-js@2.105 (see app/dev/products/page.tsx for context).
      supabase
        .from('nutrition_targets')
        .select(
          'week_start, weekly_calories, weekly_protein_g, weekly_carbs_g, weekly_fats_g, weekly_fiber_g, method',
        )
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(1),
    ]);

  if (profileErr) return { ok: false, status: 500, error: profileErr.message };
  const profile = (profileRow as ProfileRow[] | null)?.[0];
  if (!profile) return { ok: false, status: 404, error: 'Profile not found' };
  if (!profile.onboarding_completed) {
    return { ok: false, status: 400, error: 'Onboarding incomplete' };
  }
  if (profile.weekly_budget_ars == null) {
    return { ok: false, status: 400, error: 'Profile missing weekly budget' };
  }

  if (targetsErr) return { ok: false, status: 500, error: targetsErr.message };
  const targetsRow = (targetsArr as TargetsRow[] | null)?.[0];
  if (!targetsRow) {
    return {
      ok: false,
      status: 400,
      error: 'No nutrition targets yet — run /api/nutrition/targets first',
    };
  }

  const productRegion = profile.country
    ? (PRODUCT_REGION_BY_COUNTRY[profile.country] ?? DEFAULT_PRODUCT_REGION)
    : DEFAULT_PRODUCT_REGION;

  const targets: WeeklyTargets = {
    weekly_calories: Number(targetsRow.weekly_calories),
    weekly_protein_g: Number(targetsRow.weekly_protein_g),
    weekly_carbs_g: Number(targetsRow.weekly_carbs_g),
    weekly_fats_g: Number(targetsRow.weekly_fats_g),
    weekly_fiber_g: targetsRow.weekly_fiber_g != null ? Number(targetsRow.weekly_fiber_g) : 0,
    daily_calories: Math.round(Number(targetsRow.weekly_calories) / 7),
    method: targetsRow.method,
    calculated_at: targetsRow.week_start,
  };

  const optimizerProfile: OptimizerProfile = {
    weekly_budget_ars: Number(profile.weekly_budget_ars),
    allergies: profile.allergies,
    dietary_restrictions: profile.dietary_restrictions,
    preferred_foods: profile.preferred_foods,
    disliked_foods: profile.disliked_foods,
    fitness_goal: profile.fitness_goal,
  };

  // Align persisted week_start with the targets row so a regen mid-week
  // keeps the list tied to the same weekly nutrition baseline. Computed
  // before the optimizer runs because the rotation helper needs to know
  // which week to EXCLUDE when looking back at past picks.
  const week_start = targetsRow.week_start ?? startOfIsoWeek();

  // Cross-week variety inputs:
  //   - rotationPenalty: which foods we picked in the last ~2 weeks, so
  //     the greedy can suppress them in favor of something fresher.
  //   - seed: per-call salt for ±5% jitter — same iso week, different
  //     timestamp, so two regens of the same week land on different
  //     SKUs even when nothing else changed.
  // The rotation query is independent of loadCandidates and runs in
  // parallel to keep the total wall-time the same.
  const [allCandidates, rotationPenalty] = await Promise.all([
    loadCandidates(supabase, productRegion),
    loadRotationPenalty(supabase, userId, week_start),
  ]);
  const filtered = filterCandidates(allCandidates, optimizerProfile);
  const result = buildShoppingList(optimizerProfile, targets, filtered, {
    rotationPenalty,
    seed: `${week_start}:${Date.now()}`,
  });

  const { data: headerInsert, error: headerErr } = await supabase
    .from('shopping_lists')
    .upsert(
      {
        user_id: userId,
        week_start,
        summary_json: result.summary,
        feasible: result.feasible,
        feasibility_message: result.feasibility_message,
      },
      { onConflict: 'user_id,week_start' },
    )
    .select('id')
    .limit(1);

  if (headerErr) return { ok: false, status: 500, error: headerErr.message };
  const header = (headerInsert as ShoppingListHeader[] | null)?.[0];
  if (!header) {
    return { ok: false, status: 500, error: 'Failed to persist shopping list' };
  }

  // Replace items wholesale — simpler than diffing the qty/cost/position
  // changes — but PRESERVE the `checked` state for any product that
  // survives the regen. Without this, clicking "Regenerar" mid-week wiped
  // every check the user already made; afterwards `/app/history` showed
  // 0% adherence for every list because every regen reset the row.
  //
  // Snapshot the existing rows BEFORE the delete so the new inserts can
  // carry forward `checked = true` on any product_id that's still in the
  // new list. Products that were dropped by the optimizer simply lose
  // their state (which is fine — they're no longer in the list at all).
  const { data: existingItemsRaw, error: existingErr } = await supabase
    .from('shopping_list_items')
    .select('product_id, checked')
    .eq('list_id', header.id);
  if (existingErr) return { ok: false, status: 500, error: existingErr.message };

  const previouslyChecked = new Set(
    ((existingItemsRaw as ExistingItemRow[] | null) ?? [])
      .filter((r) => r.checked)
      .map((r) => r.product_id),
  );

  const { error: deleteErr } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('list_id', header.id);
  if (deleteErr) return { ok: false, status: 500, error: deleteErr.message };

  if (result.items.length > 0) {
    const itemRows = result.items.map((item, idx) => ({
      list_id: header.id,
      product_id: item.product_id,
      qty_g: item.qty_g,
      cost: item.cost,
      position: idx,
      checked: previouslyChecked.has(item.product_id),
    }));
    const { error: insertErr } = await supabase.from('shopping_list_items').insert(itemRows);
    if (insertErr) return { ok: false, status: 500, error: insertErr.message };
  }

  return {
    ok: true,
    list: {
      list_id: header.id,
      week_start,
      feasible: result.feasible,
      feasibility_message: result.feasibility_message,
      summary: result.summary,
      items_count: result.items.length,
      counts: {
        candidates_loaded: allCandidates.length,
        candidates_after_filter: filtered.length,
      },
    },
  };
}
