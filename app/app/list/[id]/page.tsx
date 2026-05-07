import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ListView } from '@/components/list/ListView';
import { loadListById } from '@/lib/list/load';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

interface ProfileRow {
  weekly_budget_ars: number | string | null;
}
interface TargetsRow {
  weekly_protein_g: number | string;
  weekly_carbs_g: number | string;
  weekly_fats_g: number | string;
  week_start: string;
}

/**
 * Read-only detail view for a past shopping list, opened from /app/history.
 *
 * Differences vs the current /app/list page:
 *   - `readOnly` mode → no toggle, no "Regenerar" button. Items keep their
 *     historical checked state as the record of what was bought that week.
 *   - Targets pulled by the list's own week_start (not "the latest"), so
 *     the rings reflect the goal that was active *that* week.
 *   - 404 on miss instead of falling through to <EmptyListState>.
 *
 * RLS guarantees ownership: shopping_lists.user_id = auth.uid() means an
 * id from another user returns no rows → notFound().
 */
export default async function PastShoppingListPage({ params }: PageProps) {
  const user = await requireUser();
  const supabase = createClient();

  const loaded = await loadListById(supabase, user.id, params.id);
  if (!loaded || loaded.items.length === 0) {
    notFound();
  }

  // Pull the targets row that was active when this list was created.
  // We key on week_start (not "latest") so a list from 6 weeks ago shows
  // the goal that mattered that week, not today's recalibrated targets.
  const [{ data: profile }, { data: targetsArr }] = await Promise.all([
    supabase
      .from('users_profile')
      .select('weekly_budget_ars')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('nutrition_targets')
      .select('weekly_protein_g, weekly_carbs_g, weekly_fats_g, week_start')
      .eq('user_id', user.id)
      .lte('week_start', loaded.metadata.week_start)
      .order('week_start', { ascending: false })
      .limit(1),
  ]);

  const targetsRow = (targetsArr as TargetsRow[] | null)?.[0];
  const targets = {
    protein_g: targetsRow ? Number(targetsRow.weekly_protein_g) : 0,
    carbs_g: targetsRow ? Number(targetsRow.weekly_carbs_g) : 0,
    fats_g: targetsRow ? Number(targetsRow.weekly_fats_g) : 0,
  };
  const budget =
    profile?.weekly_budget_ars != null ? Number(profile.weekly_budget_ars) : 0;

  return (
    <div className="flex flex-col gap-8 py-2">
      <BackToHistoryLink />
      <ListView
        items={loaded.items}
        targets={targets}
        budget={budget}
        metadata={loaded.metadata}
        readOnly
      />
    </div>
  );
}

function BackToHistoryLink() {
  return (
    <div className="print-hide">
      <Link href="/app/history">
        <Button variant="ghost" size="sm">
          ← Volver al historial
        </Button>
      </Link>
    </div>
  );
}

