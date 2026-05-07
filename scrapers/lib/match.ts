import type { FoodLite } from './types';

/**
 * Fuzzy match a scraped product name to a canonical food.
 *
 * Strategy: substring match against `foods.search_terms[]` after Unicode
 * normalization (lowercase + strip diacritics + collapse whitespace). The
 * first food whose any search_term appears in the product name wins.
 *
 * Caller is responsible for sorting the foods cache so MORE SPECIFIC foods
 * come first ("pechuga de pollo" before "pollo"). See `sortFoodsBySpecificity`.
 */

export interface MatchResult {
  food_id: string;
  confidence: number;
}

export function matchToFood(productName: string, foods: FoodLite[]): MatchResult | null {
  const normalized = normalize(productName);
  if (!normalized) return null;

  for (const food of foods) {
    for (const term of food.search_terms) {
      if (term && normalized.includes(normalize(term))) {
        return { food_id: food.id, confidence: 1.0 };
      }
    }
  }
  return null;
}

/**
 * Returns the foods cache sorted so the longest single-term-length comes
 * first. Specific multi-word terms ("pechuga de pollo" → 17 chars) outrank
 * single words ("pollo" → 5 chars), preventing the single-word from
 * stealing matches it shouldn't.
 */
export function sortFoodsBySpecificity(foods: FoodLite[]): FoodLite[] {
  return [...foods].sort((a, b) => maxTermLength(b) - maxTermLength(a));
}

function maxTermLength(food: FoodLite): number {
  if (!food.search_terms || food.search_terms.length === 0) return 0;
  let max = 0;
  for (const t of food.search_terms) {
    if (t.length > max) max = t.length;
  }
  return max;
}

const COMBINING_MARKS_REGEX = /[̀-ͯ]/g;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}
