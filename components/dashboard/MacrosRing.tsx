'use client';

import { RadialProgress } from '@/components/ui/RadialProgress';
import type { MacroProgress } from '@/lib/list/derive-progress';

interface MacrosRingProps {
  protein: MacroProgress;
  carbs: MacroProgress;
  fats: MacroProgress;
  /** Smaller variant — kept for future placements (e.g. a future scroll-
   *  shrunk header). Default false renders the hero-sized rings. */
  compact?: boolean;
}

/**
 * Three rings side-by-side: protein (cyan), carbs (mint), fats (coral).
 *
 * Each ring's fill grows toward `secured_pct` — what the user has already
 * checked off. The sublabel exposes the absolute "X / Y g" reading so
 * the user can see how the percentage maps to grams without doing math.
 *
 * Side-by-side instead of concentric: more legible on mobile, no overlap
 * issues at small sizes, and each macro gets its own color label.
 */
export function MacrosRing({ protein, carbs, fats, compact = false }: MacrosRingProps) {
  // Hero matches RadialProgress's design-system default (180/12) so the
  // dashboard reads as the visual anchor of the page. Compact stays
  // available for future scroll-shrunk headers.
  const size = compact ? 130 : 180;
  const strokeWidth = compact ? 10 : 12;

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-6">
      <RadialProgress
        value={protein.secured_pct}
        size={size}
        strokeWidth={strokeWidth}
        variant="cyan"
        label="Proteína"
        sublabel={formatSublabel(protein)}
      />
      <RadialProgress
        value={carbs.secured_pct}
        size={size}
        strokeWidth={strokeWidth}
        variant="mint"
        label="Carbos"
        sublabel={formatSublabel(carbs)}
      />
      <RadialProgress
        value={fats.secured_pct}
        size={size}
        strokeWidth={strokeWidth}
        variant="coral"
        label="Grasas"
        sublabel={formatSublabel(fats)}
      />
    </div>
  );
}

/** "23 / 150 g" — secured grams over the weekly target. The big number
 *  (rendered by RadialProgress as the percentage) is the headline; the
 *  sublabel keeps the absolute reading available without crowding. */
function formatSublabel(m: MacroProgress): string {
  return `${Math.round(m.secured)} / ${Math.round(m.target)} g`;
}
