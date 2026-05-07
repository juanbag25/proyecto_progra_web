import type { Candidate } from './types';

/**
 * Per-food weekly grams cap. The optimizer uses this to bound how much of
 * any single canonical food (foods.id) it can pile into one week's list.
 *
 * Why per-food (not per-SKU): without it, the greedy can pick two SKUs of
 * the same food (e.g. atún Marolio + atún La Campagnola) and bypass the
 * SKU cap by splitting volume across them. The food cap binds across all
 * SKUs sharing a foods.id.
 *
 * Why two layers (slug overrides + category defaults):
 *   - "What's a sensible weekly amount" varies wildly inside a category.
 *     `protein_animal` covers pollo (where 2 kg/wk is normal for a heavy
 *     lifter) and atún en lata (where 5 cans/wk is already a lot of
 *     mercury + sodium).
 *   - But maintaining a per-slug entry for every food is brittle and most
 *     foods are well-served by a category-level default. So: explicit
 *     overrides for the outliers, category defaults for the rest.
 *
 * The numbers below are coarse opinions, not nutrition science. Tune as
 * the optimizer's outputs evolve. They're encoded as grams/week (raw
 * weight as the package shows it — dry pasta dry, raw chicken raw).
 *
 * Lookup order:
 *   1. MAX_GRAMS_BY_SLUG[c.slug]    — explicit override (strongest)
 *   2. MAX_GRAMS_BY_CATEGORY[c.cat] — category default
 *   3. DEFAULT_MAX_GRAMS_PER_FOOD   — final fallback (defensive)
 */

/** Defaults by foods.category. Pick the value that fits the *typical* food
 *  in the category, then list the outliers in MAX_GRAMS_BY_SLUG. */
const MAX_GRAMS_BY_CATEGORY: Record<string, number> = {
  // Animal protein: typical is "pollo / merluza" — heavy-lifter sized.
  // Outliers (atún en lata, jamones, salmón) live in MAX_GRAMS_BY_SLUG.
  protein_animal: 2000,
  // Vegetal protein (tofu): substantial portion but not main staple yet.
  protein_vegetal: 1000,
  // Legumbres (secas, antes de cocinar): 1.5 kg seca rinde mucho cocinada.
  legume: 1500,
  // Lácteos genéricos. Leche tiene su override (mucho más alto).
  dairy: 2000,
  // Cereales/pan: la base de carbos en la dieta AR. Pasta y arroz mucho.
  carbs_grain: 2000,
  // Tubérculos (papa/batata): rinden mucho cocidos, cap generoso.
  carbs_tuber: 3000,
  // Aceites: a 50 ml/día (~50 g) son 350 g/sem. No se chupa aceite.
  fats_oil: 350,
  // Frutos secos: 1 puñado/día ≈ 30 g, 350 g/sem es alto pero sano.
  fats_nuts: 350,
  // Verduras / frutas: la OMS recomienda 400 g/día. Tope holgado.
  vegetable: 2500,
  fruit: 2500,
  // Condimentos (azúcar etc.): la OMS sugiere <50 g azúcar/día.
  condiment: 200,
  // Bebidas (yerba): un mate/día rinde ~50 g de yerba.
  beverage: 200,
};

/** Slug-level overrides for foods that don't fit their category default.
 *  These come first in the lookup; if a slug isn't here we fall back to
 *  the category. Keep additions narrow — "this food is unusually heavy/
 *  light to eat weekly" is the bar. */
const MAX_GRAMS_BY_SLUG: Record<string, number> = {
  // protein_animal — bajos por mercurio, sodio, procesamiento, costo
  atun_lata: 500, // ~5 latas chicas — atún concentra mercurio
  salmon: 1000, // caro y omega3, 1 kg/sem alcanza
  jamon_cocido: 600, // procesado + sodio
  jamon_crudo: 400, // más procesado, sodio muy alto
  carne_magra: 1500, // carne roja: cap más bajo por salud cardiovascular
  carne_molida: 1500, // ídem
  huevo: 1500, // ~25 huevos/sem (4/día) ya es bastante

  // dairy — leche aparte, quesos más restringidos
  leche_entera: 3500, // 500 ml/día razonable
  leche_descremada: 3500,
  queso_fresco: 800, // ~115 g/día, 4-5 fetas
  queso_duro: 400, // queso fuerte se come en menos cantidad
  ricota: 1000,

  // carbs_grain — porciones más realistas para granos vs pasta/arroz
  avena: 700, // ~100 g/día = 1 plato
  fideos: 1500, // ~215 g sec/día razonable
  polenta: 800,

  // fruit — palta es densa en grasas, tope más bajo
  palta: 1000, // ~140 g/día = 1 paltita
};

/** Used when neither slug nor category match. Defensive — should not
 *  trigger in production because every seeded food has both populated. */
const DEFAULT_MAX_GRAMS_PER_FOOD = 1000;

export function maxGramsForCandidate(c: Candidate): number {
  if (c.slug) {
    const slugCap = MAX_GRAMS_BY_SLUG[c.slug];
    if (slugCap !== undefined) return slugCap;
  }
  const categoryCap = MAX_GRAMS_BY_CATEGORY[c.category];
  if (categoryCap !== undefined) return categoryCap;
  return DEFAULT_MAX_GRAMS_PER_FOOD;
}
