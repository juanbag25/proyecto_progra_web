'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { BudgetRing } from './BudgetRing';
import { MacrosRing } from './MacrosRing';
import type { ListProgress } from '@/lib/list/derive-progress';

interface SummaryHeaderProps {
  progress: ListProgress;
}

/**
 * Banner above the items list with the four reactive rings (3 macros +
 * budget) plus a "checked / total" counter.
 *
 * Sticky on md+: the dashboard pins under the app shell header (top 68px)
 * so the rings stay visible while the user scrolls through items —
 * matches the Apple Health vibe of "your progress is always there".
 * On mobile the band flows normally: a 180px-tall sticky pinned to a
 * 600px viewport eats the whole screen and traps clicks. Rings still
 * update reactively in the unstuck position.
 */
export function SummaryHeader({ progress }: SummaryHeaderProps) {
  const { macros, budget, items } = progress;

  return (
    <GlassCard
      variant="strong"
      className="flex flex-col gap-6 p-6 sm:p-8 md:sticky md:top-[68px] md:z-20"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-white/55">
          Tu progreso
        </h2>
        <span className="tabular font-display text-sm font-semibold text-white/80">
          {items.checked}
          <span className="text-white/40">/{items.total}</span>{' '}
          <span className="font-sans text-[10px] font-normal uppercase tracking-widest text-white/40">
            items
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto_auto] md:gap-10">
        <MacrosRing
          protein={macros.protein}
          carbs={macros.carbs}
          fats={macros.fats}
        />
        <div className="hidden h-32 w-px bg-hairline md:block" aria-hidden />
        <div className="flex justify-center md:justify-start">
          <BudgetRing budget={budget} />
        </div>
      </div>
    </GlassCard>
  );
}
