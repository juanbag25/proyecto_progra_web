import type { WeeklyTargets } from '@/lib/nutrition/tdee';
import { maxGramsForCandidate } from './food-caps';
import { jitterFor, type RotationPenalty } from './rotation';
import { scoreCandidate } from './score';
import type {
  Candidate,
  OptimizerProfile,
  ShoppingListItem,
  ShoppingListResult,
  ShoppingListSummary,
} from './types';

/** Optional knobs that introduce cross-run variety without changing the
 *  greedy's structure. Both default to "off" — pure-input runs (tests,
 *  golden-file fixtures) stay deterministic. */
export interface OptimizerOptions {
  /** Per-food multiplier in (0, 1] that suppresses recently-used foods.
   *  See `lib/optimizer/rotation.ts` for the curve. */
  rotationPenalty?: RotationPenalty;
  /** Seed for stable per-candidate jitter (±5%). When omitted, jitter is
   *  disabled and the optimizer is fully deterministic. */
  seed?: string;
}

/**
 * Greedy "Shopping List Builder" — the core of P6.A.
 *
 * The algorithm is documented at length in docs/optimizer/formulation.md.
 * Short version: at each iteration we re-rank every candidate by
 *   (static quality) + (dynamic boost reflecting what's still missing)
 * and pick the winner, decide how many grams to buy, debit budget +
 * remaining macros, then loop. We never undo a pick.
 *
 * Inputs:
 *   - profile.weekly_budget_ars  → hard cap on total cost
 *   - targets.weekly_*           → macro/fiber goals to chase
 *   - candidates                 → already filter()ed list
 *
 * Output: items + summary + feasibility flag. The richer
 * `feasibility_message` and micros-coverage stats land in P6.B.
 *
 * Pure: no DB, no network, deterministic given inputs (same candidates
 * in same order ⇒ same list). Easy to test.
 */

// Don't let any single SKU dominate the list. Tuned with weekly grocery
// volumes in mind: even heavy protein eaters rarely consume more than
// ~5kg of any one product per week.
const MAX_GRAMS_PER_SKU = 5000;

// Per-food cap is no longer a single constant — it's per-food (or per-
// category) via maxGramsForCandidate() in food-caps.ts. Pollo gets 2 kg,
// atún en lata gets 500 g, aceite gets 350 g, etc. Same scoring loop,
// the cap is just looked up dynamically per candidate.

// Multiplier applied to the per-iteration "needBoost" when ranking. The
// base score (protein-per-ARS) lives in the 100–500 range; the raw
// needBoost lives in 0–30. Without amplification the base would dominate
// after the protein target is met, leading the greedy to keep buying
// protein-heavy SKUs even though they no longer move us toward the
// outstanding carbs/fats gap. 30× lands them in the same order-of-magnitude.
const NEED_BOOST_WEIGHT = 30;

// Stop once this fraction of EACH macro target is met. Chasing the last
// few grams creates ugly micro-purchases (50g of pollo) without nutritional
// value. 95% is the practical "you nailed it" threshold.
const MACRO_SATISFIED_PCT = 0.95;

// Hard ceiling on iterations — defends against pathological loops where
// every candidate would add < 1g per pick. 200 is generous: typical runs
// converge in 15–40 iterations.
const MAX_ITERATIONS = 200;

// Minimum increment per pick (g). Prevents the "rounds of 0.3g" tail.
const MIN_QTY_G = 50;

interface RemainingNeeds {
  protein: number;
  carbs: number;
  fats: number;
}

interface ItemAccumulator {
  product_id: string;
  qty_g: number;
  cost: number;
  /** Cached so we can enforce MAX_GRAMS_PER_SKU without rescanning items[]. */
  weight_g: number;
  /** Cached so the per-food cap can be enforced without re-fetching the
   *  candidate from the master list every iteration. */
  food_id: string;
}

export function buildShoppingList(
  profile: OptimizerProfile,
  targets: WeeklyTargets,
  candidates: Candidate[],
  options: OptimizerOptions = {},
): ShoppingListResult {
  // Pre-compute static scores once. Reused every iteration.
  const baseScores = new Map<string, number>();
  for (const c of candidates) {
    baseScores.set(c.product_id, scoreCandidate(c, targets, profile));
  }

  const remaining: RemainingNeeds = {
    protein: targets.weekly_protein_g,
    carbs: targets.weekly_carbs_g,
    fats: targets.weekly_fats_g,
  };
  let remainingBudget = profile.weekly_budget_ars;
  const itemsByProduct = new Map<string, ItemAccumulator>();
  const usedFoodIds = new Set<string>();
  // Track total grams per food across all SKUs so the per-food cap holds
  // even when the greedy is tempted by a second SKU of the same food.
  const gramsByFoodId = new Map<string, number>();

  // Per-macro thresholds for "satisfied". Computed once — used both as
  // the loop exit condition and as the feasibility test below.
  const proteinFloor = targets.weekly_protein_g * (1 - MACRO_SATISFIED_PCT);
  const carbsFloor = targets.weekly_carbs_g * (1 - MACRO_SATISFIED_PCT);
  const fatsFloor = targets.weekly_fats_g * (1 - MACRO_SATISFIED_PCT);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (remainingBudget <= 0) break;
    // Don't exit on protein alone — keep buying until carbs and fats are
    // also covered (or budget / picks run out). The picker's need-boost
    // already tilts toward the most-deficient macro at each iteration, so
    // this happens naturally without changing scoring math.
    const allMacrosSatisfied =
      remaining.protein <= proteinFloor &&
      remaining.carbs <= carbsFloor &&
      remaining.fats <= fatsFloor;
    if (allMacrosSatisfied) break;

    const pick = pickBest(
      candidates,
      remaining,
      remainingBudget,
      usedFoodIds,
      baseScores,
      itemsByProduct,
      gramsByFoodId,
      options,
    );
    if (!pick) break;

    const qty = computeQty(pick, remaining, remainingBudget, itemsByProduct, gramsByFoodId);
    if (qty < MIN_QTY_G) break;

    const cost = (qty / pick.weight_g) * pick.price_ars;
    commit(itemsByProduct, pick, qty, cost);
    usedFoodIds.add(pick.food_id);
    gramsByFoodId.set(pick.food_id, (gramsByFoodId.get(pick.food_id) ?? 0) + qty);
    remainingBudget -= cost;
    remaining.protein -= (pick.protein_per_100g / 100) * qty;
    remaining.carbs -= (pick.carbs_per_100g / 100) * qty;
    remaining.fats -= (pick.fats_per_100g / 100) * qty;
  }

  const items = toItems(itemsByProduct);
  const summary = summarize(items, candidates, targets, profile);
  // Feasibility = the protein target was met. Carbs/fats falling short
  // doesn't break the plan (the user can still hit them eating what they
  // bought differently); failing protein is the actual deal-breaker for
  // any fitness goal.
  const feasible = remaining.protein <= proteinFloor;
  const feasibility_message = feasible
    ? null
    : buildFeasibilityMessage(profile, targets, summary, candidates);

  return { items, summary, feasible, feasibility_message };
}

/** Cheapest cost (ARS) needed to source `target_protein_g` grams of protein
 *  using the most protein-efficient candidate in the filtered pool. Returns
 *  null when no candidate has any protein at all (an unfilterable corner of
 *  the catalog) — the caller renders a different message in that case. */
export function computeMinViableProteinBudget(
  filteredCandidates: Candidate[],
  target_protein_g: number,
): number | null {
  let cheapestCostPerG: number | null = null;
  for (const c of filteredCandidates) {
    const proteinPerPkg = (c.protein_per_100g / 100) * c.weight_g;
    if (proteinPerPkg <= 0) continue;
    const costPerG = c.price_ars / proteinPerPkg;
    if (cheapestCostPerG == null || costPerG < cheapestCostPerG) {
      cheapestCostPerG = costPerG;
    }
  }
  if (cheapestCostPerG == null) return null;
  return cheapestCostPerG * target_protein_g;
}

/** Set of dietary tags + flag-mapped allergies the user currently has
 *  active. Used in the feasibility message so we can name them concretely
 *  ("Relajar restricciones activas: Vegano, Sin TACC"). */
export function collectActiveRestrictions(profile: OptimizerProfile): string[] {
  const out: string[] = [];
  for (const r of profile.dietary_restrictions ?? []) out.push(r);
  for (const a of profile.allergies ?? []) {
    // Surface the two allergies that the optimizer turns into hard flag
    // filters — these are the ones whose removal changes the candidate
    // pool the most. Free-form "Mariscos"/"Frutos secos" stay in their
    // own list further down (different lever).
    if (a.toLowerCase() === 'lactosa') out.push('Lactosa');
    else if (a.toLowerCase() === 'gluten') out.push('Gluten');
  }
  return out;
}

/** Compose the multi-line, plain-text actionable suggestion shown when
 *  `feasible=false`. The shape:
 *
 *    Tu presupuesto ($X) cubre solo el N% de tu objetivo de proteína (Yg/sem).
 *    Para cumplirlo necesitás aproximadamente $Z/sem.
 *
 *    Opciones:
 *    • Subir el presupuesto a $Z (+$Δ)
 *    • Cambiar tu goal a 'maintenance' (~20% menos de proteína)
 *    • Relajar restricciones activas: Vegano, Sin TACC
 *
 *  Each option is conditional — we don't suggest "switch to maintenance"
 *  if the user is already on maintenance, or "relax restrictions" if there
 *  aren't any.
 */
function buildFeasibilityMessage(
  profile: OptimizerProfile,
  targets: WeeklyTargets,
  summary: ShoppingListSummary,
  filteredCandidates: Candidate[],
): string {
  const proteinPct = Math.max(0, Math.round(summary.targets_match_pct.protein));
  const minBudget = computeMinViableProteinBudget(
    filteredCandidates,
    targets.weekly_protein_g,
  );
  const currentBudget = profile.weekly_budget_ars;
  const restrictions = collectActiveRestrictions(profile);

  const lines: string[] = [];

  if (filteredCandidates.length === 0) {
    // Nothing passed filtering — restrictions are the only viable lever.
    lines.push(
      `No quedaron candidatos con tus restricciones actuales — no podemos armar ninguna lista.`,
    );
    if (restrictions.length > 0) {
      lines.push(`Probá relajar: ${restrictions.join(', ')}.`);
    }
    return lines.join('\n');
  }

  lines.push(
    `Tu presupuesto ($${formatARS(currentBudget)}) cubre solo el ${proteinPct}% de tu objetivo de proteína (${formatNumber(targets.weekly_protein_g)}g/sem).`,
  );
  if (minBudget != null) {
    lines.push(
      `Para cumplirlo necesitás aproximadamente $${formatARS(Math.ceil(minBudget))}/sem.`,
    );
  }

  const options: string[] = [];
  if (minBudget != null && minBudget > currentBudget) {
    const delta = minBudget - currentBudget;
    options.push(
      `Subir el presupuesto a ~$${formatARS(Math.ceil(minBudget))} (+$${formatARS(Math.ceil(delta))})`,
    );
  }
  if (profile.fitness_goal && profile.fitness_goal !== 'maintenance') {
    options.push(`Cambiar tu goal a 'maintenance' (~20% menos de proteína)`);
  }
  if (restrictions.length > 0) {
    options.push(`Relajar restricciones activas: ${restrictions.join(', ')}`);
  }

  if (options.length > 0) {
    lines.push('');
    lines.push('Opciones:');
    for (const opt of options) lines.push(`• ${opt}`);
  }

  return lines.join('\n');
}

function formatARS(n: number): string {
  // Plain integer formatting with thousands separators; the UI handles
  // currency symbol placement. Locale 'es-AR' uses '.' as thousands
  // separator, matching local convention.
  return Math.round(n).toLocaleString('es-AR');
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('es-AR');
}

/** Re-rank all viable candidates by (static score) × (variety penalty)
 *  × (rotation penalty) × (1 + jitter) + (need boost). Linear scan — N is
 *  at most a few thousand and we run for ~30 iterations, so 30 × 3000 =
 *  90k comparisons. Negligible. */
function pickBest(
  candidates: Candidate[],
  remaining: RemainingNeeds,
  remainingBudget: number,
  usedFoodIds: Set<string>,
  baseScores: Map<string, number>,
  itemsByProduct: Map<string, ItemAccumulator>,
  gramsByFoodId: Map<string, number>,
  options: OptimizerOptions,
): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = -Infinity;

  // Bias toward whatever macro is most under-supplied. Shares sum to 1.
  const totalNeed =
    Math.max(0, remaining.protein) +
    Math.max(0, remaining.carbs) +
    Math.max(0, remaining.fats);
  const proteinShare = totalNeed > 0 ? Math.max(0, remaining.protein) / totalNeed : 0;
  const carbsShare = totalNeed > 0 ? Math.max(0, remaining.carbs) / totalNeed : 0;
  const fatsShare = totalNeed > 0 ? Math.max(0, remaining.fats) / totalNeed : 0;

  for (const c of candidates) {
    // Skip candidates already too close to their per-SKU cap to add a
    // meaningful chunk this iteration.
    const acc = itemsByProduct.get(c.product_id);
    if (acc && acc.qty_g + MIN_QTY_G > MAX_GRAMS_PER_SKU) continue;

    // Skip candidates whose canonical food is already at its per-food cap.
    // Without this the greedy can pick a second SKU of an already-saturated
    // food (e.g. two atún SKUs) and bypass MAX_GRAMS_PER_SKU. The cap is
    // food-specific (see food-caps.ts) so pollo and atún are bounded
    // independently even though they share the protein_animal category.
    const foodGramsSoFar = gramsByFoodId.get(c.food_id) ?? 0;
    if (foodGramsSoFar + MIN_QTY_G > maxGramsForCandidate(c)) continue;

    // Skip candidates whose minimum-purchase cost (MIN_QTY_G grams) would
    // exceed the remaining budget. Otherwise a "winning" candidate could
    // get rounded to <MIN_QTY_G in computeQty and the outer loop would
    // exit even though a cheaper candidate would still produce a real
    // pick.
    const minCost = (MIN_QTY_G / c.weight_g) * c.price_ars;
    if (minCost > remainingBudget) continue;

    const base = baseScores.get(c.product_id) ?? 0;
    // Variety penalty: half the static score for foods we've already used.
    // Strong enough to encourage spreading, soft enough not to forbid it.
    const varietyMult = usedFoodIds.has(c.food_id) ? 0.5 : 1.0;

    // Cross-week rotation penalty — discourages picking the same foods
    // we picked in recent weeks. Defaults to 1.0 (no penalty) when the
    // map is missing or this food wasn't recently used. See
    // lib/optimizer/rotation.ts for the curve.
    const rotationMult = options.rotationPenalty?.get(c.food_id) ?? 1.0;

    // Need-boost: weighted nutritional density per 100g, biased by the
    // share of each macro we still owe. Picks the candidate that closes
    // the largest gap fastest, naturally. Amplified to compete with the
    // base score's order of magnitude (see NEED_BOOST_WEIGHT comment).
    const needBoost =
      proteinShare * c.protein_per_100g +
      carbsShare * c.carbs_per_100g +
      fatsShare * c.fats_per_100g;

    let score = base * varietyMult * rotationMult + NEED_BOOST_WEIGHT * needBoost;

    // Seeded jitter (±5%) — breaks ties when two candidates score within
    // a few percent of each other, so back-to-back regens of the same
    // week land on slightly different SKUs. No-op when no seed is passed
    // (tests stay deterministic).
    if (options.seed) {
      score *= 1 + jitterFor(c.product_id, options.seed);
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

/** Decide grams to add this iteration. Take the smallest of:
 *    - what we need to close the dominant macro gap
 *    - what fits in the remaining budget
 *    - what fits before the per-SKU cap
 *    - the package-aware floor (MIN_QTY_G), so we don't pick "10g of pollo"
 */
function computeQty(
  c: Candidate,
  remaining: RemainingNeeds,
  remainingBudget: number,
  itemsByProduct: Map<string, ItemAccumulator>,
  gramsByFoodId: Map<string, number>,
): number {
  // Drive by whichever macro the picker would have weighed highest. We
  // mirror the same priority — protein first while it's owed, then fall
  // through to carbs, then fats. The earlier `pickBest` already biased the
  // candidate toward the most-needed macro; here we just pick the qty that
  // closes the remaining gap on whichever macro this candidate touches.
  let qtyByMacro = Infinity;
  if (remaining.protein > 0 && c.protein_per_100g > 0) {
    qtyByMacro = (remaining.protein * 100) / c.protein_per_100g;
  } else if (remaining.carbs > 0 && c.carbs_per_100g > 0) {
    qtyByMacro = (remaining.carbs * 100) / c.carbs_per_100g;
  } else if (remaining.fats > 0 && c.fats_per_100g > 0) {
    qtyByMacro = (remaining.fats * 100) / c.fats_per_100g;
  }

  const costPerG = c.price_ars / c.weight_g;
  const qtyByBudget = remainingBudget / costPerG;

  const acc = itemsByProduct.get(c.product_id);
  const qtyByCapSku = MAX_GRAMS_PER_SKU - (acc?.qty_g ?? 0);

  const foodGramsSoFar = gramsByFoodId.get(c.food_id) ?? 0;
  const qtyByCapFood = maxGramsForCandidate(c) - foodGramsSoFar;

  return Math.max(0, Math.min(qtyByMacro, qtyByBudget, qtyByCapSku, qtyByCapFood));
}

function commit(
  itemsByProduct: Map<string, ItemAccumulator>,
  c: Candidate,
  qty_g: number,
  cost: number,
): void {
  const existing = itemsByProduct.get(c.product_id);
  if (existing) {
    existing.qty_g += qty_g;
    existing.cost += cost;
    return;
  }
  itemsByProduct.set(c.product_id, {
    product_id: c.product_id,
    qty_g,
    cost,
    weight_g: c.weight_g,
    food_id: c.food_id,
  });
}

function toItems(itemsByProduct: Map<string, ItemAccumulator>): ShoppingListItem[] {
  return Array.from(itemsByProduct.values()).map((a) => ({
    product_id: a.product_id,
    qty_g: round1(a.qty_g),
    cost: round2(a.cost),
  }));
}

function summarize(
  items: ShoppingListItem[],
  candidates: Candidate[],
  targets: WeeklyTargets,
  profile: OptimizerProfile,
): ShoppingListSummary {
  // Build a lookup so we can resolve product_id → nutrition without
  // refetching from DB. Candidates is the same array passed in; build()
  // never mutates it.
  const byProductId = new Map(candidates.map((c) => [c.product_id, c]));

  let totals = {
    cost: 0,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
  };
  for (const item of items) {
    const c = byProductId.get(item.product_id);
    if (!c) continue;
    const factor = item.qty_g / 100;
    totals.cost += item.cost;
    totals.kcal += factor * c.kcal_per_100g;
    totals.protein += factor * c.protein_per_100g;
    totals.carbs += factor * c.carbs_per_100g;
    totals.fats += factor * c.fats_per_100g;
    totals.fiber += factor * c.fiber_per_100g;
  }

  return {
    total_cost: round2(totals.cost),
    total_calories: round1(totals.kcal),
    total_protein_g: round1(totals.protein),
    total_carbs_g: round1(totals.carbs),
    total_fats_g: round1(totals.fats),
    total_fiber_g: round1(totals.fiber),
    // P5.D backlog: when foods.micros_json is populated at scale, fill
    // this with `{vitamin_d_iu: 87, b12_mcg: 110, ...}` style coverage.
    // Empty object today keeps the persisted JSON shape stable.
    micros_coverage_pct: {},
    budget_usage_pct: profile.weekly_budget_ars > 0
      ? round1((totals.cost / profile.weekly_budget_ars) * 100)
      : 0,
    targets_match_pct: {
      protein: targets.weekly_protein_g > 0
        ? round1((totals.protein / targets.weekly_protein_g) * 100)
        : 0,
      carbs: targets.weekly_carbs_g > 0
        ? round1((totals.carbs / targets.weekly_carbs_g) * 100)
        : 0,
      fats: targets.weekly_fats_g > 0
        ? round1((totals.fats / targets.weekly_fats_g) * 100)
        : 0,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
