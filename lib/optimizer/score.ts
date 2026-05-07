import type { Candidate, OptimizerProfile } from './types';

/**
 * Static "quality" score per candidate, computed once before the greedy
 * loop runs. The build.ts inner loop adds a *dynamic* boost on top of
 * this baseline based on what's still missing in the current iteration —
 * that combination is what drives the actual pick.
 *
 * Components, all clamped to [0, 100]:
 *   +W1  Protein-per-ARS density       — the candidate's intrinsic
 *                                          efficiency at hitting the macro
 *                                          users are most often short on.
 *   +W2  Fiber per 100g                 — pushes vegetables/whole grains
 *                                          even when they're not the
 *                                          cheapest source of macros.
 *   +W3  Preferred-food bonus           — flat boost if `food_name` shows
 *                                          up in `profile.preferred_foods`.
 *   −W4  Ultra-processed penalty        — heuristic name-match against a
 *                                          short list of known junk-food
 *                                          markers ("snack", "barrita",
 *                                          "instantáneo", ...). Imperfect
 *                                          but cheap and surprisingly good
 *                                          at catching the obvious cases.
 *
 * The result is clamped to ≥ 0 (a candidate can't have a negative quality
 * score) but **not** clamped above. Capping at 100 would destroy ordering
 * between two candidates that both happen to be excellent — the preference
 * bonus and ultra-processed penalty would silently disappear once the base
 * score saturated. The picker only uses relative comparisons, so the upper
 * range is unrestricted.
 *
 * `targets` is in the signature for forward-compatibility (so build.ts /
 * P6.B can pass updated context without rewriting callers) — the v1
 * implementation doesn't read it.
 */

import type { WeeklyTargets } from '@/lib/nutrition/tdee';

const W_PROTEIN_PER_ARS = 1500;
const W_FIBER = 1.5;
const W_PREFERENCE_BONUS = 25;
const W_ULTRAPROCESSED_PENALTY = 35;

// Heuristic markers — token-based to avoid false positives like
// "snackeable" matching "snack". Match if a candidate's product name
// contains any of these terms as a whole word. Hand-curated from real
// product names that gamed the optimizer during P6.B smoke tests
// (sugary "sabor X" snacks beating raw foods on protein-per-ARS, etc.).
const ULTRAPROCESSED_TOKENS = [
  // Snack form factors
  'snack',
  'snacks',
  'barrita',
  'barritas',
  'crocante',
  'crocantes',
  'crujiente',
  'crujientes',
  'frituras',
  'fritas',
  'papitas',
  'palitos',
  // Sugary / candied prep
  'caramelos',
  'caramelizado',
  'caramelizada',
  'azucarado',
  'azucarada',
  'endulzado',
  'endulzada',
  'chocolatado',
  'confitado',
  'confitada',
  // Liquid / drink form factors that aren't the canonical food
  'gaseosa',
  'gaseosas',
  'jugo',
  'bebida',
  // Instant / processed prep
  'instantaneo',
  'instantanea',
  'instantáneo',
  'instantánea',
  'cereal sabor',
  'sopa instant',
  // Generic flavor markers (a "sabor X" product is rarely the raw X)
  'sabor a',
  'sabor',
  'gusto a',
];

export function scoreCandidate(
  candidate: Candidate,
  _targets: WeeklyTargets,
  profile: OptimizerProfile,
): number {
  let score = 0;

  // (protein g per package) / (price ARS) — how many grams of protein you
  // get per peso. Multiplied by W_PROTEIN_PER_ARS to land in a useful range
  // (typical values: 0.001–0.02 → after weight: 1.5–30).
  const proteinPerArs =
    ((candidate.protein_per_100g / 100) * candidate.weight_g) /
    candidate.price_ars;
  score += W_PROTEIN_PER_ARS * proteinPerArs;

  score += W_FIBER * candidate.fiber_per_100g;

  if (matchesPreferred(candidate, profile.preferred_foods)) {
    score += W_PREFERENCE_BONUS;
  }

  if (looksUltraprocessed(candidate.name)) {
    score -= W_ULTRAPROCESSED_PENALTY;
  }

  return Math.max(0, score);
}

function matchesPreferred(
  candidate: Candidate,
  preferred: string[] | null,
): boolean {
  if (!preferred || preferred.length === 0) return false;
  const foodKey = normalize(candidate.food_name);
  for (const pref of preferred) {
    const norm = normalize(pref);
    if (!norm) continue;
    if (foodKey.includes(norm) || norm.includes(foodKey)) return true;
  }
  return false;
}

function looksUltraprocessed(name: string): boolean {
  const norm = normalize(name);
  // Word-boundary check: surround the haystack with spaces so we can use
  // "needle is preceded AND followed by space/edge" via simple includes.
  const padded = ` ${norm} `;
  for (const token of ULTRAPROCESSED_TOKENS) {
    if (padded.includes(` ${token} `) || padded.includes(` ${token}.`)) {
      return true;
    }
  }
  return false;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
