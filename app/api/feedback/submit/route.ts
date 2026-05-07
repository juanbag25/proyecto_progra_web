import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAndPersistTargets, startOfIsoWeek } from '@/lib/nutrition/generate';
import {
  recalibrateProfile,
  type RecalibrationResult,
} from '@/lib/nutrition/recalibration';
import type { FitnessGoal } from '@/lib/nutrition/tdee';
import { generateAndPersistShoppingList } from '@/lib/optimizer/generate';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Calls the LLM for nutrition targets + runs the optimizer in sequence —
// 30s buys headroom on Vercel hobby (default 10s would be tight).
export const maxDuration = 30;

/**
 * POST /api/feedback/submit
 *
 * Closes the weekly loop:
 *   1. Persist the feedback (weight_logs + weekly_feedback rows).
 *   2. Update users_profile.weight_kg + (optionally) weekly_budget_ars so
 *      next-week generation starts from the new baseline.
 *   3. Compute recalibration (advisory — surfaces in the response so the UI
 *      can render "we're nudging your calories +5%" copy).
 *   4. Regenerate nutrition targets — picks up the new weight automatically.
 *   5. Regenerate the shopping list against those targets.
 *
 * Response includes the next list ID so the client can redirect straight
 * to it, plus the recalibration summary so the success screen has copy
 * to render.
 *
 * Security: every read/write uses the user's session cookie, so RLS keeps
 * cross-user access impossible.
 */

const submitSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  finished_food: z.boolean().nullable().optional(),
  // 0–100 — see migration 008 comment on why this is self-reported, not
  // derived from `shopping_list_items.checked`.
  adherence_pct: z.number().int().min(0).max(100),
  weight_kg: z.number().positive().max(500),
  budget_actual: z.number().nonnegative().max(10_000_000).nullable().optional(),
  // Optional — only present if the user adjusted next week's budget on the
  // budget card. When null/absent, we keep the existing budget.
  new_weekly_budget_ars: z.number().positive().max(10_000_000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

interface ProfileSlice {
  weight_kg: number | string | null;
  fitness_goal: FitnessGoal | null;
  weekly_budget_ars: number | string | null;
}

interface PreviousWeightRow {
  weight_kg: number | string;
  logged_at: string;
}

interface ListIdRow {
  id: string;
}

interface RecentWeightRow {
  weight_kg: number | string;
  logged_at: string;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = submitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const payload = parsed.data;

  // Today's ISO date — used as the unique key for weight_logs. If the user
  // somehow submits twice on the same day, the upsert below collapses them.
  const today = new Date().toISOString().slice(0, 10);

  // 1. Read profile (for current weight, goal, budget) + the most recent
  //    weight log strictly before today, so recalibration has a baseline.
  const [{ data: profileRow, error: profileErr }, { data: prevWeightRow, error: prevWeightErr }] =
    await Promise.all([
      supabase
        .from('users_profile')
        .select('weight_kg, fitness_goal, weekly_budget_ars')
        .eq('id', user.id)
        .maybeSingle<ProfileSlice>(),
      supabase
        .from('weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', user.id)
        .lt('logged_at', today)
        .order('logged_at', { ascending: false })
        .limit(1),
    ]);

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
  if (!profileRow) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (!profileRow.fitness_goal) {
    return NextResponse.json({ error: 'Profile missing fitness_goal' }, { status: 400 });
  }
  if (prevWeightErr) {
    return NextResponse.json({ error: prevWeightErr.message }, { status: 500 });
  }

  const previousWeight = (prevWeightRow as PreviousWeightRow[] | null)?.[0] ?? null;
  // Days elapsed clamped to >=1 to avoid divide-by-zero in the recalibrator
  // when somehow a same-day log sneaks in (the lt(today) filter should
  // prevent it, but defensiveness is cheap here).
  const daysElapsed = previousWeight
    ? Math.max(1, daysBetween(previousWeight.logged_at, today))
    : 7;

  // 2. Persist feedback rows + update profile in parallel — these are
  //    independent writes and any failure aborts the whole submit.
  const weightUpsert = supabase
    .from('weight_logs')
    .upsert(
      { user_id: user.id, weight_kg: payload.weight_kg, logged_at: today },
      { onConflict: 'user_id,logged_at' },
    );

  const feedbackUpsert = supabase
    .from('weekly_feedback')
    .upsert(
      {
        user_id: user.id,
        week_start: payload.week_start,
        finished_food: payload.finished_food ?? null,
        adherence_pct: payload.adherence_pct,
        budget_actual: payload.budget_actual ?? null,
        notes: payload.notes ?? null,
      },
      { onConflict: 'user_id,week_start' },
    );

  // Profile update — new weight is the load-bearing one, budget only if
  // the user changed it on the budget card.
  const profileUpdates: Record<string, number> = { weight_kg: payload.weight_kg };
  if (payload.new_weekly_budget_ars != null) {
    profileUpdates.weekly_budget_ars = payload.new_weekly_budget_ars;
  }
  const profileUpdate = supabase.from('users_profile').update(profileUpdates).eq('id', user.id);

  const [weightResult, feedbackResult, profileResult] = await Promise.all([
    weightUpsert,
    feedbackUpsert,
    profileUpdate,
  ]);

  if (weightResult.error) {
    return NextResponse.json({ error: weightResult.error.message }, { status: 500 });
  }
  if (feedbackResult.error) {
    return NextResponse.json({ error: feedbackResult.error.message }, { status: 500 });
  }
  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }

  // 3. Compute the recalibration (advisory). Pure function — no I/O.
  const recalibration: RecalibrationResult = recalibrateProfile({
    goal: profileRow.fitness_goal,
    previous_weight_kg: previousWeight ? Number(previousWeight.weight_kg) : null,
    current_weight_kg: payload.weight_kg,
    days_elapsed: daysElapsed,
  });

  // 4. Regenerate nutrition targets — for NEXT iso week, not the current
  //    one. Closing a week shouldn't overwrite the targets row that anchors
  //    the list the user just bought (and probably hasn't fully checked
  //    off in the UI). Picks up the new weight from users_profile so the
  //    next week's plan reflects the real progress.
  const nextWeekStart = startOfIsoWeek(addDays(new Date(), 7));
  const targetsResult = await generateAndPersistTargets(supabase, user.id, nextWeekStart);
  if (!targetsResult.ok) {
    return NextResponse.json({ error: targetsResult.error }, { status: targetsResult.status });
  }

  // 5. Regenerate the shopping list against the fresh targets. The helper
  //    reads the latest targets row (= next-week, just inserted) and
  //    creates the list under that week_start, so the row keyed on the
  //    week the user just closed stays intact — including the per-item
  //    `checked` state the history view reads.
  const listResult = await generateAndPersistShoppingList(supabase, user.id);
  if (!listResult.ok) {
    return NextResponse.json({ error: listResult.error }, { status: listResult.status });
  }

  // Resolve next_list_id + the recent weight logs in parallel — both are
  // small reads with no ordering dependency on each other.
  const [{ data: latestListRow }, { data: recentWeightRows }] = await Promise.all([
    supabase
      .from('shopping_lists')
      .select('id')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1),
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(12),
  ]);
  const latestId = (latestListRow as ListIdRow[] | null)?.[0]?.id;
  const nextListId = latestId ?? listResult.list.list_id;

  // Chart expects oldest-first; the query returned newest-first.
  const recentWeightLogs = ((recentWeightRows as RecentWeightRow[] | null) ?? [])
    .map((r) => ({ logged_at: r.logged_at, weight_kg: Number(r.weight_kg) }))
    .reverse();

  return NextResponse.json({
    ok: true,
    next_list_id: nextListId,
    next_week_start: listResult.list.week_start,
    feasible: listResult.list.feasible,
    recalibration,
    targets: {
      weekly_calories: targetsResult.targets.weekly_calories,
      weekly_protein_g: targetsResult.targets.weekly_protein_g,
      weekly_carbs_g: targetsResult.targets.weekly_carbs_g,
      weekly_fats_g: targetsResult.targets.weekly_fats_g,
      method: targetsResult.targets.method,
    },
    recent_weight_logs: recentWeightLogs,
    fitness_goal: profileRow.fitness_goal,
  });
}

/** Whole days between two ISO YYYY-MM-DD strings. UTC-anchored to avoid
 *  DST quirks shifting the count by ±1 around DST boundaries. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 7;
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/** UTC-anchored date arithmetic. Adding days via `setUTCDate` handles month
 *  + year rollover correctly and is immune to DST shifts. */
function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
