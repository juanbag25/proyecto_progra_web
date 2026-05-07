'use client';

import { RadialProgress } from '@/components/ui/RadialProgress';
import { formatARS } from '@/lib/format';
import type { BudgetProgress } from '@/lib/list/derive-progress';

interface BudgetRingProps {
  budget: BudgetProgress;
  compact?: boolean;
}

/**
 * Single radial showing how much of the budget has been spent (on items
 * already checked).
 *
 * Color discipline: mint while there's runway, coral once we've crossed
 * 90%. RadialProgress only ships those two warm/cool variants — going
 * mint→orange→coral (the "stoplight" the spec hints at) would mean adding
 * an `orange` variant. Two-tone is enough signal: the user reads the
 * absolute "$X / $Y" sublabel for fine-grain.
 *
 * Threshold at 90% (not 75%): below 90% the user is doing fine, no point
 * coloring the warning early.
 */
export function BudgetRing({ budget, compact = false }: BudgetRingProps) {
  // Match MacrosRing's hero size (RadialProgress's design-system default)
  // so the four rings line up visually as a single dashboard band.
  const size = compact ? 130 : 180;
  const strokeWidth = compact ? 10 : 12;
  const variant = budget.secured_pct >= 90 ? 'coral' : 'mint';

  return (
    <RadialProgress
      value={budget.secured_pct}
      size={size}
      strokeWidth={strokeWidth}
      variant={variant}
      label="Presupuesto"
      sublabel={`${formatARS(budget.secured)} / ${formatARS(budget.budget)}`}
    />
  );
}
