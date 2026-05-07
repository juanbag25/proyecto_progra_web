import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { FeedbackBanner } from '@/components/feedback/FeedbackBanner';
import { RegenerateButton } from '@/components/nutrition/RegenerateButton';
import {
  TargetsPanel,
  type NutritionTargetsView,
} from '@/components/nutrition/TargetsPanel';
import type { Micros } from '@/lib/nutrition/llm-prompt';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const FEEDBACK_DUE_DAYS = 7;

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

interface LatestListRow {
  week_start: string;
  created_at: string;
}

interface FeedbackRow {
  week_start: string;
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

  // Targets, latest list, and any existing feedback for that list's week —
  // all three are independent reads, so fetch in parallel.
  const [{ data: targetsRow }, { data: latestListArr }, { data: feedbackRows }] = await Promise.all(
    [
      supabase
        .from('nutrition_targets')
        .select(
          'week_start, weekly_calories, weekly_protein_g, weekly_carbs_g, weekly_fats_g, weekly_fiber_g, micros_json, method, llm_explanation',
        )
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle<TargetsRow>(),
      supabase
        .from('shopping_lists')
        .select('week_start, created_at')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1),
      supabase
        .from('weekly_feedback')
        .select('week_start')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(4),
    ],
  );

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

  // Banner condition: there's a list, it's at least 7 days old, AND no
  // feedback exists for that list's week_start.
  const latestList = (latestListArr as LatestListRow[] | null)?.[0] ?? null;
  const filedWeeks = new Set(
    ((feedbackRows as FeedbackRow[] | null) ?? []).map((r) => r.week_start),
  );
  const banner = computeBanner(latestList, filedWeeks);

  return (
    <div className="flex flex-col gap-6 py-6">
      {banner && (
        <FeedbackBanner
          weekStart={banner.weekStart}
          daysSinceGenerated={banner.daysSinceGenerated}
        />
      )}
      <TargetsPanel targets={view} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href="/app/profile">
          <Button variant="ghost" size="md">
            Ver mi perfil
          </Button>
        </Link>
        <RegenerateButton />
        <Link href="/app/list">
          <Button variant="primary" size="md">
            Mi lista de la semana →
          </Button>
        </Link>
      </div>
    </div>
  );
}

function computeBanner(
  list: LatestListRow | null,
  filedWeeks: Set<string>,
): { weekStart: string; daysSinceGenerated: number } | null {
  if (!list) return null;
  if (filedWeeks.has(list.week_start)) return null;
  const created = Date.parse(list.created_at);
  if (Number.isNaN(created)) return null;
  const days = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
  if (days < FEEDBACK_DUE_DAYS) return null;
  return { weekStart: list.week_start, daysSinceGenerated: days };
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
