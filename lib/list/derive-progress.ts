/**
 * Pure progress calculator for the shopping list dashboard.
 *
 * Rings render two ratios:
 *   - "secured" = what the user has already CHECKED off (i.e. bought).
 *   - "planned" = what the optimizer assigned in total for the week.
 *
 * The ring fills toward the SECURED ratio (so it grows live as the user
 * checks items in the supermarket). Sublabels expose the planned totals so
 * the user knows whether the gap between plan and target is "the plan was
 * already short" vs "you haven't shopped yet".
 *
 * Items missing nutrition (food.protein_per_100g === null) contribute to
 * cost but NOT to macros — same defensive rule as page.tsx. After the
 * INNER JOIN in loadCandidates this should be empty in production, but
 * the type allows it for legacy rows.
 *
 * Pure function. No I/O. Easy to test.
 */

export interface ProgressItem {
  id: string;
  qty_g: number;
  cost: number;
  /** Per-100g nutrition from foods. null when the item has no canonical
   *  food match (defensive — INNER JOIN should make this impossible). */
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fats_per_100g: number | null;
}

export interface ProgressTargets {
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}

export interface MacroProgress {
  /** Grams secured (sum across checked items). */
  secured: number;
  /** Grams planned (sum across all items, regardless of checked). */
  planned: number;
  /** User's weekly target. */
  target: number;
  /** secured / target × 100, clamped to [0, 100]. The ring fills toward this. */
  secured_pct: number;
  /** planned / target × 100, clamped to [0, 100]. Used in the sublabel. */
  planned_pct: number;
}

export interface BudgetProgress {
  /** ARS spent on items already checked. */
  secured: number;
  /** ARS the optimizer assigned in total. */
  planned: number;
  /** User's weekly budget. */
  budget: number;
  /** secured / budget × 100, clamped to [0, 100]. The ring fills here. */
  secured_pct: number;
  /** planned / budget × 100, clamped to [0, 100]. Used in the sublabel. */
  planned_pct: number;
}

export interface ListProgress {
  macros: {
    protein: MacroProgress;
    carbs: MacroProgress;
    fats: MacroProgress;
  };
  budget: BudgetProgress;
  items: { total: number; checked: number };
}

export function computeProgress(
  items: ProgressItem[],
  checked: ReadonlySet<string>,
  targets: ProgressTargets,
  budget: number,
): ListProgress {
  const totals = {
    cost_planned: 0,
    cost_secured: 0,
    protein_planned: 0,
    protein_secured: 0,
    carbs_planned: 0,
    carbs_secured: 0,
    fats_planned: 0,
    fats_secured: 0,
    items_checked: 0,
  };

  for (const item of items) {
    const isChecked = checked.has(item.id);
    if (isChecked) totals.items_checked += 1;

    totals.cost_planned += item.cost;
    if (isChecked) totals.cost_secured += item.cost;

    // Macros need the qty/100 factor and a non-null per-100g value.
    const factor = item.qty_g / 100;
    if (item.protein_per_100g != null) {
      const grams = factor * item.protein_per_100g;
      totals.protein_planned += grams;
      if (isChecked) totals.protein_secured += grams;
    }
    if (item.carbs_per_100g != null) {
      const grams = factor * item.carbs_per_100g;
      totals.carbs_planned += grams;
      if (isChecked) totals.carbs_secured += grams;
    }
    if (item.fats_per_100g != null) {
      const grams = factor * item.fats_per_100g;
      totals.fats_planned += grams;
      if (isChecked) totals.fats_secured += grams;
    }
  }

  return {
    macros: {
      protein: buildMacro(totals.protein_secured, totals.protein_planned, targets.protein_g),
      carbs: buildMacro(totals.carbs_secured, totals.carbs_planned, targets.carbs_g),
      fats: buildMacro(totals.fats_secured, totals.fats_planned, targets.fats_g),
    },
    budget: {
      secured: round1(totals.cost_secured),
      planned: round1(totals.cost_planned),
      budget,
      secured_pct: pct(totals.cost_secured, budget),
      planned_pct: pct(totals.cost_planned, budget),
    },
    items: { total: items.length, checked: totals.items_checked },
  };
}

function buildMacro(secured: number, planned: number, target: number): MacroProgress {
  return {
    secured: round1(secured),
    planned: round1(planned),
    target,
    secured_pct: pct(secured, target),
    planned_pct: pct(planned, target),
  };
}

function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.max(0, Math.min(100, (num / denom) * 100));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
