import type { Candidate, OptimizerProfile } from './types';

/**
 * Hard-constraint filtering: removes candidates that violate the user's
 * allergies, dietary restrictions, or explicit dislikes.
 *
 * Three classes of exclusion:
 *
 *   1. Free-form allergens (e.g. "Mariscos", "Frutos secos", "Soja"): we
 *      look for the allergy term as a substring of `food_name` after
 *      normalizing both sides (lowercase + strip diacritics).
 *
 *   2. Disliked foods: same substring rule against `food_name`.
 *
 *   3. Diet flags: `Vegano`, `Vegetariano`, `Sin TACC` from
 *      `dietary_restrictions`, plus `Lactosa` and `Gluten` which the UI
 *      surfaces as ALLERGIES (RestrictionsStep) but our `foods` schema
 *      tracks as flags. We cross-cut both sources so e.g. a user that
 *      ticks `Lactosa` as allergy gets the same exclusion as one that
 *      somehow expressed `Sin lactosa` as a dietary restriction.
 *
 * Other diets the UI offers but we can't enforce yet (Pescetariano,
 * Kosher, Halal, Keto): no flag in `foods` to filter on. Documented as a
 * post-v1 TODO in docs/optimizer/formulation.md.
 *
 * Pure: no I/O, no mutation. Test fixtures pass an array + a profile and
 * get a subset back.
 */
export function filterCandidates(
  candidates: Candidate[],
  profile: OptimizerProfile,
): Candidate[] {
  const allergiesNormalized = normalizeList(profile.allergies);
  const dislikedNormalized = normalizeList(profile.disliked_foods);
  const diets = profile.dietary_restrictions ?? [];

  // Cross-cutting: an "allergy" to lactose/gluten enforces the same flag
  // as the corresponding dietary restriction, so the user only has to
  // express it once (and the UI only happens to put it in one bucket).
  const requireLactoseFree = allergiesNormalized.has('lactosa');
  const requireGlutenFree =
    allergiesNormalized.has('gluten') || diets.includes('Sin TACC');
  const requireVegan = diets.includes('Vegano');
  const requireVegetarian = diets.includes('Vegetariano');

  // Substring-allergy terms: drop the two we already mapped to flags so
  // we don't double-filter (e.g. matching "lactosa" inside "leche
  // descremada" via substring would be wrong — only the flag matters).
  const substringAllergens = new Set<string>();
  for (const a of allergiesNormalized) {
    if (a === 'lactosa' || a === 'gluten') continue;
    substringAllergens.add(a);
  }

  return candidates.filter((c) => {
    if (requireVegan && !c.is_vegan) return false;
    if (requireVegetarian && !c.is_vegetarian) return false;
    if (requireGlutenFree && !c.is_gluten_free) return false;
    if (requireLactoseFree && !c.is_lactose_free) return false;

    const foodKey = normalize(c.food_name);
    for (const term of substringAllergens) {
      if (foodKey.includes(term)) return false;
    }
    for (const term of dislikedNormalized) {
      if (foodKey.includes(term)) return false;
    }
    return true;
  });
}

function normalizeList(items: string[] | null): Set<string> {
  if (!items) return new Set();
  const out = new Set<string>();
  for (const item of items) {
    const norm = normalize(item);
    if (norm) out.add(norm);
  }
  return out;
}

/** Lowercase + strip diacritics + collapse whitespace. Match what we'd do
 *  to both sides of a substring comparison so "Almendras" matches a user
 *  who typed "almendrás". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
