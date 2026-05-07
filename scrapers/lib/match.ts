import type { FoodLite } from './types';

/**
 * Fuzzy match a scraped product name to a canonical food.
 *
 * Strategy: word-bounded substring match against `foods.search_terms[]`
 * after Unicode normalization (lowercase + strip diacritics + collapse
 * whitespace). The (food, term) pairs are tried in order of TERM length
 * descending so a long specific phrase ("pechuga de pollo") outranks any
 * shorter generic word ("pollo"); the first hit wins.
 *
 * Two guards keep the substring approach honest:
 *
 *   1. Word boundary — the matched term has to be surrounded by whitespace
 *      or punctuation, not embedded in a longer word. Without this,
 *      "azucar" matched "azucarado" (so a sugary yogurt was tagged as
 *      pure sugar and the optimizer happily bought 1.7kg of it).
 *
 *   2. Negation cue — if the term is preceded by "sin", "no contiene",
 *      "libre de", "0%", etc., the match is rejected. Catches "Yogur Sin
 *      Azúcar" → not sugar.
 *
 *   3. Category-drift cue — same shape as negation but for product class
 *      shifts: "leche de almendras" is a drink, not nuts. "sabor a banana"
 *      isn't a banana. These prefixes block the match outright.
 *
 * Caller is responsible for sorting via `sortFoodsBySpecificity` so the
 * pre-flattened term list is already in priority order.
 */

export interface MatchResult {
  food_id: string;
  confidence: number;
}

const NEGATION_CUES = [
  'sin',
  'no contiene',
  'libre de',
  'libre',
  '0% de',
  '0%',
  'cero',
  'free',
  'gratis de',
];

const CATEGORY_DRIFT_CUES = [
  'leche de',
  'bebida de',
  'bebida vegetal',
  'agua de',
  'jugo de',
  'aceite de',
  'esencia de',
  'extracto de',
  'sabor a',
  'sabor',
  'gusto a',
  'crema de',
  'helado de',
  'mermelada de',
  'dulce de',
];

/**
 * Product-name keywords that disqualify ANY match outright. These are
 * confection / dessert / bakery formats where the product happens to
 * contain a real food's name (e.g. "Huevo de Pascua" contains "huevo")
 * but the actual product is a chocolate egg, not eggs. We can't rely on
 * cue-based blocking here because the offending word can be ANYWHERE in
 * the product name, not just immediately preceding the matched term.
 */
const DISQUALIFYING_PRODUCT_KEYWORDS = [
  // Holiday confections that contain food keywords as decoration ("Huevo de
  // Pascua" → not eggs; "Pan dulce" → not bread)
  'pascua',
  'pascuas',
  'navidad',
  'pan dulce',
  // Bakery / candy formats
  'alfajor',
  'alfajores',
  'bombon',
  'bombones',
  'galletita',
  'galletitas',
  'torta',
  'tortas',
  'turron',
  'turrones',
  // Chocolate is essentially a confection in our seed catalog (we don't
  // model raw cacao). Anything labelled "chocolate" pulls a real food's
  // name into a candy context — drop the match.
  'chocolate',
  'chocolatado',
  'chocolatada',
];

// Characters that count as a word boundary on either side of a matched
// term. Lowercased space already covers the common case; the rest catch
// names like "Pollo, fresco" or "Pan-Integral".
const BOUNDARY_REGEX = /[\s.,;:!?()/\\\-_]/;

interface IndexedTerm {
  food_id: string;
  term: string;
}

export function matchToFood(productName: string, foods: FoodLite[]): MatchResult | null {
  const normalized = normalize(productName);
  if (!normalized) return null;
  if (containsDisqualifier(normalized)) return null;

  const sortedTerms = buildSortedTerms(foods);

  for (const { food_id, term } of sortedTerms) {
    const normalizedTerm = normalize(term);
    if (!normalizedTerm) continue;

    // Walk every occurrence of `term` so a guard on one occurrence doesn't
    // hide a legitimate match later in the same string.
    let searchFrom = 0;
    while (searchFrom <= normalized.length) {
      const idx = normalized.indexOf(normalizedTerm, searchFrom);
      if (idx === -1) break;
      const endIdx = idx + normalizedTerm.length;
      if (
        isWordBoundedAt(normalized, idx, endIdx) &&
        !isPrecededByCue(normalized, idx, NEGATION_CUES) &&
        !isPrecededByCue(normalized, idx, CATEGORY_DRIFT_CUES)
      ) {
        return { food_id, confidence: 1.0 };
      }
      searchFrom = idx + 1;
    }
  }
  return null;
}

/** True when ANY disqualifying confection/bakery keyword is present
 *  anywhere in the (already-normalized) product name. Token-bounded so
 *  "tortas" doesn't trigger on "tortilla". */
function containsDisqualifier(normalized: string): boolean {
  const padded = ` ${normalized} `;
  for (const kw of DISQUALIFYING_PRODUCT_KEYWORDS) {
    if (padded.includes(` ${kw} `) || padded.includes(` ${kw}.`)) return true;
  }
  return false;
}

/** True when the matched term is surrounded by whitespace, punctuation, or
 *  the string edges — i.e. it's a whole word, not a substring of a longer
 *  word. Prevents "azucar" matching "azucarado" or "manz" matching "manzana".
 */
function isWordBoundedAt(haystack: string, start: number, end: number): boolean {
  if (start > 0) {
    const before = haystack[start - 1]!;
    if (!BOUNDARY_REGEX.test(before)) return false;
  }
  if (end < haystack.length) {
    const after = haystack[end]!;
    if (!BOUNDARY_REGEX.test(after)) return false;
  }
  return true;
}

/** True when `haystack[matchIndex...]` is preceded by any of `cues` (with at
 *  most one whitespace separator). Cues are matched as full tokens (the
 *  character before the cue must be whitespace or string start). */
function isPrecededByCue(haystack: string, matchIndex: number, cues: string[]): boolean {
  let scanEnd = matchIndex;
  if (scanEnd > 0 && haystack[scanEnd - 1] === ' ') scanEnd -= 1;
  const before = haystack.slice(0, scanEnd);

  for (const cue of cues) {
    if (!before.endsWith(cue)) continue;
    const cueStart = before.length - cue.length;
    if (cueStart === 0) return true;
    const charBeforeCue = before[cueStart - 1];
    if (charBeforeCue === ' ') return true;
  }
  return false;
}

/**
 * Flatten foods into (food_id, term) pairs sorted by TERM length descending.
 *
 * Sorting per-term (not per-food's max term) is important: `Maní` has
 * "cacahuete" as a 9-char synonym, but if the actual matching term is
 * "mani" (4 chars), it shouldn't outrank a 5-char term from another food.
 * Per-term sort keeps each individual term's priority honest.
 */
export function sortFoodsBySpecificity(foods: FoodLite[]): FoodLite[] {
  // Kept for backwards compatibility — `matchToFood` re-sorts internally.
  return [...foods].sort((a, b) => maxTermLength(b) - maxTermLength(a));
}

function buildSortedTerms(foods: FoodLite[]): IndexedTerm[] {
  const out: IndexedTerm[] = [];
  for (const food of foods) {
    if (!food.search_terms) continue;
    for (const term of food.search_terms) {
      if (term) out.push({ food_id: food.id, term });
    }
  }
  out.sort((a, b) => b.term.length - a.term.length);
  return out;
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
