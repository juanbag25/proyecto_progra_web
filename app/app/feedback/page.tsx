import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { FeedbackFlow } from '@/components/feedback/FeedbackFlow';
import type { WeightPoint } from '@/components/feedback/ProgressChart';
import type { FitnessGoal } from '@/lib/nutrition/tdee';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  weight_kg: number | string | null;
  weekly_budget_ars: number | string | null;
  fitness_goal: FitnessGoal | null;
  onboarding_completed: boolean | null;
}

interface ListRow {
  id: string;
  week_start: string;
  created_at: string;
}

interface WeightLogRow {
  weight_kg: number | string;
  logged_at: string;
}

export default async function FeedbackPage() {
  const user = await requireUser();
  const supabase = createClient();

  // Profile + latest list + last 12 weight logs in parallel — none of them
  // depend on each other to load.
  const [{ data: profileRow }, { data: latestListRow }, { data: weightRows }] = await Promise.all([
    supabase
      .from('users_profile')
      .select('weight_kg, weekly_budget_ars, fitness_goal, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('shopping_lists')
      .select('id, week_start, created_at')
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

  if (!profileRow?.onboarding_completed) {
    return <PreFlightGate kind="onboarding" />;
  }
  if (profileRow.weight_kg == null || profileRow.weekly_budget_ars == null) {
    return <PreFlightGate kind="onboarding" />;
  }

  const list = (latestListRow as ListRow[] | null)?.[0];
  if (!list) {
    return <PreFlightGate kind="no-list" />;
  }

  // Weight logs come back newest-first; the chart wants oldest-first.
  const weightLogs: WeightPoint[] = ((weightRows as WeightLogRow[] | null) ?? [])
    .map((r) => ({ logged_at: r.logged_at, weight_kg: Number(r.weight_kg) }))
    .reverse();

  // Most recent prior log strictly before today — the live diff under the
  // weight input shows the delta vs this number.
  const today = new Date().toISOString().slice(0, 10);
  const previousLog = weightLogs.filter((p) => p.logged_at < today).pop();

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-1">
        <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-accent-cyan">
          Cierre semanal
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Cerrá la semana
        </h1>
        <p className="font-sans text-sm text-white/65">
          Tres datos rápidos y armamos la lista de la próxima — ya con tus números actualizados.
        </p>
      </header>

      <FeedbackFlow
        weekStart={list.week_start}
        currentWeightKg={Number(profileRow.weight_kg)}
        weeklyBudgetArs={Number(profileRow.weekly_budget_ars)}
        fitnessGoal={profileRow.fitness_goal}
        previousWeightKg={previousLog ? previousLog.weight_kg : null}
        initialWeightLogs={weightLogs}
      />
    </div>
  );
}

function PreFlightGate({ kind }: { kind: 'onboarding' | 'no-list' }) {
  if (kind === 'onboarding') {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <GlassCard variant="strong" className="flex flex-col items-center gap-6 p-12 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Aún no podés cerrar una semana.
          </h1>
          <p className="max-w-md font-sans text-base text-white/65">
            Te falta completar el perfil. Pasá por el onboarding y volvemos al cierre semanal cuando
            tengas tu primera lista.
          </p>
          <Link href="/onboarding">
            <Button variant="primary" size="lg">
              Ir al onboarding →
            </Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard variant="strong" className="flex flex-col items-center gap-6 p-12 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Todavía no tenés ninguna lista para cerrar.
        </h1>
        <p className="max-w-md font-sans text-base text-white/65">
          Generá tu primera lista de la semana y la próxima vez vamos a poder calibrar todo.
        </p>
        <Link href="/app/list">
          <Button variant="primary" size="lg">
            Ir a mi lista →
          </Button>
        </Link>
      </GlassCard>
    </div>
  );
}
