import { NextResponse } from 'next/server';
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
import type { OptimizerProfile } from '@/lib/optimizer/types';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Optimizer is fast (<200ms typically), but loading 1k+ candidates over the
// network adds variance. 30s gives plenty of headroom on Vercel hobby.
export const maxDuration = 30;

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

/**
 * Country → product-region mapping. The `region` column on `products` is
 * a country-level code (the scraper writes 'AR' for everything from the
 * Argentine VTEX storefronts), NOT the user's province. The province in
 * `users_profile.region` is captured for future UX (nearby chains, regional
 * pricing) but doesn't filter the catalog today. When we onboard a new
 * country, add an entry here AND wire its scrapers to write the matching
 * region code.
 */
const PRODUCT_REGION_BY_COUNTRY: Record<string, string> = {
  Argentina: 'AR',
  argentina: 'AR',
};
const DEFAULT_PRODUCT_REGION = 'AR';

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

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load profile + latest targets in parallel — they're independent reads.
  const [{ data: profileRow, error: profileErr }, { data: targetsArr, error: targetsErr }] =
    await Promise.all([
      supabase
        .from('users_profile')
        .select(
          'age, weight_kg, height_cm, gender, activity_level, fitness_goal, country, region, weekly_budget_ars, allergies, dietary_restrictions, preferred_foods, disliked_foods, onboarding_completed',
        )
        .eq('id', user.id)
        .limit(1),
      // Avoiding `.maybeSingle()` chained after `.order().limit(1)` — known
      // bug in supabase-js@2.105 (see app/dev/products/page.tsx for context).
      supabase
        .from('nutrition_targets')
        .select('week_start, weekly_calories, weekly_protein_g, weekly_carbs_g, weekly_fats_g, weekly_fiber_g, method')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1),
    ]);

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }
  const profile = (profileRow as ProfileRow[] | null)?.[0];
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!profile.onboarding_completed) {
    return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 400 });
  }
  if (profile.weekly_budget_ars == null) {
    return NextResponse.json({ error: 'Profile missing weekly budget' }, { status: 400 });
  }
  // Resolve the catalog region from the user's country. Province in
  // `profile.region` (e.g. "Buenos Aires") is for future regional UX, NOT
  // a key into the products table. See PRODUCT_REGION_BY_COUNTRY above.
  const productRegion = profile.country
    ? PRODUCT_REGION_BY_COUNTRY[profile.country] ?? DEFAULT_PRODUCT_REGION
    : DEFAULT_PRODUCT_REGION;

  if (targetsErr) {
    return NextResponse.json({ error: targetsErr.message }, { status: 500 });
  }
  const targetsRow = (targetsArr as TargetsRow[] | null)?.[0];
  if (!targetsRow) {
    return NextResponse.json(
      { error: 'No nutrition targets yet — run /api/nutrition/targets first' },
      { status: 400 },
    );
  }

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

  // Both products + foods are SELECT-able by any authenticated user, so the
  // session-cookie client is fine here — no admin client needed.
  const allCandidates = await loadCandidates(supabase, productRegion);
  const filtered = filterCandidates(allCandidates, optimizerProfile);
  const result = buildShoppingList(optimizerProfile, targets, filtered);

  // Diagnostic counters in the response — when the result is infeasible the
  // UI / debugger gets to see whether the empty list came from filtering or
  // from an empty catalog.
  const counts = {
    candidates_loaded: allCandidates.length,
    candidates_after_filter: filtered.length,
  };

  // Align the persisted week_start with the targets row (NOT today's ISO
  // week) so a user that regenerates the list mid-week keeps it tied to
  // the same weekly nutrition baseline. If the user has somehow drifted
  // weeks (last targets are old), fall through to today's iso week.
  const week_start = targetsRow.week_start ?? startOfIsoWeek();

  const { data: headerInsert, error: headerErr } = await supabase
    .from('shopping_lists')
    .upsert(
      {
        user_id: user.id,
        week_start,
        summary_json: result.summary,
        feasible: result.feasible,
        feasibility_message: result.feasibility_message,
      },
      { onConflict: 'user_id,week_start' },
    )
    .select('id')
    .limit(1);

  if (headerErr) {
    return NextResponse.json({ error: headerErr.message }, { status: 500 });
  }
  const header = (headerInsert as ShoppingListHeader[] | null)?.[0];
  if (!header) {
    return NextResponse.json({ error: 'Failed to persist shopping list' }, { status: 500 });
  }

  // Replace items wholesale — simpler than diffing, and the UI's checked
  // state lives on items so a regen genuinely resets the week.
  const { error: deleteErr } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('list_id', header.id);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  if (result.items.length > 0) {
    const itemRows = result.items.map((item, idx) => ({
      list_id: header.id,
      product_id: item.product_id,
      qty_g: item.qty_g,
      cost: item.cost,
      position: idx,
    }));
    const { error: insertErr } = await supabase.from('shopping_list_items').insert(itemRows);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    list_id: header.id,
    week_start,
    feasible: result.feasible,
    feasibility_message: result.feasibility_message,
    summary: result.summary,
    items_count: result.items.length,
    counts,
  });
}
