import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyListState } from '@/components/list/EmptyListState';
import { ListView } from '@/components/list/ListView';
import { loadCurrentList } from '@/lib/list/load';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  onboarding_completed: boolean | null;
  weekly_budget_ars: number | string | null;
}
interface TargetsRow {
  weekly_protein_g: number | string;
  weekly_carbs_g: number | string;
  weekly_fats_g: number | string;
}

export default async function ShoppingListPage() {
  const user = await requireUser();
  const supabase = createClient();

  // Profile + latest targets + list — three independent reads, in parallel.
  let listError: string | null = null;
  const [
    { data: profile },
    { data: targetsArr },
    loaded,
  ] = await Promise.all([
    supabase
      .from('users_profile')
      .select('onboarding_completed, weekly_budget_ars')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('nutrition_targets')
      .select('weekly_protein_g, weekly_carbs_g, weekly_fats_g')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1),
    loadCurrentList(supabase, user.id).catch((e: unknown) => {
      listError = e instanceof Error ? e.message : 'Error desconocido';
      return null;
    }),
  ]);

  if (!profile?.onboarding_completed) {
    return <OnboardingGate />;
  }

  if (listError) {
    return <ErrorBox message={listError} />;
  }

  if (!loaded || loaded.items.length === 0) {
    return <EmptyListState />;
  }

  // Targets + budget — required for the dashboard rings. Defaults of 0
  // collapse the rings to 0% rather than crashing on missing data.
  const targetsRow = (targetsArr as TargetsRow[] | null)?.[0];
  const targets = {
    protein_g: targetsRow ? Number(targetsRow.weekly_protein_g) : 0,
    carbs_g: targetsRow ? Number(targetsRow.weekly_carbs_g) : 0,
    fats_g: targetsRow ? Number(targetsRow.weekly_fats_g) : 0,
  };
  const budget =
    profile.weekly_budget_ars != null ? Number(profile.weekly_budget_ars) : 0;

  return (
    <div className="flex flex-col gap-8 py-2">
      <ListView
        items={loaded.items}
        targets={targets}
        budget={budget}
        metadata={loaded.metadata}
      />
    </div>
  );
}

function OnboardingGate() {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard
        variant="strong"
        className="flex flex-col items-center gap-6 p-12 text-center"
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Aún no completaste tu perfil.
        </h1>
        <p className="max-w-md font-sans text-base text-white/65">
          Necesitamos los datos del onboarding para armar tu lista.
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

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard
        variant="strong"
        className="flex flex-col items-center gap-4 border-warn-coral/30 p-10 text-center"
      >
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          No pudimos leer tu lista.
        </h1>
        <p className="font-sans text-sm text-white/60">{message}</p>
      </GlassCard>
    </div>
  );
}
