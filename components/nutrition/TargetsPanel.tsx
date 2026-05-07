'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { RadialProgress } from '@/components/ui/RadialProgress';
import type { Micros } from '@/lib/nutrition/llm-prompt';

export interface NutritionTargetsView {
  week_start: string;
  weekly_calories: number;
  weekly_protein_g: number;
  weekly_carbs_g: number;
  weekly_fats_g: number;
  weekly_fiber_g: number | null;
  micros: Micros | null;
  method: 'mifflin_st_jeor' | 'llm_adjusted';
  llm_explanation: string | null;
}

interface TargetsPanelProps {
  targets: NutritionTargetsView;
}

type TabId = 'macros' | 'micros' | 'method';

const TABS: { id: TabId; label: string }[] = [
  { id: 'macros', label: 'Macros' },
  { id: 'micros', label: 'Micros' },
  { id: 'method', label: 'Cómo calculamos esto' },
];

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

const formatN = (n: number) => Math.round(n).toLocaleString('es-AR');

export function TargetsPanel({ targets }: TargetsPanelProps) {
  const [tab, setTab] = useState<TabId>('macros');

  return (
    <GlassCard variant="strong" className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-glass px-3 py-1 font-display text-[10px] uppercase tracking-widest text-accent-cyan">
          {targets.method === 'llm_adjusted' ? 'Plan calibrado por IA' : 'Plan determinístico'}
          <span className="text-white/45">·</span>
          <span className="text-white/55">semana del {targets.week_start}</span>
        </span>
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Tu plan nutricional semanal.
        </h2>
        <p className="font-sans text-sm text-white/65">
          Estos son los números a los que apunta tu lista de compras. La idea es simple: si comés
          esto, llegás. Sin diario, sin contar.
        </p>
      </header>

      <nav className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={active}
              className={`rounded-full px-4 py-2 font-display text-xs uppercase tracking-widest transition-all duration-300 ease-premium ${
                active
                  ? 'bg-accent-cyan/15 text-accent-cyan shadow-glow-cyan'
                  : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === 'macros' && <MacrosTab targets={targets} />}
      {tab === 'micros' && <MicrosTab micros={targets.micros} />}
      {tab === 'method' && <MethodTab targets={targets} />}
    </GlassCard>
  );
}

function MacrosTab({ targets }: { targets: NutritionTargetsView }) {
  const proteinKcal = targets.weekly_protein_g * KCAL_PER_G_PROTEIN;
  const carbsKcal = targets.weekly_carbs_g * KCAL_PER_G_CARBS;
  const fatsKcal = targets.weekly_fats_g * KCAL_PER_G_FAT;
  const totalKcal = Math.max(proteinKcal + carbsKcal + fatsKcal, 1);

  const dailyCalories = Math.round(targets.weekly_calories / 7);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 rounded-2xl border border-hairline bg-white/[0.03] p-6 sm:grid-cols-3">
        <Stat label="Calorías / semana" value={`${formatN(targets.weekly_calories)}`} unit="kcal" />
        <Stat label="Calorías / día" value={`${formatN(dailyCalories)}`} unit="kcal" accent="mint" />
        <Stat
          label="Fibra / semana"
          value={targets.weekly_fiber_g ? formatN(targets.weekly_fiber_g) : '—'}
          unit="g"
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-3">
        <MacroRing
          label="Proteína"
          grams={targets.weekly_protein_g}
          pct={(proteinKcal / totalKcal) * 100}
          variant="cyan"
        />
        <MacroRing
          label="Carbohidratos"
          grams={targets.weekly_carbs_g}
          pct={(carbsKcal / totalKcal) * 100}
          variant="mint"
        />
        <MacroRing
          label="Grasas"
          grams={targets.weekly_fats_g}
          pct={(fatsKcal / totalKcal) * 100}
          variant="coral"
        />
      </div>

      <p className="rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 font-sans text-xs text-white/55">
        Cada anillo muestra el % de tus calorías semanales que viene de ese macro. El número grande
        abajo es el total en gramos para los 7 días.
      </p>
    </div>
  );
}

function MacroRing({
  label,
  grams,
  pct,
  variant,
}: {
  label: string;
  grams: number;
  pct: number;
  variant: 'cyan' | 'mint' | 'coral';
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <RadialProgress
        value={pct}
        size={160}
        label={label}
        variant={variant}
        sublabel={`${formatN(grams)} g / sem`}
      />
    </div>
  );
}

const MICRO_META: Record<keyof Micros, { label: string; unit: string; tone: 'cyan' | 'mint' }> = {
  vitamin_d_iu: { label: 'Vitamina D', unit: 'IU', tone: 'cyan' },
  vitamin_b12_mcg: { label: 'Vitamina B12', unit: 'mcg', tone: 'cyan' },
  iron_mg: { label: 'Hierro', unit: 'mg', tone: 'mint' },
  calcium_mg: { label: 'Calcio', unit: 'mg', tone: 'mint' },
  magnesium_mg: { label: 'Magnesio', unit: 'mg', tone: 'mint' },
  zinc_mg: { label: 'Zinc', unit: 'mg', tone: 'cyan' },
  potassium_mg: { label: 'Potasio', unit: 'mg', tone: 'mint' },
  omega3_g: { label: 'Omega-3', unit: 'g', tone: 'cyan' },
  fiber_g: { label: 'Fibra', unit: 'g', tone: 'mint' },
};

const TONE_STYLES: Record<'cyan' | 'mint', { bar: string; text: string }> = {
  cyan: { bar: 'bg-accent-cyan', text: 'text-accent-cyan' },
  mint: { bar: 'bg-accent-mint', text: 'text-accent-mint' },
};

function MicrosTab({ micros }: { micros: Micros | null }) {
  if (!micros) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-warn-coral/30 bg-warn-coral/[0.04] p-6">
        <span className="font-display text-sm font-semibold text-warn-coral">
          Micros no disponibles
        </span>
        <p className="font-sans text-sm text-white/70">
          La calibración con IA no pudo completarse — vamos con el plan determinístico de macros
          mientras tanto. Volvé a generar el plan en un rato y los micros van a aparecer.
        </p>
      </div>
    );
  }

  const entries = (Object.keys(MICRO_META) as (keyof Micros)[]).map((key) => ({
    key,
    meta: MICRO_META[key],
    value: micros[key],
  }));

  // Normalize bar lengths against the highest value so the visual scale is
  // consistent across micros of wildly different magnitudes (mcg vs IU vs g).
  const maxValue = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="flex flex-col gap-3">
      {entries.map(({ key, meta, value }) => {
        const pct = Math.min(100, (value / maxValue) * 100);
        const { bar, text } = TONE_STYLES[meta.tone];
        return (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-xl border border-hairline bg-white/[0.03] px-5 py-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-sm font-medium tracking-tight text-white/85">
                {meta.label}
              </span>
              <span className={`tabular font-display text-base font-semibold ${text}`}>
                {formatN(value)}
                <span className="ml-1 text-xs font-normal text-white/45">{meta.unit} / sem</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-premium`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="mt-2 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 font-sans text-xs text-white/55">
        Targets semanales basados en RDAs internacionales × 7, ajustados por tus restricciones. La
        barra es la magnitud relativa entre micros — no es consumo, es objetivo.
      </p>
    </div>
  );
}

function MethodTab({ targets }: { targets: NutritionTargetsView }) {
  return (
    <div className="flex flex-col gap-5">
      {targets.llm_explanation && (
        <div className="rounded-2xl border border-accent-cyan/30 bg-accent-cyan/[0.04] p-6">
          <span className="mb-3 inline-flex items-center gap-2 font-display text-[10px] uppercase tracking-widest text-accent-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
            Tu nutricionista IA
          </span>
          <p className="font-sans text-sm leading-relaxed text-white/85">
            {targets.llm_explanation}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-white/[0.03] p-6">
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-white/70">
          La fórmula
        </h3>
        <ol className="flex flex-col gap-3 font-sans text-sm text-white/75">
          <Step n="1" title="BMR — Mifflin-St Jeor">
            Tu metabolismo basal: lo que quemás en reposo. Calculado con tu peso, altura, edad y
            sexo.
          </Step>
          <Step n="2" title="TDEE — factor de actividad">
            BMR × multiplicador según cuánto te movés (sedentario 1.2 → atleta 1.9). Esto da las
            calorías que quemás en un día normal.
          </Step>
          <Step n="3" title="Ajuste por objetivo">
            Aplicamos un déficit, superávit, o lo dejamos plano. Hipertrofia +10%, fuerza +5%,
            recomp y mantenimiento 0%, pérdida de grasa -20% (nunca más agresivo que -25%).
          </Step>
          <Step n="4" title="Macros + micros">
            Proteína anclada a tu peso (1.6–2.2 g/kg según objetivo). Grasa al 30% de calorías con
            piso de 0.8 g/kg. Carbos absorben el resto. Los micros{' '}
            {targets.method === 'llm_adjusted' ? 'los enriquece la IA' : 'se calculan con RDAs base'}
            .
          </Step>
        </ol>
      </div>

      <p className="rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 font-sans text-xs text-white/45">
        No es consejo médico. Si tenés condiciones específicas (embarazo, diabetes, riñón, etc.),
        validalo con tu profesional de salud.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent = 'cyan',
}: {
  label: string;
  value: string;
  unit: string;
  accent?: 'cyan' | 'mint';
}) {
  const text = accent === 'mint' ? 'text-accent-mint' : 'text-accent-cyan';
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </span>
      <span className={`tabular font-display text-3xl font-extrabold tracking-tightest ${text}`}>
        {value}
        <span className="ml-1 text-base font-semibold opacity-70">{unit}</span>
      </span>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-accent-cyan/40 bg-accent-cyan/10 font-display text-xs font-semibold text-accent-cyan">
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <span className="font-display text-sm font-semibold tracking-tight text-white">
          {title}
        </span>
        <span className="font-sans text-sm leading-relaxed text-white/65">{children}</span>
      </div>
    </li>
  );
}
