import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressChart, type WeightPoint } from '@/components/feedback/ProgressChart';
import type { FitnessGoal } from '@/lib/nutrition/tdee';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: 'Hipertrofia',
  fat_loss: 'Pérdida de grasa',
  recomp: 'Recomposición',
  strength: 'Fuerza',
  maintenance: 'Mantenimiento',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentario',
  light: 'Liviano',
  moderate: 'Moderado',
  active: 'Activo',
  athlete: 'Atleta',
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
};

const formatARS = (n: number) => `$${n.toLocaleString('es-AR')}`;
const join = (arr: string[] | null | undefined) => (arr && arr.length > 0 ? arr.join(' · ') : '—');

interface ProfileRow {
  age: number | null;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  gender: string | null;
  activity_level: string | null;
  exercise_type: string[] | null;
  fitness_goal: FitnessGoal | null;
  preferred_foods: string[] | null;
  disliked_foods: string[] | null;
  allergies: string[] | null;
  dietary_restrictions: string[] | null;
  country: string | null;
  region: string | null;
  weekly_budget_ars: number | string | null;
  onboarding_completed: boolean | null;
}

interface WeightLogRow {
  weight_kg: number | string;
  logged_at: string;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="font-display text-xs uppercase tracking-widest text-white/50 sm:w-32">
        {label}
      </span>
      <span className="font-sans text-sm text-white/85">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard variant="default" className="flex flex-col gap-4 p-6">
      <h2 className="font-display text-base font-semibold uppercase tracking-widest text-white/65">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </GlassCard>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = createClient();

  // Profile + the last 12 weight logs in parallel — both reads are
  // independent and cheap.
  const [{ data: profile }, { data: weightRows }] = await Promise.all([
    supabase
      .from('users_profile')
      .select(
        'age, weight_kg, height_cm, gender, activity_level, exercise_type, fitness_goal, preferred_foods, disliked_foods, allergies, dietary_restrictions, country, region, weekly_budget_ars, onboarding_completed',
      )
      .eq('id', user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(12),
  ]);

  const onboardingDone = profile?.onboarding_completed ?? false;

  // Chart wants oldest-first; the query returned newest-first.
  const weightLogs: WeightPoint[] = ((weightRows as WeightLogRow[] | null) ?? [])
    .map((r) => ({ logged_at: r.logged_at, weight_kg: Number(r.weight_kg) }))
    .reverse();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Tu perfil
          </h1>
          <p className="font-sans text-sm text-white/55">{user.email}</p>
        </div>
        {onboardingDone ? (
          <Link href="/onboarding?edit=1">
            <Button variant="outline" size="md">
              Editar perfil
            </Button>
          </Link>
        ) : (
          <Link href="/onboarding">
            <Button variant="primary" size="md">
              Completar onboarding →
            </Button>
          </Link>
        )}
      </div>

      {!onboardingDone && (
        <GlassCard
          variant="strong"
          className="border border-warn-coral/30 bg-warn-coral/[0.04] p-5"
        >
          <p className="font-sans text-sm text-white/85">
            Tu onboarding está en pausa. Completalo para empezar a generar listas semanales.
          </p>
        </GlassCard>
      )}

      {onboardingDone && (
        <ProgressChart points={weightLogs} goal={profile?.fitness_goal ?? null} />
      )}

      <Section title="Biometría">
        <Row label="Edad">{profile?.age ?? '—'} años</Row>
        <Row label="Peso">{profile?.weight_kg ? `${profile.weight_kg} kg` : '—'}</Row>
        <Row label="Altura">{profile?.height_cm ? `${profile.height_cm} cm` : '—'}</Row>
        <Row label="Género">
          {profile?.gender ? (GENDER_LABELS[profile.gender] ?? profile.gender) : '—'}
        </Row>
      </Section>

      <Section title="Actividad">
        <Row label="Nivel">
          {profile?.activity_level
            ? (ACTIVITY_LABELS[profile.activity_level] ?? profile.activity_level)
            : '—'}
        </Row>
        <Row label="Ejercicios">{join(profile?.exercise_type)}</Row>
      </Section>

      <Section title="Objetivo">
        <Row label="Meta">
          <span className="font-display text-base font-semibold tracking-tight text-accent-cyan">
            {profile?.fitness_goal
              ? (GOAL_LABELS[profile.fitness_goal] ?? profile.fitness_goal)
              : '—'}
          </span>
        </Row>
      </Section>

      <Section title="Preferencias">
        <Row label="Te gusta">{join(profile?.preferred_foods)}</Row>
        <Row label="No te gusta">{join(profile?.disliked_foods)}</Row>
      </Section>

      <Section title="Restricciones">
        <Row label="Alergias">{join(profile?.allergies)}</Row>
        <Row label="Dietas">{join(profile?.dietary_restrictions)}</Row>
      </Section>

      <Section title="Ubicación">
        <Row label="Zona">
          {profile?.region || profile?.country
            ? `${profile?.region ?? '—'}, ${profile?.country ?? '—'}`
            : '—'}
        </Row>
      </Section>

      <Section title="Presupuesto">
        <Row label="Semanal">
          <span className="tabular font-display text-2xl font-bold text-accent-mint">
            {profile?.weekly_budget_ars ? formatARS(Number(profile.weekly_budget_ars)) : '—'}
          </span>
        </Row>
      </Section>
    </div>
  );
}
