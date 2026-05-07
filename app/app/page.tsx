import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { RegenerateButton } from '@/components/nutrition/RegenerateButton';
import {
  TargetsPanel,
  type NutritionTargetsView,
} from '@/components/nutrition/TargetsPanel';
import type { Micros } from '@/lib/nutrition/llm-prompt';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  onboarding_completed: boolean | null;
}

interface TargetsRow {
  week_start: string;
  weekly_calories: number | string;
  weekly_protein_g: number | string;
  weekly_carbs_g: number | string;
  weekly_fats_g: number | string;
  weekly_fiber_g: number | string | null;
  micros_json: Micros | null;
  method: 'mifflin_st_jeor' | 'llm_adjusted';
  llm_explanation: string | null;
}

export default async function AppHomePage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('users_profile')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (!profile?.onboarding_completed) {
    return <OnboardingPrompt />;
  }

  const { data: targetsRow } = await supabase
    .from('nutrition_targets')
    .select(
      'week_start, weekly_calories, weekly_protein_g, weekly_carbs_g, weekly_fats_g, weekly_fiber_g, micros_json, method, llm_explanation',
    )
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle<TargetsRow>();

  if (!targetsRow) {
    return <NoTargetsYet />;
  }

  const view: NutritionTargetsView = {
    week_start: targetsRow.week_start,
    weekly_calories: Number(targetsRow.weekly_calories),
    weekly_protein_g: Number(targetsRow.weekly_protein_g),
    weekly_carbs_g: Number(targetsRow.weekly_carbs_g),
    weekly_fats_g: Number(targetsRow.weekly_fats_g),
    weekly_fiber_g: targetsRow.weekly_fiber_g != null ? Number(targetsRow.weekly_fiber_g) : null,
    micros: targetsRow.micros_json,
    method: targetsRow.method,
    llm_explanation: targetsRow.llm_explanation,
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      <TargetsPanel targets={view} />
      <div className="flex items-center justify-end gap-3">
        <Link href="/app/profile">
          <Button variant="ghost" size="md">
            Ver mi perfil
          </Button>
        </Link>
        <RegenerateButton />
      </div>
    </div>
  );
}

function OnboardingPrompt() {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard variant="strong" className="flex flex-col items-center gap-6 p-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-glass px-4 py-1.5 font-display text-xs uppercase tracking-widest text-accent-cyan">
          Cuenta lista
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-white">
          Aún no tenés tu plan semanal.
        </h1>
        <p className="max-w-md font-sans text-base text-white/65">
          Pasá por el onboarding (cinco minutos) y te armamos la primera lista de compras esta misma
          semana — calibrada a tus macros, tu presupuesto y tu super.
        </p>
        <Link href="/onboarding">
          <Button variant="primary" size="lg">
            Empezar onboarding →
          </Button>
        </Link>
      </GlassCard>
    </div>
  );
}

function NoTargetsYet() {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard variant="strong" className="flex flex-col items-center gap-6 p-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-warn-coral/30 bg-warn-coral/[0.06] px-4 py-1.5 font-display text-xs uppercase tracking-widest text-warn-coral">
          Plan pendiente
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-white">
          Hay que generar tu primer plan.
        </h1>
        <p className="max-w-md font-sans text-base text-white/65">
          Tu perfil está completo pero el plan aún no se calculó (puede pasar si la IA falló al
          cerrar el onboarding). Tocá el botón y lo armamos en segundos.
        </p>
        <RegenerateButton variant="primary" firstRun />
      </GlassCard>
    </div>
  );
}
